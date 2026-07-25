import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/jwt';

// ==========================================
// CONFIGURATION & RULES
// ==========================================

const RBAC_RULES = [
  { pathPrefix: '/super-admin', role: 'SUPER_ADMIN', exclude: ['/super-admin/login'] },
  { pathPrefix: '/admin', role: 'ADMIN', exclude: ['/admin/login'] },
  { pathPrefix: '/staff', role: 'STAFF', exclude: ['/staff/login'] }
];

const MODULE_RULES = [
  { pathPrefix: '/queue', module: 'QUEUE_MANAGEMENT' },
  { pathPrefix: '/queue-status', module: 'QUEUE_MANAGEMENT' },
  { pathPrefix: '/admin/queue', module: 'QUEUE_MANAGEMENT' },
  { pathPrefix: '/admin/sales', module: 'ONLINE_ORDERING' },
  { pathPrefix: '/checkout', module: 'ONLINE_ORDERING' },
  { pathPrefix: '/cart', module: 'ONLINE_ORDERING' },
  { pathPrefix: '/order-status', module: 'ONLINE_ORDERING' },
  { pathPrefix: '/menu', module: 'DIGITAL_MENU' },
];

// ==========================================
// MAIN MIDDLEWARE EXPORT
// ==========================================

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);

  // 1. Static Asset Bypassing
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // 2. API Route Handling
  if (pathname.startsWith('/api')) {
    return handleApiRoutes(request, requestHeaders);
  }

  // 3. Extract Tenant Slug
  const pathSegments = pathname.split('/').filter(Boolean);
  const slug = pathSegments[0];

  // 4. Super Admin Routing
  if (!slug || slug === 'super-admin') {
    return handleSuperAdminRoutes(request, pathname);
  }

  requestHeaders.set('x-restaurant-slug', slug);
  const subPath = '/' + pathSegments.slice(1).join('/');

  // 4.5 Protect Order/Queue Status pages with UUID validation
  if (subPath.startsWith('/order-status/') || subPath.startsWith('/queue-status/')) {
    const segments = subPath.split('/');
    const idParam = segments[2];
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
    if (idParam && !uuidRegex.test(idParam)) {
      return NextResponse.redirect(new URL(`/${slug}/menu`, request.url));
    }
  }

  // 5. Authentication & Role-Based Access Control (RBAC)
  const rbacResponse = await handleRBAC(request, slug, subPath);
  if (rbacResponse) return rbacResponse;

  // 6. Module Permissions Check
  const moduleResponse = await handleModulePermissions(request, slug, subPath);
  if (moduleResponse) return moduleResponse;

  // 7. Pass-through if all checks pass
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// ==========================================
// HANDLERS
// ==========================================

function isStaticAsset(pathname: string) {
  return pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico');
}

function handleApiRoutes(request: NextRequest, headers: Headers) {
  const slug = request.headers.get('x-restaurant-slug') || request.nextUrl.searchParams.get('restaurant_slug');
  if (slug) {
    headers.set('x-restaurant-slug', slug);
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.next();
}

async function handleSuperAdminRoutes(request: NextRequest, pathname: string) {
  if (pathname.startsWith('/super-admin') && pathname !== '/super-admin/login') {
    const token = request.cookies.get('super_admin_token')?.value;
    if (!token) return NextResponse.redirect(new URL('/super-admin/login', request.url));

    const payload = await verifyToken(token);
    if (!payload?.isSuperAdmin) {
      const response = NextResponse.redirect(new URL('/super-admin/login', request.url));
      response.cookies.delete('super_admin_token');
      return response;
    }
  }
  return NextResponse.next();
}

async function handleRBAC(request: NextRequest, slug: string, subPath: string) {
  for (const rule of RBAC_RULES) {
    if (subPath.startsWith(rule.pathPrefix) && !rule.exclude.includes(subPath)) {
      if (rule.role === 'ADMIN') {
        const token = request.cookies.get('admin_token')?.value;
        if (!token) return NextResponse.redirect(new URL(`/${slug}/admin/login`, request.url));

        const payload = await verifyToken(token);
        if (!payload?.isAdmin) {
          const response = NextResponse.redirect(new URL(`/${slug}/admin/login`, request.url));
          response.cookies.delete('admin_token');
          return response;
        }
      } else if (rule.role === 'STAFF') {
        const token = request.cookies.get('staff_token')?.value;
        if (!token) return NextResponse.redirect(new URL(`/${slug}/staff/login`, request.url));

        const payload = await verifyToken(token);
        if (!payload?.isStaff) {
          const response = NextResponse.redirect(new URL(`/${slug}/staff/login`, request.url));
          response.cookies.delete('staff_token');
          return response;
        }
        
        if (payload.restaurantSlug !== slug) {
          return NextResponse.redirect(new URL(`/${payload.restaurantSlug}/staff/orders`, request.url));
        }
      }
    }
  }
  return null;
}

async function handleModulePermissions(request: NextRequest, slug: string, subPath: string) {
  // Determine if the route falls under any module rules
  const requiredModule = MODULE_RULES.find(rule => subPath.startsWith(rule.pathPrefix))?.module;

  if (requiredModule) {
    try {
      // Fetch restaurant configuration from our API
      // Using absolute URL to avoid edge issues
      const origin = request.nextUrl.origin;
      const res = await fetch(`${origin}/api/restaurant`, {
        headers: { 'x-restaurant-slug': slug },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data && data.data.modules) {
          const isEnabled = data.data.modules[requiredModule] === true;
          if (!isEnabled) {
            // Module is disabled, redirect to a safe route (menu is usually safe)
            // If the disabled module IS the menu, we could redirect to a dedicated 403/unavailable page
            if (requiredModule === 'DIGITAL_MENU') {
              return NextResponse.rewrite(new URL('/404', request.url)); // Next.js default 404
            }
            return NextResponse.redirect(new URL(`/${slug}/menu`, request.url));
          }
        }
      }
    } catch (e) {
      console.error('[Middleware] Module check failed:', e);
      // On failure, fail open to prevent blocking the app due to transient API errors
    }
  }

  return null;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
