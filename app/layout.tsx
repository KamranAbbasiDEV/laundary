import type { Metadata } from 'next';
import './globals.css';
import './orders-reference.css';
import './client-theme.css';
import AuthSessionGuard from '@/components/auth-session-guard';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function generateMetadata(): Promise<Metadata> {
  const client = await createSupabaseServerClient();
  const { data } = client ? await client.from('workspace_settings').select('company_name').eq('id', 'default').maybeSingle() : { data: null };
  const companyName = data?.company_name?.trim() || 'RinseLine';
  return {
    title: `${companyName} Dispatch`,
    description: 'Operations control center for laundry pickup, processing, and delivery.'
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthSessionGuard />{children}</body></html>;
}
