import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fallback = { companyName: 'RinseLine', services: [], pickupWindows: [] };
  if (!supabaseAdmin) return NextResponse.json(fallback);
  const { data, error } = await supabaseAdmin.from('workspace_settings').select('company_name,services,pickup_windows').eq('id', 'default').maybeSingle();
  if (error || !data) return NextResponse.json(fallback);
  return NextResponse.json({ companyName: data.company_name || fallback.companyName, services: Array.isArray(data.services) ? data.services : [], pickupWindows: Array.isArray(data.pickup_windows) ? data.pickup_windows : [] });
}
