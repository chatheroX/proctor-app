
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, Database } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-session'; // Using email as session identifier

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
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
    setIsLoading(true);
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    if (userEmailFromCookie) {
      try {
        // Re-fetch user details from DB using the email from cookie to ensure data is fresh
        // IMPORTANT: Ensure the 'id' column in your proctorX table is indexed for performance.
        const { data, error } = await supabase
          .from('proctorX')
          .select('id, name') // Select email (id) and name
          .eq('id', userEmailFromCookie)
          .single();

        if (data && !error) {
          setUser({ email: data.id, name: data.name ?? null });
        } else {
          Cookies.remove(SESSION_COOKIE_NAME);
          setUser(null);
          if (error) console.error('Error re-validating user from DB:', error.message);
        }
      } catch (e) {
        console.error('Error processing user session:', e);
        Cookies.remove(SESSION_COOKIE_NAME);
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadUserFromCookie();
  }, [loadUserFromCookie]);

  useEffect(() => {
    if (!isLoading) {
      const isDashboardRoute = pathname?.startsWith('/student/dashboard') || pathname?.startsWith('/teacher/dashboard');
      if (!user && isDashboardRoute) {
        router.replace('/auth');
      }
    }
  }, [user, isLoading, pathname, router]);

  useEffect(() => {
    if (!isLoading && user && pathname === '/auth') {
      router.replace('/student/dashboard/overview');
    }
  }, [user, isLoading, pathname, router]);


  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    // IMPORTANT: Ensure the 'id' column in your proctorX table (used for email lookup) 
    // is indexed in your Supabase database for optimal performance, especially as the table grows.
    console.time('Supabase SignIn Query');
    const { data, error } = await supabase
      .from('proctorX')
      .select('id, pass, name')
      .eq('id', email)
      .single();
    console.timeEnd('Supabase SignIn Query');

    if (error || !data) {
      setIsLoading(false);
      return { success: false, error: 'User not found or database error.' };
    }

    if (data.pass === pass) { // PLAIN TEXT PASSWORD COMPARISON - INSECURE
      const userData: CustomUser = { email: data.id, name: data.name ?? null };
      Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
      setUser(userData);
      setIsLoading(false);
      return { success: true };
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

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116: "Row to retrieve was not found"
      setIsLoading(false);
      return { success: false, error: 'Error checking existing user: ' + selectError.message };
    }
    if (existingUser) {
      setIsLoading(false);
      return { success: false, error: 'User with this email already exists.' };
    }

    const { error: insertError } = await supabase
      .from('proctorX')
      .insert([{ id: email, pass: pass, name: name }]); // Storing plaintext password - INSECURE

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
    router.push('/auth');
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
