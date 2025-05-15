
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE;

const generateShortId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  authError: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  let supabaseInstance;
  let supabaseInitializationError: string | null = null;
  try {
    supabaseInstance = createSupabaseBrowserClient();
  } catch (e: any) {
    console.error("CRITICAL: Failed to initialize Supabase client in AuthContext:", e.message);
    supabaseInitializationError = e.message || "Failed to initialize Supabase client.";
  }
  const supabase = supabaseInstance;
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null>(null); // Initial state is null
  const [isLoading, setIsLoading] = useState(true); // Start as true
  const [authError, setAuthError] = useState<string | null>(supabaseInitializationError);

  const getRedirectPathForRole = useCallback((userRole: CustomUser['role']) => {
    if (userRole === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    return STUDENT_DASHBOARD_ROUTE;
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    console.log('[AuthContext loadUserFromCookie] Attempting. Current isLoading:', isLoading);
    if (!supabase || authError) {
      console.warn('[AuthContext loadUserFromCookie] Supabase client not available or init error. Setting user to null.');
      setUser(null);
      setIsLoading(false);
      return;
    }

    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    const userRoleFromCookie = Cookies.get(ROLE_COOKIE_NAME) as CustomUser['role'];

    if (user && user.email === userEmailFromCookie && user.role === userRoleFromCookie && !isLoading) {
      console.log('[AuthContext loadUserFromCookie] User in context matches cookie and not loading. Skipping DB fetch.');
      return; // Already loaded and not in an active loading cycle
    }
    
    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found. Setting user to null.');
      setUser(null);
      setIsLoading(false);
      return;
    }
    
    // If we reach here, there's a cookie but user in context might be stale or initial load
    if (!isLoading) setIsLoading(true); // Ensure loading state is true if we proceed to fetch

    console.log('[AuthContext loadUserFromCookie] Session cookie found. Fetching user from DB for email:', userEmailFromCookie);
    try {
      console.time('Supabase LoadUserFromCookie Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role')
        .eq('email', userEmailFromCookie)
        .single();
      console.timeEnd('Supabase LoadUserFromCookie Query');

      if (dbError || !data) {
        console.warn('[AuthContext loadUserFromCookie] Error fetching user or user not found in DB. Clearing session.', dbError?.message);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        setUser(null);
      } else {
        const loadedUser: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? null,
          role: data.role as CustomUser['role'] ?? null,
        };
        console.log('[AuthContext loadUserFromCookie] User loaded from DB:', loadedUser);
        setUser(loadedUser);
        if (loadedUser.role && Cookies.get(ROLE_COOKIE_NAME) !== loadedUser.role) {
          Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        }
      }
    } catch (e: any) {
      console.error('[AuthContext loadUserFromCookie] Exception during user session processing:', e.message);
      Cookies.remove(SESSION_COOKIE_NAME);
      Cookies.remove(ROLE_COOKIE_NAME);
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('[AuthContext loadUserFromCookie] Finished. isLoading set to false.');
    }
  }, [supabase, authError, user, isLoading]); // Added user and isLoading

  useEffect(() => {
    if (authError) {
      setIsLoading(false);
      setUser(null);
      return;
    }
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, authError, supabase]); // loadUserFromCookie itself is memoized

  useEffect(() => {
    console.log(`[AuthContext Effect - Route Guard] Running. Pathname: ${pathname}, isLoading: ${isLoading}, User: ${user ? `{user_id: ${user.user_id}, email: ${user.email}, role: ${user.role}}` : JSON.stringify(user)}`);

    if (isLoading || authError) {
      console.log(`[AuthContext Effect - Route Guard] Waiting. isLoading: ${isLoading}, authError: ${authError}`);
      return;
    }

    const isAuthRoute = pathname === AUTH_ROUTE;
    const isProtectedRoute = ['/student/dashboard', '/teacher/dashboard'].some(p => pathname?.startsWith(p));

    if (user) { // User IS authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`[AuthContext Effect - Route Guard] User IS authenticated. Role: ${user.role}, Target dashboard: ${targetDashboard}`);
      
      if (isAuthRoute) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Effect - Route Guard] User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        } else {
          console.log(`[AuthContext Effect - Route Guard] User on /auth, but target is /auth or already on target. Path: ${pathname}`);
        }
        return;
      }
      
      const expectedDashboardPrefix = user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
      if (isProtectedRoute && !pathname.startsWith(expectedDashboardPrefix)) {
        console.log(`[AuthContext Effect - Route Guard] User on wrong protected route (${pathname}), attempting redirect to ${targetDashboard}`);
        if (pathname !== targetDashboard) {
           router.replace(targetDashboard);
        } else {
           console.log(`[AuthContext Effect - Route Guard] User on wrong dashboard, but target is current path. Path: ${pathname}`);
        }
        return;
      }
      console.log('[AuthContext Effect - Route Guard] User authenticated and on correct page or non-protected page.');

    } else { // User is NOT authenticated (user is null)
      console.log('[AuthContext Effect - Route Guard] User NOT authenticated.');
      if (isProtectedRoute) {
        console.log(`[AuthContext Effect - Route Guard] User on protected route (${pathname}), attempting redirect to ${AUTH_ROUTE}`);
        if (pathname !== AUTH_ROUTE) {
          router.replace(AUTH_ROUTE);
        } else {
          console.log(`[AuthContext Effect - Route Guard] Already on /auth. Path: ${pathname}`);
        }
        return;
      }
      console.log('[AuthContext Effect - Route Guard] User not authenticated and on public page or /auth.');
    }
  }, [user, isLoading, pathname, router, getRedirectPathForRole, authError]);

  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    try {
      console.time('Supabase SignIn Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, pass, name, role')
        .eq('email', email)
        .single();
      console.timeEnd('Supabase SignIn Query');

      if (dbError) {
        if (dbError.code === 'PGRST116') {
          return { success: false, error: 'User with this email not found.' };
        }
        return { success: false, error: 'Login failed: ' + dbError.message };
      }
      
      if (data && data.pass === pass) {
        const userData: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? null,
          role: data.role as CustomUser['role'] ?? null,
        };
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) {
          Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        }
        setUser(userData);
        console.log('[AuthContext signIn] Success. User set:', userData);
        return { success: true, user: userData };
      } else {
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      console.error('[AuthContext signIn] Exception:', e.message);
      return { success: false, error: 'An unexpected error occurred during sign in.' };
    } finally {
      setIsLoading(false);
      console.log('[AuthContext signIn] Finished. isLoading set to false.');
    }
  }, [supabase, authError]);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: 'student' | 'teacher'): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    setIsLoading(true);
    try {
      const { data: existingUser, error: selectError } = await supabase
        .from('proctorX')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 means no rows found, which is good here
        return { success: false, error: 'Error checking existing user: ' + selectError.message };
      }
      if (existingUser) {
        return { success: false, error: 'User with this email already exists.' };
      }

      const newUserId = generateShortId();
      const newUserRecord: Omit<ProctorXTableType, 'created_at'> = {
        user_id: newUserId,
        email: email,
        pass: pass,
        name: name,
        role: role,
      };
      
      const { data: insertedData, error: insertError } = await supabase
        .from('proctorX')
        .insert(newUserRecord)
        .select('user_id, email, name, role')
        .single();

      if (insertError || !insertedData) {
        return { success: false, error: 'Registration failed: ' + (insertError?.message || "Could not retrieve user after insert.") };
      }
      
      const newUserData: CustomUser = {
        user_id: insertedData.user_id,
        email: insertedData.email,
        name: insertedData.name ?? null,
        role: insertedData.role as CustomUser['role'] ?? null,
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) {
        Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      }
      setUser(newUserData);
      console.log('[AuthContext signUp] Success. User set:', newUserData);
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      return { success: false, error: 'An unexpected error occurred during sign up.' };
    } finally {
      setIsLoading(false);
      console.log('[AuthContext signUp] Finished. isLoading set to false.');
    }
  }, [supabase, authError]);

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null);
    setIsLoading(false); // Ensure loading is false after sign out so route guard can act
    console.log('[AuthContext signOut] User set to null, isLoading set to false. Redirect will be handled by useEffect.');
    // No direct router.push here, let the useEffect handle it.
  }, []);
  
  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized."};
    if (!user || !user.user_id) return { success: false, error: "User not authenticated or user_id missing."};
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id);
    setIsLoading(true);
    
    const updates: Partial<ProctorXTableType> = { name: profileData.name };
    if (profileData.password && profileData.password.length >=6 ) {
      updates.pass = profileData.password;
    } else if (profileData.password && profileData.password.length > 0 && profileData.password.length < 6 ) {
      setIsLoading(false);
      return { success: false, error: "New password must be at least 6 characters long." };
    }

    const { error: updateError } = await supabase
      .from('proctorX')
      .update(updates)
      .eq('user_id', user.user_id);

    if (updateError) {
      setIsLoading(false);
      console.error('[AuthContext updateUserProfile] Error:', updateError.message);
      return { success: false, error: updateError.message };
    }
    
    setUser(prevUser => prevUser ? ({...prevUser, name: profileData.name }) : null);
    setIsLoading(false);
    console.log('[AuthContext updateUserProfile] Success. Profile updated in context.');
    return { success: true };
  }, [supabase, authError, user]);

  const value = useMemo(() => ({
    user,
    isLoading,
    authError,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
  }), [user, isLoading, authError, signIn, signUp, signOut, updateUserProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
