import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Protect admin routes
  if (path.startsWith('/admin') && path !== '/admin/login') {
    const adminToken = request.cookies.get('admin_token')?.value;
    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  // Protect customer routes
  const customerProtectedPaths = ['/menu', '/cart', '/checkout', '/history', '/order-status'];
  if (customerProtectedPaths.some(p => path.startsWith(p))) {
    const authToken = request.cookies.get('auth_token')?.value;
    // We also check for a bypass header or if the client will handle it via localStorage
    // But for Next.js SSR/Middleware, cookies are the best way to pre-redirect
    if (!authToken && path !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/menu', '/cart', '/checkout', '/history'],
};
