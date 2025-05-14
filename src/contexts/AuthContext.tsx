
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-session';
const AUTH_ROUTE = '/auth';
const DEFAULT_DASHBOARD_ROUTE = '/student/dashboard/overview'; // Centralized default
const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];


type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser }>;
  signUp: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string; user?: CustomUser }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserFromCookie = useCallback(async () => {
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);

    // If user context is already set and matches cookie, and not currently forced loading, skip DB.
    // This helps prevent re-fetch immediately after login/signup if state is already good.
    if (user && user.email === userEmailFromCookie && !isLoading) {
      // setUser(user); // Ensure state is consistent if needed, though should be already.
      // setIsLoading(false); // Already false if this condition is met.
      return;
    }
    
    // If we are here, either user is null, or cookie doesn't match, or forced loading.
    // Always set loading true before async operation.
    setIsLoading(true);

    if (userEmailFromCookie) {
      console.time('Supabase LoadUserFromCookie Query');
      try {
        const { data, error } = await supabase
          .from('proctorX')
          .select('id, name')
          .eq('id', userEmailFromCookie)
          .single();
        console.timeEnd('Supabase LoadUserFromCookie Query');

        if (data && !error) {
          const loadedUser: CustomUser = { email: data.id, name: data.name ?? null };
          setUser(loadedUser);
        } else {
          Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
          setUser(null);
          if (error && error.code !== 'PGRST116') {
            console.error('Error re-validating user from DB:', error.message);
          }
        }
      } catch (e: any) {
        console.error('Error processing user session:', e);
        Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.email]); // Depend on user.email to re-run if it changes from outside

  useEffect(() => {
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Re-validate on path changes

  useEffect(() => {
    if (!isLoading) {
      const isAuthRoute = pathname === AUTH_ROUTE;
      const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname?.startsWith(p));

      if (user && isAuthRoute) {
        router.replace(DEFAULT_DASHBOARD_ROUTE);
      } else if (!user && isProtectedRoute) {
        router.replace(AUTH_ROUTE);
      }
    }
  }, [user, isLoading, pathname, router]);


  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser }> => {
    setIsLoading(true);
    console.time('Supabase SignIn Query');
    const { data, error } = await supabase
      .from('proctorX')
      .select('id, pass, name')
      .eq('id', email)
      .single();
    console.timeEnd('Supabase SignIn Query');

    if (error || !data) {
      setIsLoading(false);
      return { success: false, error: error?.message || 'User not found or database error.' };
    }

    if (data.pass === pass) {
      const userData: CustomUser = { email: data.id, name: data.name ?? null };
      Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
      setUser(userData);
      setIsLoading(false);
      return { success: true, user: userData };
    } else {
      setIsLoading(false);
      return { success: false, error: 'Incorrect password.' };
    }
  };

  const signUp = async (email: string, pass: string, name: string): Promise<{ success: boolean; error?: string; user?: CustomUser }> => {
    setIsLoading(true);
    const { data: existingUser, error: selectError } = await supabase
      .from('proctorX')
      .select('id')
      .eq('id', email)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      setIsLoading(false);
      return { success: false, error: 'Error checking existing user: ' + selectError.message };
    }
    if (existingUser) {
      setIsLoading(false);
      return { success: false, error: 'User with this email already exists.' };
    }

    const { error: insertError } = await supabase
      .from('proctorX')
      .insert([{ id: email, pass: pass, name: name }]);

    if (insertError) {
      setIsLoading(false);
      return { success: false, error: 'Registration failed: ' + insertError.message };
    }

    const userData: CustomUser = { email, name };
    Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
    setUser(userData);
    setIsLoading(false);
    return { success: true, user: userData };
  };

  const signOut = async () => {
    setIsLoading(true); // Set loading true before async op
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    setUser(null);
    // router.push will trigger path change, which re-runs loadUserFromCookie & protection useEffect.
    // loadUserFromCookie will set isLoading false after it's done.
    router.push(AUTH_ROUTE); 
    // No need to setIsLoading(false) here if router.push causes context re-evaluation that handles it.
    // However, for safety if component doesn't unmount/re-eval immediately:
    // setIsLoading(false); 
  };

  const value = {
    user,
    isLoading,
    signIn,
    signUp,
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
