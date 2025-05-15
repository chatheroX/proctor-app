
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
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-card/80 backdrop-blur-lg shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 group">
          <ShieldCheck className="h-7 w-7 text-primary group-hover:text-primary/80 transition-colors" />
          <span className="font-semibold text-xl text-foreground group-hover:text-primary/90 transition-colors">ProctorPrep</span>
        </Link>
        <nav className="flex items-center space-x-2 md:space-x-3">
          {isLoading && !user ? ( // Show loader if context is loading AND user is not yet known (null)
             <div className="p-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
             </div>
          ) : isAuthenticated && user ? ( // User is known and authenticated
            <>
              <Button variant="ghost" asChild className="text-sm font-medium text-foreground hover:bg-accent/50 hover:text-accent-foreground px-3 py-1.5 rounded-md">
                <Link href={dashboardRoute}>
                 <LayoutDashboard className="mr-1.5 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button 
                variant="outline" 
                onClick={signOut} 
                disabled={isLoading} // Disable only if an auth operation is actively in progress
                className="text-sm font-medium border-border/70 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive px-3 py-1.5 rounded-md"
              >
                {isLoading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}
                 Logout
              </Button>
            </>
          ) : ( // User is not authenticated (and isLoading is false)
            <>
              <Button variant="ghost" asChild className="text-sm font-medium text-foreground hover:bg-accent/50 hover:text-accent-foreground px-3 py-1.5 rounded-md">
                <Link href="/auth?action=login">
                  <LogIn className="mr-1.5 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild className="btn-primary-solid text-sm px-4 py-1.5 rounded-md">
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
