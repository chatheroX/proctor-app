
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, Edit3, History, Loader2, Settings, AlertTriangle } from 'lucide-react';
import React, { useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) { // Should be caught by middleware, but as a fallback
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background p-4">
            <Card className="p-6 modern-card text-center">
              <CardHeader>
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3"/>
                <CardTitle className="text-xl">Session Not Found</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Redirecting to login...</p>
              </CardContent>
            </Card>
        </div>
    );
  }
  
  if (user.role !== 'student') {
     return (
        <div className="flex h-screen w-full items-center justify-center bg-background p-4">
             <Card className="p-6 modern-card text-center">
                <CardHeader>
                    <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3"/>
                    <CardTitle className="text-xl">Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Your role ({user.role}) does not permit access here.</p>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  return (
    <SidebarProvider 
        defaultOpen 
        className="bg-background min-h-screen" // Use plain background
    > 
      <SidebarElements
        navItems={studentNavItems}
        userRoleDashboard="student"
        user={user}
        signOut={handleSignOut}
        authLoading={authLoading}
        className="bg-sidebar-background border-r border-sidebar-border shadow-sm" 
      />
      <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8 bg-muted/30 min-w-0"> 
        {/* TODO: Add Framer Motion Page Wrapper here for content animations */}
        {children}
      </main>
    </SidebarProvider>
  );
}
