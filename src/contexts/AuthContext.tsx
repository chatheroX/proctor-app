
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTable } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];


// Helper to generate a pseudo-random 6-character alphanumeric ID
// IMPORTANT: This is NOT collision-proof for a production system.
// A robust solution would check for uniqueness in the DB or use a sequence.
const generateShortId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean; // Renamed from authLoading for clarity within context
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser }>;
  signUp: (email: string, pass: string, name: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string; user?: CustomUser }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { user_id: string; name: string; password?: string}) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getRedirectPathForRole = useCallback((role: CustomUser['role']) => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    return STUDENT_DASHBOARD_ROUTE; // Default for student or null/undefined role
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    const userRoleFromCookie = Cookies.get(ROLE_COOKIE_NAME) as CustomUser['role'];

    // If user context matches cookie and not loading, skip DB query
    if (user && user.email === userEmailFromCookie && user.role === userRoleFromCookie && !isLoading) {
      // console.log('AuthContext: User in context matches cookie, skipping fetch.');
      // Ensure isLoading is false if we skip.
      if (isLoading) setIsLoading(false); // Should not happen if !isLoading is true in condition
      return;
    }
    
    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUser] No session cookie found.');
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
      setIsLoading(false);
      return;
    }

    // Only set isLoading true if we are about to make a DB call
    setIsLoading(true);
    console.log('[AuthContext loadUser] Session cookie found, fetching user from DB for email:', userEmailFromCookie);
    console.time('Supabase LoadUserFromCookie Query');
    try {
      const { data, error } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role')
        .eq('email', userEmailFromCookie)
        .single();
      console.timeEnd('Supabase LoadUserFromCookie Query');

      if (data && !error) {
        const loadedUser: CustomUser = { 
            user_id: data.user_id, 
            email: data.email, 
            name: data.name ?? null, 
            role: data.role as CustomUser['role'] 
        };
        setUser(loadedUser);
        // Ensure role cookie is consistent
        if (loadedUser.role && Cookies.get(ROLE_COOKIE_NAME) !== loadedUser.role) {
          Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        }
        console.log('[AuthContext loadUser] User loaded from DB:', loadedUser);
      } else {
        console.warn('[AuthContext loadUser] Error fetching user or user not found in DB. Clearing session.', error?.message);
        Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
        Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
        setUser(null);
        if (error && error.code !== 'PGRST116') { 
          console.error('Error re-validating user from DB:', error.message);
        }
      }
    } catch (e: any) {
      console.error('[AuthContext loadUser] Exception during user session processing:', e);
      Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
      Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.email, user?.role]); // Dependencies review

  useEffect(() => {
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Re-check on path change, but loadUserFromCookie has its own guards

  useEffect(() => {
    console.log('[AuthContext Effect - Route Guard] Running. isLoading:', isLoading, 'pathname:', pathname, 'user:', user ? `{email: ${user.email}, role: ${user.role}}` : 'null');

    if (isLoading) {
      console.log('[AuthContext Effect - Route Guard] Still loading initial auth state, returning.');
      return;
    }

    const isAuthRoute = pathname === AUTH_ROUTE;
    const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname?.startsWith(p));

    if (user) { // User IS authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`[AuthContext Effect - Route Guard] User authenticated. Role: ${user.role}, Target dashboard: ${targetDashboard}`);
      if (isAuthRoute) {
        console.log(`[AuthContext Effect - Route Guard] User on /auth, attempting redirect to: ${targetDashboard}`);
        if (pathname !== targetDashboard) { // Avoid self-redirect
          router.replace(targetDashboard);
        } else {
          console.log(`[AuthContext Effect - Route Guard] Already on target dashboard or /auth is target (should not happen). Path: ${pathname}`);
        }
      } else {
        // User is authenticated and on a page other than /auth.
        // Check if they are on the correct dashboard for their role.
        const expectedDashboardPrefix = user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
        if (isProtectedRoute && !pathname.startsWith(expectedDashboardPrefix)) {
          console.log(`[AuthContext Effect - Route Guard] User on wrong protected route (${pathname}), attempting redirect to ${targetDashboard}`);
          if (pathname !== targetDashboard) { // Avoid self-redirect
             router.replace(targetDashboard);
          } else {
             console.log(`[AuthContext Effect - Route Guard] User on wrong dashboard, but target is current path. Path: ${pathname}`);
          }
        } else {
          console.log('[AuthContext Effect - Route Guard] User authenticated and on correct page or non-protected page.');
        }
      }
    } else { // User is NOT authenticated
      console.log('[AuthContext Effect - Route Guard] User not authenticated.');
      if (isProtectedRoute) {
        console.log(`[AuthContext Effect - Route Guard] User on protected route (${pathname}), attempting redirect to /auth`);
        if (pathname !== AUTH_ROUTE) { // Avoid self-redirect
          router.replace(AUTH_ROUTE);
        } else {
          console.log(`[AuthContext Effect - Route Guard] Already on /auth. Path: ${pathname}`);
        }
      } else {
        console.log('[AuthContext Effect - Route Guard] User not authenticated and on public page or /auth.');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, pathname, router]); // getRedirectPathForRole is stable due to useCallback

  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser }> => {
    setIsLoading(true);
    console.time('Supabase SignIn Query');
    const { data, error } = await supabase
      .from('proctorX')
      .select('user_id, email, pass, name, role')
      .eq('email', email)
      .single(); 
    console.timeEnd('Supabase SignIn Query');

    if (error) {
      setIsLoading(false);
      if (error.code === 'PGRST116') { 
        return { success: false, error: 'User not found.' };
      }
      return { success: false, error: 'Login failed: ' + error.message };
    }
    
    if (data.pass === pass) { // PLAIN TEXT PASSWORD CHECK - SECURITY RISK
      const userData: CustomUser = { 
        user_id: data.user_id, 
        email: data.email, 
        name: data.name ?? null, 
        role: data.role as CustomUser['role'] 
      };
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

    const newUserId = generateShortId();
    
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
    setIsLoading(false); // Set loading to false *after* user is nullified
    // The useEffect for route protection will handle redirecting to AUTH_ROUTE
    // router.push(AUTH_ROUTE); // Avoid direct push here, let effect handle it.
  };
  
  const updateUserProfile = async (profileData: { user_id: string; name: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "User not authenticated."};
    setIsLoading(true);
    const updates: Partial<ProctorXTable['Update']> = { name: profileData.name };
    if (profileData.password) {
      updates.pass = profileData.password; // PLAIN TEXT PASSWORD UPDATE - SECURITY RISK
    }

    const { error } = await supabase
      .from('proctorX')
      .update(updates)
      .eq('user_id', profileData.user_id); 

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }
    
    // Optimistically update user context or re-fetch
    setUser(prevUser => prevUser ? ({...prevUser, name: profileData.name }) : null);
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
