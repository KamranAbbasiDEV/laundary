import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const processorSchema = z.object({ name:z.string().min(2), address:z.string().min(3), serviceArea:z.string().optional(), capabilities:z.array(z.string()).min(1), pricing:z.string().optional(), capacityLimit:z.number().int().nonnegative(), operatingHours:z.string().optional(), turnaroundHours:z.number().nonnegative(), phone:z.string().optional() });
function mapRow(row:Record<string,unknown>) { return { id:row.id, name:row.name, address:row.address ?? '', location:row.service_area ?? '', capabilities:row.capabilities ?? [], pricing:row.pricing ?? '', capacityLimit:row.capacity_limit ?? 0, capacityUsed:row.capacity_percent ?? 0, operatingHours:row.operating_hours ?? '', turnaround:row.turnaround_hours ? `${row.turnaround_hours} hrs` : '', score:row.performance_score ?? 0, queue:0, phone:row.phone ?? '', active:row.active }; }

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error:'Authentication required' }, { status:401 });
  const { data, error } = await supabase.from('processors').select('*').eq('active', true).order('name');
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  return NextResponse.json({ processors:(data ?? []).map(mapRow) });
}

export async function POST(request:Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error:'Authentication required' }, { status:401 });
  const parsed = processorSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error:'Invalid processor payload', details:parsed.error.flatten() }, { status:400 });
  const { data, error } = await supabase.from('processors').insert({ name:parsed.data.name, address:parsed.data.address, service_area:parsed.data.serviceArea ?? null, capabilities:parsed.data.capabilities, pricing:parsed.data.pricing ?? null, capacity_limit:parsed.data.capacityLimit, operating_hours:parsed.data.operatingHours ?? null, turnaround_hours:parsed.data.turnaroundHours, phone:parsed.data.phone ?? null }).select().single();
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  return NextResponse.json({ processor:mapRow(data) }, { status:201 });
}
