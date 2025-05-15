
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar'; // Updated import name
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, Edit3, History, CheckSquare } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useCallback } from 'react'; // Added useCallback

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

  // Memoize signOut to prevent re-renders of SidebarElements if it were passed directly
  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  // This loader covers the case where auth state is being determined.
  // If user is null after loading, middleware should redirect to /auth.
  if (authLoading && user === undefined) { // Show loader if auth is loading AND user state is not yet determined
    console.log("[StudentDashboardLayout] Auth loading and user undefined, showing layout loader.");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  // If not loading and user is definitively null, middleware should have redirected.
  // This is a fallback or for brief moments before redirect effect takes place.
  if (!authLoading && !user) {
    console.log("[StudentDashboardLayout] Not auth loading and no user, rendering null (middleware should redirect).");
    // Or show a message like "Redirecting to login..."
    // For now, returning null might be okay if middleware is robust.
    // Or, a more explicit loading/redirecting state could be shown.
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <p>Session not found. Redirecting...</p>
            <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
        </div>
    );
  }

  // If user exists (even if authLoading might still be true for a brief moment after user is set), render dashboard.
  // This prioritizes showing dashboard UI once user data is available.
  if (user) {
    console.log("[StudentDashboardLayout] User determined, rendering dashboard for:", user.email);
    return (
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full bg-muted/40 overflow-x-hidden">
          <SidebarElements 
            navItems={studentNavItems} 
            userRoleDashboard="student"
            user={user} // Pass the user object
            signOut={handleSignOut} // Pass the memoized signOut
            authLoading={authLoading} // Pass authLoading for internal use in SidebarElements if needed
          />
          <main className="flex-1 flex flex-col overflow-auto p-6 bg-background min-w-0">
            {children}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  // Fallback for any other unhandled state (should ideally not be reached if logic above is correct)
  console.log("[StudentDashboardLayout] Fallback: Reached unexpected state. authLoading:", authLoading, "user:", user);
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p>Loading dashboard...</p>
      <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
    </div>
  );
}
