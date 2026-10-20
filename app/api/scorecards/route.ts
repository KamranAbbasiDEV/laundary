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
  const processorIds = [...new Set((data ?? []).map(card => card.processor_id))];
  if (!processorIds.length) return NextResponse.json({ scorecards: [] });
  const [{ data: orders }, { data: deliveries }, { data: exceptions }] = await Promise.all([
    auth.client.from('orders').select('id,order_number,processor_id,due_at,original_due_at,deadline_revision_reason').in('processor_id', processorIds),
    auth.client.from('order_events').select('order_id,created_at').eq('to_status', 'delivered').order('created_at', { ascending: true }),
    auth.client.from('exceptions').select('order_id,description,created_at').order('created_at', { ascending: true })
  ]);
  const orderById = new Map((orders ?? []).map(order => [order.id, order]));
  const issuesByOrder = new Map<string, Array<{ description?: string | null; created_at: string }>>();
  for (const exception of exceptions ?? []) issuesByOrder.set(exception.order_id, [...(issuesByOrder.get(exception.order_id) ?? []), exception]);
  const enriched = (data ?? []).map(card => ({ ...card, details: (deliveries ?? []).filter(event => { const order = orderById.get(event.order_id); return order?.processor_id === card.processor_id && event.created_at >= `${card.period_start}T00:00:00.000Z` && event.created_at <= `${card.period_end}T23:59:59.999Z`; }).reduce<Array<{ order_number: string; delivered_at: string; due_at?: string | null; original_due_at?: string | null; deadline_revision_reason?: string | null; issue?: string }>>((items, event) => { if (items.some(item => item.order_number === orderById.get(event.order_id)?.order_number)) return items; const order = orderById.get(event.order_id); if (!order) return items; const issue = (issuesByOrder.get(event.order_id) ?? []).find(item => item.created_at >= `${card.period_start}T00:00:00.000Z` && item.created_at <= `${card.period_end}T23:59:59.999Z`); items.push({ order_number: order.order_number, delivered_at: event.created_at, due_at: order.due_at, original_due_at: order.original_due_at, deadline_revision_reason: order.deadline_revision_reason, issue: issue?.description ?? undefined }); return items; }, []) }));
  return NextResponse.json({ scorecards: enriched });
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

  const { data: processorOrders, error: ordersError } = await auth.client.from('orders').select('id,due_at').eq('processor_id', item.processorId);
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
  const onTimeRate = measurable.length ? Math.round((onTime.length / measurable.length) * 10000) / 100 : 0;

  const completedIds = completed.map(order => order.id);
  const { data: exceptionRows, error: exceptionsError } = completedIds.length
    ? await auth.client.from('exceptions').select('order_id').in('order_id', completedIds).gte('created_at', periodStart).lte('created_at', periodEnd)
    : { data: [], error: null };
  if (exceptionsError) return NextResponse.json({ error: exceptionsError.message }, { status: 500 });
  const exceptionOrderIds = new Set((exceptionRows ?? []).map(exception => exception.order_id));
  const issueCount = exceptionOrderIds.size;
  const discrepancyRate = completed.length ? Math.round((issueCount / completed.length) * 10000) / 100 : 0;
  const score = completed.length ? Math.max(0, Math.round(((measurable.length ? onTimeRate * .6 : 0) + (100 - discrepancyRate) * (measurable.length ? .4 : 1)) * 100) / 100) : 0;
  const reviewNote = [item.notes?.trim(), measurable.length ? undefined : 'Turnaround is neutral: no completed order in this period had an exact due timestamp.'].filter(Boolean).join('\n') || null;

  const { data, error } = await auth.client.from('processor_scorecards').upsert({ processor_id: item.processorId, period_start: item.periodStart, period_end: item.periodEnd, orders_completed: completed.length, on_time_rate: onTimeRate, discrepancy_rate: discrepancyRate, issue_count: issueCount, score, notes: reviewNote, reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() }, { onConflict: 'processor_id,period_start,period_end' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { error: processorUpdateError } = await auth.client.from('processors').update({ performance_score: score, updated_at: new Date().toISOString() }).eq('id', item.processorId);
  if (processorUpdateError) return NextResponse.json({ error: processorUpdateError.message }, { status: 500 });
  return NextResponse.json({ scorecard: data, measuredOrders: measurable.length });
}
