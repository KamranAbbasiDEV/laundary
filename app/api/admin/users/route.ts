import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const updateSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['super_admin', 'dispatcher', 'driver', 'processor', 'customer']).optional(),
  status: z.enum(['pending', 'active', 'suspended', 'rejected', 'deactivated']).optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  onboardingComplete: z.boolean().optional(),
  processorId: z.string().uuid().nullable().optional()
}).refine((value) => value.role || value.status || value.fullName || value.phone !== undefined || value.onboardingComplete !== undefined || value.processorId !== undefined, 'No changes supplied');

async function getAdmin() {
  const client = await createSupabaseServerClient();
  if (!client) return { error: 'The workspace is not configured.', status: 503 as const };
  const { data: { user } } = await getUserSafely(client);
  if (!user) return { error: 'Authentication required.', status: 401 as const };
  const { data: profile } = await client.from('profiles').select('role,status').eq('id', user.id).single();
  if (profile?.role !== 'super_admin' || profile.status !== 'active') return { error: 'Super Admin access required.', status: 403 as const };
  return { client, user };
}

export async function GET() {
  const auth = await getAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.client.from('profiles').select('id,full_name,role,status,phone,processor_id,driver_id,onboarding_complete,created_at').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function PATCH(request: Request) {
  const auth = await getAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid user update.' }, { status: 400 });
  if (parsed.data.role === 'super_admin') return NextResponse.json({ error: 'Super Admin access cannot be granted from this endpoint.' }, { status: 403 });
  if (parsed.data.userId === auth.user.id && parsed.data.role) return NextResponse.json({ error: 'You cannot change your own Super Admin role.' }, { status: 400 });
  if (parsed.data.userId === auth.user.id && parsed.data.status && parsed.data.status !== 'active') return NextResponse.json({ error: 'You cannot suspend your own Super Admin account.' }, { status: 400 });
  const { data: target, error: targetError } = await auth.client.from('profiles').select('role,status,onboarding_complete').eq('id', parsed.data.userId).maybeSingle();
  if (targetError || !target) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (parsed.data.status === 'active' && !target.onboarding_complete) return NextResponse.json({ error: 'This user must complete secure account setup before access can be activated. Send a fresh setup link instead.' }, { status: 409 });
  if (parsed.data.processorId !== undefined) {
    const nextRole = parsed.data.role ?? target.role;
    if (nextRole !== 'processor') return NextResponse.json({ error: 'Only processor accounts can be linked to a processor facility.' }, { status: 400 });
    if (parsed.data.processorId) {
      const { data: processor, error: processorError } = await auth.client.from('processors').select('id').eq('id', parsed.data.processorId).eq('active', true).maybeSingle();
      if (processorError || !processor) return NextResponse.json({ error: 'Choose an active processor facility.' }, { status: 400 });
    }
  }
  const { userId, ...changes } = parsed.data;
  const update = { ...changes, ...(changes.fullName !== undefined ? { full_name: changes.fullName } : {}), ...(changes.onboardingComplete !== undefined ? { onboarding_complete: changes.onboardingComplete } : {}), ...(changes.processorId !== undefined ? { processor_id: changes.processorId } : {}), updated_at: new Date().toISOString() } as Record<string, unknown>;
  delete update.fullName;
  delete update.onboardingComplete;
  delete update.processorId;
  const writer = supabaseAdmin ?? auth.client;
  const { data, error } = await writer.from('profiles').update(update).eq('id', userId).select('id,full_name,role,status,phone,processor_id,driver_id,onboarding_complete').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: 'profile_updated', entity_type: 'profile', entity_id: userId, metadata: changes });
  return NextResponse.json({ user: data });
}
