import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/api-auth';
import { canTransition } from '@/lib/workflow';
import type { OrderStatus } from '@/lib/types';
import { blockActiveRouteStatusChange, syncDraftRoutesAfterStatusChange } from '@/lib/route-consistency';

const statuses = ['Created', 'Validated', 'Processor ranked', 'Capacity confirmed', 'Pickup scheduled', 'Picked up', 'At processor', 'Processing', 'Ready for pickup', 'Picked up from processor', 'QC / Reconciliation', 'Out for delivery', 'Delivered', 'Processor reviewed'] as const;
const toDatabaseStatus = (value: OrderStatus) => ({ Created: 'created', Validated: 'validated', 'Processor ranked': 'processor_ranked', 'Capacity confirmed': 'capacity_confirmed', 'Pickup scheduled': 'pickup_scheduled', 'Picked up': 'picked_up', 'At processor': 'at_processor', Processing: 'processing', 'Ready for pickup': 'ready_for_pickup', 'Picked up from processor': 'picked_up_from_processor', 'QC / Reconciliation': 'qc_reconciliation', 'Out for delivery': 'out_for_delivery', Delivered: 'delivered', 'Processor reviewed': 'processor_reviewed' } as Record<OrderStatus, string>)[value];
const toDisplayStatus = (value: string) => ({ created: 'Created', validated: 'Validated', processor_ranked: 'Processor ranked', capacity_confirmed: 'Capacity confirmed', pickup_scheduled: 'Pickup scheduled', picked_up: 'Picked up', at_processor: 'At processor', processing: 'Processing', ready_for_pickup: 'Ready for pickup', picked_up_from_processor: 'Picked up from processor', qc_reconciliation: 'QC / Reconciliation', out_for_delivery: 'Out for delivery', delivered: 'Delivered', processor_reviewed: 'Processor reviewed' } as Record<string, OrderStatus>)[value];

const payloadSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['set_status', 'record_exception', 'resolve_exception', 'archive', 'restore']),
  status: z.enum(statuses).optional(),
  reason: z.string().trim().min(3).max(1000).optional()
}).superRefine((value, context) => {
  if (value.action === 'set_status' && !value.status) context.addIssue({ code: 'custom', message: 'Choose a status.' });
  if ((value.action === 'set_status' || value.action === 'record_exception') && !value.reason) context.addIssue({ code: 'custom', message: 'A reason is required.' });
});

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid bulk update.', details: parsed.error.flatten() }, { status: 400 });
  const payload = parsed.data;
  const { data: orders, error: readError } = await auth.client.from('orders').select('id,order_number,status,processor_id,assigned_driver_id').in('id', payload.orderIds);
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!orders || orders.length !== payload.orderIds.length) return NextResponse.json({ error: 'One or more orders no longer exist.' }, { status: 404 });

  const role = auth.profile.role;
  if (role === 'customer') return NextResponse.json({ error: 'Customers cannot bulk-manage operational orders.' }, { status: 403 });
  if (role === 'driver') return NextResponse.json({ error: 'Driver handoffs must be completed one stop at a time with required evidence.' }, { status: 403 });
  if (payload.action === 'set_status' && role === 'dispatcher') return NextResponse.json({ error: 'Dispatchers cannot change order status.' }, { status: 403 });
  if (['archive', 'restore'].includes(payload.action) && role !== 'super_admin') return NextResponse.json({ error: 'Only Super Admin can archive or restore orders.' }, { status: 403 });
  if (role === 'processor' && orders.some(order => order.processor_id !== auth.profile.processor_id)) return NextResponse.json({ error: 'You can only update your facility\'s orders.' }, { status: 403 });
  if (role === 'processor' && (payload.action !== 'set_status' || !payload.status || !['Processing', 'Ready for pickup'].includes(payload.status))) return NextResponse.json({ error: 'Processors can bulk-start work or mark work ready only.' }, { status: 403 });
  if (payload.action === 'set_status' && role !== 'super_admin' && orders.some(order => !canTransition(toDisplayStatus(order.status), payload.status!))) {
    return NextResponse.json({ error: 'Every selected order must be eligible for that next action.' }, { status: 409 });
  }
  if (payload.action === 'set_status') {
    const routeBlock = await blockActiveRouteStatusChange(auth.client, payload.orderIds, role);
    if (routeBlock) return NextResponse.json({ error: routeBlock.error }, { status: routeBlock.status });
  }
  if (payload.action === 'record_exception') {
    const { data: affectedOrders } = await auth.client.from('orders').select('id,due_at').in('id', payload.orderIds);
    const { error: exceptionError } = await auth.client.from('exceptions').insert((affectedOrders ?? []).map(order => ({ order_id: order.id, type: 'route_issue', stage: 'route', description: payload.reason!, severity: 'medium', deadline_impact: order.due_at ? 'at_risk' : 'none', deadline_before: order.due_at, opened_by: auth.user.id, status: 'open' })));
    if (exceptionError) return NextResponse.json({ error: exceptionError.message }, { status: 500 });
  }
  if (payload.action === 'resolve_exception') {
    const { error: exceptionError } = await auth.client.from('exceptions').update({ status: 'resolved', resolution_notes: payload.reason || 'Resolved by dispatch.', resolved_at: new Date().toISOString(), resolved_by: auth.user.id }).in('order_id', payload.orderIds).neq('status', 'resolved');
    if (exceptionError) return NextResponse.json({ error: exceptionError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const update = payload.action === 'set_status' ? { status: toDatabaseStatus(payload.status!), updated_at: now } : payload.action === 'record_exception' ? { has_exception: true, updated_at: now } : payload.action === 'resolve_exception' ? { has_exception: false, updated_at: now } : payload.action === 'archive' ? { archived_at: now, archived_by: auth.user.id, updated_at: now } : { archived_at: null, archived_by: null, updated_at: now };
  const { error: updateError } = await auth.client.from('orders').update(update).in('id', payload.orderIds);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (payload.action === 'resolve_exception') {
    await Promise.all(payload.orderIds.map(async (orderId) => {
      const { count } = await auth.client.from('exceptions').select('id', { count: 'exact', head: true }).eq('order_id', orderId).neq('status', 'resolved');
      await auth.client.from('orders').update({ has_exception: Boolean(count), updated_at: now }).eq('id', orderId);
    }));
  }

  const events = orders.map(order => ({
    order_id: order.id,
    from_status: order.status,
    to_status: payload.action === 'set_status' ? toDatabaseStatus(payload.status!) : order.status,
    actor_id: auth.user.id,
    note: payload.action === 'set_status' ? `Bulk ${role === 'super_admin' ? 'administrator override' : 'workflow action'}: ${payload.reason}` : payload.action === 'record_exception' ? `Bulk exception recorded: ${payload.reason}` : payload.action === 'resolve_exception' ? 'Bulk exception resolved' : `Bulk ${payload.action}: ${payload.reason || 'Administrator action'}`
  }));
  const { error: eventError } = await auth.client.from('order_events').insert(events);
  if (eventError) return NextResponse.json({ error: `Orders updated, but audit logging failed: ${eventError.message}` }, { status: 500 });
  const routeSync = payload.action === 'set_status'
    ? await syncDraftRoutesAfterStatusChange(auth.client, new Map(payload.orderIds.map(id => [id, toDatabaseStatus(payload.status!)])))
    : { invalidated: 0, warning: null };
  return NextResponse.json({ updated: orders.length, routeSync: { invalidated: routeSync.invalidated }, ...(routeSync.warning ? { warning: routeSync.warning } : {}) });
}
