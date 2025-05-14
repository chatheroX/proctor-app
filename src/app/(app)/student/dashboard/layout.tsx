
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, Edit3, History, CheckSquare } from 'lucide-react';
import { Loader2 } from 'lucide-react';

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

  if (authLoading && !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-full bg-muted/40 overflow-x-hidden">
        <SidebarElements 
          navItems={studentNavItems} 
          userRoleDashboard="student"
          user={user}
          signOut={signOut}
          authLoading={authLoading} 
        />
        <main className="flex-1 flex flex-col overflow-auto p-6 bg-background min-w-0">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
