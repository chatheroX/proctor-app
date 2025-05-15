
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
import { ShieldCheck, LogOut, Settings, Loader2, UserCircle2, Fingerprint, Hash } from 'lucide-react';
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
  userRoleDashboard: 'student' | 'teacher';
  user: CustomUser | null; 
  signOut: () => Promise<void>; 
  authLoading: boolean;
  className?: string; 
}

export function SidebarElements({ navItems, userRoleDashboard, user, signOut, authLoading, className }: SidebarElementsProps) {
  const pathname = usePathname();

  return (
    <Sidebar 
        collapsible="icon" 
        className={className} // Apply passed className for effects like backdrop-blur
    >
      <SidebarHeader className="p-4 border-b border-sidebar-border/30">
        <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
          <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <span className="font-semibold text-xl text-sidebar-foreground">ProctorPrep</span>
          </Link>
          <SidebarTrigger className="text-sidebar-foreground/70 hover:text-sidebar-foreground" />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2 flex-grow">
        {user && (
          <div className="px-2 py-3 mb-2 border-b border-sidebar-border/20 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-3">
              <UserCircle2 className="h-10 w-10 text-sidebar-primary"/>
              <div>
                <p className="text-sm font-medium text-sidebar-foreground truncate" title={user.name || user.email}>
                  {user.name || user.email}
                </p>
                <p className="text-xs text-sidebar-foreground/70 capitalize">
                  Role: {user.role || 'N/A'}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-sidebar-foreground/60" title={user.user_id}>
                <Hash className="h-3.5 w-3.5"/> 
                <span className="truncate">ID: {user.user_id}</span>
            </div>
          </div>
        )}
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              {/* TODO: Add Framer Motion for item hover/selection animation */}
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                tooltip={{ 
                    children: item.label, 
                    className: "group-data-[collapsible=icon]:block hidden bg-popover/90 text-popover-foreground backdrop-blur-sm border-border/50 shadow-lg"
                }}
                disabled={item.disabled}
                className="data-[active=true]:bg-sidebar-primary/20 data-[active=true]:text-sidebar-primary hover:bg-sidebar-accent/70 focus:bg-sidebar-accent/70 text-sidebar-foreground/90 hover:text-sidebar-foreground"
                // The glow effect is now primarily handled by global CSS targeting data-sidebar="menu-button"
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
      <SidebarFooter className="p-2 border-t border-sidebar-border/30">
         <SidebarMenu>
          <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(`/${userRoleDashboard}/dashboard/settings`)} 
                tooltip={{ 
                    children: "Settings", 
                    className: "group-data-[collapsible=icon]:block hidden bg-popover/90 text-popover-foreground backdrop-blur-sm border-border/50 shadow-lg"
                }}
                className="hover:bg-sidebar-accent/70 focus:bg-sidebar-accent/70 text-sidebar-foreground/90 hover:text-sidebar-foreground"
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
                  className="text-destructive hover:bg-destructive/20 hover:text-destructive border-destructive/50 focus:bg-destructive/20"
                  tooltip={{ 
                    children: "Logout", 
                    className: "group-data-[collapsible=icon]:block hidden bg-popover/90 text-popover-foreground backdrop-blur-sm border-border/50 shadow-lg"
                   }}
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
