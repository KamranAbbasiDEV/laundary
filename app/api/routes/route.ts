import { NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateRoute, geocodeAddress } from '@/lib/mapbox';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const routeSchema = z.object({ addresses: z.array(z.string().min(3)).min(1) });

export async function POST(request: Request) {
  const authClient = await createSupabaseServerClient();
  if (authClient) { const { data: { user } } = await authClient.auth.getUser(); if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 }); }
  const body = routeSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: 'At least one valid address is required' }, { status: 400 });
  try {
    const geocoded = await Promise.all(body.data.addresses.map(geocodeAddress));
    const coordinates = geocoded.flatMap(item => item.coordinates ? [item.coordinates] : []) as [number, number][];
    const route = await calculateRoute(coordinates);
    return NextResponse.json({ geocoded, route });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Route calculation failed' }, { status: 502 });
  }
}
