import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { getUserSafely } from '@/lib/supabase-auth';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicAsset = pathname.startsWith('/fonts/') || pathname.startsWith('/brand/') || /\.(?:svg|png|jpe?g|gif|webp|ico|woff2?|ttf|otf)$/i.test(pathname);
  if (!url || !anonKey || publicAsset || pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password') || pathname.startsWith('/reset-password') || pathname.startsWith('/apply/processor') || pathname.startsWith('/invite') || pathname.startsWith('/api')) return NextResponse.next();
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
