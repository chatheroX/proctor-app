
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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarSeparator
} from '@/components/ui/sidebar'; 
import { ShieldCheck, LogOut, Settings, Loader2, UserCircle2, Fingerprint, Hash, GripVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CustomUser } from '@/types/supabase';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"


export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  group?: 'MAIN' | 'TOOLS' | 'OTHER'; // For grouping like examam.io
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

  const mainNavItems = navItems.filter(item => !item.group || item.group === 'MAIN');
  const toolsNavItems = navItems.filter(item => item.group === 'TOOLS'); // Example, adjust if needed
  const otherNavItems = navItems.filter(item => item.group === 'OTHER'); // Example

  const renderNavGroup = (items: NavItem[], groupLabel?: string) => {
    if (items.length === 0 && !groupLabel) return null;
    if (items.length === 0 && groupLabel) { // Render label even if group is empty for structure
      return (
        <SidebarGroup className="pt-2 pb-1 px-2 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="text-xs font-semibold uppercase text-sidebar-group-text tracking-wider">
                {groupLabel}
            </SidebarGroupLabel>
        </SidebarGroup>
      );
    }

    return (
      <>
        {groupLabel && (
            <SidebarGroup className="pt-2 pb-1 px-2 group-data-[collapsible=icon]:hidden">
                <SidebarGroupLabel className="text-xs font-semibold uppercase text-sidebar-group-text tracking-wider">
                    {groupLabel}
                </SidebarGroupLabel>
            </SidebarGroup>
        )}
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href} className="px-2">
              <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href)}
                tooltip={{ 
                    children: item.label, 
                    className: "group-data-[collapsible=icon]:block hidden bg-popover text-popover-foreground border-border shadow-sm rounded-sm"
                }}
                disabled={item.disabled}
                className="text-sm font-medium text-sidebar-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
                data-sidebar="menu-button" 
              >
                <Link href={item.href} className="gap-2.5">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </>
    );
  };


  return (
    <Sidebar 
        collapsible="icon" 
        className={className} 
    >
      <SidebarHeader className="p-3 border-b border-sidebar-border/60 h-16 flex items-center">
        <div className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
          <Link href="/" className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span className="font-semibold text-lg text-foreground">ProctorPrep</span>
          </Link>
          <SidebarTrigger className="text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden" />
           <SidebarTrigger className="text-muted-foreground hover:text-foreground hidden group-data-[collapsible=icon]:flex" />
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-0 flex-grow flex flex-col">
        <div className="py-3 flex-grow">
            {renderNavGroup(mainNavItems)} 
            {/* Add other groups if you define them in navItems */}
            {/* {renderNavGroup(toolsNavItems, 'TOOLS')} */}
            {/* {renderNavGroup(otherNavItems, 'OTHER')} */}
        </div>

        <div className="mt-auto p-2 border-t border-sidebar-border/60">
             <SidebarMenu className="px-2">
                <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    isActive={pathname.startsWith(`/${userRoleDashboard}/dashboard/settings`)} 
                    tooltip={{ 
                        children: "Settings", 
                         className: "group-data-[collapsible=icon]:block hidden bg-popover text-popover-foreground border-border shadow-sm rounded-sm"
                    }}
                    className="text-sm font-medium text-sidebar-foreground data-[active=true]:bg-primary data-[active=true]:text-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md"
                     data-sidebar="menu-button"
                >
                    <Link href={`/${userRoleDashboard}/dashboard/settings`} className="gap-2.5">
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                    </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
             </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/60">
        {user && (
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 overflow-hidden group-data-[collapsible=icon]:hidden">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.name || user.email || 'User'} data-ai-hint="person letter" />
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                            {(user.name || user.email || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col overflow-hidden">
                        <p className="text-xs font-medium text-foreground truncate" title={user.name || user.email}>
                        {user.name || user.email}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize truncate">
                        {user.role || 'N/A'}
                        </p>
                    </div>
                </div>
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={signOut} 
                    disabled={authLoading}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                    aria-label="Logout"
                >
                    {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                 </Button>
            </div>
        )}
        {!user && authLoading && (
            <div className="flex items-center justify-center h-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
