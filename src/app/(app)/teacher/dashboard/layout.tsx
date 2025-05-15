
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, BookOpenCheck, Brain, BarChart3, Loader2 } from 'lucide-react';
import { useCallback, ReactNode } from 'react'; // Added ReactNode

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
  children: ReactNode;
}) {
  const { user, signOut, isLoading: authLoading } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  if (authLoading && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-background via-muted to-background">
        {/* TODO: Add Framer Motion loader animation */}
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!authLoading && !user) {
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
  
  if (user && user.role !== 'teacher') {
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
  
  return (
    <SidebarProvider defaultOpen className="bg-gradient-to-br from-primary/5 via-muted/50 to-accent/5 dark:from-primary/10 dark:via-background dark:to-accent/10"> 
      <SidebarElements
        navItems={teacherNavItems}
        userRoleDashboard="teacher"
        user={user}
        signOut={handleSignOut}
        authLoading={authLoading}
        className="bg-card/20 dark:bg-card/30 backdrop-blur-xl border-r border-white/10 dark:border-black/20 shadow-2xl"
      />
      <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8 bg-transparent min-w-0"> 
        {/* TODO: Add Framer Motion Page Wrapper here for content animations */}
        {children}
      </main>
    </SidebarProvider>
  );
}
