import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const applicationSchema = z.object({
  businessName: z.string().min(2), contactName: z.string().min(2), email: z.string().email(), phone: z.string().min(7),
  address: z.string().min(5), serviceArea: z.string().optional(), capabilities: z.array(z.string()).min(1), pricing: z.string().optional(),
  capacityLimit: z.number().int().nonnegative(), operatingHours: z.string().optional(), turnaroundHours: z.number().nonnegative(), notes: z.string().optional()
});
const decisionSchema = z.object({ id: z.string().uuid(), status: z.enum(['approved', 'rejected', 'withdrawn']) });

export async function POST(request: Request) {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: 'Applications are not configured yet.' }, { status: 503 });
  const parsed = applicationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Complete all required processor application fields.' }, { status: 400 });
  const { data: { user } } = await client.auth.getUser();
  const item = parsed.data;
  const { data, error } = await client.from('processor_applications').insert({
    business_name: item.businessName, contact_name: item.contactName, email: item.email, phone: item.phone, address: item.address,
    service_area: item.serviceArea ?? null, capabilities: item.capabilities, pricing: item.pricing ?? null, capacity_limit: item.capacityLimit,
    operating_hours: item.operatingHours ?? null, turnaround_hours: item.turnaroundHours, notes: item.notes ?? null, applicant_user_id: user?.id ?? null
  }).select('id,status').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ application: data }, { status: 201 });
}

export async function GET() {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: 'Applications are not configured yet.' }, { status: 503 });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { data: profile } = await client.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || !['super_admin', 'dispatcher'].includes(profile.role) || profile.status !== 'active') return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const { data, error } = await client.from('processor_applications').select('*').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ applications: data ?? [] });
}

export async function PATCH(request: Request) {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: 'Applications are not configured yet.' }, { status: 503 });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { data: profile } = await client.from('profiles').select('role,status').eq('id', user.id).single();
  if (!profile || !['super_admin', 'dispatcher'].includes(profile.role) || profile.status !== 'active') return NextResponse.json({ error: 'Operations access required.' }, { status: 403 });
  const parsed = decisionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Application and decision are required.' }, { status: 400 });
  const body = parsed.data;
  const { data: application, error: readError } = await client.from('processor_applications').select('*').eq('id', body.id).single();
  if (readError || !application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  if (application.status !== 'pending') return NextResponse.json({ error: 'This application has already been reviewed.' }, { status: 409 });
  let processorId: string | null = null;
  if (body.status === 'approved') {
    const { data: processor, error: processorError } = await client.from('processors').insert({ name: application.business_name, address: application.address, service_area: application.service_area, capabilities: application.capabilities, pricing: application.pricing, capacity_limit: application.capacity_limit, operating_hours: application.operating_hours, turnaround_hours: application.turnaround_hours, phone: application.phone }).select('id').single();
    if (processorError) return NextResponse.json({ error: processorError.message }, { status: 500 });
    processorId = processor.id;
  }
  const { error } = await client.from('processor_applications').update({ status: body.status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await client.from('audit_log').insert({ actor_id: user.id, action: `processor_application_${body.status}`, entity_type: 'processor_application', entity_id: body.id, metadata: { processorId } });
  return NextResponse.json({ ok: true, processorId });
}
