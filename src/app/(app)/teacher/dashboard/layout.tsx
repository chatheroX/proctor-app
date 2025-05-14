
'use client';
import { SidebarProvider } from '@/components/ui/sidebar';
import { SidebarElements, NavItem } from '@/components/shared/dashboard-sidebar'; 
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, UserCircle, BookOpenCheck, ListChecks, Brain, BarChart3 } from 'lucide-react';
import { Loader2 } from 'lucide-react';

const teacherNavItems: NavItem[] = [
  { href: '/teacher/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/teacher/dashboard/exams', label: 'Manage Exams', icon: BookOpenCheck },
  { href: '/teacher/dashboard/questions', label: 'Question Bank', icon: ListChecks, disabled: true }, 
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
          navItems={teacherNavItems} 
          userRoleDashboard="teacher"
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
