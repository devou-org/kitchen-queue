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

  // Protect customer routes (optional, could also redirect to /login)
  const customerProtectedPaths = ['/menu', '/cart', '/checkout', '/history'];
  if (customerProtectedPaths.some(p => path.startsWith(p))) {
    const defaultHeaders = new Headers(request.headers);
    // You could do token checking here if using httpOnly cookies for customers, 
    // but right now customer tokens are in localStorage. We will just pass it through.
    return NextResponse.next({
      request: {
        headers: defaultHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/menu', '/cart', '/checkout', '/history'],
};
