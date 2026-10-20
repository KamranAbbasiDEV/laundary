import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';

const payloadSchema = z.object({
  externalId: z.string().min(1).max(160), customer: z.string().min(2), phone: z.string().min(7), address: z.string().min(5),
  service: z.string().min(1), bags: z.number().int().positive(), due: z.string().min(1), dueAt: z.string().datetime({ offset: true }), notes: z.string().max(4000).optional(), source: z.string().min(2).max(60).default('crm')
});

export async function POST(request: Request) {
  const key = process.env.ORDER_INTAKE_API_KEY;
  if (!key) return NextResponse.json({ error: 'External order intake is not configured.' }, { status: 503 });
  if (request.headers.get('authorization') !== `Bearer ${key}`) return NextResponse.json({ error: 'Unauthorized integration request.' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Supabase service access is not configured.' }, { status: 503 });
  const parsed = payloadSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order payload.', details: parsed.error.flatten() }, { status: 400 });
  const item = parsed.data;
  const { data: workspace } = await supabaseAdmin.from('workspace_settings').select('matching_rules').eq('id', 'default').maybeSingle();
  const { data: existing, error: lookupError } = await supabaseAdmin.from('orders').select('id,order_number,status').eq('intake_source', item.source).eq('external_id', item.externalId).maybeSingle();
  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (existing) return NextResponse.json({ order: existing, idempotent: true });
  const { data: order, error } = await supabaseAdmin.from('orders').insert({ customer_name: item.customer, phone: item.phone, pickup_address: item.address, service_type: item.service, expected_bags: item.bags, due_at_label: item.due, due_at: item.dueAt, original_due_at: item.dueAt, notes: item.notes ?? null, status: 'validated', intake_source: item.source, external_id: item.externalId }).select('id,order_number,status').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: processors } = await supabaseAdmin.from('processors').select('id,capabilities,capacity_limit,capacity_percent,turnaround_hours,pricing,performance_score').eq('active', true);
  const defaults = { capability: 30, location: 20, capacity: 20, turnaround: 15, pricing: 10, performance: 5 };
  const configured = workspace?.matching_rules && typeof workspace.matching_rules === 'object' && !Array.isArray(workspace.matching_rules) ? workspace.matching_rules as Record<string, unknown> : {};
  const weights = { ...defaults, ...Object.fromEntries(Object.entries(configured).filter(([, value]) => typeof value === 'number' && value >= 0)) } as Record<string, number>;
  const service = item.service.toLowerCase();
  const ranked = (processors ?? []).map((processor) => {
    const capabilities = Array.isArray(processor.capabilities) ? processor.capabilities.map((value) => String(value).toLowerCase()) : [];
    const capability = capabilities.some((value) => service.includes(value) || value.includes(service)) ? weights.capability : 0;
    const capacity = Number(processor.capacity_limit) > 0 && Number(processor.capacity_percent) < 100 ? weights.capacity : 0;
    const turnaroundHours = Number(processor.turnaround_hours ?? 0);
    const turnaround = turnaroundHours > 0 ? Math.max(0, weights.turnaround * (1 - Math.min(turnaroundHours, 96) / 96)) : 0;
    const pricing = processor.pricing ? weights.pricing : 0;
    const performance = Math.max(0, Math.min(100, Number(processor.performance_score ?? 0))) / 100 * weights.performance;
    return { id: processor.id, score: capability + capacity + turnaround + pricing + performance, turnaround: turnaroundHours || 999 };
  }).sort((a, b) => b.score - a.score || a.turnaround - b.turnaround);
  if (ranked.length) {
    const expiry = new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString();
    const { error: offerError } = await supabaseAdmin.from('processor_offers').insert(ranked.map((processor, index) => ({ order_id: order.id, processor_id: processor.id, rank: index + 1, score: processor.score, status: index === 0 ? 'pending' : 'withdrawn', expires_at: expiry })));
    if (!offerError) await supabaseAdmin.from('orders').update({ status: 'processor_ranked', updated_at: new Date().toISOString() }).eq('id', order.id);
  }
  // The order is committed before downstream matching so an integration can safely retry.
  return NextResponse.json({ order: { ...order, status: ranked.length ? 'processor_ranked' : order.status }, idempotent: false }, { status: 201 });
}
