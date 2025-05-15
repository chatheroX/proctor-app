
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE; // Fallback

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  authError: string | null;
  supabaseInitializationError: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: CustomUser['role']) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: string }>;
  supabase: ReturnType<typeof createSupabaseBrowserClient> | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateDefaultAvatar = (role: CustomUser['role'], userId: string): string => {
  const safeRole = role || 'student';
  const seed = `${safeRole}-${userId}-${Date.now()}`; // Add timestamp for more uniqueness if needed
  return `https://api.dicebear.com/8.x/micah/svg?seed=${encodeURIComponent(seed)}`;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true until initial load attempt
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabaseInitializationError, setSupabaseInitializationError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Effect for Supabase client initialization (runs once)
  useEffect(() => {
    console.log('[AuthContext SupabaseClientInitEffect] Attempting Supabase client initialization...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = "CRITICAL: Supabase URL or Anon Key missing. Check .env and NEXT_PUBLIC_ prefix.";
      console.error("[AuthContext SupabaseClientInitEffect] " + errorMsg);
      setSupabaseInitializationError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Critical: set loading false if init fails
      return;
    }

    try {
      const client = createSupabaseBrowserClient();
      setSupabase(client);
      setSupabaseInitializationError(null); // Clear any previous init error
      console.log('[AuthContext SupabaseClientInitEffect] Supabase client initialized successfully.');
      // setIsLoading will be handled by loadUserFromCookie after client is set
    } catch (e: any) {
      const errorMsg = e.message || "Failed to initialize Supabase client.";
      console.error("[AuthContext SupabaseClientInitEffect] CRITICAL: " + errorMsg, e);
      setSupabaseInitializationError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Critical: set loading false if init fails
    }
  }, []);


  const loadUserFromCookie = useCallback(async (client: ReturnType<typeof createSupabaseBrowserClient>) => {
    console.log('[AuthContext loadUserFromCookie] Starting user load from cookie.');
    setIsLoading(true); // Set loading true at the start of this async operation
    setAuthError(null); // Clear previous auth errors

    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME);
      setIsLoading(false);
      return;
    }

    // Optimization: If user state matches cookie, and we are NOT in an initial loading phase from a previous action,
    // we might consider skipping DB fetch. But for robustness, fetching is usually safer for session validation.
    // Let's keep the fetch for now but ensure isLoading is managed.

    try {
      console.time('Supabase LoadUserFromCookie Query');
      const { data, error: dbError } = await client
        .from('proctorX')
        .select('user_id, email, name, role, avatar_url')
        .eq('email', userEmailFromCookie)
        .single();
      console.timeEnd('Supabase LoadUserFromCookie Query');

      if (dbError || !data) {
        console.warn('[AuthContext loadUserFromCookie] Error fetching user or user not found. Email:', userEmailFromCookie, 'Error:', dbError?.message);
        setUser(null);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        if (dbError && dbError.code !== 'PGRST116') { // PGRST116 is "No rows found", not necessarily an app error
            setAuthError(dbError.message || "Failed to fetch user data from DB.");
        }
      } else {
        const loadedUser: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? null,
          role: data.role as CustomUser['role'] ?? null,
          avatar_url: data.avatar_url || generateDefaultAvatar(data.role as CustomUser['role'], data.user_id),
        };
        console.log('[AuthContext loadUserFromCookie] User loaded from DB:', loadedUser.email, "Role:", loadedUser.role);
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
      setIsLoading(false);
    }
  }, []); // Removed user and isLoading from deps as it's meant for initial load or explicit call

  // Effect for initial user load from cookie (runs once after Supabase client is ready)
  useEffect(() => {
    console.log(`[AuthContext Initial User Load Effect] Running. Supabase client: ${!!supabase}, SupabaseInitError: ${supabaseInitializationError}`);
    if (supabase && !supabaseInitializationError) {
      console.log('[AuthContext Initial User Load Effect] Supabase client ready, calling loadUserFromCookie.');
      loadUserFromCookie(supabase);
    } else if (supabaseInitializationError) {
      console.log('[AuthContext Initial User Load Effect] Supabase init error, initial user load skipped. isLoading is false.');
      // isLoading should have been set to false by the client init effect's error path.
      if(isLoading) setIsLoading(false); // Defensive
    } else if (!supabase && isLoading) {
      console.log('[AuthContext Initial User Load Effect] Supabase client not set, still loading (or init failed and isLoading was not reset).');
      // If supabase init fails and somehow isLoading wasn't set to false, ensure it is.
      // This check is mostly defensive. The SupabaseClientInitEffect should handle it.
    }
  }, [supabase, supabaseInitializationError, loadUserFromCookie, isLoading]);


  // Effect for route protection and redirection
  useEffect(() => {
    console.log(`[AuthContext Route Guard Effect] Running. isLoading: ${isLoading}, Path: ${pathname}, User: ${user?.email}, Role: ${user?.role}, SupabaseInitError: ${supabaseInitializationError}`);

    if (isLoading) {
      console.log('[AuthContext Route Guard Effect] Still loading (isLoading is true). Aborting route protection for this render cycle.');
      return;
    }

    if (supabaseInitializationError) {
      console.warn(`[AuthContext Route Guard Effect] SupabaseInitError ('${supabaseInitializationError}') present. Halting route protection logic. Current path: ${pathname}`);
      // Optionally, redirect to an error page or prevent access to protected routes.
      // For now, it just halts. AuthForm and other pages should display this error.
      return;
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboardArea = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboardArea = pathname?.startsWith('/teacher/dashboard');
    const isExamSessionPage = pathname?.startsWith('/exam-session/');

    let targetDashboard = DEFAULT_DASHBOARD_ROUTE;
    if (user?.role === 'teacher') targetDashboard = TEACHER_DASHBOARD_ROUTE;
    else if (user?.role === 'student') targetDashboard = STUDENT_DASHBOARD_ROUTE;


    if (user) { // User IS authenticated
      console.log(`[AuthContext Route Guard Effect] User authenticated (${user.email}, Role: ${user.role}). Current path: ${pathname}`);
      if (isAuthPg) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Route Guard Effect] User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        }
        return;
      }
      if (user.role === 'student' && isTeacherDashboardArea) {
        if (pathname !== STUDENT_DASHBOARD_ROUTE) {
          console.log(`[AuthContext Route Guard Effect] Student on teacher area, redirecting to ${STUDENT_DASHBOARD_ROUTE}`);
          router.replace(STUDENT_DASHBOARD_ROUTE);
        }
        return;
      }
      if (user.role === 'teacher' && isStudentDashboardArea) {
         if (pathname !== TEACHER_DASHBOARD_ROUTE) {
          console.log(`[AuthContext Route Guard Effect] Teacher on student area, redirecting to ${TEACHER_DASHBOARD_ROUTE}`);
          router.replace(TEACHER_DASHBOARD_ROUTE);
        }
        return;
      }
      console.log('[AuthContext Route Guard Effect] Authenticated user on correct page or non-auth public page.');

    } else { // User is NOT authenticated (user is null)
      console.log(`[AuthContext Route Guard Effect] User not authenticated. Current path: ${pathname}`);
      const isProtectedRoute = isStudentDashboardArea || isTeacherDashboardArea || isExamSessionPage;

      if (isProtectedRoute) {
        if (pathname !== AUTH_ROUTE) {
          console.log(`[AuthContext Route Guard Effect] Unauthenticated on protected route ${pathname}, redirecting to ${AUTH_ROUTE}`);
          router.replace(AUTH_ROUTE);
        }
        return;
      }
      console.log('[AuthContext Route Guard Effect] User not authenticated and on public page or /auth.');
    }
  }, [user, isLoading, pathname, router, supabaseInitializationError]);


  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase) {
      const errorMsg = supabaseInitializationError || "Supabase client not initialized.";
      console.error('[AuthContext signIn] Aborted:', errorMsg);
      return { success: false, error: errorMsg };
    }
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    setAuthError(null);

    try {
      console.time('Supabase SignIn Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, pass, name, role, avatar_url')
        .eq('email', email)
        .single();
      console.timeEnd('Supabase SignIn Query');

      if (dbError || !data) {
        const errorDetail = dbError?.message || 'User data not found.';
        console.warn('[AuthContext signIn] Failed to fetch user or user not found. Email:', email, 'Error:', errorDetail);
        if (dbError && dbError.code === 'PGRST116') { // No rows found
          setAuthError('User with this email not found.');
          setIsLoading(false);
          return { success: false, error: 'User with this email not found.' };
        }
        setAuthError('Login failed: ' + errorDetail);
        setIsLoading(false);
        return { success: false, error: 'Login failed: ' + errorDetail };
      }

      console.log('[AuthContext signIn] User data fetched from DB:', data.email);

      if (data.pass === pass) { // SECURITY RISK: Plaintext password comparison
        const userData: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? null,
          role: data.role as CustomUser['role'] ?? null,
          avatar_url: data.avatar_url || generateDefaultAvatar(data.role as CustomUser['role'], data.user_id),
        };
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) {
          Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        } else {
           Cookies.remove(ROLE_COOKIE_NAME);
        }
        setUser(userData);
        console.log('[AuthContext signIn] Success. User set in context:', userData.email, 'Role:', userData.role);
        setIsLoading(false);
        return { success: true, user: userData };
      } else {
        console.warn('[AuthContext signIn] Incorrect password for email:', email);
        setAuthError('Incorrect password.');
        setIsLoading(false);
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      console.error('[AuthContext signIn] Exception during sign in:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign in.');
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred during sign in.' };
    }
  }, [supabase, supabaseInitializationError]);

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: CustomUser['role']): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase) {
        const errorMsg = supabaseInitializationError || "Supabase client not initialized.";
        console.error('[AuthContext signUp] Aborted:', errorMsg);
        return { success: false, error: errorMsg };
    }
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    if (!role) {
        setAuthError("Role must be selected for registration.");
        return { success: false, error: "Role must be selected for registration."};
    }
    setIsLoading(true);
    setAuthError(null);

    try {
      const { data: existingUser, error: selectError } = await supabase
        .from('proctorX')
        .select('email') // Only need to check if email exists
        .eq('email', email)
        .maybeSingle(); // Use maybeSingle to handle 0 or 1 row without error for not found

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine here
        setIsLoading(false);
        setAuthError('Error checking existing user: ' + selectError.message);
        return { success: false, error: 'Error checking existing user: ' + selectError.message };
      }
      if (existingUser) {
        setIsLoading(false);
        setAuthError('User with this email already exists.');
        return { success: false, error: 'User with this email already exists.' };
      }

      const newUserId = generateShortId();
      const defaultAvatar = generateDefaultAvatar(role, newUserId);

      const newUserRecord: ProctorXTableType['Insert'] = {
        user_id: newUserId,
        email: email,
        pass: pass, // SECURITY RISK
        name: name,
        role: role,
        avatar_url: defaultAvatar,
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('proctorX')
        .insert(newUserRecord)
        .select('user_id, email, name, role, avatar_url') // Select all necessary fields
        .single();

      if (insertError || !insertedData) {
        setIsLoading(false);
        const errorDetail = insertError?.message || "Could not retrieve user data after insert.";
        setAuthError('Registration failed: ' + errorDetail);
        return { success: false, error: 'Registration failed: ' + errorDetail };
      }

      const newUserData: CustomUser = {
        user_id: insertedData.user_id,
        email: insertedData.email,
        name: insertedData.name ?? null,
        role: insertedData.role as CustomUser['role'] ?? null,
        avatar_url: insertedData.avatar_url || defaultAvatar,
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) {
        Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      }
      setUser(newUserData);
      setIsLoading(false);
      console.log('[AuthContext signUp] Success. User set in context:', newUserData);
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign up.');
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred during sign up.' };
    }
  }, [supabase, generateShortId, supabaseInitializationError]);

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null);
    setAuthError(null);
    setIsLoading(false); // Ensure loading is false so route guard can redirect
    // The route guard useEffect will handle redirection to AUTH_ROUTE
  }, []);

  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      const errorMsg = supabaseInitializationError || "Supabase client not initialized.";
      console.error('[AuthContext updateUserProfile] Aborted:', errorMsg);
      return { success: false, error: errorMsg };
    }
    if (!user || !user.user_id) {
      setAuthError("User not authenticated or user_id missing.");
      return { success: false, error: "User not authenticated or user_id missing." };
    }
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id);
    setAuthError(null);

    const updates: Partial<ProctorXTableType['Update']> = {
        name: profileData.name,
        // updated_at: new Date().toISOString(), // Supabase DB trigger should handle this
    };
    if (profileData.password) {
      if (profileData.password.length < 6) {
        setAuthError("New password must be at least 6 characters long.");
        return { success: false, error: "New password must be at least 6 characters long." };
      }
      updates.pass = profileData.password; // SECURITY RISK
    }
    if (profileData.avatar_url !== undefined) { // Allow setting avatar_url to null or empty string if intended
      updates.avatar_url = profileData.avatar_url;
    }

    const oldUserSnapshot = { ...user };

    // Optimistic UI update
    setUser(prevUser => prevUser ? ({
      ...prevUser,
      name: profileData.name ?? prevUser.name,
      avatar_url: profileData.avatar_url !== undefined ? profileData.avatar_url : prevUser.avatar_url,
    }) : null);

    try {
        const { error: updateError } = await supabase
        .from('proctorX')
        .update(updates)
        .eq('user_id', user.user_id);

        if (updateError) {
            console.error('[AuthContext updateUserProfile] Error updating DB:', updateError.message);
            setAuthError(updateError.message);
            setUser(oldUserSnapshot); // Rollback optimistic update
            return { success: false, error: updateError.message };
        }
        console.log('[AuthContext updateUserProfile] Success. Profile updated in DB.');
        // No need to call loadUserFromCookie here if optimistic update is sufficient
        return { success: true };
    } catch (e: any) {
        console.error('[AuthContext updateUserProfile] Exception:', e.message);
        setAuthError(e.message || 'An unexpected error occurred during profile update.');
        setUser(oldUserSnapshot); // Rollback optimistic update
        return { success: false, error: e.message || 'An unexpected error occurred during profile update.' };
    }
  }, [supabase, user, supabaseInitializationError]);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    authError,
    supabaseInitializationError,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
    supabase,
  }), [user, isLoading, authError, supabaseInitializationError, signIn, signUp, signOut, updateUserProfile, supabase]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
