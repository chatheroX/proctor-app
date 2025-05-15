
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, Edit3, History, Loader2 } from 'lucide-react';
import { useCallback } from 'react';

const studentNavItems: NavItem[] = [
  { href: '/student/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/student/dashboard/join-exam', label: 'Join Exam', icon: Edit3 },
  { href: '/student/dashboard/exam-history', label: 'Exam History', icon: History },
  { href: '/student/dashboard/profile', label: 'My Profile', icon: UserCircle },
];

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, signOut, isLoading: authLoading } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  if (authLoading) {
    console.log("[StudentDashboardLayout] Auth loading, showing layout loader.");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) { // After loading, if no user, middleware should have redirected. This is a fallback.
    console.log("[StudentDashboardLayout] Not auth loading and no user, rendering redirecting message (middleware should redirect).");
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <p>Session not found. Redirecting to login...</p>
            <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
        </div>
    );
  }

  // If user exists and role is student, render dashboard.
  if (user.role === 'student') {
    console.log("[StudentDashboardLayout] User determined, rendering dashboard for student:", user.email);
    return (
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full bg-muted/40 overflow-x-hidden">
          <SidebarElements 
            navItems={studentNavItems} 
            userRoleDashboard="student"
            user={user}
            signOut={handleSignOut}
            authLoading={authLoading} // Pass authLoading for internal use in SidebarElements if needed
          />
          <main className="flex-1 flex flex-col overflow-auto p-6 bg-background min-w-0">
            {children}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  // Fallback for incorrect role or other issues
  console.log("[StudentDashboardLayout] User exists but role is not student or unexpected state. authLoading:", authLoading, "user:", user);
   return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p>Access Denied or error loading dashboard. Redirecting...</p>
      <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
    </div>
  );
}
