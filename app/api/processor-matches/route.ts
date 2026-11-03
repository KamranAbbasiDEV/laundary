import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { rankEligibleProcessors } from '@/lib/processor-matching';
import { inngest, notifyPendingProcessorOffers } from '@/lib/inngest';

const matchSchema = z.object({ orderId: z.string().uuid(), selectedProcessorId: z.string().uuid() });

async function loadRanking(auth: Exclude<Awaited<ReturnType<typeof requireActiveUser>>, { error: string; status: number }>, orderId: string) {
  const { data: order, error: orderError } = await auth.client.from('orders').select('id,order_number,status,service_type,pickup_address,validation_reason').eq('id', orderId).maybeSingle();
  if (orderError) return { error: orderError.message, status: 500 as const };
  if (!order) return { error: 'Order not found.', status: 404 as const };
  const [{ data: processors, error: processorError }, { data: workspace, error: workspaceError }] = await Promise.all([
    auth.client.from('processors').select('id,name,address,service_area,capabilities,pricing,capacity_limit,capacity_percent,turnaround_hours,performance_score,active').eq('active', true),
    auth.client.from('workspace_settings').select('matching_rules').eq('id', 'default').maybeSingle()
  ]);
  const loadError = processorError || workspaceError;
  if (loadError) return { error: loadError.message, status: 500 as const };
  const services = String(order.service_type).split(',').map(value => value.trim()).filter(Boolean);
  const ranked = rankEligibleProcessors(processors ?? [], services, workspace?.matching_rules, { pickupAddress: order.pickup_address });
  const processorById = new Map((processors ?? []).map(processor => [processor.id, processor]));
  return { order, services, candidates: ranked.map((candidate, index) => { const processor = processorById.get(candidate.id); return { ...candidate, rank: index + 1, name: processor?.name ?? 'Processor', address: processor?.address ?? '', serviceArea: processor?.service_area ?? '', capacityPercent: Number(processor?.capacity_percent ?? 0), capabilities: processor?.capabilities ?? [] }; }) };
}

export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const orderId = new URL(request.url).searchParams.get('orderId');
  if (!orderId || !z.string().uuid().safeParse(orderId).success) return NextResponse.json({ error: 'A valid order is required.' }, { status: 400 });
  const ranking = await loadRanking(auth, orderId);
  if ('error' in ranking) return NextResponse.json({ error: ranking.error }, { status: ranking.status });
  const { data: offers, error: offerError } = await auth.client.from('processor_offers').select('processor_id,rank,score,score_breakdown,status,expires_at,processors(name)').eq('order_id', orderId).order('rank');
  if (offerError) return NextResponse.json({ error: offerError.message }, { status: 500 });
  return NextResponse.json({ ...ranking, offers: offers ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = matchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Choose an order and processor.' }, { status: 400 });
  const ranking = await loadRanking(auth, parsed.data.orderId);
  if ('error' in ranking) return NextResponse.json({ error: ranking.error }, { status: ranking.status });
  if (ranking.order.status !== 'validated') return NextResponse.json({ error: ranking.order.status === 'processor_ranked' ? 'Processor offers have already started for this order.' : 'This order is no longer waiting for matching.' }, { status: 409 });
  const selected = ranking.candidates.find(candidate => candidate.id === parsed.data.selectedProcessorId);
  if (!selected) return NextResponse.json({ error: 'The selected processor is no longer eligible. Refresh the ranking and choose again.' }, { status: 409 });
  const ordered = [selected, ...ranking.candidates.filter(candidate => candidate.id !== selected.id)];
  const { error } = await auth.client.rpc('finalize_order_validation', { p_order_id: parsed.data.orderId, p_candidates: ordered.map(candidate => ({ id: candidate.id, score: candidate.score, breakdown: candidate.breakdown })), p_no_match_reason: null });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  const { error: attributionError } = await auth.client.from('orders').update({ matching_selected_by: auth.user.id, matching_selected_at: new Date().toISOString() }).eq('id', parsed.data.orderId);
  let warning: string | undefined;
  if (attributionError) warning = 'The offer is active, but the dispatcher attribution could not be saved.';
  try {
    if (process.env.INNGEST_EVENT_KEY) await inngest.send({ name: 'rinseline/order.validated', data: { orderId: parsed.data.orderId } });
    else await notifyPendingProcessorOffers(parsed.data.orderId);
  } catch {
    warning = [warning, 'The in-app offer is active; processor SMS delivery must be retried.'].filter(Boolean).join(' ');
  }
  return NextResponse.json({ matched: true, processor: { id: selected.id, name: selected.name }, candidateCount: ordered.length, warning });
}
