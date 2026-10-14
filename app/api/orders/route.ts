import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const orderInput = z.object({
  customer: z.string().min(2), phone: z.string().min(7), address: z.string().min(5),
  service: z.string().min(1), bags: z.number().int().positive(), due: z.string().min(1), notes: z.string().optional()
});

function mapOrder(row:Record<string,unknown>, processorName?: string) {
  const statusMap:Record<string,string> = { created:'Created', validated:'Validated', processor_ranked:'Processor ranked', capacity_confirmed:'Capacity confirmed', pickup_scheduled:'Pickup scheduled', picked_up:'Picked up', at_processor:'At processor', processing:'Processing', ready_for_pickup:'Ready for pickup', picked_up_from_processor:'Picked up from processor', qc_reconciliation:'QC / Reconciliation', out_for_delivery:'Out for delivery', delivered:'Delivered', processor_reviewed:'Processor reviewed' };
  const priorityMap:Record<string,string> = { standard:'Standard', priority:'Priority', same_day:'Same day' };
  return { id:row.order_number ?? row.id, internalId:row.id, customer:row.customer_name, phone:row.phone, address:row.pickup_address, service:row.service_type, items:row.item_description ?? '', bags:row.expected_bags, due:row.due_at_label ?? '', status:statusMap[String(row.status)] ?? row.status, processor:processorName ?? 'Unassigned', priority:priorityMap[String(row.priority)] ?? row.priority, created:row.created_at, notes:row.notes ?? undefined, exception:row.has_exception ? 'Open exception' : undefined };
}

export async function GET() {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data:{ user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error:'Authentication required' }, { status:401 });
  const { data:profile } = await client.from('profiles').select('role,processor_id,driver_id').eq('id',user.id).single();
  let query = client.from('orders').select('*').order('created_at', { ascending:false });
  if (profile?.role === 'customer') query = query.eq('customer_user_id', user.id);
  if (profile?.role === 'processor' && profile.processor_id) query = query.eq('processor_id', profile.processor_id);
  if (profile?.role === 'driver') query = query.eq('assigned_driver_id', user.id);
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

  const { data, error } = await supabase.from('orders').insert({
    customer_name: parsed.data.customer, phone: parsed.data.phone, pickup_address: parsed.data.address,
    service_type: parsed.data.service, expected_bags: parsed.data.bags, due_at_label: parsed.data.due,
    notes: parsed.data.notes ?? null, status: 'validated', customer_user_id: profile?.role === 'customer' ? user.id : null
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const matchingClient = supabaseAdmin ?? supabase;
  const { data: candidates } = await matchingClient.from('processors').select('id,capabilities,capacity_limit,capacity_percent,turnaround_hours,performance_score').eq('active', true);
  if (candidates?.length) {
    const service = parsed.data.service.toLowerCase();
    const ranked = candidates.map(candidate => {
      const capabilities = Array.isArray(candidate.capabilities) ? candidate.capabilities.map(value => String(value).toLowerCase()) : [];
      const capabilityScore = capabilities.some(value => service.includes(value) || value.includes(service)) ? 40 : 10;
      const capacityScore = Number(candidate.capacity_limit) > Number(candidate.capacity_percent) ? 25 : 0;
      return { id: candidate.id, score: capabilityScore + capacityScore + Number(candidate.performance_score ?? 0), turnaround: Number(candidate.turnaround_hours ?? 999) };
    }).sort((a, b) => b.score - a.score || a.turnaround - b.turnaround);
    await matchingClient.from('processor_offers').insert(ranked.map((candidate, index) => ({ order_id: data.id, processor_id: candidate.id, rank: index + 1, score: candidate.score })));
    await matchingClient.from('orders').update({ status: 'processor_ranked', updated_at: new Date().toISOString() }).eq('id', data.id);
    data.status = 'processor_ranked';
  }
  return NextResponse.json({ order: data, persistence: 'supabase' }, { status: 201 });
}
