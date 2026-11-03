import { NextResponse } from 'next/server';
import { hasRole, requireActiveUser } from '@/lib/api-auth';

export async function GET(request: Request) {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasRole(auth.profile.role, ['super_admin', 'dispatcher'])) return NextResponse.json({ error: 'Dispatcher access required.' }, { status: 403 });
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, 160) ?? '';
  if (query.length < 3) return NextResponse.json({ suggestions: [] });
  const token = process.env.MAPBOX_ACCESS_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return NextResponse.json({ suggestions: [], configured: false });
  const params = new URLSearchParams({ q: query, limit: '6', autocomplete: 'true', access_token: token });
  if (process.env.MAPBOX_COUNTRY) params.set('country', process.env.MAPBOX_COUNTRY);
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, { cache: 'no-store' });
  if (!response.ok) return NextResponse.json({ error: 'Address suggestions are temporarily unavailable.' }, { status: 502 });
  const body = await response.json() as { features?: Array<{ id?: string; properties?: { full_address?: string; name?: string }; place_name?: string; geometry?: { coordinates?: unknown[] } }> };
  const suggestions = (body.features ?? []).flatMap(feature => {
    const coordinates = feature.geometry?.coordinates;
    const address = feature.properties?.full_address || feature.place_name || feature.properties?.name;
    if (!address || !Array.isArray(coordinates) || coordinates.length < 2 || !coordinates.every(value => typeof value === 'number' && Number.isFinite(value))) return [];
    return [{ id: feature.id ?? `${coordinates[0]},${coordinates[1]}`, address, longitude: coordinates[0] as number, latitude: coordinates[1] as number }];
  });
  return NextResponse.json({ suggestions, configured: true });
}
