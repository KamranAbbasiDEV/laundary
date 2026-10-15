import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function getAdmin() {
  const client = await createSupabaseServerClient();
  if (!client) return { error: 'The workspace is not configured.', status: 503 as const };
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: 'Authentication required.', status: 401 as const };
  const { data: profile } = await client.from('profiles').select('role,status').eq('id', user.id).single();
  if (profile?.role !== 'super_admin' || profile.status !== 'active') return { error: 'Super Admin access required.', status: 403 as const };
  return { client, user };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAdmin();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Account setup emails are not configured.' }, { status: 503 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid invitation.' }, { status: 400 });

  const { data: invitation, error: invitationError } = await auth.client
    .from('invitations')
    .select('id,email,full_name,phone,role,processor_id,auth_user_id,status')
    .eq('id', id)
    .maybeSingle();
  if (invitationError || !invitation?.auth_user_id) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  if (invitation.status === 'accepted') return NextResponse.json({ error: 'This account has already completed setup.' }, { status: 409 });

  // Supabase cannot issue a second Invite-user email for an existing Auth user.
  // An incomplete account has no operational data yet, so replace only that
  // unonboarded Auth identity and send a genuine invitation, not a recovery link.
  const { data: existingProfile, error: profileError } = await auth.client
    .from('profiles')
    .select('onboarding_complete')
    .eq('id', invitation.auth_user_id)
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (existingProfile?.onboarding_complete) return NextResponse.json({ error: 'This account has already completed setup.' }, { status: 409 });

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(invitation.auth_user_id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(invitation.email, {
    data: { full_name: invitation.full_name }, redirectTo: `${origin}/invite`
  });
  if (inviteError || !invited.user) return NextResponse.json({ error: inviteError?.message ?? 'Unable to send a fresh invitation.' }, { status: 400 });

  const { error: newProfileError } = await supabaseAdmin.from('profiles').upsert({
    id: invited.user.id,
    full_name: invitation.full_name,
    role: invitation.role,
    status: 'pending',
    phone: invitation.phone ?? null,
    processor_id: invitation.processor_id ?? null,
    onboarding_complete: false,
    updated_at: new Date().toISOString()
  });
  if (newProfileError) return NextResponse.json({ error: newProfileError.message }, { status: 500 });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: updateError } = await supabaseAdmin.from('invitations').update({ auth_user_id: invited.user.id, status: 'pending', accepted_at: null, expires_at: expiresAt }).eq('id', invitation.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: 'account_setup_resent', entity_type: 'invitation', entity_id: invitation.id, metadata: { delivery: 'invitation' } });
  return NextResponse.json({ ok: true, delivery: 'invitation' });
}
