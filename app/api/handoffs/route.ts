import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/api-auth';

const handoffSchema = z.object({ orderId: z.string().uuid(), stage: z.enum(['customer_pickup','processor_dropoff','processor_pickup','customer_delivery']), actualBags: z.number().int().nonnegative(), discrepancy: z.string().max(1000).optional(), notes: z.string().max(1000).optional() });

export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const orderId = new URL(request.url).searchParams.get('orderId');
  if (orderId && !z.string().uuid().safeParse(orderId).success) return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 });
  let query = auth.client.from('order_handoffs').select('*').order('created_at');
  if (auth.profile.role === 'driver') {
    const { data: assigned } = await auth.client.from('orders').select('id').eq('assigned_driver_id', auth.user.id);
    const ids = (assigned ?? []).map(order => order.id);
    if (!ids.length) return NextResponse.json({ handoffs: [] });
    query = query.in('order_id', ids);
  }
  if (auth.profile.role === 'processor') {
    if (!auth.profile.processor_id) return NextResponse.json({ handoffs: [] });
    const { data: assigned } = await auth.client.from('orders').select('id').eq('processor_id', auth.profile.processor_id);
    const ids = (assigned ?? []).map(order => order.id);
    if (!ids.length) return NextResponse.json({ handoffs: [] });
    query = query.in('order_id', ids);
  }
  if (orderId) query = query.eq('order_id', orderId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ handoffs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!['super_admin','dispatcher','driver'].includes(auth.profile.role)) return NextResponse.json({ error: 'Driver or dispatcher access required.' }, { status: 403 });
  const parsed = handoffSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid handoff data.', details: parsed.error.flatten() }, { status: 400 });
  const item = parsed.data;
  const { data: order, error: orderError } = await auth.client.from('orders').select('id,expected_bags,assigned_driver_id,has_exception').eq('id', item.orderId).single();
  if (orderError || !order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (auth.profile.role === 'driver' && order.assigned_driver_id !== auth.user.id) return NextResponse.json({ error: 'You can only record handoffs for orders assigned to you.' }, { status: 403 });
  const { data, error } = await auth.client.from('order_handoffs').upsert({ order_id: item.orderId, stage: item.stage, expected_bags: order.expected_bags, actual_bags: item.actualBags, discrepancy: item.discrepancy ?? null, notes: item.notes ?? null, confirmed_by: auth.user.id, confirmed_at: new Date().toISOString() }, { onConflict: 'order_id,stage' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const column = item.stage === 'customer_pickup' ? 'actual_bags' : item.stage === 'processor_dropoff' ? 'processor_bags' : item.stage === 'processor_pickup' ? 'completed_bags' : 'delivered_bags';
  // A later clean handoff must not erase an earlier discrepancy awaiting review.
  const { error: updateError } = await auth.client.from('orders').update({ [column]: item.actualBags, has_exception: order.has_exception || Boolean(item.discrepancy), updated_at: new Date().toISOString() }).eq('id', item.orderId);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ handoff: data }, { status: 201 });
}
