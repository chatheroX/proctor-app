
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser } from '@/types/supabase'; // Using CustomUser

const SESSION_COOKIE_NAME = 'proctorprep-user-session';

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
    const userCookie = Cookies.get(SESSION_COOKIE_NAME);
    if (userCookie) {
      try {
        const parsedUser: CustomUser = JSON.parse(userCookie);
        // For this custom auth, the cookie IS the session.
        // Re-validating name from DB in case it changed, email is the key.
        const { data, error } = await supabase.from('proctorX').select('name').eq('id', parsedUser.email).single();
        if (data) {
          setUser({ email: parsedUser.email, name: data.name ?? null });
        } else {
          // If user not found in DB, invalidate cookie
          Cookies.remove(SESSION_COOKIE_NAME);
          setUser(null);
          if (error) console.error('Error re-validating user from DB:', error.message);
        }
      } catch (e) {
        console.error('Failed to parse user cookie:', e);
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

  // Handle redirects based on custom auth state and path
  useEffect(() => {
    if (!isLoading) {
      const isDashboardRoute = pathname?.startsWith('/student/dashboard') || pathname?.startsWith('/teacher/dashboard');
      
      if (!user && isDashboardRoute) {
        router.replace('/auth');
      }
      
      if (user && pathname === '/auth') {
        // If logged in and on auth page, redirect to student dashboard (default)
        router.replace('/student/dashboard/overview');
      }
    }
  }, [user, isLoading, pathname, router]);


  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('proctorX')
      .select('id, pass, name')
      .eq('id', email)
      .single();

    if (error || !data) {
      setIsLoading(false);
      return { success: false, error: 'User not found or database error.' };
    }

    // PLAIN TEXT PASSWORD COMPARISON - HIGHLY INSECURE
    if (data.pass === pass) {
      const userData: CustomUser = { email: data.id, name: data.name ?? null };
      Cookies.set(SESSION_COOKIE_NAME, JSON.stringify(userData), { expires: 7, path: '/' });
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
    // Check if user already exists
    const { data: existingUser, error: selectError } = await supabase
      .from('proctorX')
      .select('id')
      .eq('id', email)
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116: "Row to retrieve was not found" (expected if user doesn't exist)
      setIsLoading(false);
      return { success: false, error: 'Error checking existing user: ' + selectError.message };
    }
    if (existingUser) {
      setIsLoading(false);
      return { success: false, error: 'User with this email already exists.' };
    }

    // Insert new user - STORING PLAINTEXT PASSWORD - HIGHLY INSECURE
    const { error: insertError } = await supabase
      .from('proctorX')
      .insert([{ id: email, pass: pass, name: name }]);

    if (insertError) {
      setIsLoading(false);
      return { success: false, error: 'Registration failed: ' + insertError.message };
    }

    const userData: CustomUser = { email, name };
    Cookies.set(SESSION_COOKIE_NAME, JSON.stringify(userData), { expires: 7, path: '/' });
    setUser(userData);
    setIsLoading(false);
    return { success: true };
  };

  const signOut = async () => {
    setIsLoading(true);
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    setUser(null);
    router.push('/auth'); // Redirect to login after sign out
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
