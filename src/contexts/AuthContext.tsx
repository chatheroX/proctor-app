
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser } from '@/types/supabase';
import type { Database } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

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

// Helper to generate a pseudo-random 6-character alphanumeric ID
// IMPORTANT: This is NOT collision-proof for a production system.
// A robust solution would check for uniqueness in the DB or use a sequence.
const generateShortId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getRedirectPathForRole = (role: 'student' | 'teacher' | null) => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    return STUDENT_DASHBOARD_ROUTE;
  };
  
  const loadUserFromCookie = useCallback(async () => {
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    const userRoleFromCookie = Cookies.get(ROLE_COOKIE_NAME) as CustomUser['role'];

    // If user context is already populated and matches cookie, skip DB query
    if (user && user.email === userEmailFromCookie && user.role === userRoleFromCookie && !isLoading) {
      console.log('AuthContext: User already in context and matches cookie, skipping fetch.');
      return;
    }
    
    setIsLoading(true);

    if (userEmailFromCookie) {
      console.time('Supabase LoadUserFromCookie Query');
      try {
        const { data, error } = await supabase
          .from('proctorX')
          .select('user_id, email, name, role')
          .eq('email', userEmailFromCookie)
          .single();
        console.timeEnd('Supabase LoadUserFromCookie Query');

        if (data && !error) {
          const loadedUser: CustomUser = { user_id: data.user_id, email: data.email, name: data.name ?? null, role: data.role as CustomUser['role'] };
          setUser(loadedUser);
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
      Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.email, user?.role]); // Added user?.role dependency

  useEffect(() => {
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Re-check on path change

  useEffect(() => {
    if (!isLoading) {
      const isAuthRoute = pathname === AUTH_ROUTE;
      const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname?.startsWith(p));
      const defaultDashboardRedirect = getRedirectPathForRole(user?.role);

      if (user && isAuthRoute) {
        router.replace(defaultDashboardRedirect);
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
      .select('user_id, email, pass, name, role')
      .eq('email', email)
      .single(); // Use single to expect one row or error
    console.timeEnd('Supabase SignIn Query');

    if (error) {
      setIsLoading(false);
      if (error.code === 'PGRST116') { // PostgREST error for "exactly one row expected"
        return { success: false, error: 'User not found.' };
      }
      return { success: false, error: 'Login failed: ' + error.message };
    }
    
    if (data.pass === pass) {
      const userData: CustomUser = { user_id: data.user_id, email: data.email, name: data.name ?? null, role: data.role as CustomUser['role'] };
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
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST116') {
      setIsLoading(false);
      return { success: false, error: 'Error checking existing user: ' + selectError.message };
    }
    if (existingUser) {
      setIsLoading(false);
      return { success: false, error: 'User with this email already exists.' };
    }

    const newUserId = generateShortId(); // Generate 6-character ID
    
    const { data: insertedData, error: insertError } = await supabase
      .from('proctorX')
      .insert([{ user_id: newUserId, email: email, pass: pass, name: name, role: role }])
      .select('user_id, email, name, role')
      .single();

    if (insertError || !insertedData) {
      setIsLoading(false);
      return { success: false, error: 'Registration failed: ' + (insertError?.message || "Could not retrieve user after insert.") };
    }
    
    const userData: CustomUser = { 
        user_id: insertedData.user_id, 
        email: insertedData.email, 
        name: insertedData.name ?? null, 
        role: insertedData.role as CustomUser['role'] 
    };
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
    setIsLoading(false);
    router.push(AUTH_ROUTE); 
  };
  
  const updateUserProfile = async (profileData: { name: string; currentEmail: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "User not authenticated."};
    setIsLoading(true);
    const updates: Partial<Database['public']['Tables']['proctorX']['Row']> = { name: profileData.name };
    if (profileData.password) {
      updates.pass = profileData.password;
    }

    const { error } = await supabase
      .from('proctorX')
      .update(updates)
      .eq('email', profileData.currentEmail); 

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    // Re-fetch user data to update context state for name/pass change
    await loadUserFromCookie(); 
    // setUser(prevUser => prevUser ? ({...prevUser, name: profileData.name }) : null); // Optimistic update
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
