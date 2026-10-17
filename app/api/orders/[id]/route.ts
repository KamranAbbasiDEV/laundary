import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { canTransition } from '@/lib/workflow';
import type { OrderStatus } from '@/lib/types';
import { logOperationalNotification } from '@/lib/notifications';

const statusSchema = z.enum(['Created', 'Validated', 'Processor ranked', 'Capacity confirmed', 'Pickup scheduled', 'Picked up', 'At processor', 'Processing', 'Ready for pickup', 'Picked up from processor', 'QC / Reconciliation', 'Out for delivery', 'Delivered', 'Processor reviewed']);
const bodySchema = z.object({ status: statusSchema.optional(), exception: z.string().trim().min(1).max(1000).optional(), resolveException: z.boolean().optional(), note: z.string().trim().max(1000).optional(), customer: z.string().trim().min(2).max(160).optional(), phone: z.string().trim().min(7).max(40).optional(), address: z.string().trim().min(5).max(500).optional(), service: z.string().trim().min(1).max(120).optional(), bags: z.number().int().positive().optional(), due: z.string().trim().max(160).optional(), notes: z.string().trim().max(2000).nullable().optional() });
const displayStatus = (value: string): OrderStatus => ({
  created:'Created',validated:'Validated',processor_ranked:'Processor ranked',capacity_confirmed:'Capacity confirmed',pickup_scheduled:'Pickup scheduled',picked_up:'Picked up',at_processor:'At processor',processing:'Processing',ready_for_pickup:'Ready for pickup',picked_up_from_processor:'Picked up from processor',qc_reconciliation:'QC / Reconciliation',out_for_delivery:'Out for delivery',delivered:'Delivered',processor_reviewed:'Processor reviewed'
} as Record<string, OrderStatus>)[value] ?? value as OrderStatus;
const dbStatus = (value: string) => ({
  'Created':'created','Validated':'validated','Processor ranked':'processor_ranked','Capacity confirmed':'capacity_confirmed','Pickup scheduled':'pickup_scheduled','Picked up':'picked_up','At processor':'at_processor','Processing':'processing','Ready for pickup':'ready_for_pickup','Picked up from processor':'picked_up_from_processor','QC / Reconciliation':'qc_reconciliation','Out for delivery':'out_for_delivery','Delivered':'delivered','Processor reviewed':'processor_reviewed'
} as Record<string, string>)[value] ?? value.toLowerCase().replaceAll(' ', '_');

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const isUuid = z.string().uuid().safeParse(id).success;
  if (!isUuid && !/^RL-\d{6}$/i.test(id)) return NextResponse.json({ error: 'Invalid order identifier' }, { status: 400 });
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: actor } = await supabase.from('profiles').select('role,status,processor_id,driver_id').eq('id', user.id).single();
  if (!actor || actor.status !== 'active' || !['super_admin','dispatcher','driver','processor'].includes(actor.role)) return NextResponse.json({ error: 'Operations access required' }, { status: 403 });

  const currentQuery = isUuid
    ? supabase.from('orders').select('id,order_number,phone,status,assigned_driver_id,processor_id').eq('id', id).maybeSingle()
    : supabase.from('orders').select('id,order_number,phone,status,assigned_driver_id,processor_id').eq('order_number', id).maybeSingle();
  const { data: current, error: readError } = await currentQuery;
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (actor.role === 'driver' && current.assigned_driver_id !== user.id) return NextResponse.json({ error: 'You can only update orders assigned to you.' }, { status: 403 });
  if (actor.role === 'processor' && current.processor_id !== actor.processor_id) return NextResponse.json({ error: 'You can only update orders assigned to your processor.' }, { status: 403 });
  if (body.data.resolveException && !['super_admin', 'dispatcher'].includes(actor.role)) return NextResponse.json({ error: 'Only dispatch can resolve an exception.' }, { status: 403 });
  const isOrderEdit = body.data.customer !== undefined || body.data.phone !== undefined || body.data.address !== undefined || body.data.service !== undefined || body.data.bags !== undefined || body.data.due !== undefined || body.data.notes !== undefined;
  if (isOrderEdit && !['super_admin', 'dispatcher'].includes(actor.role)) return NextResponse.json({ error: 'Only dispatch can edit order details.' }, { status: 403 });
  if (isOrderEdit && ['delivered', 'processor_reviewed'].includes(current.status)) return NextResponse.json({ error: 'Completed orders are historical records and cannot be edited.' }, { status: 409 });
  const currentDisplay = displayStatus(current.status);
  const allowedByRole: Record<string, OrderStatus[]> = {
    driver: ['Picked up','At processor','Picked up from processor','QC / Reconciliation','Out for delivery','Delivered'],
    processor: ['Processing','Ready for pickup']
  };
  if (body.data.status && allowedByRole[actor.role] && !allowedByRole[actor.role].includes(body.data.status)) return NextResponse.json({ error: 'Your role cannot perform this transition.' }, { status: 403 });
  // Super Admin may repair or reconcile any workflow state; every other role remains bound to the normal transition graph.
  if (body.data.status && actor.role !== 'super_admin' && !canTransition(currentDisplay, body.data.status)) return NextResponse.json({ error: `Invalid transition from ${currentDisplay} to ${body.data.status}` }, { status: 409 });
  if (body.data.status === 'Capacity confirmed' && actor.role !== 'super_admin') {
    const { data: acceptedOffer, error: offerError } = await supabase.from('processor_offers').select('id').eq('order_id', current.id).eq('status', 'accepted').maybeSingle();
    if (offerError) return NextResponse.json({ error: offerError.message }, { status: 500 });
    if (!acceptedOffer) return NextResponse.json({ error: 'A processor must accept this order before capacity can be confirmed.' }, { status: 409 });
  }
  if (actor.role === 'driver' && body.data.status) {
    const requiredHandoff: Partial<Record<OrderStatus, string>> = { 'Picked up': 'customer_pickup', 'At processor': 'processor_dropoff', 'Picked up from processor': 'processor_pickup', 'Delivered': 'customer_delivery' };
    const stage = requiredHandoff[body.data.status];
    if (stage) {
      const { data: handoff, error: handoffError } = await supabase.from('order_handoffs').select('id').eq('order_id', current.id).eq('stage', stage).maybeSingle();
      if (handoffError) return NextResponse.json({ error: handoffError.message }, { status: 500 });
      if (!handoff) return NextResponse.json({ error: 'Record the required handoff count before advancing this order.' }, { status: 409 });
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.status) update.status = dbStatus(body.data.status);
  if (body.data.exception) update.has_exception = true;
  if (body.data.resolveException) update.has_exception = false;
  if (body.data.customer !== undefined) update.customer_name = body.data.customer;
  if (body.data.phone !== undefined) update.phone = body.data.phone;
  if (body.data.address !== undefined) update.pickup_address = body.data.address;
  if (body.data.service !== undefined) update.service_type = body.data.service;
  if (body.data.bags !== undefined) update.expected_bags = body.data.bags;
  if (body.data.due !== undefined) update.due_at_label = body.data.due || null;
  if (body.data.notes !== undefined) update.notes = body.data.notes;
  const { data, error } = await supabase.from('orders').update(update).eq('id', current.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('order_events').insert({ order_id: current.id, from_status: current.status, to_status: body.data.status ? dbStatus(body.data.status) : current.status, note: body.data.note ?? body.data.exception ?? (body.data.resolveException ? 'Exception resolved by dispatch' : null) });
  const event = body.data.resolveException ? 'exception_resolved' : body.data.exception ? 'exception_recorded' : body.data.status ? `order_${dbStatus(body.data.status)}` : 'order_updated';
  const message = body.data.resolveException ? `${current.order_number} exception resolved by dispatch.` : body.data.exception ? `${current.order_number} requires dispatcher review: ${body.data.exception}` : body.data.status ? `${current.order_number} is now ${body.data.status}.` : `${current.order_number} was updated.`;
  await logOperationalNotification({ orderId: current.id, event, message, phone: current.phone });
  return NextResponse.json({ order: data, persistence: 'supabase' });
}
