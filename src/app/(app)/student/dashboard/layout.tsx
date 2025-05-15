
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Edit3, History, Loader2, AlertTriangle } from 'lucide-react';
import React, { useCallback, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const studentNavItems: NavItem[] = [
  { href: '/student/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/student/dashboard/join-exam', label: 'Join Exam', icon: Edit3 },
  { href: '/student/dashboard/exam-history', label: 'Exam History', icon: History },
];

export default function StudentDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, signOut, isLoading: authLoading, authError } = useAuth();

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  if (authLoading) { // Primary loading state check
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100 dark:bg-slate-900">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-muted-foreground">Loading student session...</p>
      </div>
    );
  }

  if (!user) { // Auth loading is false, but no user
    return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
            <Card className="p-6 modern-card text-center shadow-xl">
              <CardHeader>
                <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3"/>
                <CardTitle className="text-xl text-foreground">Session Not Found</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {authError ? authError : "Your session may have expired or is invalid."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Redirecting to login...</p>
              </CardContent>
            </Card>
        </div>
    );
  }
  
  if (user.role !== 'student') {
     return (
        <div className="flex h-screen w-full items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
             <Card className="p-6 modern-card text-center shadow-xl">
                <CardHeader>
                    <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3"/>
                    <CardTitle className="text-xl text-foreground">Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Your role ({user.role || 'Unknown'}) does not permit access to this dashboard.</p>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  return (
    <SidebarProvider 
        defaultOpen 
        className="bg-slate-100 dark:bg-slate-900 min-h-screen"
    > 
      <SidebarElements
        navItems={studentNavItems}
        userRoleDashboard="student"
        user={user} 
        signOut={handleSignOut}
        authLoading={authLoading} // Pass this down if SidebarElements needs it
      />
      <main className="flex-1 flex flex-col overflow-y-auto p-6 md:p-8 bg-transparent min-w-0"> 
        {children}
      </main>
    </SidebarProvider>
  );
}
