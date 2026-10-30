import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getUserSafely } from '@/lib/supabase-auth';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  if (!url || !anonKey || request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup') || request.nextUrl.pathname.startsWith('/forgot-password') || request.nextUrl.pathname.startsWith('/reset-password') || request.nextUrl.pathname.startsWith('/apply/processor') || request.nextUrl.pathname.startsWith('/invite') || request.nextUrl.pathname.startsWith('/api')) return NextResponse.next();
  let response = NextResponse.next({ request });
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) { values.forEach(({ name, value, options }) => { request.cookies.set(name, value); response.cookies.set(name, value, options); }); }
    }
  });
  const { data: { user } } = await getUserSafely(client);
  if (!user) {
    const redirect = NextResponse.redirect(new URL('/login', request.url));
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) redirect.cookies.delete(cookie.name);
    }
    return redirect;
  }
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
