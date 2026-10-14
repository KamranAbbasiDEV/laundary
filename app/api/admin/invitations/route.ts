import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(['dispatcher', 'driver', 'processor']),
  phone: z.string().optional(),
  processorId: z.string().uuid().optional()
});

async function getAdmin() {
  const client = await createSupabaseServerClient();
  if (!client) return { error: 'The workspace is not configured.', status: 503 as const };
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: 'Authentication required.', status: 401 as const };
  const { data: profile } = await client.from('profiles').select('role,status').eq('id', user.id).single();
  if (profile?.role !== 'super_admin' || profile.status !== 'active') return { error: 'Super Admin access required.', status: 403 as const };
  return { client, user };
}

export async function GET() {
  const auth = await getAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await auth.client.from('invitations').select('id,email,role,full_name,phone,status,expires_at,accepted_at,created_at,processor_id').order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invitations: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await getAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!supabaseAdmin) return NextResponse.json({ error: 'User invitations are not configured yet.' }, { status: 503 });
  const parsed = inviteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid name, email, and role.' }, { status: 400 });
  const origin = new URL(request.url).origin;
  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName },
    redirectTo: `${origin}/invite`
  });
  if (inviteError || !invited.user) return NextResponse.json({ error: inviteError?.message ?? 'Unable to send invitation.' }, { status: 400 });

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: invited.user.id,
    full_name: parsed.data.fullName,
    role: parsed.data.role,
    status: 'pending',
    phone: parsed.data.phone ?? null,
    processor_id: parsed.data.processorId ?? null,
    onboarding_complete: false,
    updated_at: new Date().toISOString()
  });
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  const { data: record, error } = await auth.client.from('invitations').insert({
    email: parsed.data.email,
    role: parsed.data.role,
    full_name: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
    processor_id: parsed.data.processorId ?? null,
    invited_by: auth.user.id,
    auth_user_id: invited.user.id
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: 'user_invited', entity_type: 'invitation', entity_id: record.id, metadata: { role: parsed.data.role, email: parsed.data.email } });
  return NextResponse.json({ invitation: record }, { status: 201 });
}
