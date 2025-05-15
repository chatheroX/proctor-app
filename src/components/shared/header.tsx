
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldCheck, UserPlus, LogIn, LogOut, LayoutDashboard, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Define these constants once or import from a shared location if used elsewhere
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';

export function AppHeader() {
  const { user, signOut, isLoading } = useAuth();
  const isAuthenticated = !!user;

  // Determine the correct dashboard route based on user role
  // Defaults to student dashboard if role is not teacher or user is null (though Link won't render then)
  const dashboardRoute = user?.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between"> {/* Added justify-between */}
        <Link href="/" className="flex items-center space-x-2"> {/* Removed mr-auto as justify-between handles it */}
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl">ProctorPrep</span>
        </Link>
        <nav className="flex items-center space-x-2 md:space-x-4"> {/* Adjusted spacing for responsiveness */}
          {isLoading && !isAuthenticated ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isAuthenticated ? (
            <>
              <Button variant="ghost" asChild>
                <Link href={dashboardRoute}>
                 <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button variant="outline" onClick={signOut} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                 Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/auth?action=login">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild>
                <Link href="/auth?action=register">
                  <UserPlus className="mr-2 h-4 w-4" /> Register
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
