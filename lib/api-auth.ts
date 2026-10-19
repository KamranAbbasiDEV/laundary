import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getUserSafely } from '@/lib/supabase-auth';

export async function requireActiveUser() {
  const client = await createSupabaseServerClient();
  if (!client) return { error: 'The workspace is not configured.', status: 503 as const };
  const { data: { user } } = await getUserSafely(client);
  if (!user) return { error: 'Authentication required.', status: 401 as const };
  const { data: profile, error } = await client.from('profiles').select('id,role,status,processor_id,driver_id').eq('id', user.id).single();
  if (error || !profile) return { error: 'Workspace profile not found.', status: 403 as const };
  if (profile.status !== 'active') return { error: 'Your account is not active.', status: 403 as const };
  return { client, user, profile };
}

export function hasRole(role: string, allowed: string[]) { return allowed.includes(role); }
