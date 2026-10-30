import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { inngest, notifyPendingProcessorOffers } from '@/lib/inngest';
import { logOperationalNotification } from '@/lib/notifications';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
    if (acceptError && supabaseAdmin) {
      const { data: claimedOrder, error: claimError } = await supabaseAdmin.from('orders').update({ processor_id: offer.processor_id, status: 'capacity_confirmed', updated_at: new Date().toISOString() }).eq('id', offer.order_id).eq('status', 'processor_ranked').select('id').maybeSingle();
      if (claimError || !claimedOrder) return NextResponse.json({ error: claimError?.message ?? 'This offer is no longer available.' }, { status: 409 });
      const { error: claimOfferError } = await supabaseAdmin.from('processor_offers').update({ status: 'accepted', rejection_reason: null, responded_by: auth.user.id, responded_at: new Date().toISOString() }).eq('id', offer.id).eq('status', 'pending');
      if (claimOfferError) {
        await supabaseAdmin.from('orders').update({ processor_id: null, status: 'processor_ranked', updated_at: new Date().toISOString() }).eq('id', offer.order_id).eq('processor_id', offer.processor_id).eq('status', 'capacity_confirmed');
        return NextResponse.json({ error: claimOfferError.message }, { status: 409 });
      }
      await supabaseAdmin.from('processor_offers').update({ status: 'withdrawn' }).eq('order_id', offer.order_id).neq('id', offer.id).in('status', ['pending', 'withdrawn']);
    } else if (acceptError) {
      return NextResponse.json({ error: acceptError.message }, { status: 409 });
    }
    const { data: acceptedOffer, error: acceptedError } = await auth.client.from('processor_offers').select('*').eq('id', item.offerId).single();
    if (acceptedError || !acceptedOffer) return NextResponse.json({ error: acceptedError?.message ?? 'Offer acceptance could not be confirmed.' }, { status: 500 });
    data = acceptedOffer;
    const { data: acceptedOrder } = await auth.client.from('orders').select('order_number,phone,due_at').eq('id', offer.order_id).maybeSingle();
    const { error: eventError } = await auth.client.from('order_events').insert({ order_id: offer.order_id, from_status: 'processor_ranked', to_status: 'capacity_confirmed', actor_id: auth.user.id, note: 'Processor accepted the capacity offer.' });
    const warning = eventError ? `Capacity was accepted, but its audit event must be repaired: ${eventError.message}` : null;
    const acceptedDeadline = acceptedOrder?.due_at ? ` Deadline: ${new Date(acceptedOrder.due_at).toLocaleString()}.` : '';
    await logOperationalNotification({ orderId: offer.order_id, event: 'processor_offer_accepted', message: `${acceptedOrder?.order_number ?? 'Order'} was accepted by its processor. Capacity is confirmed.${acceptedDeadline}`, phone: acceptedOrder?.phone ?? undefined }, auth.client);
    if (warning) data = { ...acceptedOffer, warning };
  }
  if (item.decision === 'rejected') {
    const { error: rejectError } = await auth.client.rpc('reject_processor_offer', { p_offer_id: item.offerId, p_reason: item.reason ?? 'Processor declined' });
    if (rejectError && supabaseAdmin) {
      const { error: directRejectError } = await supabaseAdmin.from('processor_offers').update({ status: 'rejected', rejection_reason: item.reason ?? 'Processor declined', responded_by: auth.user.id, responded_at: new Date().toISOString() }).eq('id', offer.id).eq('status', 'pending');
      if (directRejectError) return NextResponse.json({ error: directRejectError.message }, { status: 409 });
      const { data: nextOffer } = await supabaseAdmin.from('processor_offers').select('id').eq('order_id', offer.order_id).eq('status', 'withdrawn').gt('rank', offer.rank).order('rank').limit(1).maybeSingle();
      if (nextOffer) {
        const { error: activateError } = await supabaseAdmin.from('processor_offers').update({ status: 'pending', offered_at: new Date().toISOString(), expires_at: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() }).eq('id', nextOffer.id);
        if (activateError) return NextResponse.json({ error: `The offer was declined, but the next processor could not be activated: ${activateError.message}` }, { status: 500 });
      } else {
        const { error: reviewError } = await supabaseAdmin.from('orders').update({ status: 'validated', validation_state: 'manual_review', validation_reason: 'All eligible processors declined or expired. Dispatcher reassignment is required.', updated_at: new Date().toISOString() }).eq('id', offer.order_id).eq('status', 'processor_ranked');
        if (reviewError) return NextResponse.json({ error: `The offer was declined, but dispatcher review could not be queued: ${reviewError.message}` }, { status: 500 });
      }
    } else if (rejectError) {
      return NextResponse.json({ error: rejectError.message }, { status: 409 });
    }
    const { data: rejectedOffer, error: rejectedError } = await auth.client.from('processor_offers').select('*').eq('id', item.offerId).single();
    if (rejectedError || !rejectedOffer) return NextResponse.json({ error: rejectedError?.message ?? 'Offer rejection could not be confirmed.' }, { status: 500 });
    data = rejectedOffer;
    const { data: rejectedOrder } = await auth.client.from('orders').select('order_number,phone,due_at').eq('id', offer.order_id).maybeSingle();
    const rejectedDeadline = rejectedOrder?.due_at ? ` Deadline: ${new Date(rejectedOrder.due_at).toLocaleString()}.` : '';
    await logOperationalNotification({ orderId: offer.order_id, event: 'processor_offer_rejected', message: `${rejectedOrder?.order_number ?? 'Order'} was declined by a processor and is being reassigned.${rejectedDeadline}`, phone: rejectedOrder?.phone ?? undefined }, auth.client);
    try {
      if (process.env.INNGEST_EVENT_KEY) await inngest.send({ name: 'rinseline/order.processor_offer_activated', data: { orderId: offer.order_id } });
      else await notifyPendingProcessorOffers(offer.order_id);
    } catch (eventError) { console.error('Unable to queue the next processor notification', eventError); }
  }
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: `processor_offer_${item.decision}`, entity_type: 'processor_offer', entity_id: offer.id, metadata: { orderId: offer.order_id, reason: item.reason ?? null } });
  return NextResponse.json({ offer: data });
}
