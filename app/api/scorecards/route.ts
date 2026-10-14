import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const scorecardSchema = z.object({ processorId: z.string().uuid(), periodStart: z.string().date(), periodEnd: z.string().date(), notes: z.string().max(2000).optional() });

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin','dispatcher'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const { data, error } = await auth.client.from('processor_scorecards').select('*, processors(name)').order('period_end', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ scorecards: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin','dispatcher'])) return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const parsed = scorecardSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'A processor and review period are required.' }, { status: 400 });
  const item = parsed.data;
  const { data: processor } = await auth.client.from('processors').select('id').eq('id', item.processorId).single();
  if (!processor) return NextResponse.json({ error: 'Processor not found.' }, { status: 404 });
  const { data: orders } = await auth.client.from('orders').select('id,status,has_exception,created_at,updated_at').eq('processor_id', item.processorId).gte('created_at', `${item.periodStart}T00:00:00Z`).lte('created_at', `${item.periodEnd}T23:59:59Z`);
  const completed = orders?.filter(order=>['delivered','processor_reviewed'].includes(order.status)) ?? [];
  const issues = orders?.filter(order=>order.has_exception).length ?? 0;
  const onTimeRate = completed.length ? Math.round((completed.filter(order=>order.status === 'processor_reviewed').length / completed.length) * 10000) / 100 : 0;
  const discrepancyRate = orders?.length ? Math.round((issues / orders.length) * 10000) / 100 : 0;
  const score = Math.max(0, Math.round((onTimeRate * 0.6 + (100 - discrepancyRate) * 0.4) * 100) / 100);
  const { data, error } = await auth.client.from('processor_scorecards').upsert({ processor_id:item.processorId, period_start:item.periodStart, period_end:item.periodEnd, orders_completed:completed.length, on_time_rate:onTimeRate, discrepancy_rate:discrepancyRate, issue_count:issues, score, notes:item.notes ?? null, reviewed_by:auth.user.id, reviewed_at:new Date().toISOString() }, { onConflict:'processor_id,period_start,period_end' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.client.from('processors').update({ performance_score: score, updated_at: new Date().toISOString() }).eq('id', item.processorId);
  return NextResponse.json({ scorecard: data }, { status: 201 });
}
