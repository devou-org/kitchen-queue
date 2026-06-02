import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

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

  // Protect staff routes
  if (path.startsWith('/staff') && path !== '/staff/login') {
    const staffToken = request.cookies.get('staff_token')?.value;
    if (!staffToken) {
      return NextResponse.redirect(new URL('/staff/login', request.url));
    }

    const payload = await verifyToken(staffToken) as any;
    if (!payload?.isStaff) {
      const response = NextResponse.redirect(new URL('/staff/login', request.url));
      response.cookies.delete('staff_token');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/staff/:path*', '/menu', '/cart', '/checkout', '/history', '/order-status', '/order-status/:path*'],
};
