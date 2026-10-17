import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { inngest } from '@/lib/inngest';

const decisionSchema = z.object({ orderId: z.string().uuid(), action: z.enum(['approve', 'request_changes']), reason: z.string().trim().min(3).max(1000).optional() }).superRefine((value, context) => {
  if (value.action === 'request_changes' && !value.reason) context.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Explain what must be corrected.' });
});

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const { data, error } = await auth.client.from('orders').select('id,order_number,customer_name,phone,pickup_address,service_type,expected_bags,due_at_label,notes,created_at,validation_reason').eq('validation_state', 'manual_review').is('archived_at', null).order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid validation decision.' }, { status: 400 });
  const item = parsed.data;
  const { data: order, error: orderError } = await auth.client.from('orders').select('id,service_type,status').eq('id', item.orderId).eq('validation_state', 'manual_review').maybeSingle();
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });
  if (!order) return NextResponse.json({ error: 'This order is no longer awaiting validation.' }, { status: 409 });
  if (item.action === 'request_changes') {
    const { error } = await auth.client.from('orders').update({ validation_reason: item.reason, updated_at: new Date().toISOString() }).eq('id', order.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reviewRequired: true });
  }

  const { data: workspace } = await auth.client.from('workspace_settings').select('matching_rules').eq('id', 'default').maybeSingle();
  const { data: candidates, error: candidatesError } = await auth.client.from('processors').select('id,capabilities,pricing,capacity_limit,capacity_percent,turnaround_hours,performance_score').eq('active', true);
  if (candidatesError) return NextResponse.json({ error: candidatesError.message }, { status: 500 });
  const defaultWeights = { capability: 30, capacity: 20, turnaround: 15, pricing: 10, performance: 5 };
  const configured = workspace?.matching_rules && typeof workspace.matching_rules === 'object' && !Array.isArray(workspace.matching_rules) ? workspace.matching_rules as Record<string, unknown> : {};
  const weights = { ...defaultWeights, ...Object.fromEntries(Object.entries(configured).filter(([, value]) => typeof value === 'number' && value >= 0)) } as Record<string, number>;
  const service = order.service_type.toLowerCase();
  const ranked = (candidates ?? []).map(candidate => {
    const capabilities = Array.isArray(candidate.capabilities) ? candidate.capabilities.map(value => String(value).toLowerCase()) : [];
    const capability = capabilities.some(value => service.includes(value) || value.includes(service)) ? weights.capability : 0;
    const capacity = Number(candidate.capacity_limit) > 0 && Number(candidate.capacity_percent) < 100 ? weights.capacity : 0;
    const turnaroundHours = Number(candidate.turnaround_hours ?? 0);
    const turnaround = turnaroundHours > 0 ? Math.max(0, weights.turnaround * (1 - Math.min(turnaroundHours, 96) / 96)) : 0;
    const pricing = candidate.pricing ? weights.pricing : 0;
    const performance = Math.max(0, Math.min(100, Number(candidate.performance_score ?? 0))) / 100 * weights.performance;
    return { id: candidate.id, score: capability + capacity + turnaround + pricing + performance, turnaround: turnaroundHours || 999, breakdown: { capability, capacity, turnaround, pricing, performance } };
  }).sort((a, b) => b.score - a.score || a.turnaround - b.turnaround);
  if (ranked.length) {
    const expiry = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const { error } = await auth.client.from('processor_offers').insert(ranked.map((candidate, index) => ({ order_id: order.id, processor_id: candidate.id, rank: index + 1, score: candidate.score, score_breakdown: candidate.breakdown, expires_at: expiry, status: index === 0 ? 'pending' : 'withdrawn' })));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const nextStatus = ranked.length ? 'processor_ranked' : 'validated';
  const { error: updateError } = await auth.client.from('orders').update({ validation_state: 'resolved', validation_reason: null, validated_at: new Date().toISOString(), validated_by: auth.user.id, status: nextStatus, updated_at: new Date().toISOString() }).eq('id', order.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await auth.client.from('order_events').insert({ order_id: order.id, from_status: order.status, to_status: nextStatus, actor_id: auth.user.id, note: 'Dispatcher validation approved.' });
  if (ranked.length && process.env.INNGEST_EVENT_KEY) await inngest.send({ name: 'rinseline/order.validated', data: { orderId: order.id } });
  return NextResponse.json({ validated: true, matched: ranked.length });
}
