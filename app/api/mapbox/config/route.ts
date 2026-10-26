import { NextResponse } from 'next/server';
import { publicMapboxToken } from '@/lib/mapbox';
import { requireActiveUser } from '@/lib/api-auth';

export async function GET() {
  const auth = await requireActiveUser();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const token = publicMapboxToken();
  return NextResponse.json({ configured: Boolean(token), token: token || null });
}
