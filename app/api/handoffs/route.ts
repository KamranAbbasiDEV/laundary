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
  if (orderId) query = query.eq('order_id', orderId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ handoffs: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!['super_admin','dispatcher','driver','processor'].includes(auth.profile.role)) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const parsed = handoffSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid handoff data.', details: parsed.error.flatten() }, { status: 400 });
  const item = parsed.data;
  const { data, error } = await auth.client.from('order_handoffs').upsert({ order_id: item.orderId, stage: item.stage, actual_bags: item.actualBags, discrepancy: item.discrepancy ?? null, notes: item.notes ?? null, confirmed_by: auth.user.id, confirmed_at: new Date().toISOString() }, { onConflict: 'order_id,stage' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const column = item.stage === 'customer_pickup' ? 'actual_bags' : item.stage === 'processor_dropoff' ? 'processor_bags' : item.stage === 'processor_pickup' ? 'completed_bags' : 'delivered_bags';
  await auth.client.from('orders').update({ [column]: item.actualBags, has_exception: Boolean(item.discrepancy), updated_at: new Date().toISOString() }).eq('id', item.orderId);
  return NextResponse.json({ handoff: data }, { status: 201 });
}
