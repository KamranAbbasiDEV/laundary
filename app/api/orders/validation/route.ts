import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';
import { inngest, notifyPendingProcessorOffers } from '@/lib/inngest';
import { rankEligibleProcessors } from '@/lib/processor-matching';

const decisionSchema = z.object({ orderId: z.string().uuid(), action: z.enum(['approve', 'request_changes']), reason: z.string().trim().min(3).max(1000).optional() }).superRefine((value, context) => {
  if (value.action === 'request_changes' && !value.reason) context.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'Explain what must be corrected.' });
});

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const { data, error } = await auth.client.from('orders').select('id,order_number,customer_name,phone,pickup_address,service_type,expected_bags,due_at_label,due_at,pickup_window_start_at,pickup_window_end_at,notes,created_at,validation_reason').or('validation_state.eq.manual_review,status.eq.created').in('status', ['created', 'validated']).is('archived_at', null).order('created_at');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const orders = (data ?? []).map(order => ({ ...order, due_at_label: [order.due_at_label ?? '', order.due_at ? `deadline ${new Date(order.due_at).toLocaleString()}` : ''].filter(Boolean).join(' · ') }));
  return NextResponse.json({ orders });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid validation decision.' }, { status: 400 });
  const item = parsed.data;
  const { data: order, error: orderError } = await auth.client.from('orders').select('id,service_type,status,validation_state').eq('id', item.orderId).or('validation_state.eq.manual_review,status.eq.created').in('status', ['created', 'validated']).maybeSingle();
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
  const ranked = rankEligibleProcessors(candidates ?? [], order.service_type, workspace?.matching_rules);
  const noMatchReason = ranked.length ? null : `No active processor currently supports ${order.service_type} with available capacity.`;
  const { error: validationError } = await auth.client.rpc('finalize_order_validation', {
    p_order_id: order.id,
    p_candidates: ranked.map(candidate => ({ id: candidate.id, score: candidate.score, breakdown: candidate.breakdown })),
    p_no_match_reason: noMatchReason
  });
  if (validationError) return NextResponse.json({ error: validationError.message }, { status: 409 });
  let notificationWarning: string | null = null;
  if (ranked.length) {
    try {
      if (process.env.INNGEST_EVENT_KEY) await inngest.send({ name: 'rinseline/order.validated', data: { orderId: order.id } });
      else await notifyPendingProcessorOffers(order.id);
    } catch (error) {
      notificationWarning = error instanceof Error ? `The in-app processor offer is ready, but SMS/background delivery must be retried: ${error.message}` : 'The in-app processor offer is ready, but SMS/background delivery must be retried.';
    }
  }
  return NextResponse.json({ validated: true, matched: ranked.length, reviewRequired: !ranked.length, warning: noMatchReason ?? notificationWarning });
}
