
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
    <header className="sticky top-0 z-50 w-full border-b border-border/20 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl text-foreground">ProctorPrep</span>
        </Link>
        <nav className="flex items-center space-x-2 md:space-x-3">
          {isLoading && !isAuthenticated ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : isAuthenticated ? (
            <>
              {/* TODO: Add Framer Motion hover effects */}
              <Button variant="ghost" asChild className="text-foreground hover:bg-accent/10 hover:text-accent-foreground px-3 py-2 rounded-lg">
                <Link href={dashboardRoute}>
                 <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button 
                variant="outline" 
                onClick={signOut} 
                disabled={isLoading} 
                className="border-primary/40 hover:bg-primary/10 text-primary hover:text-primary hover:border-primary px-3 py-2 rounded-lg"
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                 Logout
              </Button>
            </>
          ) : (
            <>
              {/* TODO: Add Framer Motion hover effects */}
              <Button variant="ghost" asChild className="text-foreground hover:bg-accent/10 hover:text-accent-foreground px-3 py-2 rounded-lg">
                <Link href="/auth?action=login">
                  <LogIn className="mr-2 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild className="btn-gradient px-4 py-2 rounded-lg">
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
