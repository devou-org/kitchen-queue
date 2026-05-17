import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathSegments = pathname.split('/').filter(Boolean);
  const requestHeaders = new Headers(request.headers);

  // If it's an API route, try to get slug from header or query
  if (pathname.startsWith('/api')) {
    const slug = request.headers.get('x-restaurant-slug') || request.nextUrl.searchParams.get('restaurant_slug');
    if (slug) {
      requestHeaders.set('x-restaurant-slug', slug);
      return NextResponse.next({
        request: { headers: requestHeaders },
      });
    }
    // If no slug, just proceed (might be super-admin or auth)
    return NextResponse.next();
  }

  // Skip middleware for static files, etc.
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/super-admin')
  ) {
    return NextResponse.next();
  }

  // Extract slug from path (e.g., /[slug]/menu -> slug)
  const slug = pathSegments[0];
  if (!slug) {
    return NextResponse.next();
  }

  requestHeaders.set('x-restaurant-slug', slug);

  // Remaining path after slug (e.g., /admin/orders)
  const subPath = '/' + pathSegments.slice(1).join('/');

  // Protect admin routes: /[slug]/admin/...
  if (subPath.startsWith('/admin') && subPath !== '/admin/login') {
    const adminToken = request.cookies.get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL(`/${slug}/admin/login`, request.url));
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      const response = NextResponse.redirect(new URL(`/${slug}/admin/login`, request.url));
      response.cookies.delete('admin_token');
      return response;
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
