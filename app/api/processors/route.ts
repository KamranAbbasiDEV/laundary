import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

const processorSchema = z.object({ name:z.string().min(2), address:z.string().min(3), serviceArea:z.string().optional(), capabilities:z.array(z.string()).min(1), pricing:z.string().optional(), capacityLimit:z.number().int().nonnegative(), operatingHours:z.string().optional(), turnaroundHours:z.number().nonnegative(), phone:z.string().optional() });
const processorUpdateSchema = processorSchema.partial().extend({ id: z.string().uuid(), active: z.boolean().optional() }).refine(value => Object.keys(value).some(key => key !== 'id'), 'No changes supplied');
function mapRow(row:Record<string,unknown>) { return { id:row.id, name:row.name, address:row.address ?? '', location:row.service_area ?? '', capabilities:row.capabilities ?? [], pricing:row.pricing ?? '', capacityLimit:row.capacity_limit ?? 0, capacityUsed:row.capacity_percent ?? 0, operatingHours:row.operating_hours ?? '', turnaround:row.turnaround_hours ? `${row.turnaround_hours} hrs` : '', score:row.performance_score ?? 0, queue:0, phone:row.phone ?? '', active:row.active }; }

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.profile.role === 'customer' || auth.profile.role === 'driver') return NextResponse.json({ processors: [] });
  let query = auth.client.from('processors').select('*').order('name');
  if (auth.profile.role === 'processor') {
    if (!auth.profile.processor_id) return NextResponse.json({ processors: [] });
    query = query.eq('id', auth.profile.processor_id);
  } else if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  return NextResponse.json({ processors:(data ?? []).map(mapRow) });
}

export async function POST(request:Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = processorSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error:'Invalid processor payload', details:parsed.error.flatten() }, { status:400 });
  const { data, error } = await auth.client.from('processors').insert({ name:parsed.data.name, address:parsed.data.address, service_area:parsed.data.serviceArea ?? null, capabilities:parsed.data.capabilities, pricing:parsed.data.pricing ?? null, capacity_limit:parsed.data.capacityLimit, operating_hours:parsed.data.operatingHours ?? null, turnaround_hours:parsed.data.turnaroundHours, phone:parsed.data.phone ?? null }).select().single();
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  return NextResponse.json({ processor:mapRow(data) }, { status:201 });
}

export async function PATCH(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const parsed = processorUpdateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid processor update.', details: parsed.error.flatten() }, { status: 400 });
  const { id, name, address, serviceArea, capabilities, pricing, capacityLimit, operatingHours, turnaroundHours, phone, active } = parsed.data;
  const update = {
    ...(name !== undefined ? { name } : {}), ...(address !== undefined ? { address } : {}), ...(serviceArea !== undefined ? { service_area: serviceArea || null } : {}), ...(capabilities !== undefined ? { capabilities } : {}), ...(pricing !== undefined ? { pricing: pricing || null } : {}), ...(capacityLimit !== undefined ? { capacity_limit: capacityLimit } : {}), ...(operatingHours !== undefined ? { operating_hours: operatingHours || null } : {}), ...(turnaroundHours !== undefined ? { turnaround_hours: turnaroundHours } : {}), ...(phone !== undefined ? { phone: phone || null } : {}), ...(active !== undefined ? { active } : {}), updated_at: new Date().toISOString()
  };
  const { data, error } = await auth.client.from('processors').update(update).eq('id', id).select('*').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Processor not found.' }, { status: 404 });
  return NextResponse.json({ processor: mapRow(data) });
}
