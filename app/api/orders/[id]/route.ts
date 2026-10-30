import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';
import { canTransition } from '@/lib/workflow';
import type { OrderStatus } from '@/lib/types';
import { logCustomerNotification, logOperationalNotification } from '@/lib/notifications';
import { blockActiveRouteStatusChange, syncDraftRoutesAfterStatusChange } from '@/lib/route-consistency';
import { pickupDeadlineError } from '@/lib/order-scheduling';
import { serviceIsConfigured } from '@/lib/service-catalog';

const statusSchema = z.enum(['Created', 'Validated', 'Processor ranked', 'Capacity confirmed', 'Pickup scheduled', 'Picked up', 'At processor', 'Processing', 'Ready for pickup', 'Picked up from processor', 'QC / Reconciliation', 'Out for delivery', 'Delivered', 'Processor reviewed']);
const bodySchema = z.object({ status: statusSchema.optional(), exception: z.string().trim().min(1).max(1000).optional(), resolveException: z.boolean().optional(), note: z.string().trim().max(1000).optional(), deadlineImpact: z.enum(['none','at_risk','delayed']).optional(), customerMessage: z.string().trim().max(1000).optional(), notifyCustomer: z.boolean().optional(), deadlineReason: z.string().trim().max(1000).optional(), customer: z.string().trim().min(2).max(160).optional(), phone: z.string().trim().min(7).max(40).optional(), address: z.string().trim().min(5).max(500).optional(), service: z.string().trim().min(1).max(120).optional(), bags: z.number().int().positive().optional(), due: z.string().trim().max(160).optional(), dueAt: z.string().datetime({ offset: true }).nullable().optional(), originalDueAt: z.string().datetime({ offset: true }).nullable().optional(), notes: z.string().trim().max(2000).nullable().optional() });
const displayStatus = (value: string): OrderStatus => ({
  created:'Created',validated:'Validated',processor_ranked:'Processor ranked',capacity_confirmed:'Capacity confirmed',pickup_scheduled:'Pickup scheduled',picked_up:'Picked up',at_processor:'At processor',processing:'Processing',ready_for_pickup:'Ready for pickup',picked_up_from_processor:'Picked up from processor',qc_reconciliation:'QC / Reconciliation',out_for_delivery:'Out for delivery',delivered:'Delivered',processor_reviewed:'Processor reviewed'
} as Record<string, OrderStatus>)[value] ?? value as OrderStatus;
const dbStatus = (value: string) => ({
  'Created':'created','Validated':'validated','Processor ranked':'processor_ranked','Capacity confirmed':'capacity_confirmed','Pickup scheduled':'pickup_scheduled','Picked up':'picked_up','At processor':'at_processor','Processing':'processing','Ready for pickup':'ready_for_pickup','Picked up from processor':'picked_up_from_processor','QC / Reconciliation':'qc_reconciliation','Out for delivery':'out_for_delivery','Delivered':'delivered','Processor reviewed':'processor_reviewed'
} as Record<string, string>)[value] ?? value.toLowerCase().replaceAll(' ', '_');
const physicalDriverStatuses = new Set<OrderStatus>(['Picked up', 'At processor', 'Picked up from processor', 'Delivered']);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const isUuid = z.string().uuid().safeParse(id).success;
  if (!isUuid && !/^RL-\d{6}$/i.test(id)) return NextResponse.json({ error: 'Invalid order identifier' }, { status: 400 });
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data: { user } } = await getUserSafely(supabase);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data: actor } = await supabase.from('profiles').select('role,status,processor_id,driver_id').eq('id', user.id).single();
  if (!actor || actor.status !== 'active' || !['super_admin','dispatcher','driver','processor'].includes(actor.role)) return NextResponse.json({ error: 'Operations access required' }, { status: 403 });

  const currentQuery = isUuid
    ? supabase.from('orders').select('id,order_number,phone,customer_user_id,status,assigned_driver_id,processor_id,service_type,due_at,original_due_at,pickup_window_start_at,pickup_window_end_at').eq('id', id).maybeSingle()
    : supabase.from('orders').select('id,order_number,phone,customer_user_id,status,assigned_driver_id,processor_id,service_type,due_at,original_due_at,pickup_window_start_at,pickup_window_end_at').eq('order_number', id).maybeSingle();
  const { data: current, error: readError } = await currentQuery;
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (actor.role === 'driver' && current.assigned_driver_id !== user.id) return NextResponse.json({ error: 'You can only update orders assigned to you.' }, { status: 403 });
  if (actor.role === 'processor' && current.processor_id !== actor.processor_id) return NextResponse.json({ error: 'You can only update orders assigned to your processor.' }, { status: 403 });
  if (body.data.resolveException && !['super_admin', 'dispatcher'].includes(actor.role)) return NextResponse.json({ error: 'Only dispatch can resolve an exception.' }, { status: 403 });
  if ((body.data.deadlineImpact || body.data.customerMessage || body.data.notifyCustomer) && !['super_admin', 'dispatcher'].includes(actor.role)) return NextResponse.json({ error: 'Only dispatch can manage customer deadline updates.' }, { status: 403 });
  const isOrderEdit = body.data.customer !== undefined || body.data.phone !== undefined || body.data.address !== undefined || body.data.service !== undefined || body.data.bags !== undefined || body.data.due !== undefined || body.data.dueAt !== undefined || body.data.originalDueAt !== undefined || body.data.notes !== undefined;
  if (isOrderEdit && !['super_admin', 'dispatcher'].includes(actor.role)) return NextResponse.json({ error: 'Only dispatch can edit order details.' }, { status: 403 });
  if (isOrderEdit && ['delivered', 'processor_reviewed'].includes(current.status)) return NextResponse.json({ error: 'Completed orders are historical records and cannot be edited.' }, { status: 409 });
  const currentDisplay = displayStatus(current.status);
  const allowedByRole: Record<string, OrderStatus[]> = {
    driver: ['Picked up','At processor','Picked up from processor','QC / Reconciliation','Out for delivery','Delivered'],
    processor: ['Processing','Ready for pickup']
  };
  if (body.data.status && actor.role === 'dispatcher') return NextResponse.json({ error: 'Dispatchers cannot change order status.' }, { status: 403 });
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
  if (body.data.status) {
    const routeBlock = await blockActiveRouteStatusChange(supabase, [current.id], actor.role);
    if (routeBlock) return NextResponse.json({ error: routeBlock.error }, { status: routeBlock.status });
  }
  if (body.data.service !== undefined) {
    const { data: workspaceSettings, error: settingsError } = await supabase.from('workspace_settings').select('services').eq('id', 'default').maybeSingle();
    if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 });
    if (!serviceIsConfigured(body.data.service, workspaceSettings?.services)) return NextResponse.json({ error: 'Choose a service from the active workspace service catalog.' }, { status: 400 });
  }
  const pickupError = pickupDeadlineError({ pickupStartAt: current.pickup_window_start_at, pickupEndAt: current.pickup_window_end_at, deadlineAt: body.data.dueAt ?? current.due_at });
  if (pickupError) return NextResponse.json({ error: pickupError }, { status: 400 });

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
  if (body.data.dueAt !== undefined) update.due_at = body.data.dueAt;
  if (body.data.notes !== undefined) update.notes = body.data.notes;
  if (body.data.customerMessage !== undefined) update.customer_exception_message = body.data.customerMessage || null;
  if (body.data.notifyCustomer && body.data.customerMessage?.trim()) update.customer_exception_notified_at = new Date().toISOString();
  if (body.data.originalDueAt !== undefined) update.original_due_at = body.data.originalDueAt;
  if (body.data.dueAt !== undefined && body.data.dueAt !== current.due_at) { if (body.data.originalDueAt === undefined) update.original_due_at = current.original_due_at ?? current.due_at; update.deadline_revised_at = new Date().toISOString(); update.deadline_revised_by = user.id; update.deadline_revision_reason = body.data.note ?? body.data.exception ?? null; }
  if (body.data.originalDueAt !== undefined || (body.data.dueAt !== undefined && body.data.dueAt !== current.due_at)) update.deadline_revision_reason = body.data.deadlineReason ?? body.data.note ?? body.data.exception ?? null;
  let data;
  if (actor.role === 'driver' && body.data.status && physicalDriverStatuses.has(body.data.status)) {
    const { error: transitionError } = await supabase.rpc('advance_driver_order_stage', { p_order_id: current.id, p_target_status: dbStatus(body.data.status) });
    if (transitionError) return NextResponse.json({ error: transitionError.message }, { status: 409 });
    delete update.status;
    const hasSecondaryUpdate = Object.keys(update).some(key => key !== 'updated_at');
    const result = hasSecondaryUpdate
      ? await supabase.from('orders').update(update).eq('id', current.id).select().single()
      : await supabase.from('orders').select('*').eq('id', current.id).single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    data = result.data;
  } else {
    const result = await supabase.from('orders').update(update).eq('id', current.id).select().single();
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    data = result.data;
  }
  if (body.data.originalDueAt !== undefined || (body.data.dueAt !== undefined && body.data.dueAt !== current.due_at)) {
    const { error: historyError } = await supabase.from('deadline_revisions').insert({
      order_id: current.id,
      previous_original_due_at: current.original_due_at ?? current.due_at,
      original_due_at: body.data.originalDueAt !== undefined ? body.data.originalDueAt : current.original_due_at ?? current.due_at,
      previous_committed_due_at: current.due_at,
      committed_due_at: body.data.dueAt !== undefined ? body.data.dueAt : current.due_at,
      reason: body.data.deadlineReason ?? body.data.note ?? body.data.exception ?? null,
      changed_by: user.id
    });
    if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 });
  }
  if (body.data.exception) {
    const { error: exceptionError } = await supabase.from('exceptions').insert({ order_id: current.id, type: 'route_issue', stage: 'route', description: body.data.exception, severity: 'medium', deadline_impact: body.data.deadlineImpact ?? (current.due_at ? 'at_risk' : 'none'), deadline_before: current.due_at, customer_message: body.data.customerMessage ?? null, opened_by: user.id, status: 'open' });
    if (exceptionError) return NextResponse.json({ error: exceptionError.message }, { status: 500 });
  }
  if (body.data.resolveException) {
    const { error: exceptionError } = await supabase.from('exceptions').update({ status: 'resolved', resolution_notes: body.data.note ?? 'Resolved by dispatch.', resolved_at: new Date().toISOString(), resolved_by: user.id }).eq('order_id', current.id).neq('status', 'resolved');
    if (exceptionError) return NextResponse.json({ error: exceptionError.message }, { status: 500 });
    const { count: openExceptions } = await supabase.from('exceptions').select('id', { count: 'exact', head: true }).eq('order_id', current.id).neq('status', 'resolved');
    if (openExceptions) await supabase.from('orders').update({ has_exception: true, updated_at: new Date().toISOString() }).eq('id', current.id);
  }
  await supabase.from('order_events').insert({ order_id: current.id, from_status: current.status, to_status: body.data.status ? dbStatus(body.data.status) : current.status, note: body.data.note ?? body.data.exception ?? (body.data.resolveException ? 'Exception resolved by dispatch' : null) });
  const deadlinesChanged = body.data.originalDueAt !== undefined || (body.data.dueAt !== undefined && body.data.dueAt !== current.due_at);
  const event = body.data.resolveException ? 'exception_resolved' : body.data.exception ? 'exception_recorded' : deadlinesChanged ? 'deadline_updated' : body.data.status ? `order_${dbStatus(body.data.status)}` : 'order_updated';
  const deadline = body.data.dueAt !== undefined ? body.data.dueAt : current.due_at;
  const deadlineText = deadline ? ` Deadline: ${new Date(deadline).toLocaleString()}.` : '';
  const originalDeadline = body.data.originalDueAt !== undefined ? body.data.originalDueAt : current.original_due_at;
  const originalText = originalDeadline ? ` Original commitment: ${new Date(originalDeadline).toLocaleString()}.` : '';
  const message = body.data.resolveException ? `${current.order_number} exception resolved by dispatch.${deadlineText}` : body.data.exception ? `${current.order_number} requires dispatcher review: ${body.data.exception}.${deadlineText}` : deadlinesChanged ? `${current.order_number} deadline was updated by dispatch.${originalText}${deadlineText}` : body.data.status ? `${current.order_number} is now ${body.data.status}.${deadlineText}` : `${current.order_number} was updated.${deadlineText}`;
  await logOperationalNotification({ orderId: current.id, event, message, phone: current.phone }, supabase);
  if (body.data.notifyCustomer && body.data.customerMessage?.trim()) await logCustomerNotification({ orderId: current.id, event: 'customer_exception_update', message: body.data.customerMessage.trim(), phone: current.phone, customerUserId: current.customer_user_id }, supabase);
  else if (current.customer_user_id && (body.data.status || body.data.exception || body.data.resolveException || deadlinesChanged)) await logCustomerNotification({ orderId: current.id, event, message, phone: current.phone, customerUserId: current.customer_user_id }, supabase);
  const routeSync = body.data.status ? await syncDraftRoutesAfterStatusChange(supabase, new Map([[current.id, dbStatus(body.data.status)]])) : { invalidated: 0, warning: null };
  return NextResponse.json({ order: data, persistence: 'supabase', routeSync: { invalidated: routeSync.invalidated }, ...(routeSync.warning ? { warning: routeSync.warning } : {}) });
}
