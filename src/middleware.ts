
import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseMiddlewareClient } from '@/lib/supabase/middleware';

const PROTECTED_ROUTES_STUDENT = ['/student/dashboard'];
const PROTECTED_ROUTES_TEACHER = ['/teacher/dashboard'];
const AUTH_ROUTE = '/auth';
const PUBLIC_ROUTES = ['/', '/privacy', '/terms']; // Add any other public routes

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = await createSupabaseMiddlewareClient(req, res);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.endsWith('.png') || pathname.endsWith('.ico')) {
    return res;
  }
  
  // If user is logged in
  if (session) {
    const userRole = session.user.user_metadata?.role;
    // If user is on auth page, redirect to their dashboard
    if (pathname === AUTH_ROUTE) {
      if (userRole === 'student') {
        return NextResponse.redirect(new URL('/student/dashboard', req.url));
      } else if (userRole === 'teacher') {
        return NextResponse.redirect(new URL('/teacher/dashboard', req.url));
      } else {
        // If role is unknown, redirect to home, or handle as an error
        return NextResponse.redirect(new URL('/', req.url)); 
      }
    }

    // Check role-based access for protected routes
    if (pathname.startsWith('/student/dashboard') && userRole !== 'student') {
      return NextResponse.redirect(new URL(AUTH_ROUTE, req.url)); // Or an unauthorized page
    }
    if (pathname.startsWith('/teacher/dashboard') && userRole !== 'teacher') {
      return NextResponse.redirect(new URL(AUTH_ROUTE, req.url)); // Or an unauthorized page
    }
    
    // User is logged in and has correct role or is on a non-auth public-like page (e.g. /)
    return res;
  }

  // User is not logged in
  // If trying to access a protected route, redirect to auth page
  const isProtectedRoute = PROTECTED_ROUTES_STUDENT.some(route => pathname.startsWith(route)) ||
                           PROTECTED_ROUTES_TEACHER.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    return NextResponse.redirect(new URL(AUTH_ROUTE, req.url));
  }

  // Allow access to auth page if not logged in
  if (pathname === AUTH_ROUTE) {
    return res;
  }
  
  // For any other route not explicitly public or auth, and user is not logged in,
  // decide on a default behavior (e.g. redirect to home or auth)
  // This rule implies that if it's not public, not auth, and not protected (and user not logged in), it's likely a general page they shouldn't see.
  // However, our current setup mostly has /, /auth, and /dashboards. So this might not be hit often.
  // If it's a route like /some-other-page that's not in PUBLIC_ROUTES and not /auth, redirect to login.
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
