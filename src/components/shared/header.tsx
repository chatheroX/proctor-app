
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Loader2, LogIn, LogOut, UserPlus, Settings, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import logoAsset from '../../../logo.png'; // Import the logo

const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';

export function AppHeader() {
  const { user, signOut, isLoading } = useAuth();
  const isAuthenticated = !!user;

  const getDashboardRoute = () => {
    if (!user || !user.role) return STUDENT_DASHBOARD_ROUTE; // Default to student if role is somehow null
    return user.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/30 bg-background/80 dark:bg-slate-900/80 backdrop-blur-lg shadow-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 group">
          <Image src={logoAsset} alt="ZenTest Logo" width={100} height={28} priority className="h-7 w-auto" />
        </Link>
        <nav className="flex items-center space-x-1 sm:space-x-2">
          {isLoading ? (
             <div className="p-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
             </div>
          ) : isAuthenticated && user ? (
            <>
              <Button variant="ghost" asChild className="text-xs sm:text-sm font-medium text-foreground hover:bg-accent/50 hover:text-accent-foreground px-2 sm:px-3 py-1.5 rounded-md">
                <Link href={getDashboardRoute()}>
                 <LayoutDashboard className="mr-1.5 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={signOut}
                className="text-xs sm:text-sm font-medium border-border/70 hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive px-2 sm:px-3 py-1.5 rounded-md"
              >
                <LogOut className="mr-1.5 h-4 w-4" />
                 Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild className="text-xs sm:text-sm font-medium text-foreground hover:bg-accent/50 hover:text-accent-foreground px-2 sm:px-3 py-1.5 rounded-md">
                <Link href="/auth?action=login">
                  <LogIn className="mr-1.5 h-4 w-4" /> Login
                </Link>
              </Button>
              <Button asChild className="btn-primary-solid text-xs sm:text-sm px-3 sm:px-4 py-1.5 rounded-md">
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
