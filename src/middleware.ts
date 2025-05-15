
import { type NextRequest, NextResponse } from 'next/server';

const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE; // Fallback
const AUTH_ROUTE = '/auth';
const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];
const PUBLIC_ROUTES = ['/', '/privacy', '/terms', '/supabase-test'];

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next(); // Prepare response for potential cookie operations

  console.log(`[Middleware] Path: ${pathname}`);

  // Allow static assets, API routes, and image optimization routes to pass through
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$/i)) {
    console.log(`[Middleware] Allowing asset/API route: ${pathname}`);
    return res;
  }
  
  const sessionEmailCookie = req.cookies.get(SESSION_COOKIE_NAME);
  const sessionRoleCookie = req.cookies.get(ROLE_COOKIE_NAME);
  const isAuthenticated = !!sessionEmailCookie;
  const userRole = sessionRoleCookie?.value as 'student' | 'teacher' | undefined;

  console.log(`[Middleware] isAuthenticated: ${isAuthenticated}, Role: ${userRole}`);

  const getRedirectPathForRoleFromMiddleware = (role?: 'student' | 'teacher') => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    if (role === 'student') return STUDENT_DASHBOARD_ROUTE;
    return DEFAULT_DASHBOARD_ROUTE;
  };
  
  const targetDashboardRedirect = getRedirectPathForRoleFromMiddleware(userRole);

  if (PUBLIC_ROUTES.includes(pathname)) {
    console.log(`[Middleware] Public route: ${pathname}`);
    // If authenticated user tries to access /auth, redirect them to their dashboard
    if (isAuthenticated && pathname === AUTH_ROUTE) {
      console.log(`[Middleware] Authenticated user on /auth, redirecting to ${targetDashboardRedirect}`);
      return NextResponse.redirect(new URL(targetDashboardRedirect, req.url));
    }
    return res; // Allow access to public routes
  }
  
  const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname.startsWith(p));
  console.log(`[Middleware] isProtectedRoute: ${isProtectedRoute}`);

  if (isAuthenticated) {
    // If user is authenticated and tries to access /auth, redirect them
    if (pathname === AUTH_ROUTE) {
      console.log(`[Middleware] Authenticated user on /auth (re-check), redirecting to ${targetDashboardRedirect}`);
      return NextResponse.redirect(new URL(targetDashboardRedirect, req.url));
    }

    // Role-based dashboard access check for protected routes
    if (isProtectedRoute) {
        if (userRole === 'student' && pathname.startsWith('/teacher/dashboard')) {
            console.log(`[Middleware] Student trying to access teacher dashboard, redirecting to ${STUDENT_DASHBOARD_ROUTE}`);
            return NextResponse.redirect(new URL(STUDENT_DASHBOARD_ROUTE, req.url));
        }
        if (userRole === 'teacher' && pathname.startsWith('/student/dashboard')) {
            console.log(`[Middleware] Teacher trying to access student dashboard, redirecting to ${TEACHER_DASHBOARD_ROUTE}`);
            return NextResponse.redirect(new URL(TEACHER_DASHBOARD_ROUTE, req.url));
        }
    }
    console.log(`[Middleware] Authenticated user allowed for: ${pathname}`);
    return res; // Allow access to their dashboard or other allowed routes
  }

  // User is NOT authenticated
  if (isProtectedRoute) {
    console.log(`[Middleware] Unauthenticated user on protected route ${pathname}, redirecting to ${AUTH_ROUTE}`);
    return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  // If route is neither public, nor /auth, nor a known protected pattern, and user is not authenticated,
  // it's likely a direct access attempt to a non-defined route that should be protected.
  if (pathname !== AUTH_ROUTE) { // Avoid redirecting /auth to /auth if already there
     console.log(`[Middleware] Unauthenticated user on unhandled route ${pathname}, redirecting to ${AUTH_ROUTE}`);
     return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  console.log(`[Middleware] Fallback for: ${pathname}`);
  return res;
}

export const config = {
  matcher: [
    // Match all routes except static files and specific Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
