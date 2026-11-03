import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { pickupDeadlineError } from '@/lib/order-scheduling';

const decisionSchema = z.object({ orderId: z.string().uuid(), action: z.enum(['approve', 'request_changes']), reason: z.string().trim().min(3).max(1000).optional() }).superRefine((value, context) => {
  if (value.action === 'request_changes' && !value.reason) context.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Explain what must be corrected.' });
});

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const { data, error } = await auth.client.from('orders').select('id,order_number,customer_name,phone,pickup_address,customer_delivery_address,service_type,expected_bags,due_at_label,due_at,pickup_window_start_at,pickup_window_end_at,delivery_window_start_at,delivery_window_end_at,notes,created_at,validation_reason').or('validation_state.eq.manual_review,status.eq.created').in('status', ['created', 'validated']).is('archived_at', null).order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const orders = (data ?? []).map(order => ({ ...order, due_at_label: [order.due_at_label ?? '', order.due_at ? `deadline ${new Date(order.due_at).toLocaleString()}` : ''].filter(Boolean).join(' · ') }));
  return NextResponse.json({ orders });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid validation decision.' }, { status: 400 });
  const item = parsed.data;
  const { data: order, error: orderError } = await auth.client.from('orders').select('id,status,validation_state,customer_account_id,customer_name,phone,pickup_address,customer_delivery_address,service_type,expected_bags,due_at,pickup_window_start_at,pickup_window_end_at,delivery_window_start_at,delivery_window_end_at').eq('id', item.orderId).or('validation_state.eq.manual_review,status.eq.created').in('status', ['created', 'validated']).maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'This order is no longer awaiting validation.' }, { status: 409 });
  if (item.action === 'request_changes') {
    const { error } = await auth.client.from('orders').update({ validation_reason: item.reason, updated_at: new Date().toISOString() }).eq('id', order.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { error: eventError } = await auth.client.from('order_events').insert({ order_id: order.id, from_status: order.status, to_status: order.status, actor_id: auth.user.id, note: `Intake held for correction: ${item.reason}` });
    if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 });
    return NextResponse.json({ reviewRequired: true });
  }

  const requiredValues = [order.customer_account_id, order.customer_name, order.phone, order.pickup_address, order.customer_delivery_address, order.service_type, order.expected_bags, order.due_at, order.pickup_window_start_at, order.pickup_window_end_at, order.delivery_window_start_at, order.delivery_window_end_at];
  if (requiredValues.some(value => value === null || value === undefined || value === '')) return NextResponse.json({ error: 'This intake is missing its CRM account, addresses, services, bag count, or pickup/delivery windows. Hold it for correction before matching.' }, { status: 409 });
  const scheduleError = pickupDeadlineError({ pickupStartAt: order.pickup_window_start_at, pickupEndAt: order.pickup_window_end_at, deadlineAt: order.due_at });
  if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 409 });
  if (new Date(order.delivery_window_end_at).getTime() <= new Date(order.delivery_window_start_at).getTime() || new Date(order.delivery_window_start_at).getTime() <= new Date(order.pickup_window_end_at).getTime()) return NextResponse.json({ error: 'Correct the pickup and delivery windows before matching this order.' }, { status: 409 });

  const { error: validationError } = await auth.client.rpc('validate_order_for_matching', { p_order_id: order.id });
  if (validationError) return NextResponse.json({ error: validationError.message }, { status: 409 });
  return NextResponse.json({ validated: true, matchingRequired: true, orderId: order.id });
}
