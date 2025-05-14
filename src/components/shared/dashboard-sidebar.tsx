
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { ShieldCheck, LogOut, Settings, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface DashboardSidebarProps {
  navItems: NavItem[];
  userRole: 'student' | 'teacher'; // Passed to determine settings link, or could be derived from context
}

export function DashboardSidebar({ navItems, userRole }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { signOut, isLoading: authLoading, userMetadata } = useAuth();
  const actualUserRole = userMetadata?.role || userRole; // Prefer role from context if available

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="p-4">
          <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
            <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
              <ShieldCheck className="h-7 w-7 text-primary" />
              <span className="font-semibold text-lg">ProctorPrep</span>
            </Link>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2 flex-grow">
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  tooltip={{ children: item.label, className: "group-data-[collapsible=icon]:block hidden"}}
                  disabled={item.disabled}
                >
                  <Link href={item.href}>
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2">
           <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(`/${actualUserRole}/dashboard/settings`)} 
                  tooltip={{ children: "Settings", className: "group-data-[collapsible=icon]:block hidden"}}
                >
                  <Link href={`/${actualUserRole}/dashboard/settings`}>
                    <Settings className="h-5 w-5" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton
                    onClick={async () => {
                      if (authLoading) return;
                      await signOut();
                    }}
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    tooltip={{ children: "Logout", className: "group-data-[collapsible=icon]:block hidden"}}
                    disabled={authLoading}
                >
                  {authLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                  <span>Logout</span>
                </SidebarMenuButton>
            </SidebarMenuItem>
           </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
