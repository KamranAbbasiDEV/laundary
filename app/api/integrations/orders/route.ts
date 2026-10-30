import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { pickupDeadlineError } from '@/lib/order-scheduling';
import { serviceIsConfigured } from '@/lib/service-catalog';
import { rankEligibleProcessors } from '@/lib/processor-matching';
import { inngest, notifyPendingProcessorOffers } from '@/lib/inngest';

const payloadSchema = z.object({
  externalId: z.string().min(1).max(160), customer: z.string().min(2), phone: z.string().min(7), address: z.string().min(5),
  service: z.string().min(1), bags: z.number().int().positive(), due: z.string().min(1), dueAt: z.string().datetime({ offset: true }), pickupWindowStartAt: z.string().datetime({ offset: true }).optional(), pickupWindowEndAt: z.string().datetime({ offset: true }).optional(), notes: z.string().max(4000).optional(), source: z.string().min(2).max(60).default('crm')
});

export async function POST(request: Request) {
  const key = process.env.ORDER_INTAKE_API_KEY;
  if (!key) return NextResponse.json({ error: 'External order intake is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${key}`) return NextResponse.json({ error: 'Unauthorized integration request.' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase service access is not configured.' }, { status: 503 });
  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order payload.', details: parsed.error.flatten() }, { status: 400 });
  const item = parsed.data;
  const pickupError = pickupDeadlineError({ pickupStartAt: item.pickupWindowStartAt, pickupEndAt: item.pickupWindowEndAt, deadlineAt: item.dueAt });
  if (pickupError) return NextResponse.json({ error: pickupError }, { status: 400 });
  const { data: workspace } = await supabaseAdmin.from('workspace_settings').select('services,matching_rules').eq('id', 'default').maybeSingle();
  if (!serviceIsConfigured(item.service, workspace?.services)) return NextResponse.json({ error: 'Choose a service from the active workspace service catalog.' }, { status: 400 });
  const { data: existing, error: lookupError } = await supabaseAdmin.from('orders').select('id,order_number,status').eq('intake_source', item.source).eq('external_id', item.externalId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (existing && existing.status !== 'validated') return NextResponse.json({ order: existing, idempotent: true });
  let order = existing;
  let idempotent = Boolean(existing);
  if (!order) {
    const { data: insertedOrder, error } = await supabaseAdmin.from('orders').insert({ customer_name: item.customer, phone: item.phone, pickup_address: item.address, service_type: item.service, expected_bags: item.bags, due_at_label: item.due, due_at: item.dueAt, original_due_at: item.dueAt, pickup_window_start_at: item.pickupWindowStartAt ?? null, pickup_window_end_at: item.pickupWindowEndAt ?? null, notes: item.notes ?? null, status: 'validated', intake_source: item.source, external_id: item.externalId }).select('id,order_number,status').single();
    if (error && error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
    if (insertedOrder) order = insertedOrder;
    else {
      const { data: concurrentOrder, error: concurrentLookupError } = await supabaseAdmin.from('orders').select('id,order_number,status').eq('intake_source', item.source).eq('external_id', item.externalId).maybeSingle();
      if (concurrentLookupError || !concurrentOrder) return NextResponse.json({ error: concurrentLookupError?.message ?? 'The duplicate order could not be recovered.' }, { status: 500 });
      if (concurrentOrder.status !== 'validated') return NextResponse.json({ order: concurrentOrder, idempotent: true });
      order = concurrentOrder;
      idempotent = true;
    }
  }
  const { data: existingOffers, error: existingOffersError } = await supabaseAdmin.from('processor_offers').select('id').eq('order_id', order.id).limit(1);
  if (existingOffersError) return NextResponse.json({ error: existingOffersError.message, order, retryable: true }, { status: 503 });
  if (existingOffers?.length) {
    const { error: resumeError } = await supabaseAdmin.from('orders').update({ status: 'processor_ranked', validation_state: 'resolved', validation_reason: null, updated_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'validated');
    if (resumeError) return NextResponse.json({ error: `Existing processor offers could not be resumed: ${resumeError.message}`, order, retryable: true }, { status: 503 });
    try {
      if (process.env.INNGEST_EVENT_KEY) await inngest.send({ name: 'rinseline/order.validated', data: { orderId: order.id } });
      else await notifyPendingProcessorOffers(order.id);
    } catch { /* The processor queue remains visible and notification retries are safe. */ }
    return NextResponse.json({ order: { ...order, status: 'processor_ranked' }, idempotent: true, resumed: true });
  }
  const { data: processors } = await supabaseAdmin.from('processors').select('id,capabilities,capacity_limit,capacity_percent,turnaround_hours,pricing,performance_score').eq('active', true);
  const ranked = rankEligibleProcessors(processors ?? [], item.service, workspace?.matching_rules);
  if (ranked.length) {
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString();
    const { error: offerError } = await supabaseAdmin.from('processor_offers').insert(ranked.map((processor, index) => ({ order_id: order.id, processor_id: processor.id, rank: index + 1, score: processor.score, score_breakdown: processor.breakdown, status: index === 0 ? 'pending' : 'withdrawn', expires_at: expiry })));
    if (offerError) return NextResponse.json({ error: `Order was created, but processor matching failed: ${offerError.message}`, order, retryable: true }, { status: 503 });
    const { error: statusError } = await supabaseAdmin.from('orders').update({ status: 'processor_ranked', validation_state: 'resolved', validation_reason: null, updated_at: new Date().toISOString() }).eq('id', order.id);
    if (statusError) return NextResponse.json({ error: `Processor offers were created, but the order queue could not be updated: ${statusError.message}`, order, retryable: true }, { status: 503 });
    try {
      if (process.env.INNGEST_EVENT_KEY) await inngest.send({ name: 'rinseline/order.validated', data: { orderId: order.id } });
      else await notifyPendingProcessorOffers(order.id);
    } catch (notificationError) {
      return NextResponse.json({ order: { ...order, status: 'processor_ranked' }, idempotent, warning: notificationError instanceof Error ? `Order matched, but processor notification must be retried: ${notificationError.message}` : 'Order matched, but processor notification must be retried.' }, { status: 202 });
    }
  } else {
    const { error: reviewError } = await supabaseAdmin.from('orders').update({ validation_state: 'manual_review', validation_reason: `No active processor currently supports ${item.service} with available capacity.`, updated_at: new Date().toISOString() }).eq('id', order.id);
    if (reviewError) return NextResponse.json({ error: `The order was created, but dispatcher review could not be queued: ${reviewError.message}`, order, retryable: true }, { status: 503 });
  }
  // The order is committed before downstream matching so an integration can safely retry.
  return NextResponse.json({ order: { ...order, status: ranked.length ? 'processor_ranked' : order.status }, idempotent }, { status: idempotent ? 200 : 201 });
}
