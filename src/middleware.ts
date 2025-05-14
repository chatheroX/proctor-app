
import { type NextRequest, NextResponse } from 'next/server';

const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];
const AUTH_ROUTE = '/auth';
const PUBLIC_ROUTES = ['/', '/privacy', '/terms', '/supabase-test'];
const DEFAULT_DASHBOARD_ROUTE = '/student/dashboard/overview';

const SESSION_COOKIE_NAME = 'proctorprep-user-session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/)) {
    return res;
  }
  
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME);
  const isAuthenticated = !!sessionCookie;

  if (PUBLIC_ROUTES.includes(pathname)) {
    if (isAuthenticated && pathname === AUTH_ROUTE) {
      // If authenticated and trying to access auth page, redirect to dashboard
      return NextResponse.redirect(new URL(DEFAULT_DASHBOARD_ROUTE, req.url));
    }
    return res; // Allow access to public routes
  }
  
  const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname.startsWith(p));

  if (isAuthenticated) {
    if (pathname === AUTH_ROUTE) {
      // Authenticated user trying to access /auth, redirect to dashboard
      return NextResponse.redirect(new URL(DEFAULT_DASHBOARD_ROUTE, req.url));
    }
    // Allow access to any other route if authenticated (including protected ones)
    // Role-based restrictions would need more info in the session cookie or a DB lookup here
    return res;
  }

  // User is NOT authenticated
  if (isProtectedRoute) {
    // Unauthenticated user trying to access a protected route, redirect to login
    return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  // Allow access to auth page if not logged in
  if (pathname === AUTH_ROUTE) {
    return res;
  }
  
  // For any other route not explicitly public or auth, and user is not logged in, redirect to login.
  // This behavior might need adjustment based on specific non-auth, non-public pages.
  // For now, if it's not public and not auth and not protected (caught above),
  // and user is not logged in, it means it's an unknown route or a protected one missed.
  // Redirecting to auth is a safe default.
   if (!PUBLIC_ROUTES.includes(pathname) && pathname !== AUTH_ROUTE && !isProtectedRoute) {
     // This case might need review: non-public, non-auth, non-protected route for unauth user.
     // Example: if you had `/about` not in public routes, it would redirect to login.
     // If this is undesired, add more routes to PUBLIC_ROUTES or adjust this condition.
     // For now, redirecting to auth is consistent with locking down non-public areas.
     return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
