import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function serviceKeyMatchesProject(projectUrl?: string, key?: string) {
  if (!projectUrl || !key) return false;
  // Supabase's current secret-key format is opaque. Legacy service-role keys
  // are JWTs, so reject malformed/wrong-project JWTs before they poison every
  // API that happens to prefer the admin client.
  if (key.startsWith('sb_secret_')) return true;
  try {
    const [, payload] = key.split('.');
    if (!payload) return false;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: string; ref?: string };
    const projectRef = new URL(projectUrl).hostname.split('.')[0];
    return claims.role === 'service_role' && (!claims.ref || claims.ref === projectRef);
  } catch {
    return false;
  }
}

export const supabaseAdmin = serviceKeyMatchesProject(url, serviceRoleKey)
  ? createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;
