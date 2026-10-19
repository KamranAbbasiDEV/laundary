import type { SupabaseClient, User } from '@supabase/supabase-js';

type GetUserResult = {
  data: { user: User | null };
  error: Error | null;
};

/**
 * Supabase can throw while recovering a browser/server session when the
 * refresh token has been revoked or no longer exists. Treat that state as an
 * anonymous session so a stale cookie cannot turn every request into a 500.
 */
export async function getUserSafely(client: SupabaseClient): Promise<GetUserResult> {
  try {
    const { data, error } = await client.auth.getUser();
    return { data: { user: data.user }, error: error ?? null };
  } catch (error) {
    return {
      data: { user: null },
      error: error instanceof Error ? error : new Error('Unable to restore the authentication session.'),
    };
  }
}
