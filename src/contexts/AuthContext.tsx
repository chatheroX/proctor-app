
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role'; // Cookie to store role

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE; // Fallback

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
    console.log('[AuthContext] Supabase client initialized successfully.');
  } catch (e: any) {
    console.error("CRITICAL: Failed to initialize Supabase client in AuthContext:", e.message);
    supabaseInitializationError = e.message || "Failed to initialize Supabase client.";
  }
  const supabase = supabaseInstance;
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true
  const [authError, setAuthError] = useState<string | null>(supabaseInitializationError);

  const getRedirectPathForRole = useCallback((userRole?: CustomUser['role'] | null) => {
    if (userRole === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    if (userRole === 'student') return STUDENT_DASHBOARD_ROUTE;
    return DEFAULT_DASHBOARD_ROUTE; // Fallback if role is undefined or null
  }, []);

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    console.log('[AuthContext loadUserFromCookie] Starting. Current isLoading:', isLoading, 'User:', user);
    // Ensure isLoading is true if we are actually trying to load/verify.
    // This prevents a quick flicker if this function is called when not strictly needed.
    if (!isLoading) setIsLoading(true);


    if (!supabase || authError) {
      console.warn('[AuthContext loadUserFromCookie] Supabase client not available or init error. Setting user to null, isLoading to false.');
      setUser(null);
      setAuthError(prev => prev || "Supabase client unavailable for cookie load.");
      setIsLoading(false);
      return;
    }

    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    const userRoleFromCookie = Cookies.get(ROLE_COOKIE_NAME) as CustomUser['role'] | undefined;

    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found. Setting user to null, isLoading to false.');
      setUser(null);
      setIsLoading(false);
      return;
    }

    console.log(`[AuthContext loadUserFromCookie] Session cookie found. Email: ${userEmailFromCookie}, Role from cookie: ${userRoleFromCookie}. Fetching user from DB.`);
    try {
      console.time('Supabase LoadUserFromCookie Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role')
        .eq('email', userEmailFromCookie)
        .single();
      console.timeEnd('Supabase LoadUserFromCookie Query');

      if (dbError || !data) {
        console.warn('[AuthContext loadUserFromCookie] Error fetching user or user not found in DB for email:', userEmailFromCookie, dbError?.message);
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
        // Ensure role cookie is consistent
        if (loadedUser.role && userRoleFromCookie !== loadedUser.role) {
          Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        }
      }
    } catch (e: any) {
      console.error('[AuthContext loadUserFromCookie] Exception during user session processing:', e.message);
      Cookies.remove(SESSION_COOKIE_NAME);
      Cookies.remove(ROLE_COOKIE_NAME);
      setUser(null);
    } finally {
      console.log('[AuthContext loadUserFromCookie] Finished. Setting isLoading to false.');
      setIsLoading(false);
    }
  }, [supabase, authError, isLoading]); // Removed user from deps to avoid re-running if only user changed.

  // Effect for initial user loading
  useEffect(() => {
    console.log('[AuthContext Initial Load Effect] Running. AuthError:', authError, 'Supabase available:', !!supabase);
    if (authError) {
      console.warn('[AuthContext Initial Load Effect] Auth error exists, setting isLoading to false.');
      setIsLoading(false); // Ensure loading stops if there was an init error
      return;
    }
    if (supabase) { // Only load if supabase client is available
        loadUserFromCookie();
    } else if (!supabase && !authError) {
        console.log('[AuthContext Initial Load Effect] Supabase client not yet available, but no authError. Waiting for client.');
        // isLoading remains true until supabase client is ready or an error occurs
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authError, supabase]); // Runs when supabase client or authError status changes. loadUserFromCookie is memoized.

  // Effect for route protection and redirection
  useEffect(() => {
    console.log(`[AuthContext Route Guard Effect] Running. Path: ${pathname}, isLoading: ${isLoading}, User: ${JSON.stringify(user)}, AuthError: ${authError}`);

    if (isLoading || authError) {
      console.log(`[AuthContext Route Guard Effect] Waiting. isLoading: ${isLoading}, authError: ${authError}`);
      return; // Don't do anything if still loading or if there's a critical auth error
    }

    const isAuthRoute = pathname === AUTH_ROUTE;
    const isProtectedRoute = ['/student/dashboard', '/teacher/dashboard'].some(p => pathname?.startsWith(p));

    if (user) { // User IS authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`[AuthContext Route Guard Effect] User IS authenticated. Role: ${user.role}, Target dashboard: ${targetDashboard}`);
      
      if (isAuthRoute) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Route Guard Effect] User on ${AUTH_ROUTE}, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        } else {
          console.log(`[AuthContext Route Guard Effect] User on ${AUTH_ROUTE}, but target is current path or loop. Path: ${pathname}`);
        }
        return; // Stop further processing in this effect run
      }
      
      // Role-based dashboard access check for protected routes
      const expectedDashboardPrefix = user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
      if (isProtectedRoute && !pathname.startsWith(expectedDashboardPrefix)) {
        console.log(`[AuthContext Route Guard Effect] User on wrong protected route (${pathname}), attempting redirect to ${targetDashboard}`);
        if (pathname !== targetDashboard) {
           router.replace(targetDashboard);
        } else {
           console.log(`[AuthContext Route Guard Effect] User on wrong dashboard, but target is current path. Path: ${pathname}`);
        }
        return; // Stop further processing
      }
      console.log('[AuthContext Route Guard Effect] User authenticated and on correct page or non-protected page.');

    } else { // User is NOT authenticated (user is null)
      console.log('[AuthContext Route Guard Effect] User NOT authenticated.');
      if (isProtectedRoute) {
        console.log(`[AuthContext Route Guard Effect] User on protected route (${pathname}), attempting redirect to ${AUTH_ROUTE}`);
        if (pathname !== AUTH_ROUTE) {
          router.replace(AUTH_ROUTE);
        } else {
          console.log(`[AuthContext Route Guard Effect] Already on ${AUTH_ROUTE}. Path: ${pathname}`);
        }
        return; // Stop further processing
      }
      console.log('[AuthContext Route Guard Effect] User not authenticated and on public page or /auth.');
    }
  }, [user, isLoading, pathname, router, getRedirectPathForRole, authError]);

  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    setAuthError(null);
    try {
      console.time('Supabase SignIn Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, pass, name, role')
        .eq('email', email)
        .single(); // Assuming email is unique
      console.timeEnd('Supabase SignIn Query');

      if (dbError) {
        if (dbError.code === 'PGRST116') { // No rows found
          return { success: false, error: 'User with this email not found.' };
        }
        return { success: false, error: 'Login failed: ' + dbError.message };
      }
      
      if (data && data.pass === pass) { // Plaintext password check - SECURITY RISK
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
        setIsLoading(false); // Set loading false AFTER user is set
        return { success: true, user: userData };
      } else {
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      console.error('[AuthContext signIn] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign in.');
      return { success: false, error: 'An unexpected error occurred during sign in.' };
    } finally {
      // Ensure isLoading is false if not already set by success path
      // This might be redundant if all paths set it, but good for safety.
      if (isLoading) setIsLoading(false); 
      console.log('[AuthContext signIn] Finished. isLoading state:', isLoading);
    }
  }, [supabase, authError, isLoading]); // Added isLoading to deps

  const signUp = useCallback(async (email: string, pass: string, name: string, role: 'student' | 'teacher'): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    setIsLoading(true);
    setAuthError(null);
    try {
      const { data: existingUser, error: selectError } = await supabase
        .from('proctorX')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') {
        return { success: false, error: 'Error checking existing user: ' + selectError.message };
      }
      if (existingUser) {
        return { success: false, error: 'User with this email already exists.' };
      }

      const newUserId = generateShortId();
      const newUserRecord: Omit<ProctorXTableType, 'created_at' | 'uuid'> & { user_id: string } = {
        user_id: newUserId,
        email: email,
        pass: pass, // Plaintext password - SECURITY RISK
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
      setIsLoading(false); // Set loading false AFTER user is set
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign up.');
      return { success: false, error: 'An unexpected error occurred during sign up.' };
    } finally {
       if (isLoading) setIsLoading(false);
       console.log('[AuthContext signUp] Finished. isLoading state:', isLoading);
    }
  }, [supabase, authError, generateShortId, isLoading]); // Added isLoading to deps

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null);
    // It's crucial that isLoading is set to false *after* user is null,
    // so the routing useEffect can correctly identify unauthenticated state.
    setIsLoading(false); 
    console.log('[AuthContext signOut] User set to null, isLoading set to false. Redirect will be handled by route guard effect.');
    // No direct router.push here, let the useEffect handle it.
  }, []);
  
  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized."};
    if (!user || !user.user_id) return { success: false, error: "User not authenticated or user_id missing."};
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id);
    // Don't set global isLoading for this, as it's a specific action.
    // A local loading state in the profile form would be better.

    const updates: Partial<ProctorXTableType> = { name: profileData.name };
    if (profileData.password && profileData.password.length >=6 ) {
      updates.pass = profileData.password; // Plaintext password - SECURITY RISK
    } else if (profileData.password && profileData.password.length > 0 && profileData.password.length < 6 ) {
      return { success: false, error: "New password must be at least 6 characters long." };
    }

    const { error: updateError } = await supabase
      .from('proctorX')
      .update(updates)
      .eq('user_id', user.user_id);

    if (updateError) {
      console.error('[AuthContext updateUserProfile] Error:', updateError.message);
      return { success: false, error: updateError.message };
    }
    
    // Update user in context
    setUser(prevUser => prevUser ? ({...prevUser, name: profileData.name }) : null);
    console.log('[AuthContext updateUserProfile] Success. Profile updated in context.');
    return { success: true };
  }, [supabase, authError, user]);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    authError,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
  }), [user, isLoading, authError, signIn, signUp, signOut, updateUserProfile]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
