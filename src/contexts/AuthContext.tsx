
'use client';

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import type { UserMetadata } from '@/types/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  userMetadata: UserMetadata | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userMetadata, setUserMetadata] = useState<UserMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    const { data: { session: currentSession }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error fetching session:', error);
      setSession(null);
      setUser(null);
      setUserMetadata(null);
    } else {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setUserMetadata((currentSession?.user?.user_metadata as UserMetadata) ?? null);
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase.auth]);

  useEffect(() => {
    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setUserMetadata((newSession?.user?.user_metadata as UserMetadata) ?? null);
        setIsLoading(false);

        // If user logs out and is on a protected route, redirect to auth
        if (!newSession && (pathname?.startsWith('/student/dashboard') || pathname?.startsWith('/teacher/dashboard'))) {
          router.replace('/auth');
        }
         // If user logs in and is on auth page, redirect to dashboard
        if (newSession && pathname === '/auth') {
           const role = (newSession?.user?.user_metadata as UserMetadata)?.role;
           if (role === 'student') {
             router.replace('/student/dashboard');
           } else if (role === 'teacher') {
             router.replace('/teacher/dashboard');
           } else {
             router.replace('/'); // Fallback if role is not defined
           }
        }
      }
    );

    return () => {
      authListener?.unsubscribe();
    };
  }, [supabase.auth, fetchSession, router, pathname]);

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setUserMetadata(null);
    router.push('/auth'); // Redirect to login after sign out
    setIsLoading(false);
  };

  const value = {
    session,
    user,
    userMetadata,
    isLoading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
