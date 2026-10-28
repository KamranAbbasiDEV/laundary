'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthSessionGuard() {
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;
    const recoverInvalidSession = async () => {
      const result = await client.auth.getSession();
      if (!active || !result.error) return;
      const errorCode = (result.error as { code?: string }).code;
      if (errorCode !== 'refresh_token_not_found') return;
      await client.auth.signOut({ scope: 'local' });
      if (window.location.pathname !== '/login') window.location.replace('/login');
    };
    void recoverInvalidSession().catch(() => undefined);
    return () => { active = false; };
  }, []);
  return null;
}
