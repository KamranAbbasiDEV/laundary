import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error:'Supabase is not configured' }, { status:503 });
  const { data:{ user }, error:userError } = await getUserSafely(supabase);
  if (userError || !user) return NextResponse.json({ error:'Authentication required' }, { status:401 });
  const { data:profile, error } = await supabase.from('profiles').select('id,full_name,role,status,phone,processor_id,driver_id,avatar_url,address,service_zones,availability,vehicle_details,onboarding_complete').eq('id',user.id).single();
  if (error) return NextResponse.json({ error:error.message }, { status:500 });
  return NextResponse.json({ user:{ id:user.id, email:user.email }, profile });
}
