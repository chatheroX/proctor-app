
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldCheck, UserPlus, LogIn, LogOut, LayoutDashboard, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';

export function AppHeader() {
  const { user, signOut, isLoading } = useAuth();
  const isAuthenticated = !!user;

  const dashboardRoute = user?.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/80 shadow-xs">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <span className="font-semibold text-lg text-foreground">ProctorPrep</span>
        </Link>
        <nav className="flex items-center space-x-1.5 md:space-x-2">
          {isLoading && !isAuthenticated ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : isAuthenticated ? (
            <>
              <Button variant="ghost" asChild className="text-foreground hover:bg-accent/10 hover:text-accent-foreground px-3 py-1.5 text-sm rounded-md">
                <Link href={dashboardRoute}>
                 <LayoutDashboard className="mr-1.5 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button 
                variant="outline" 
                onClick={signOut} 
                disabled={isLoading} 
                className="border-border hover:bg-accent/10 text-foreground hover:text-accent-foreground px-3 py-1.5 text-sm rounded-md"
              >
                {isLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}
                 Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="text-foreground hover:bg-accent/10 hover:text-accent-foreground px-3 py-1.5 text-sm rounded-md">
                <Link href="/auth?action=login">
                  <LogIn className="mr-1.5 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild className="btn-primary-solid px-4 py-1.5 text-sm rounded-md">
                <Link href="/auth?action=register">
                  <UserPlus className="mr-1.5 h-4 w-4" /> Register
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
