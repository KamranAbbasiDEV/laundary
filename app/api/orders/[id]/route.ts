import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { canTransition } from '@/lib/workflow';
import type { OrderStatus } from '@/lib/types';

const statusSchema = z.enum(['Created', 'Validated', 'Processor ranked', 'Capacity confirmed', 'Pickup scheduled', 'Picked up', 'At processor', 'Processing', 'Ready for pickup', 'Picked up from processor', 'QC / Reconciliation', 'Out for delivery', 'Delivered', 'Processor reviewed']);
const bodySchema = z.object({ status: statusSchema.optional(), exception: z.string().trim().min(1).max(1000).optional(), note: z.string().trim().max(1000).optional() });
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
    ? supabase.from('orders').select('id,status,assigned_driver_id,processor_id').eq('id', id).maybeSingle()
    : supabase.from('orders').select('id,status,assigned_driver_id,processor_id').eq('order_number', id).maybeSingle();
  const { data: current, error: readError } = await currentQuery;
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (actor.role === 'driver' && current.assigned_driver_id !== user.id) return NextResponse.json({ error: 'You can only update orders assigned to you.' }, { status: 403 });
  if (actor.role === 'processor' && current.processor_id !== actor.processor_id) return NextResponse.json({ error: 'You can only update orders assigned to your processor.' }, { status: 403 });
  const currentDisplay = displayStatus(current.status);
  const allowedByRole: Record<string, OrderStatus[]> = {
    driver: ['Picked up','At processor','Picked up from processor','QC / Reconciliation','Delivered'],
    processor: ['Processing','Ready for pickup']
  };
  if (body.data.status && allowedByRole[actor.role] && !allowedByRole[actor.role].includes(body.data.status)) return NextResponse.json({ error: 'Your role cannot perform this transition.' }, { status: 403 });
  if (body.data.status && !canTransition(currentDisplay, body.data.status)) return NextResponse.json({ error: `Invalid transition from ${currentDisplay} to ${body.data.status}` }, { status: 409 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.status) update.status = dbStatus(body.data.status);
  if (body.data.exception) update.has_exception = true;
  const { data, error } = await supabase.from('orders').update(update).eq('id', current.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from('order_events').insert({ order_id: current.id, from_status: current.status, to_status: body.data.status ? dbStatus(body.data.status) : current.status, note: body.data.note ?? body.data.exception ?? null });
  return NextResponse.json({ order: data, persistence: 'supabase' });
}
