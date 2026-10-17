import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { inngest } from '@/lib/inngest';

const orderInput = z.object({
  customer: z.string().min(2), phone: z.string().min(7), address: z.string().min(5),
  service: z.string().min(1), bags: z.number().int().positive(), due: z.string().min(1), notes: z.string().optional()
});

function mapOrder(row:Record<string,unknown>, processorName?: string) {
  const statusMap:Record<string,string> = { created:'Created', validated:'Validated', processor_ranked:'Processor ranked', capacity_confirmed:'Capacity confirmed', pickup_scheduled:'Pickup scheduled', picked_up:'Picked up', at_processor:'At processor', processing:'Processing', ready_for_pickup:'Ready for pickup', picked_up_from_processor:'Picked up from processor', qc_reconciliation:'QC / Reconciliation', out_for_delivery:'Out for delivery', delivered:'Delivered', processor_reviewed:'Processor reviewed' };
  const priorityMap:Record<string,string> = { standard:'Standard', priority:'Priority', same_day:'Same day' };
  return { id:row.order_number ?? row.id, internalId:row.id, customer:row.customer_name, phone:row.phone, address:row.pickup_address, service:row.service_type, items:row.item_description ?? '', bags:row.expected_bags, due:row.due_at_label ?? '', status:statusMap[String(row.status)] ?? row.status, processor:processorName ?? 'Unassigned', priority:priorityMap[String(row.priority)] ?? row.priority, created:row.created_at, notes:row.notes ?? undefined, actualBags:row.actual_bags ?? undefined, processorBags:row.processor_bags ?? undefined, completedBags:row.completed_bags ?? undefined, exception:row.has_exception ? 'Open exception' : undefined, archived:Boolean(row.archived_at) };
}

export async function GET() {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data:{ user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error:'Authentication required' }, { status:401 });
  const { data:profile } = await client.from('profiles').select('role,processor_id,driver_id').eq('id',user.id).single();
  if (!profile) return NextResponse.json({ error: 'Workspace profile not found.' }, { status: 403 });
  let query = client.from('orders').select('*').order('created_at', { ascending:false });
  if (profile.role === 'customer') query = query.eq('customer_user_id', user.id);
  if (profile.role === 'processor') {
    if (!profile.processor_id) return NextResponse.json({ orders: [] });
    query = query.eq('processor_id', profile.processor_id);
  }
  if (profile.role === 'driver') query = query.eq('assigned_driver_id', user.id);
  if (profile.role !== 'super_admin') query = query.is('archived_at', null);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  const rows = data ?? [];
  const processorNames = new Map<string, string>();
  if (profile?.role && profile.role !== 'customer') {
    const processorIds = [...new Set(rows.map(row => row.processor_id).filter((id): id is string => typeof id === 'string'))];
    if (processorIds.length) {
      const { data: processorRows } = await client.from('processors').select('id,name').in('id', processorIds);
      (processorRows ?? []).forEach(processor => processorNames.set(processor.id, processor.name));
    }
  }
  return NextResponse.json({ orders: rows.map(row => mapOrder(row, typeof row.processor_id === 'string' ? processorNames.get(row.processor_id) : undefined)) });
}

export async function POST(request: Request) {
  const parsed = orderInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid order payload', details: parsed.error.flatten() }, { status: 400 });
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { data:profile } = await supabase.from('profiles').select('role,status').eq('id',user.id).single();
  if (!profile || profile.status !== 'active' || !['super_admin', 'dispatcher', 'customer'].includes(profile.role)) return NextResponse.json({ error: 'Your account cannot create orders.' }, { status: 403 });
  const matchingClient = supabaseAdmin ?? supabase;
  const { data: workspace } = await matchingClient.from('workspace_settings').select('services,matching_rules').eq('id', 'default').maybeSingle();
  const configuredServices = Array.isArray(workspace?.services) ? workspace.services.map(service => typeof service === 'object' && service ? String((service as Record<string, unknown>).name ?? '').trim().toLowerCase() : '').filter(Boolean) : [];
  if (configuredServices.length && !configuredServices.includes(parsed.data.service.trim().toLowerCase())) return NextResponse.json({ error: 'Choose a service from the active workspace service catalog.' }, { status: 400 });

  const { data, error } = await supabase.from('orders').insert({
    customer_name: parsed.data.customer, phone: parsed.data.phone, pickup_address: parsed.data.address,
    service_type: parsed.data.service, expected_bags: parsed.data.bags, due_at_label: parsed.data.due,
    notes: parsed.data.notes ?? null, status: 'validated', customer_user_id: profile?.role === 'customer' ? user.id : null
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const defaultWeights = { capability: 30, capacity: 20, turnaround: 15, pricing: 10, performance: 5 };
  const configuredWeights = workspace?.matching_rules && typeof workspace.matching_rules === 'object' && !Array.isArray(workspace.matching_rules) ? workspace.matching_rules as Record<string, unknown> : {};
  const weights = { ...defaultWeights, ...Object.fromEntries(Object.entries(configuredWeights).filter(([, value]) => typeof value === 'number' && value >= 0)) } as Record<string, number>;
  const { data: candidates } = await matchingClient.from('processors').select('id,capabilities,pricing,capacity_limit,capacity_percent,turnaround_hours,performance_score').eq('active', true);
  if (candidates?.length) {
    const service = parsed.data.service.toLowerCase();
    const ranked = candidates.map(candidate => {
      const capabilities = Array.isArray(candidate.capabilities) ? candidate.capabilities.map(value => String(value).toLowerCase()) : [];
      const capabilityScore = capabilities.some(value => service.includes(value) || value.includes(service)) ? weights.capability : 0;
      const capacityScore = Number(candidate.capacity_limit) > 0 && Number(candidate.capacity_percent) < 100 ? weights.capacity : 0;
      const turnaroundHours = Number(candidate.turnaround_hours ?? 0);
      const turnaroundScore = turnaroundHours > 0 ? Math.max(0, weights.turnaround * (1 - Math.min(turnaroundHours, 96) / 96)) : 0;
      const pricingScore = candidate.pricing ? weights.pricing : 0;
      const performanceScore = Math.max(0, Math.min(100, Number(candidate.performance_score ?? 0))) / 100 * weights.performance;
      return { id: candidate.id, score: capabilityScore + capacityScore + turnaroundScore + pricingScore + performanceScore, turnaround: turnaroundHours || 999 };
    }).sort((a, b) => b.score - a.score || a.turnaround - b.turnaround);
    const { error: offerError } = await matchingClient.from('processor_offers').insert(ranked.map((candidate, index) => ({ order_id: data.id, processor_id: candidate.id, rank: index + 1, score: candidate.score, status: index === 0 ? 'pending' : 'withdrawn' })));
    if (offerError) return NextResponse.json({ order: data, persistence: 'supabase', warning: `Order was created but processor matching needs dispatcher attention: ${offerError.message}` }, { status: 201 });
    const { error: statusError } = await matchingClient.from('orders').update({ status: 'processor_ranked', updated_at: new Date().toISOString() }).eq('id', data.id);
    if (statusError) return NextResponse.json({ order: data, persistence: 'supabase', warning: `Order was created but could not enter matching: ${statusError.message}` }, { status: 201 });
    data.status = 'processor_ranked';
  }
  if (process.env.INNGEST_EVENT_KEY) {
    try { await inngest.send({ name: 'rinseline/order.validated', data: { orderId: data.id } }); } catch (eventError) { console.error('Unable to queue processor notification', eventError); }
  }
  return NextResponse.json({ order: data, persistence: 'supabase' }, { status: 201 });
}
