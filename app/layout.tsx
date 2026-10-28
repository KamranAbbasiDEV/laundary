import type { Metadata } from 'next';
import './globals.css';
import AuthSessionGuard from '@/components/auth-session-guard';

export const metadata: Metadata = {
  title: 'RinseLine Dispatch',
  description: 'Operations control center for laundry pickup, processing, and delivery.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthSessionGuard />{children}</body></html>;
}
