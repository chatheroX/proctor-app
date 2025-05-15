
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
  
  if (!user) { 
    console.log("[StudentDashboardLayout] Not auth loading and no user, rendering redirecting message (middleware should have redirected).");
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <p>Session not found. Redirecting to login...</p>
            <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
        </div>
    );
  }
  
  if (user.role === 'student') {
    console.log("[StudentDashboardLayout] User determined, rendering dashboard for student:", user.email);
    return (
      // SidebarProvider's root div is: "group/sidebar-wrapper flex min-h-svh w-full"
      // It will act as the main flex container for SidebarElements and main.
      // Add className="bg-muted/40" to SidebarProvider if you want that background for the whole page.
      // Add className="bg-red-300" for temporary debugging of the provider's area.
      <SidebarProvider defaultOpen className="bg-muted/40"> 
        <SidebarElements
          navItems={studentNavItems}
          userRoleDashboard="student"
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

  // Fallback for incorrect role or other issues
  console.log(`[StudentDashboardLayout] User ${user.email} is not a student (role: ${user.role}). This should ideally be handled by middleware redirecting to the correct dashboard or an error page.`);
   return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <p>Access Denied or error loading student dashboard. Role: {user.role}.</p>
      <Loader2 className="ml-2 h-4 w-4 animate-spin"/>
    </div>
  );
}
