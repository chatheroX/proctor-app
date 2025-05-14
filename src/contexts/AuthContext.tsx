
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email'; // Store email in cookie
const ROLE_COOKIE_NAME = 'proctorprep-user-role'; // Store role in cookie

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser }>;
  signUp: (email: string, pass: string, name: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string; user?: CustomUser }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; currentEmail: string; password?: string}) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getRedirectPathForRole = (role: 'student' | 'teacher' | null) => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    return STUDENT_DASHBOARD_ROUTE; // Default to student dashboard
  };
  
  const loadUserFromCookie = useCallback(async () => {
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    const userRoleFromCookie = Cookies.get(ROLE_COOKIE_NAME) as 'student' | 'teacher' | undefined;

    if (user && user.email === userEmailFromCookie && user.role === userRoleFromCookie && !isLoading) {
      return; 
    }
    
    setIsLoading(true);

    if (userEmailFromCookie) {
      console.time('Supabase LoadUserFromCookie Query');
      try {
        const { data, error } = await supabase
          .from('proctorX')
          .select('uuid, id, name, role') // id is email column
          .eq('id', userEmailFromCookie) // Query by email
          .single();
        console.timeEnd('Supabase LoadUserFromCookie Query');

        if (data && !error) {
          const loadedUser: CustomUser = { uuid: data.uuid, email: data.id, name: data.name ?? null, role: data.role as CustomUser['role'] };
          setUser(loadedUser);
          // Ensure role cookie is also consistent if it wasn't already
          if (data.role && Cookies.get(ROLE_COOKIE_NAME) !== data.role) {
            Cookies.set(ROLE_COOKIE_NAME, data.role, { expires: 7, path: '/' });
          }
        } else {
          Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
          Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
          setUser(null);
          if (error && error.code !== 'PGRST116') { 
            console.error('Error re-validating user from DB:', error.message);
          }
        }
      } catch (e: any) {
        console.error('Error processing user session:', e);
        Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
        Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
        setUser(null);
      }
    } else {
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME, { path: '/' }); // Also clear role cookie if email cookie is gone
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.email, user?.role]);

  useEffect(() => {
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!isLoading) {
      const isAuthRoute = pathname === AUTH_ROUTE;
      const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname?.startsWith(p));

      if (user && isAuthRoute) {
        router.replace(getRedirectPathForRole(user.role));
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
      .select('uuid, id, pass, name, role') // id is the email column
      .eq('id', email) // Filter by email
      .single(); // Expect a single row
    console.timeEnd('Supabase SignIn Query');

    if (error) {
      setIsLoading(false);
      if (error.code === 'PGRST116') {
        return { success: false, error: 'User not found.' };
      }
      return { success: false, error: 'Login failed: ' + error.message };
    }
    
    if (data.pass === pass) { // Plaintext password check - UNSAFE FOR PRODUCTION
      const userData: CustomUser = { uuid: data.uuid, email: data.id, name: data.name ?? null, role: data.role as CustomUser['role'] };
      Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
      if (userData.role) {
        Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
      }
      setUser(userData);
      setIsLoading(false);
      return { success: true, user: userData };
    } else {
      setIsLoading(false);
      return { success: false, error: 'Incorrect password.' };
    }
  };

  const signUp = async (email: string, pass: string, name: string, role: 'student' | 'teacher'): Promise<{ success: boolean; error?: string; user?: CustomUser }> => {
    setIsLoading(true);
    const { data: existingUser, error: selectError } = await supabase
      .from('proctorX')
      .select('id') // id is email column
      .eq('id', email)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      setIsLoading(false);
      return { success: false, error: 'Error checking existing user: ' + selectError.message };
    }
    if (existingUser) {
      setIsLoading(false);
      return { success: false, error: 'User with this email already exists.' };
    }

    const { data: insertedData, error: insertError } = await supabase
      .from('proctorX')
      .insert([{ id: email, pass: pass, name: name, role: role }]) // pass is plaintext - UNSAFE FOR PRODUCTION
      .select('uuid, id, name, role') // id is email column
      .single();

    if (insertError || !insertedData) {
      setIsLoading(false);
      return { success: false, error: 'Registration failed: ' + (insertError?.message || "Could not retrieve user after insert.") };
    }
    
    const userData: CustomUser = { uuid: insertedData.uuid, email: insertedData.id, name: insertedData.name ?? null, role: insertedData.role as CustomUser['role'] };
    Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
    if (userData.role) {
      Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
    }
    setUser(userData);
    setIsLoading(false);
    return { success: true, user: userData };
  };

  const signOut = async () => {
    setIsLoading(true); 
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null);
    setIsLoading(false); // Set loading to false before push to avoid race condition with useEffect
    router.push(AUTH_ROUTE); 
  };
  
  const updateUserProfile = async (profileData: { name: string; currentEmail: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const updates: { name: string; pass?: string } = { name: profileData.name };
    if (profileData.password) {
      updates.pass = profileData.password; // Plaintext password update - UNSAFE
    }

    const { error } = await supabase
      .from('proctorX')
      .update(updates)
      .eq('id', profileData.currentEmail); // id is email column

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    // Re-fetch user data to update context
    await loadUserFromCookie(); 
    setIsLoading(false);
    return { success: true };
  };


  const value = {
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
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
