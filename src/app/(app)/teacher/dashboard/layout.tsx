'use client';
import { DashboardSidebar, NavItem } from '@/components/shared/dashboard-sidebar';
import { LayoutDashboard, UserCircle, BookOpenCheck, ListChecks, Brain, Settings, BarChart3 } from 'lucide-react';

const teacherNavItems: NavItem[] = [
  { href: '/teacher/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/teacher/dashboard/exams', label: 'Manage Exams', icon: BookOpenCheck },
  { href: '/teacher/dashboard/questions', label: 'Question Bank', icon: ListChecks, disabled: true }, // Placeholder
  { href: '/teacher/dashboard/ai-assistant', label: 'AI Assistant', icon: Brain },
  { href: '/teacher/dashboard/results', label: 'Student Results', icon: BarChart3 },
  { href: '/teacher/dashboard/profile', label: 'My Profile', icon: UserCircle },
];

export default function TeacherDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-muted/40">
      <DashboardSidebar navItems={teacherNavItems} userRole="teacher" />
      <main className="flex-1 flex flex-col overflow-auto p-6 bg-background min-w-0">
        {children}
      </main>
    </div>
  );
}
