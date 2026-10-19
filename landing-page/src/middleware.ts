import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { RESERVED_SLUGS } from './lib/affiliateLanding';

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // Clean host (strip port for local dev if present)
  const currentHost = hostname.split(':')[0].toLowerCase();

  // Root domains that should NOT be rewritten to affiliate landing
  const isRootDomain =
    currentHost === 'rabbitty.me' ||
    currentHost === 'www.rabbitty.me' ||
    currentHost === 'localhost' ||
    currentHost === '127.0.0.1';

  // Subdomain detection (e.g. 626cafe.rabbitty.me or 626cafe.localhost)
  let subdomain: string | null = null;

  if (!isRootDomain) {
    if (currentHost.endsWith('.rabbitty.me')) {
      subdomain = currentHost.replace('.rabbitty.me', '');
    } else if (currentHost.endsWith('.localhost')) {
      subdomain = currentHost.replace('.localhost', '');
    }
  }

  // If a valid non-reserved subdomain is detected, rewrite to dynamic landing route
  if (subdomain && !RESERVED_SLUGS.has(subdomain)) {
    // Only rewrite root path or preserve specific paths
    if (url.pathname === '/' || url.pathname === '') {
      url.pathname = `/${subdomain}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt, icon.png
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|icon.png).*)',
  ],
};
