import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { logOperationalNotification } from '@/lib/notifications';

const checkInSchema = z.object({ orderId: z.string().uuid() });
const failureSchema = z.object({ orderId: z.string().uuid(), reason: z.string().min(3).max(1000) });

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['driver'])) return NextResponse.json({ error: 'Driver access required.' }, { status: 403 });
  const parsed = checkInSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid assigned order is required.' }, { status: 400 });
  const { data: stop, error: stopError } = await auth.client.from('route_stops').select('id,checked_in_at,route_id').eq('order_id', parsed.data.orderId).eq('driver_id', auth.user.id).order('route_date', { ascending: false }).limit(1).maybeSingle();
  if (stopError) return NextResponse.json({ error: stopError.message }, { status: 500 });
  if (!stop) return NextResponse.json({ error: 'This order is not assigned to your route.' }, { status: 403 });
  if (stop.checked_in_at) return NextResponse.json({ checkedInAt: stop.checked_in_at, alreadyCheckedIn: true });
  const checkedInAt = new Date().toISOString();
  const { error: updateError } = await auth.client.from('route_stops').update({ checked_in_at: checkedInAt, status: 'arrived' }).eq('id', stop.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (stop.route_id) await auth.client.from('route_plans').update({ status: 'in_progress' }).eq('id', stop.route_id).eq('status', 'approved');
  return NextResponse.json({ checkedInAt });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['driver'])) return NextResponse.json({ error: 'Driver access required.' }, { status: 403 });
  const parsed = failureSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid assigned order and reason are required.' }, { status: 400 });
  const { data: stop, error } = await auth.client.from('route_stops').select('id,route_id').eq('order_id', parsed.data.orderId).eq('driver_id', auth.user.id).order('route_date', { ascending: false }).limit(1).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!stop) return NextResponse.json({ error: 'This order is not assigned to your route.' }, { status: 403 });
  const { error: updateError } = await auth.client.from('route_stops').update({ status: 'failed', failure_reason: parsed.data.reason }).eq('id', stop.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (stop.route_id) await auth.client.from('route_plans').update({ status: 'failed' }).eq('id', stop.route_id);
  await auth.client.from('orders').update({ has_exception: true, updated_at: new Date().toISOString() }).eq('id', parsed.data.orderId);
  const { data: failedOrder } = await auth.client.from('orders').select('order_number,phone,due_at').eq('id', parsed.data.orderId).single();
  const { error: exceptionError } = await auth.client.from('exceptions').insert({ order_id: parsed.data.orderId, type: 'route_issue', stage: 'route', issue_code: 'failed_stop', description: parsed.data.reason, severity: 'high', evidence_required: false, deadline_impact: failedOrder?.due_at ? 'at_risk' : 'none', deadline_before: failedOrder?.due_at ?? null, opened_by: auth.user.id, status: 'open' });
  if (exceptionError) return NextResponse.json({ error: exceptionError.message }, { status: 500 });
  await logOperationalNotification({ orderId: parsed.data.orderId, event: 'exception_recorded', message: `${failedOrder?.order_number ?? 'Order'} route stop failed and requires review: ${parsed.data.reason}.${failedOrder?.due_at ? ` Deadline: ${new Date(failedOrder.due_at).toLocaleString()}.` : ''}`, phone: failedOrder?.phone });
  return NextResponse.json({ failed: true });
}
