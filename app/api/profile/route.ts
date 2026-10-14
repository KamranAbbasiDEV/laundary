import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const profileSchema = z.object({ fullName: z.string().min(2), phone: z.string().min(7), address: z.string().optional(), serviceZones: z.array(z.string()).default([]), availability: z.string().optional(), vehicleDetails: z.string().optional() });

export async function GET() {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: 'The workspace is not configured.' }, { status: 503 });
  const { data: { user } } = await client.auth.getUser(); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const { data, error } = await client.from('profiles').select('id,full_name,role,status,phone,address,service_zones,availability,vehicle_details,onboarding_complete').eq('id', user.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const client = await createSupabaseServerClient();
  if (!client) return NextResponse.json({ error: 'The workspace is not configured.' }, { status: 503 });
  const { data: { user } } = await client.auth.getUser(); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const parsed = profileSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: 'Complete the required profile fields.' }, { status: 400 });
  const item = parsed.data;
  const { data, error } = await client.from('profiles').update({ full_name: item.fullName, phone: item.phone, address: item.address ?? null, service_zones: item.serviceZones, availability: item.availability ?? null, vehicle_details: item.vehicleDetails ?? null, onboarding_complete: true, updated_at: new Date().toISOString() }).eq('id', user.id).select('id,full_name,role,status,phone,address,service_zones,availability,vehicle_details,onboarding_complete').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 }); return NextResponse.json({ profile: data });
}
