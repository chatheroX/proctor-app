
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
  const dashboardRoute = user?.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl">ProctorPrep</span>
        </Link>
        <nav className="flex items-center space-x-2 md:space-x-4">
          {isLoading && !isAuthenticated ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : isAuthenticated ? (
            <>
              {/* TODO: Add Framer Motion hover effects */}
              <Button variant="ghost" asChild className="hover:bg-primary/10">
                <Link href={dashboardRoute}>
                 <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button variant="outline" onClick={signOut} disabled={isLoading} className="border-primary/50 hover:bg-primary/10 hover:border-primary text-primary hover:text-primary">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                 Logout
              </Button>
            </>
          ) : (
            <>
              {/* TODO: Add Framer Motion hover effects */}
              <Button variant="ghost" asChild className="hover:bg-primary/10">
                <Link href="/auth?action=login">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild className="shadow-md hover:shadow-primary/30 transition-shadow">
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
