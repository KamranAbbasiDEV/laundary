import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { inngest } from '@/lib/inngest';
import { logOperationalNotification } from '@/lib/notifications';

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
  const { data: offer, error: offerError } = await auth.client.from('processor_offers').select('id,order_id,processor_id,status,rank').eq('id', item.offerId).eq('processor_id', auth.profile.processor_id).single();
  if (offerError || !offer) return NextResponse.json({ error: 'Offer not found.' }, { status: 404 });
  if (offer.status !== 'pending') return NextResponse.json({ error: 'This offer has already been decided.' }, { status: 409 });
  let data;
  if (item.decision === 'accepted') {
    const { error: acceptError } = await auth.client.rpc('accept_processor_offer', { p_offer_id: item.offerId });
    if (acceptError) return NextResponse.json({ error: acceptError.message.includes('no longer') ? acceptError.message : 'Unable to accept this offer. Refresh and try again.' }, { status: 409 });
    const { data: acceptedOffer, error: acceptedError } = await auth.client.from('processor_offers').select('*').eq('id', item.offerId).single();
    if (acceptedError || !acceptedOffer) return NextResponse.json({ error: acceptedError?.message ?? 'Offer acceptance could not be confirmed.' }, { status: 500 });
    data = acceptedOffer;
    const { data: acceptedOrder } = await auth.client.from('orders').select('order_number,phone').eq('id', offer.order_id).maybeSingle();
    await logOperationalNotification({ orderId: offer.order_id, event: 'processor_offer_accepted', message: `${acceptedOrder?.order_number ?? 'Order'} was accepted by its processor. Capacity is confirmed.`, phone: acceptedOrder?.phone ?? undefined });
  }
  if (item.decision === 'rejected') {
    const { error: rejectError } = await auth.client.rpc('reject_processor_offer', { p_offer_id: item.offerId, p_reason: item.reason ?? 'Processor declined' });
    if (rejectError) return NextResponse.json({ error: rejectError.message.includes('no longer') ? rejectError.message : 'Unable to reject this offer. Refresh and try again.' }, { status: 409 });
    const { data: rejectedOffer, error: rejectedError } = await auth.client.from('processor_offers').select('*').eq('id', item.offerId).single();
    if (rejectedError || !rejectedOffer) return NextResponse.json({ error: rejectedError?.message ?? 'Offer rejection could not be confirmed.' }, { status: 500 });
    data = rejectedOffer;
    const { data: rejectedOrder } = await auth.client.from('orders').select('order_number,phone').eq('id', offer.order_id).maybeSingle();
    await logOperationalNotification({ orderId: offer.order_id, event: 'processor_offer_rejected', message: `${rejectedOrder?.order_number ?? 'Order'} was declined by a processor and is being reassigned.`, phone: rejectedOrder?.phone ?? undefined });
    if (process.env.INNGEST_EVENT_KEY) {
      try { await inngest.send({ name: 'rinseline/order.processor_offer_activated', data: { orderId: offer.order_id } }); }
      catch (eventError) { console.error('Unable to queue the next processor notification', eventError); }
    }
  }
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: `processor_offer_${item.decision}`, entity_type: 'processor_offer', entity_id: offer.id, metadata: { orderId: offer.order_id, reason: item.reason ?? null } });
  return NextResponse.json({ offer: data });
}
