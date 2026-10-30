import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { logOperationalNotification } from '@/lib/notifications';

const checkInSchema = z.object({ orderId: z.string().uuid(), routeStopId: z.string().uuid().optional() });
const failureSchema = z.object({ orderId: z.string().uuid(), reason: z.string().min(3).max(1000) });

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['driver'])) return NextResponse.json({ error: 'Driver access required.' }, { status: 403 });
  const parsed = checkInSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid assigned order is required.' }, { status: 400 });
  const { data: checkedInAt, error } = await auth.client.rpc('check_in_route_stop', { p_order_id: parsed.data.orderId, p_stop_id: parsed.data.routeStopId ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ checkedInAt });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['driver'])) return NextResponse.json({ error: 'Driver access required.' }, { status: 403 });
  const parsed = failureSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid assigned order and reason are required.' }, { status: 400 });
  const { error } = await auth.client.rpc('fail_route_stop', { p_order_id: parsed.data.orderId, p_reason: parsed.data.reason });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  const { data: failedOrder } = await auth.client.from('orders').select('order_number,phone,due_at').eq('id', parsed.data.orderId).single();
  await logOperationalNotification({ orderId: parsed.data.orderId, event: 'exception_recorded', message: `${failedOrder?.order_number ?? 'Order'} route stop failed and requires review: ${parsed.data.reason}.${failedOrder?.due_at ? ` Deadline: ${new Date(failedOrder.due_at).toLocaleString()}.` : ''}`, phone: failedOrder?.phone }, auth.client);
  return NextResponse.json({ failed: true });
}
