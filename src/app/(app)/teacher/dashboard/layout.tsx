
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

  if (!user) { 
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
      // SidebarProvider's root div is: "group/sidebar-wrapper flex min-h-svh w-full"
      // It will act as the main flex container for SidebarElements and main.
      // Add className="bg-muted/40" to SidebarProvider if you want that background for the whole page.
      // Add className="bg-red-300" for temporary debugging of the provider's area.
      <SidebarProvider defaultOpen className="bg-muted/40">
        <SidebarElements
          navItems={teacherNavItems}
          userRoleDashboard="teacher"
          user={user}
          signOut={handleSignOut}
          authLoading={authLoading}
           // To debug sidebar's own background/space, you might need to pass a className
          // into SidebarElements that it then applies to the <Sidebar> component.
          // e.g., className="TEMPORARY_DEBUG_BG_GREEN"
        />
        {/* Add className="bg-blue-300" for temporary debugging of the main content area */}
        <main className="flex-1 flex flex-col overflow-y-auto p-6 bg-background min-w-0">
          {children}
        </main>
      </SidebarProvider>
    );
  }
  
  console.log(`[TeacherDashboardLayout] User ${user.email} is not a teacher (role: ${user.role}). This should ideally be handled by middleware redirecting to the correct dashboard or an error page.`);
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p>Access Denied or error loading teacher dashboard. Role: {user.role}.</p>
      <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
    </div>
  );
}
