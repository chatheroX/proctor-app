import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldCheck, UserPlus, LogIn } from 'lucide-react';

interface HeaderProps {
  isAuthenticated?: boolean;
  userRole?: 'student' | 'teacher';
}

export function AppHeader({ isAuthenticated = false, userRole }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <Link href="/" className="flex items-center space-x-2 mr-auto">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <span className="font-bold text-xl">ProctorPrep</span>
        </Link>
        <nav className="flex items-center space-x-4">
          {isAuthenticated ? (
            <>
              <Button variant="ghost" asChild>
                <Link href={userRole === 'student' ? '/student/dashboard' : '/teacher/dashboard'}>
                  Dashboard
                </Link>
              </Button>
              <Button variant="outline">Logout</Button> {/* Mock logout */}
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
