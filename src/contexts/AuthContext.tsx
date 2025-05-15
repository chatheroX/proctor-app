
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType, Exam, ExamInsert, ExamUpdate } from '@/types/supabase';
// AlertTriangle and Loader2 are not used directly in this file for rendering,
// but could be used by consumers of authError/isLoading.

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE;

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  authError: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  supabase: ReturnType<typeof createSupabaseBrowserClient> | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true, set to false once init attempt is done
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabaseClient, setSupabaseClient] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Effect 1: Initialize Supabase Client (runs once)
  useEffect(() => {
    console.log('[AuthContext SupabaseClientInitEffect] Attempting Supabase client initialization...');
    // setIsLoading(true); // Already true by default, no need to set again here

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = "CRITICAL: Supabase URL or Anon Key missing. Check .env and NEXT_PUBLIC_ prefix.";
      console.error("[AuthContext SupabaseClientInitEffect] " + errorMsg);
      setAuthError(errorMsg);
      setSupabaseClient(null);
      setIsLoading(false); // Failed to init client, so stop loading
      return;
    }

    try {
      const client = createSupabaseBrowserClient();
      setSupabaseClient(client);
      setAuthError(null); // Clear any previous error
      console.log('[AuthContext SupabaseClientInitEffect] Supabase client initialized successfully.');
      // User loading will be handled by the next effect, which depends on supabaseClient
    } catch (e: any) {
      const errorMsg = e.message || "Failed to initialize Supabase client.";
      console.error("[AuthContext SupabaseClientInitEffect] CRITICAL: " + errorMsg, e);
      setAuthError(errorMsg);
      setSupabaseClient(null);
      setIsLoading(false); // Failed to init client, so stop loading
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array: run once on mount

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  // Effect 2: Load user from cookie ONCE Supabase client is initialized (or if client init fails but we need to stop loading)
  const loadUserFromCookie = useCallback(async (client: ReturnType<typeof createSupabaseBrowserClient>) => {
    console.log('[AuthContext loadUserFromCookie] Starting user load from cookie.');
    // setIsLoading(true) should already be set or handled by caller if needed

    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME);
      setIsLoading(false); // No cookie, so loading user data is done
      return;
    }

    // Optimization: if user state is already set and matches cookie.
    // This might be less relevant here if this is only called once post-client-init.
    if (user && user.email === userEmailFromCookie) {
        console.log('[AuthContext loadUserFromCookie] User already in state and matches cookie, skipping DB fetch.');
        setIsLoading(false);
        return;
    }

    try {
      console.time('Supabase LoadUserFromCookie Query');
      const { data, error: dbError } = await client
        .from('proctorX')
        .select('user_id, email, name, role')
        .eq('email', userEmailFromCookie)
        .single();
      console.timeEnd('Supabase LoadUserFromCookie Query');

      if (dbError || !data) {
        console.warn('[AuthContext loadUserFromCookie] Error fetching user or user not found. Email:', userEmailFromCookie, 'Error:', dbError?.message);
        setUser(null);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
      } else {
        const loadedUser: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? null,
          role: data.role as CustomUser['role'] ?? null,
        };
        console.log('[AuthContext loadUserFromCookie] User loaded from DB:', loadedUser);
        setUser(loadedUser);
        if (loadedUser.role) {
          Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        } else {
          Cookies.remove(ROLE_COOKIE_NAME);
        }
      }
    } catch (e: any) {
      console.error('[AuthContext loadUserFromCookie] Exception during user session processing:', e.message);
      setUser(null);
      Cookies.remove(SESSION_COOKIE_NAME);
      Cookies.remove(ROLE_COOKIE_NAME);
      setAuthError(e.message || "Error processing user session.");
    } finally {
      console.log('[AuthContext loadUserFromCookie] Finished. Setting isLoading to false.');
      setIsLoading(false); // User loading attempt complete
    }
  }, [user]); // user is a dep to allow re-check if external factors change it (though rare for this specific hook)

  useEffect(() => {
    // This effect runs when supabaseClient is set or if authError from init changes
    if (supabaseClient && !authError) {
        console.log('[AuthContext Initial User Load Effect] Supabase client ready, calling loadUserFromCookie.');
        loadUserFromCookie(supabaseClient);
    } else if (authError) {
        console.log('[AuthContext Initial User Load Effect] Auth error during client init, initial user load skipped. isLoading already false.');
    } else if (!supabaseClient && !isLoading) {
        // This case means client init didn't set supabaseClient, but also didn't set isLoading false (which it should if error)
        // Or if client init is somehow delayed beyond initial isLoading=true.
        // To be safe, if no client and not loading, set loading false.
        console.warn('[AuthContext Initial User Load Effect] Supabase client not set and not loading, ensuring isLoading is false.');
        setIsLoading(false);
    }
    // If supabaseClient is null and isLoading is true, it means client init is still pending.
  }, [supabaseClient, authError, loadUserFromCookie, isLoading]);


  // Effect 3: Route protection and redirection
  useEffect(() => {
    console.log(`[AuthContext Route Guard Effect] Running. Path: ${pathname}, isLoading: ${isLoading}, User: ${JSON.stringify(user)}, AuthError: ${authError}`);

    if (authError && !pathname.startsWith('/error')) { // Allow an error display page
      // If there's a fundamental auth error (e.g. Supabase client failed to init),
      // it might be best to redirect to a generic error page or show a global error message.
      // For now, we just log and prevent further routing logic if authError is set.
      console.error(`[AuthContext Route Guard Effect] AuthError ('${authError}') present. Halting route protection logic.`);
      // Potentially redirect to an error page: router.replace('/auth-error');
      return;
    }

    if (isLoading) {
      console.log(`[AuthContext Route Guard Effect] Still loading (isLoading is true). Aborting route protection for this render.`);
      return;
    }

    // At this point, isLoading is false, and authError (from init) is null or handled.
    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboard = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboard = pathname?.startsWith('/teacher/dashboard');
    const isProtectedRoute = isStudentDashboard || isTeacherDashboard;

    let targetDashboard = DEFAULT_DASHBOARD_ROUTE;
    if (user?.role === 'teacher') targetDashboard = TEACHER_DASHBOARD_ROUTE;
    else if (user?.role === 'student') targetDashboard = STUDENT_DASHBOARD_ROUTE;

    if (user) { // User IS authenticated
      console.log(`[AuthContext Route Guard Effect] User IS authenticated. Role: ${user.role}, Target dashboard: ${targetDashboard}`);
      if (isAuthPg) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Route Guard Effect] User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        } else {
          console.log(`[AuthContext Route Guard Effect] User on /auth, but target is current path. Path: ${pathname}`);
        }
        return; // Stop further processing if on auth page and redirecting/staying
      }

      // Role-based access for protected routes
      if (user.role === 'student' && isTeacherDashboard) {
        if (pathname !== STUDENT_DASHBOARD_ROUTE) {
          console.log(`[AuthContext Route Guard Effect] Student on teacher dashboard, redirecting to ${STUDENT_DASHBOARD_ROUTE}`);
          router.replace(STUDENT_DASHBOARD_ROUTE);
        }
        return;
      }
      if (user.role === 'teacher' && isStudentDashboard) {
         if (pathname !== TEACHER_DASHBOARD_ROUTE) {
          console.log(`[AuthContext Route Guard Effect] Teacher on student dashboard, redirecting to ${TEACHER_DASHBOARD_ROUTE}`);
          router.replace(TEACHER_DASHBOARD_ROUTE);
        }
        return;
      }
      console.log('[AuthContext Route Guard Effect] User authenticated and on correct page or non-protected page.');

    } else { // User is NOT authenticated (user is null because isLoading is false)
      console.log('[AuthContext Route Guard Effect] User NOT authenticated (isLoading is false).');
      if (isProtectedRoute) {
        if (pathname !== AUTH_ROUTE) {
          console.log(`[AuthContext Route Guard Effect] User on protected route (${pathname}), attempting redirect to ${AUTH_ROUTE}`);
          router.replace(AUTH_ROUTE);
        } else {
           console.log(`[AuthContext Route Guard Effect] User on protected route but already on ${AUTH_ROUTE}. Path: ${pathname}`);
        }
        return; // Stop further processing if on protected route and redirecting/staying
      }
      console.log('[AuthContext Route Guard Effect] User not authenticated and on public page or /auth.');
    }
  }, [user, isLoading, pathname, router, authError]);

  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabaseClient) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    setAuthError(null);

    try {
      console.time('Supabase SignIn Query');
      const { data, error: dbError } = await supabaseClient
        .from('proctorX')
        .select('user_id, email, pass, name, role')
        .eq('email', email)
        .single();
      console.timeEnd('Supabase SignIn Query');

      if (dbError) {
        setIsLoading(false);
        if (dbError.code === 'PGRST116') { // No rows found
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
        } else {
          Cookies.remove(ROLE_COOKIE_NAME);
        }
        setUser(userData);
        // isLoading will be set to false by the Route Guard useEffect after user state update & navigation
        console.log('[AuthContext signIn] Success. User set:', userData);
        // Let the Route Guard useEffect handle redirection. isLoading will be false when it runs after this.
        setIsLoading(false); // Explicitly set false here now, effect will pick up new user state
        return { success: true, user: userData };
      } else {
        setIsLoading(false);
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      console.error('[AuthContext signIn] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign in.');
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred during sign in.' };
    }
  }, [supabaseClient, authError]);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: 'student' | 'teacher'): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabaseClient) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    setIsLoading(true);
    setAuthError(null);

    try {
      const { data: existingUser, error: selectError } = await supabaseClient
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
      const newUserRecord: ProctorXTableType['Insert'] = {
        user_id: newUserId,
        email: email,
        pass: pass,
        name: name,
        role: role,
        // created_at is handled by DB default
      };

      const { data: insertedData, error: insertError } = await supabaseClient
        .from('proctorX')
        .insert(newUserRecord)
        .select('user_id, email, name, role')
        .single();

      if (insertError || !insertedData) {
        setIsLoading(false);
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
      // isLoading will be set to false by the Route Guard useEffect after user state update & navigation
      console.log('[AuthContext signUp] Success. User set:', newUserData);
      setIsLoading(false); // Explicitly set false here now
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign up.');
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred during sign up.' };
    }
  }, [supabaseClient, generateShortId, authError]);

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null);
    // isLoading should already be false, or will be set by the route guard effect reacting to user=null
    setIsLoading(false); // Ensure isLoading is false for the route guard effect
  }, []);

  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!supabaseClient) return { success: false, error: authError || "Supabase client not initialized." };
    if (!user || !user.user_id) return { success: false, error: "User not authenticated or user_id missing." };
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id);
    setAuthError(null); // Clear previous auth errors for this operation

    const updates: Partial<ProctorXTableType['Update']> = { name: profileData.name };
    if (profileData.password) {
      if (profileData.password.length < 6) {
        return { success: false, error: "New password must be at least 6 characters long." };
      }
      updates.pass = profileData.password;
    }

    // Optimistic update for name
    const oldUser = user;
    setUser(prevUser => prevUser ? ({ ...prevUser, name: profileData.name ?? prevUser.name }) : null);

    try {
        const { error: updateError } = await supabaseClient
        .from('proctorX')
        .update(updates)
        .eq('user_id', user.user_id);

        if (updateError) {
        console.error('[AuthContext updateUserProfile] Error:', updateError.message);
        setAuthError(updateError.message);
        setUser(oldUser); // Revert optimistic update on error
        return { success: false, error: updateError.message };
        }
        console.log('[AuthContext updateUserProfile] Success. Profile updated in DB.');
        // User state already updated optimistically for name
        // If password was changed, user doesn't need to re-login with this custom auth
        return { success: true };
    } catch (e: any) {
        console.error('[AuthContext updateUserProfile] Exception:', e.message);
        setAuthError(e.message || 'An unexpected error occurred during profile update.');
        setUser(oldUser); // Revert optimistic update
        return { success: false, error: e.message || 'An unexpected error occurred during profile update.' };
    }
  }, [supabaseClient, user, authError]);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    authError,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
    supabase: supabaseClient,
  }), [user, isLoading, authError, signIn, signUp, signOut, updateUserProfile, supabaseClient]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

    