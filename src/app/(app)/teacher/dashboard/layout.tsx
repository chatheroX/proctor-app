
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar'; // Updated import name
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, BookOpenCheck, Brain, BarChart3 } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useCallback } from 'react'; // Added useCallback

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
    console.log("[TeacherDashboardLayout] Not auth loading and no user, rendering null (middleware should redirect).");
     return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <p>Session not found. Redirecting...</p>
            <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
        </div>
    );
  }

  if (user) {
    console.log("[TeacherDashboardLayout] User determined, rendering dashboard for:", user.email);
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
  
  console.log("[TeacherDashboardLayout] Fallback: Reached unexpected state. authLoading:", authLoading, "user:", user);
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p>Loading dashboard...</p>
      <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
    </div>
  );
}
