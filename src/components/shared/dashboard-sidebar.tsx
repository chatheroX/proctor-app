
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
} from '@/components/ui/sidebar'; // SidebarProvider is removed from here
import { ShieldCheck, LogOut, Settings, Loader2 } from 'lucide-react';
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
  userRole: 'student' | 'teacher';
  user: CustomUser | null; // Pass user from layout
  signOut: () => Promise<void>; // Pass signOut from layout
  authLoading: boolean; // Pass authLoading from layout
}

export function SidebarElements({ navItems, userRole, user, signOut, authLoading }: SidebarElementsProps) {
  const pathname = usePathname();
  // useAuth() is no longer called here; props are passed down

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
                isActive={pathname.startsWith(`/${userRole}/dashboard/settings`)} 
                tooltip={{ children: "Settings", className: "group-data-[collapsible=icon]:block hidden"}}
              >
                <Link href={`/${userRole}/dashboard/settings`}>
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
