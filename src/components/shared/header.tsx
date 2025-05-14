
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldCheck, UserPlus, LogIn, LogOut, LayoutDashboard, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AppHeader() {
  const { session, userMetadata, signOut, isLoading } = useAuth();
  const isAuthenticated = !!session;
  const userRole = userMetadata?.role;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center space-x-2 mr-auto">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl">ProctorPrep</span>
        </Link>
        <nav className="flex items-center space-x-4">
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : isAuthenticated ? (
            <>
              <Button variant="ghost" asChild>
                <Link href={userRole === 'student' ? '/student/dashboard' : userRole === 'teacher' ? '/teacher/dashboard' : '/'}>
                 <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                </Link>
              </Button>
              <Button variant="outline" onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Logout
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
