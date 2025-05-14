
import { type NextRequest, NextResponse } from 'next/server';
import Cookies from 'js-cookie'; // Not usable in middleware directly

const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const AUTH_ROUTE = '/auth';
const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];
const PUBLIC_ROUTES = ['/', '/privacy', '/terms', '/supabase-test']; // Add more public routes if needed

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // Allow static assets and API routes to pass through
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/)) {
    return res;
  }
  
  const sessionEmailCookie = req.cookies.get(SESSION_COOKIE_NAME);
  const sessionRoleCookie = req.cookies.get(ROLE_COOKIE_NAME);
  const isAuthenticated = !!sessionEmailCookie;
  const userRole = sessionRoleCookie?.value as 'student' | 'teacher' | undefined;

  const getRedirectPathForRole = (role?: 'student' | 'teacher') => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    return STUDENT_DASHBOARD_ROUTE; // Default or if role is student/undefined
  };
  
  const defaultDashboardRedirect = getRedirectPathForRole(userRole);

  if (PUBLIC_ROUTES.includes(pathname)) {
    if (isAuthenticated && pathname === AUTH_ROUTE) {
      return NextResponse.redirect(new URL(defaultDashboardRedirect, req.url));
    }
    return res;
  }
  
  const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname.startsWith(p));

  if (isAuthenticated) {
    if (pathname === AUTH_ROUTE) {
      return NextResponse.redirect(new URL(defaultDashboardRedirect, req.url));
    }
    // Role-based dashboard access check
    if (userRole === 'student' && pathname.startsWith('/teacher/dashboard')) {
        return NextResponse.redirect(new URL(STUDENT_DASHBOARD_ROUTE, req.url)); // Redirect student from teacher area
    }
    if (userRole === 'teacher' && pathname.startsWith('/student/dashboard')) {
        return NextResponse.redirect(new URL(TEACHER_DASHBOARD_ROUTE, req.url)); // Redirect teacher from student area
    }
    return res;
  }

  // User is NOT authenticated
  if (isProtectedRoute) {
    return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  if (pathname === AUTH_ROUTE) {
    return res;
  }
  
   if (!PUBLIC_ROUTES.includes(pathname) && pathname !== AUTH_ROUTE && !isProtectedRoute) {
     return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
