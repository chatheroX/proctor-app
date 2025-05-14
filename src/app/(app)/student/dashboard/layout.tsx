'use client';
import { DashboardSidebar, NavItem } from '@/components/shared/dashboard-sidebar';
import { LayoutDashboard, UserCircle, Edit3, History, Settings, CheckSquare } from 'lucide-react';

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
  return (
    <div className="flex h-screen w-full bg-muted/40 overflow-x-hidden">
      <DashboardSidebar navItems={studentNavItems} userRole="student" />
      <main className="flex-1 flex flex-col overflow-auto p-6 bg-background min-w-0">
        {children}
      </main>
    </div>
  );
}
