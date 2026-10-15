import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const scorecardSchema = z.object({
  processorId: z.string().uuid(), periodStart: z.string().date(), periodEnd: z.string().date(), notes: z.string().max(2000).optional()
}).refine(value => value.periodStart <= value.periodEnd, { message: 'The review start date must be before the end date.' });

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const { data, error } = await auth.client.from('processor_scorecards').select('*, processors(name)').order('period_end', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scorecards: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const parsed = scorecardSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'A processor and review period are required.' }, { status: 400 });

  const item = parsed.data;
  const periodStart = `${item.periodStart}T00:00:00.000Z`;
  const periodEnd = `${item.periodEnd}T23:59:59.999Z`;
  const { data: processor, error: processorError } = await auth.client.from('processors').select('id').eq('id', item.processorId).maybeSingle();
  if (processorError) return NextResponse.json({ error: processorError.message }, { status: 500 });
  if (!processor) return NextResponse.json({ error: 'Processor not found.' }, { status: 404 });

  const { data: processorOrders, error: ordersError } = await auth.client.from('orders').select('id,due_at,has_exception').eq('processor_id', item.processorId);
  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });
  const orderIds = (processorOrders ?? []).map(order => order.id);
  const { data: deliveryEvents, error: eventsError } = orderIds.length
    ? await auth.client.from('order_events').select('order_id,created_at').in('order_id', orderIds).eq('to_status', 'delivered').gte('created_at', periodStart).lte('created_at', periodEnd)
    : { data: [], error: null };
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  // A scorecard's period follows the actual delivery, never the creation or review date.
  const deliveredAt = new Map<string, string>();
  for (const event of deliveryEvents ?? []) {
    const previous = deliveredAt.get(event.order_id);
    if (!previous || event.created_at < previous) deliveredAt.set(event.order_id, event.created_at);
  }
  const completed = (processorOrders ?? []).filter(order => deliveredAt.has(order.id));
  const measurable = completed.filter(order => Boolean(order.due_at));
  const onTime = measurable.filter(order => new Date(deliveredAt.get(order.id) as string).getTime() <= new Date(order.due_at as string).getTime());
  // Do not mark a processor late when the order did not carry an exact deadline.
  const onTimeRate = measurable.length ? Math.round((onTime.length / measurable.length) * 10000) / 100 : 100;

  const completedIds = completed.map(order => order.id);
  const { data: exceptionRows, error: exceptionsError } = completedIds.length
    ? await auth.client.from('exceptions').select('order_id').in('order_id', completedIds).gte('created_at', periodStart).lte('created_at', periodEnd)
    : { data: [], error: null };
  if (exceptionsError) return NextResponse.json({ error: exceptionsError.message }, { status: 500 });
  const exceptionOrderIds = new Set((exceptionRows ?? []).map(exception => exception.order_id));
  const flaggedOrderIds = new Set(completed.filter(order => order.has_exception).map(order => order.id));
  const discrepancyOrders = new Set([...exceptionOrderIds, ...flaggedOrderIds]);
  const issueCount = (exceptionRows ?? []).length || flaggedOrderIds.size;
  const discrepancyRate = completed.length ? Math.round((discrepancyOrders.size / completed.length) * 10000) / 100 : 0;
  const score = completed.length ? Math.max(0, Math.round((onTimeRate * .6 + (100 - discrepancyRate) * .25 + Math.max(0, 100 - issueCount / completed.length * 100) * .15) * 100) / 100) : 0;
  const reviewNote = [item.notes?.trim(), measurable.length ? undefined : 'Turnaround is neutral: no completed order in this period had an exact due timestamp.'].filter(Boolean).join('\n') || null;

  const { data, error } = await auth.client.from('processor_scorecards').upsert({ processor_id: item.processorId, period_start: item.periodStart, period_end: item.periodEnd, orders_completed: completed.length, on_time_rate: onTimeRate, discrepancy_rate: discrepancyRate, issue_count: issueCount, score, notes: reviewNote, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() }, { onConflict: 'processor_id,period_start,period_end' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: processorUpdateError } = await auth.client.from('processors').update({ performance_score: score, updated_at: new Date().toISOString() }).eq('id', item.processorId);
  if (processorUpdateError) return NextResponse.json({ error: processorUpdateError.message }, { status: 500 });
  return NextResponse.json({ scorecard: data, measuredOrders: measurable.length });
}
