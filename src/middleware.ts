
import { type NextRequest, NextResponse } from 'next/server';
// Supabase client for middleware is not used in custom auth
// import { createSupabaseClientForNextMiddleware } from '@/lib/supabase/middleware'; 

const PROTECTED_ROUTES_STUDENT = ['/student/dashboard'];
const PROTECTED_ROUTES_TEACHER = ['/teacher/dashboard'];
const AUTH_ROUTE = '/auth';
const PUBLIC_ROUTES = ['/', '/privacy', '/terms', '/supabase-test']; // Added supabase-test as public for easier testing

const SESSION_COOKIE_NAME = 'proctorprep-user-session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next(); // Prepare response object for potential cookie operations (though not used here for reads)

  // Allow Next.js specific paths and static assets
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico)$/)) {
    return res;
  }
  
  // Check for the custom session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME);
  const isAuthenticated = !!sessionCookie;

  // If user is on a public route, allow access
  if (PUBLIC_ROUTES.includes(pathname)) {
    // If authenticated and trying to access auth page, redirect to home
    if (isAuthenticated && pathname === AUTH_ROUTE) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return res;
  }
  
  // If user is authenticated
  if (isAuthenticated) {
    // If user is on auth page (should have been caught above, but as a safeguard)
    if (pathname === AUTH_ROUTE) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    
    // Role-based access for protected routes
    // NOTE: With the current proctorX table (id, pass, name), role is not stored.
    // This middleware can't distinguish between student/teacher for redirection.
    // It will allow access to any protected route if authenticated.
    // True role-based protection would require role information in the session cookie or fetched from DB.
    const isStudentRoute = PROTECTED_ROUTES_STUDENT.some(route => pathname.startsWith(route));
    const isTeacherRoute = PROTECTED_ROUTES_TEACHER.some(route => pathname.startsWith(route));

    if (isStudentRoute || isTeacherRoute) {
      // Allow access as we can't verify role with current custom auth.
      // A more robust solution would involve storing role in the cookie or fetching it.
      return res;
    }
    
    return res; // Allow other authenticated routes
  }

  // User is not authenticated
  const isProtectedRoute = PROTECTED_ROUTES_STUDENT.some(route => pathname.startsWith(route)) ||
                           PROTECTED_ROUTES_TEACHER.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  // Allow access to auth page if not logged in
  if (pathname === AUTH_ROUTE) {
    return res;
  }
  
  // For any other route not explicitly public or auth, and user is not logged in, redirect to login.
  // This might be too restrictive if there are other intended unauthenticated pages.
  // For now, keeping it simple: if not public, not auth, and not logged in -> redirect to auth.
   if (!PUBLIC_ROUTES.includes(pathname) && pathname !== AUTH_ROUTE) {
     return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
