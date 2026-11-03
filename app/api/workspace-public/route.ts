import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const fallback = { companyName: 'RinseLine', services: [], pickupWindows: [] };
  const sessionClient = await createSupabaseServerClient();
  const clients = [supabaseAdmin, sessionClient].filter((client): client is NonNullable<typeof client> => Boolean(client));
  let data: { company_name: string | null; services: unknown; pickup_windows: unknown } | null = null;
  for (const client of clients) {
    const result = await client.from('workspace_settings').select('company_name,services,pickup_windows').eq('id', 'default').maybeSingle();
    if (!result.error && result.data) {
      data = result.data;
      break;
    }
  }
  if (!data) return NextResponse.json(fallback);
  return NextResponse.json({ companyName: data.company_name || fallback.companyName, services: Array.isArray(data.services) ? data.services : [], pickupWindows: Array.isArray(data.pickup_windows) ? data.pickup_windows : [] });
}
