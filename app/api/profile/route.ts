import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const profileSchema = z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(7).max(40), address: z.string().trim().max(240).optional(), serviceZones: z.array(z.string().trim().min(1).max(80)).max(25).default([]), availability: z.string().trim().max(160).optional(), vehicleDetails: z.string().trim().max(160).optional() });

export async function GET() {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: 'The workspace is not configured.' }, { status: 503 });
  const { data: { user } } = await getUserSafely(client); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { data, error } = await client.from('profiles').select('id,full_name,role,status,phone,address,service_zones,availability,vehicle_details,onboarding_complete').eq('id', user.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: 'The workspace is not configured.' }, { status: 503 });
  const { data: { user } } = await getUserSafely(client); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Complete the required profile fields.' }, { status: 400 });
  const item = parsed.data;
  const { data: current, error: currentError } = await client.from('profiles').select('status,role,availability,vehicle_details').eq('id', user.id).single();
  if (currentError || !current) return NextResponse.json({ error: 'Unable to load your profile.' }, { status: 500 });
  const canEditAvailability = current.role === 'driver' || current.role === 'processor';
  const update = { full_name: item.fullName, phone: item.phone, address: item.address ?? null, service_zones: item.serviceZones, availability: canEditAvailability ? item.availability ?? null : current.availability ?? null, vehicle_details: current.role === 'driver' ? item.vehicleDetails ?? null : current.vehicle_details ?? null, onboarding_complete: true, updated_at: new Date().toISOString() };
  if (current.status === 'pending') {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Invitation activation is not configured.' }, { status: 503 });
    const { data: invitation } = await supabaseAdmin.from('invitations').select('id,expires_at').eq('auth_user_id', user.id).eq('status', 'pending').maybeSingle();
    if (!invitation || new Date(invitation.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'This invitation has expired. Ask a workspace owner to send a new one.' }, { status: 403 });
    const { data, error } = await supabaseAdmin.from('profiles').update({ ...update, status: 'active' }).eq('id', user.id).select('id,full_name,role,status,phone,address,service_zones,availability,vehicle_details,onboarding_complete').single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabaseAdmin.from('invitations').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invitation.id);
    return NextResponse.json({ profile: data });
  }
  const { data, error } = await client.from('profiles').update(update).eq('id', user.id).select('id,full_name,role,status,phone,address,service_zones,availability,vehicle_details,onboarding_complete').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (supabaseAdmin) await supabaseAdmin.from('invitations').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('auth_user_id', user.id).eq('status', 'pending');
  return NextResponse.json({ profile: data });
}
