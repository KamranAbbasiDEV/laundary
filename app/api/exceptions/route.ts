import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const updateSchema = z.object({ id: z.string().uuid(), status: z.enum(['open', 'in_review', 'resolved']), resolutionNotes: z.string().max(2000).optional(), assignedTo: z.string().uuid().nullable().optional() });
const createSchema = z.object({ orderId: z.string().uuid(), type: z.enum(['pickup_discrepancy','processor_discrepancy','quality_issue','damaged_item','route_issue','missing_customer_specification']), stage: z.string().optional(), description: z.string().trim().min(3).max(2000), severity: z.enum(['low','medium','high','critical']).default('medium') });

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher', 'processor'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid exception description is required.' }, { status: 400 });
  const item = parsed.data;
  const { data: order, error: orderError } = await auth.client.from('orders').select('id,processor_id').eq('id', item.orderId).maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (auth.profile.role === 'processor' && order.processor_id !== auth.profile.processor_id) return NextResponse.json({ error: 'You can only report issues for your facility orders.' }, { status: 403 });
  const { data, error } = await auth.client.from('exceptions').insert({ order_id: item.orderId, type: item.type, stage: item.stage ?? null, description: item.description, severity: item.severity, opened_by: auth.user.id, status: 'open' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.client.from('orders').update({ has_exception: true, updated_at: new Date().toISOString() }).eq('id', item.orderId);
  return NextResponse.json({ exception: data }, { status: 201 });
}

export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher', 'processor'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const status = new URL(request.url).searchParams.get('status');
  let query = auth.client.from('exceptions').select('*,orders(order_number,customer_name,status,processor_id)').order('created_at', { ascending: false });
  if (status && ['open', 'in_review', 'resolved'].includes(status)) query = query.eq('status', status);
  if (auth.profile.role === 'processor') {
    if (!auth.profile.processor_id) return NextResponse.json({ exceptions: [] });
    const { data: scopedOrders } = await auth.client.from('orders').select('id').eq('processor_id', auth.profile.processor_id);
    const ids = (scopedOrders ?? []).map((order) => order.id);
    if (!ids.length) return NextResponse.json({ exceptions: [] });
    query = query.in('order_id', ids);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ exceptions: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid exception update.', details: parsed.error.flatten() }, { status: 400 });
  const body = parsed.data;
  if (body.status === 'resolved' && !body.resolutionNotes?.trim()) return NextResponse.json({ error: 'A resolution note is required when resolving an exception.' }, { status: 400 });
  const { data, error } = await auth.client.from('exceptions').update({
    status: body.status, assigned_to: body.assignedTo, resolution_notes: body.resolutionNotes?.trim() || null,
    resolved_at: body.status === 'resolved' ? new Date().toISOString() : null, resolved_by: body.status === 'resolved' ? auth.user.id : null
  }).eq('id', body.id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (body.status === 'resolved') {
    const { count } = await auth.client.from('exceptions').select('id', { count: 'exact', head: true }).eq('order_id', data.order_id).neq('status', 'resolved');
    if (!count) await auth.client.from('orders').update({ has_exception: false, updated_at: new Date().toISOString() }).eq('id', data.order_id);
  }
  return NextResponse.json({ exception: data });
}
