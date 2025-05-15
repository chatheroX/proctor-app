
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, Edit3, History, Loader2, Settings } from 'lucide-react';
import React, { useCallback } from 'react'; // Added React import

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

  if (authLoading && !user) { 
    // console.log("[StudentDashboardLayout] Auth loading, no user yet, showing layout loader.");
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-background via-muted to-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!authLoading && !user) { 
    // console.log("[StudentDashboardLayout] Not auth loading and no user, rendering redirecting message (middleware should have redirected).");
    return (
        <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-background via-muted to-background">
            <div className="p-8 rounded-lg shadow-2xl bg-card/80 backdrop-blur-md text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary mb-4"/>
                <p className="text-lg font-medium text-foreground">Session not found.</p>
                <p className="text-sm text-muted-foreground">Redirecting to login...</p>
            </div>
        </div>
    );
  }
  
  // If user exists but role is incorrect (should also be caught by middleware ideally)
  if (user && user.role !== 'student') {
    // console.log(`[StudentDashboardLayout] User ${user.email} is not a student (role: ${user.role}).`);
     return (
        <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-background via-muted to-background">
             <div className="p-8 rounded-lg shadow-2xl bg-card/80 backdrop-blur-md text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-destructive mb-4"/>
                <p className="text-lg font-medium text-destructive">Access Denied.</p>
                <p className="text-sm text-muted-foreground">Your role ({user.role}) does not permit access here.</p>
            </div>
        </div>
    );
  }
  
  // console.log("[StudentDashboardLayout] User determined, rendering dashboard for student:", user?.email);
  return (
    <SidebarProvider defaultOpen className="bg-gradient-to-br from-primary/5 via-muted/50 to-accent/5 dark:from-primary/10 dark:via-background dark:to-accent/10"> 
      <SidebarElements
        navItems={studentNavItems}
        userRoleDashboard="student"
        user={user}
        signOut={handleSignOut}
        authLoading={authLoading}
        // Example of trying a glassmorphic effect for sidebar:
        // Note: True backdrop-blur needs setup if not default in Tailwind
        className="bg-card/20 dark:bg-card/30 backdrop-blur-xl border-r border-white/10 dark:border-black/20 shadow-2xl"
      />
      <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8 bg-transparent min-w-0"> 
        {/* TODO: Add Framer Motion Page Wrapper here for content animations */}
        {children}
      </main>
    </SidebarProvider>
  );
}
