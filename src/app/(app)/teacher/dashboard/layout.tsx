
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, BookOpenCheck, Brain, BarChart3, Loader2 } from 'lucide-react';
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

  if (authLoading) {
     console.log("[TeacherDashboardLayout] Auth loading, showing layout loader.");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) { // After loading, if no user, middleware should have redirected.
    console.log("[TeacherDashboardLayout] Not auth loading and no user, rendering redirecting message (middleware should have redirected).");
     return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <p>Session not found. Redirecting to login...</p>
            <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
        </div>
    );
  }

  if (user.role === 'teacher') {
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
  
  console.log("[TeacherDashboardLayout] Fallback: User exists but role is not teacher, or unexpected state. authLoading:", authLoading, "user:", user);
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p>Access Denied or error loading dashboard. Redirecting...</p>
      <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
    </div>
  );
}
