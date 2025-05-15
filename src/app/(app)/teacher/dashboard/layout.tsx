
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, BookOpenCheck, Brain, BarChart3 } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useCallback } from 'react';

const teacherNavItems: NavItem[] = [
  { href: '/teacher/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/teacher/dashboard/exams', label: 'Manage Exams', icon: BookOpenCheck },
  { href: '/teacher/dashboard/ai-assistant', label: 'AI Assistant', icon: Brain },
  { href: '/teacher/dashboard/results', label: 'Student Results', icon: BarChart3 },
  { href: '/teacher/dashboard/profile', label: 'My Profile', icon: UserCircle },
];

export default function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, signOut, isLoading: authLoading } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  if (authLoading && user === undefined) {
     console.log("[TeacherDashboardLayout] Auth loading and user undefined, showing layout loader.");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!authLoading && !user) {
    console.log("[TeacherDashboardLayout] Not auth loading and no user, rendering redirecting message (middleware should have redirected).");
     return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <p>Session not found. Redirecting...</p>
            <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
        </div>
    );
  }

  if (user && user.role === 'teacher') { // Ensure user is a teacher for this layout
    console.log("[TeacherDashboardLayout] User determined, rendering dashboard for teacher:", user.email);
    return (
      <SidebarProvider defaultOpen>
        <div className="flex h-screen w-full bg-muted/40 overflow-x-hidden">
          <SidebarElements
            navItems={teacherNavItems}
            userRoleDashboard="teacher"
            user={user}
            signOut={handleSignOut}
            authLoading={authLoading}
          />
          <main className="flex-1 flex flex-col overflow-auto p-6 bg-background min-w-0">
            {children}
          </main>
        </div>
      </SidebarProvider>
    );
  }
  
  // If user exists but is not a teacher, or some other unexpected state
  console.log("[TeacherDashboardLayout] Fallback: User exists but role is not teacher, or unexpected state. authLoading:", authLoading, "user:", user);
  return ( // Fallback to a generic loading or error state, or redirect if appropriate
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p>Access Denied or Loading dashboard...</p>
      <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
    </div>
  );
}
