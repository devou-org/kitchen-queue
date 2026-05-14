import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = request.headers.get('host') || '';
  
  // Extract subdomain (fallback to 'demo' for local dev)
  let subdomain = 'demo';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.match(/^192\.168\./);
  
  if (isLocalhost) {
    const parts = host.split('.');
    if (parts.length > 1 && !parts[0].includes('localhost') && !parts[0].match(/^\d+$/)) {
      subdomain = parts[0];
    }
  } else {
    const parts = host.split('.');
    if (parts.length >= 3) {
      subdomain = parts[0];
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-restaurant-slug', subdomain);

  // Protect admin routes
  if (path.startsWith('/admin') && path !== '/admin/login') {
    const adminToken = request.cookies.get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete('admin_token');
      return response;
    }
  }

  // Protect super-admin routes
  if (path.startsWith('/super-admin') && path !== '/super-admin/login') {
    const superAdminToken = request.cookies.get('super_admin_token')?.value;
    if (!superAdminToken) {
      return NextResponse.redirect(new URL('/super-admin/login', request.url));
    }
    const payload = await verifyToken(superAdminToken);
    if (!(payload as any)?.isSuperAdmin) {
      const response = NextResponse.redirect(new URL('/super-admin/login', request.url));
      response.cookies.delete('super_admin_token');
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
  matcher: ['/admin/:path*', '/super-admin/:path*', '/menu', '/cart', '/checkout', '/history', '/order-status', '/order-status/:path*'],
};
