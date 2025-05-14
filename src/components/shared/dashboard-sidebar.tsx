
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar'; 
import { ShieldCheck, LogOut, Settings, Loader2, UserCircle2, Fingerprint } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CustomUser } from '@/types/supabase';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

interface SidebarElementsProps {
  navItems: NavItem[];
  userRoleDashboard: 'student' | 'teacher'; // To construct settings link
  user: CustomUser | null; 
  signOut: () => Promise<void>; 
  authLoading: boolean; 
}

export function SidebarElements({ navItems, userRoleDashboard, user, signOut, authLoading }: SidebarElementsProps) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" className="border-r bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="p-4">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <span className="font-semibold text-lg text-sidebar-foreground">ProctorPrep</span>
          </Link>
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2 flex-grow">
        {user && (
          <div className="px-2 py-3 mb-2 border-b border-sidebar-border group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-7 w-7 text-sidebar-foreground/80"/>
              <div>
                <p className="text-sm font-medium text-sidebar-foreground truncate" title={user.name || user.email}>
                  {user.name || user.email}
                </p>
                <p className="text-xs text-sidebar-foreground/60 capitalize">
                  Role: {user.role || 'N/A'}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-xs text-sidebar-foreground/50" title={user.uuid}>
                <Fingerprint className="h-3 w-3"/> 
                <span className="truncate">ID: {user.uuid}</span>
            </div>
          </div>
        )}
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
                isActive={pathname.startsWith(`/${userRoleDashboard}/dashboard/settings`)} 
                tooltip={{ children: "Settings", className: "group-data-[collapsible=icon]:block hidden"}}
              >
                <Link href={`/${userRoleDashboard}/dashboard/settings`}>
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
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/50"
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
  );
}
