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
import { Button } from '@/components/ui/button';
import { ShieldCheck, LogOut, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface DashboardSidebarProps {
  navItems: NavItem[];
  userRole: 'student' | 'teacher';
}

export function DashboardSidebar({ navItems, userRole }: DashboardSidebarProps) {
  const pathname = usePathname();

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
                  isActive={pathname.startsWith(`/${userRole}/dashboard/settings`)} // Generic settings path
                  tooltip={{ children: "Settings", className: "group-data-[collapsible=icon]:block hidden"}}
                >
                  <Link href={`/${userRole}/dashboard/settings`}>
                    <Settings className="h-5 w-5" />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            <SidebarMenuItem>
                 {/* This is a mock logout. In a real app, it would clear session/token and redirect. */}
                <SidebarMenuButton
                    asChild
                    variant="outline"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    tooltip={{ children: "Logout", className: "group-data-[collapsible=icon]:block hidden"}}
                >
                    <Link href="/auth?action=login">
                        <LogOut className="h-5 w-5" />
                        <span>Logout</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
           </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </SidebarProvider>
  );
}
