import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const decisionSchema = z.object({ offerId: z.string().uuid(), decision: z.enum(['accepted', 'rejected']), reason: z.string().max(500).optional() });

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  let query = auth.client.from('processor_offers').select('*, orders(order_number,customer_name,service_type,expected_bags,due_at_label), processors(name,address)').order('offered_at', { ascending: false });
  if (auth.profile.role === 'processor') {
    if (!auth.profile.processor_id) return NextResponse.json({ offers: [] });
    query = query.eq('processor_id', auth.profile.processor_id);
  } else if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ offers: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.profile.role !== 'processor' || !auth.profile.processor_id) return NextResponse.json({ error: 'Processor access required.' }, { status: 403 });
  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A valid offer decision is required.' }, { status: 400 });
  const item = parsed.data;
  const { data: offer, error: offerError } = await auth.client.from('processor_offers').select('id,order_id,processor_id,status').eq('id', item.offerId).eq('processor_id', auth.profile.processor_id).single();
  if (offerError || !offer) return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
  if (offer.status !== 'pending') return NextResponse.json({ error: 'This offer has already been decided.' }, { status: 409 });
  const { data, error } = await auth.client.from('processor_offers').update({ status: item.decision, rejection_reason: item.decision === 'rejected' ? item.reason ?? 'Processor declined' : null, responded_by: auth.user.id, responded_at: new Date().toISOString() }).eq('id', item.offerId).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (item.decision === 'accepted') await auth.client.from('orders').update({ processor_id: offer.processor_id, status: 'capacity_confirmed', updated_at: new Date().toISOString() }).eq('id', offer.order_id);
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: `processor_offer_${item.decision}`, entity_type: 'processor_offer', entity_id: offer.id, metadata: { orderId: offer.order_id, reason: item.reason ?? null } });
  return NextResponse.json({ offer: data });
}
