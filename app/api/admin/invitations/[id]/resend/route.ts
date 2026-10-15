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
  const { data: invitation, error: invitationError } = await auth.client.from('invitations').select('id,email,full_name,auth_user_id,status').eq('id', id).maybeSingle();
  if (invitationError || !invitation?.auth_user_id) return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  if (invitation.status === 'accepted') return NextResponse.json({ error: 'This account has already completed setup.' }, { status: 409 });

  const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(invitation.auth_user_id);
  if (userError || !userResult.user) return NextResponse.json({ error: 'The invited account could not be found.' }, { status: 404 });
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || new URL(request.url).origin;
  // Supabase does not create a second invitation for an existing auth user.
  // A recovery link is the reliable, secure setup link for both unconfirmed
  // and confirmed accounts after an invitation has expired.
  const delivery = 'password_setup';
  const result = await supabaseAdmin.auth.resetPasswordForEmail(invitation.email, { redirectTo: `${origin}/reset-password` });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: updateError } = await supabaseAdmin.from('invitations').update({ status: 'pending', expires_at: expiresAt }).eq('id', invitation.id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  await auth.client.from('audit_log').insert({ actor_id: auth.user.id, action: 'account_setup_resent', entity_type: 'invitation', entity_id: invitation.id, metadata: { delivery } });
  return NextResponse.json({ ok: true, delivery });
}
