import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireActiveUser } from '@/lib/api-auth';

const schema = z.object({ action: z.enum(['archive', 'restore', 'delete']), confirmation: z.string().trim().optional(), reason: z.string().trim().min(3).max(1000) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.profile.role !== 'super_admin') return NextResponse.json({ error: 'Super Admin access is required.' }, { status: 403 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid lifecycle request.', details: parsed.error.flatten() }, { status: 400 });
  const { data: order, error: readError } = await auth.client.from('orders').select('id,order_number,archived_at').eq('id', id).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  const value = parsed.data;
  if (value.action === 'delete' && !order.archived_at) return NextResponse.json({ error: 'Archive the order before permanently deleting it.' }, { status: 409 });
  if (value.action === 'delete' && value.confirmation !== order.order_number) return NextResponse.json({ error: `Type ${order.order_number} to permanently delete this order.` }, { status: 400 });
  if (value.action === 'delete') {
    const { error } = await auth.client.from('orders').delete().eq('id', order.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const update = value.action === 'archive' ? { archived_at: new Date().toISOString(), archived_by: auth.user.id, updated_at: new Date().toISOString() } : { archived_at: null, archived_by: null, updated_at: new Date().toISOString() };
    const { error } = await auth.client.from('orders').update(update).eq('id', order.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: `order_${value.action}`, entity_type: 'order', entity_id: order.id, metadata: { orderNumber: order.order_number, reason: value.reason } });
  return NextResponse.json({ action: value.action, orderId: order.id });
}
