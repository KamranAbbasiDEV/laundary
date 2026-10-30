'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthSessionGuard() {
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const recoverInvalidSession = async () => {
      let invalidRefreshToken = false;
      try {
        const result = await client.auth.getSession();
        const errorCode = (result.error as { code?: string } | null)?.code;
        invalidRefreshToken = errorCode === 'refresh_token_not_found' || /invalid refresh token|refresh token not found/i.test(result.error?.message ?? '');
      } catch (error) {
        invalidRefreshToken = /invalid refresh token|refresh token not found/i.test(error instanceof Error ? error.message : String(error));
      }
      if (!active || !invalidRefreshToken) return;
      try { await client.auth.signOut({ scope: 'local' }); } catch { /* local session cleanup is best effort */ }
      if (window.location.pathname !== '/login') window.location.replace('/login');
    };
    void recoverInvalidSession().catch(() => undefined);
    return () => { active = false; };
  }, []);
  return null;
}
