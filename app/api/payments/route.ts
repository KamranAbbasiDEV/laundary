import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const paymentSchema = z.object({ orderId: z.string().min(1), amountDue: z.number().nonnegative(), amountPaid: z.number().nonnegative(), status: z.enum(['unpaid','pending','partially_paid','paid','refunded','disputed','waived']), method: z.string().max(40).optional(), reference: z.string().max(120).optional(), notes: z.string().max(1000).optional() });

export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const orderId = new URL(request.url).searchParams.get('orderId');
  let query = auth.client.from('payment_records').select('*').order('updated_at', { ascending: false });
  if (orderId) { const parsed = z.string().uuid().safeParse(orderId); if (!parsed.success) return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 }); query = query.eq('order_id', orderId); }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ payments: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = paymentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payment record.', details: parsed.error.flatten() }, { status: 400 });
  const item = parsed.data;
  const orderLookup = z.string().uuid().safeParse(item.orderId).success
    ? await auth.client.from('orders').select('id').eq('id', item.orderId).single()
    : await auth.client.from('orders').select('id').eq('order_number', item.orderId).single();
  if (orderLookup.error || !orderLookup.data) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const orderUuid = orderLookup.data.id;
  const { data, error } = await auth.client.from('payment_records').upsert({ order_id: orderUuid, amount_due: item.amountDue, amount_paid: item.amountPaid, status: item.status, method: item.method ?? null, reference: item.reference ?? null, notes: item.notes ?? null, recorded_by: auth.user.id, updated_at: new Date().toISOString() }, { onConflict: 'order_id' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: 'payment_recorded', entity_type: 'order', entity_id: orderUuid, metadata: { status: item.status, amountPaid: item.amountPaid, method: item.method ?? null } });
  return NextResponse.json({ payment: data }, { status: 201 });
}
