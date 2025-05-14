
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, Database } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-session'; // Using email as session identifier
const AUTH_ROUTE = '/auth';
const PROTECTED_ROUTES_STUDENT = ['/student/dashboard'];
const PROTECTED_ROUTES_TEACHER = ['/teacher/dashboard'];


type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; userName?: string | null }>;
  signUp: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
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

    // Optimization: If user context already exists and matches the cookie,
    // and we are not doing an initial forced load, we might skip the DB query.
    // However, for robustness on navigations/reloads, re-validating is safer.
    // Let's ensure isLoading is true before any async op.
    
    if (user && user.email === userEmailFromCookie) {
      // If user is already in context and matches cookie, assume valid for this render cycle.
      // This prevents a flicker if context persists across quick navigations.
      // On a full page load/reload, 'user' will be null initially, so this won't apply.
      setIsLoading(false); 
      return;
    }

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
          setUser({ email: data.id, name: data.name ?? null });
        } else {
          Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
          setUser(null);
          if (error && error.code !== 'PGRST116') { // PGRST116: Row to retrieve was not found
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
  }, [supabase, user]); // Added user to dependency array

  useEffect(() => {
    loadUserFromCookie();
  }, [loadUserFromCookie, pathname]); // Rerun on pathname change to re-validate session potentially

  useEffect(() => {
    if (!isLoading) {
      const isAuthRoute = pathname === AUTH_ROUTE;
      const isProtectedRoute = PROTECTED_ROUTES_STUDENT.some(r => pathname?.startsWith(r)) ||
                               PROTECTED_ROUTES_TEACHER.some(r => pathname?.startsWith(r));

      if (user && isAuthRoute) {
        router.replace('/student/dashboard/overview');
      } else if (!user && isProtectedRoute) {
        router.replace(AUTH_ROUTE);
      }
    }
  }, [user, isLoading, pathname, router]);


  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string; userName?: string | null }> => {
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

    if (data.pass === pass) { // PLAIN TEXT PASSWORD COMPARISON - INSECURE
      const userName = data.name ?? null;
      const userData: CustomUser = { email: data.id, name: userName };
      Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
      setUser(userData);
      setIsLoading(false);
      return { success: true, userName };
    } else {
      setIsLoading(false);
      return { success: false, error: 'Incorrect password.' };
    }
  };

  const signUp = async (email: string, pass: string, name: string): Promise<{ success: boolean; error?: string }> => {
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
    return { success: true };
  };

  const signOut = async () => {
    setIsLoading(true);
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    setUser(null);
    // No need to setIsLoading(false) immediately before router.push,
    // as the AuthContext will re-evaluate on the new page and set loading state.
    router.push(AUTH_ROUTE);
    // It's good practice to set isLoading to false if the component might not unmount immediately
    // or if other effects depend on it. However, for a sign-out redirect, this is usually fine.
    // For consistency, we can set it:
    setIsLoading(false); 
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
