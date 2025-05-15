
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email'; // Stores user email for session
const ROLE_COOKIE_NAME = 'proctorprep-user-role'; // Stores user role

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  authError: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: CustomUser['role']) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: string }>;
  supabase: ReturnType<typeof createSupabaseBrowserClient> | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateDefaultAvatar = (role: CustomUser['role'], userId: string): string => {
  const safeRole = role || 'student'; // Default to student if role is somehow null
  const seed = `${safeRole}-${userId}-${Date.now()}`;
  return `https://api.dicebear.com/8.x/micah/svg?seed=${seed}`;
};


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Effect for Supabase client initialization
  useEffect(() => {
    console.log('[AuthContext SupabaseClientInitEffect] Attempting Supabase client initialization...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = "CRITICAL: Supabase URL or Anon Key missing. Check .env and NEXT_PUBLIC_ prefix.";
      console.error("[AuthContext SupabaseClientInitEffect] " + errorMsg);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false);
      return;
    }

    try {
      const client = createSupabaseBrowserClient();
      setSupabase(client);
      setAuthError(null);
      console.log('[AuthContext SupabaseClientInitEffect] Supabase client initialized successfully.');
    } catch (e: any) {
      const errorMsg = e.message || "Failed to initialize Supabase client.";
      console.error("[AuthContext SupabaseClientInitEffect] CRITICAL: " + errorMsg, e);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false);
    }
  }, []);

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const loadUserFromCookie = useCallback(async (client: ReturnType<typeof createSupabaseBrowserClient>) => {
    console.log('[AuthContext loadUserFromCookie] Starting user load from cookie.');
    setIsLoading(true); // Ensure loading state is true during fetch attempt

    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME); // Ensure role cookie is also cleared
      setIsLoading(false);
      return;
    }

    // If user is already in state and matches cookie, and not loading, skip DB fetch.
    // This is a quick check but primary fetch logic proceeds.
    if (user && user.email === userEmailFromCookie && !isLoading) {
        console.log('[AuthContext loadUserFromCookie] User already in state and matches cookie, skipping DB fetch. This might be redundant if isLoading was reset.');
        // This path might be less common due to isLoading=true at start.
    }

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
  }, [user, isLoading]); // user and isLoading added to reflect dependencies for the early exit logic


  // Effect for initial user load based on cookie when Supabase client is ready
  useEffect(() => {
    console.log(`[AuthContext Initial User Load Effect] Running. Supabase client: ${!!supabase}, AuthError: ${authError}`);
    if (supabase && !authError) {
      console.log('[AuthContext Initial User Load Effect] Supabase client ready, calling loadUserFromCookie.');
      loadUserFromCookie(supabase);
    } else if (authError) {
      console.log('[AuthContext Initial User Load Effect] Auth error during client init, initial user load skipped.');
      if(isLoading) setIsLoading(false);
    } else if (!supabase && isLoading) {
      console.log('[AuthContext Initial User Load Effect] Supabase client not set yet, still loading (or init failed).');
      // If supabase init failed isLoading should already be false.
    }
  }, [supabase, authError, loadUserFromCookie]); // loadUserFromCookie is memoized


  // Effect for route protection and redirection
  useEffect(() => {
    console.log(`[AuthContext Route Guard Effect] Running. isLoading: ${isLoading}, Path: ${pathname}, User: ${user?.email}, Role: ${user?.role}, AuthError: ${authError}`);

    if (isLoading) {
      console.log('[AuthContext Route Guard Effect] Still loading. Aborting route protection for this render cycle.');
      return;
    }

    if (authError) {
      console.warn(`[AuthContext Route Guard Effect] AuthError ('${authError}') present. Halting route protection logic. Current path: ${pathname}`);
      if (pathname !== AUTH_ROUTE && !pathname.startsWith('/_next')) { // Avoid loops on auth page itself
        // router.replace(AUTH_ROUTE); // Potentially redirect to auth if critical error, but can cause loops.
      }
      return;
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboardArea = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboardArea = pathname?.startsWith('/teacher/dashboard');
    const isExamSessionPage = pathname?.startsWith('/exam-session/'); // New exam session page

    let targetDashboard = STUDENT_DASHBOARD_ROUTE; // Default
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
      // Role-based access checks for dashboard areas
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
  }, [user, isLoading, pathname, router, authError]); // Removed getRedirectPathForRole, logic now inline


  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase) return { success: false, error: authError || "Supabase client not initialized." };
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
        setIsLoading(false);
        if (dbError && dbError.code === 'PGRST116') {
          return { success: false, error: 'User with this email not found.' };
        }
        return { success: false, error: 'Login failed: ' + (dbError?.message || 'User data not found.') };
      }

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
        setIsLoading(false);
        console.log('[AuthContext signIn] Success. User set:', userData);
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
  }, [supabase, authError]);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: CustomUser['role']): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    if (!role) {
        return { success: false, error: "Role must be selected for registration."};
    }
    setIsLoading(true);
    setAuthError(null);

    try {
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
      const defaultAvatar = generateDefaultAvatar(role, newUserId);

      const newUserRecord: ProctorXTableType['Insert'] = {
        user_id: newUserId,
        email: email,
        pass: pass, // SECURITY RISK
        name: name,
        role: role,
        avatar_url: defaultAvatar, // Assign default avatar
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('proctorX')
        .insert(newUserRecord)
        .select('user_id, email, name, role, avatar_url')
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
        avatar_url: insertedData.avatar_url || defaultAvatar, // Ensure avatar_url is set
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) {
        Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      }
      setUser(newUserData);
      setIsLoading(false);
      console.log('[AuthContext signUp] Success. User set:', newUserData);
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign up.');
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred during sign up.' };
    }
  }, [supabase, generateShortId, authError]);

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null); // This triggers the route guard useEffect
    setIsLoading(false); // Ensure loading is false for the route guard
    // The route guard useEffect will handle redirection to AUTH_ROUTE
  }, []);

  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) return { success: false, error: authError || "Supabase client not initialized." };
    if (!user || !user.user_id) return { success: false, error: "User not authenticated or user_id missing." };
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id);
    setAuthError(null);

    const updates: Partial<ProctorXTableType['Update']> = { 
        name: profileData.name,
        updated_at: new Date().toISOString(), // Assuming you add updated_at to proctorX
    };
    if (profileData.password) {
      if (profileData.password.length < 6) {
        return { success: false, error: "New password must be at least 6 characters long." };
      }
      updates.pass = profileData.password; // SECURITY RISK
    }
    if (profileData.avatar_url) {
      updates.avatar_url = profileData.avatar_url;
    }
    
    const oldUser = { ...user }; // Shallow copy for potential rollback
    
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
            console.error('[AuthContext updateUserProfile] Error:', updateError.message);
            setAuthError(updateError.message);
            setUser(oldUser); // Rollback optimistic update
            return { success: false, error: updateError.message };
        }
        console.log('[AuthContext updateUserProfile] Success. Profile updated in DB.');
        return { success: true };
    } catch (e: any) {
        console.error('[AuthContext updateUserProfile] Exception:', e.message);
        setAuthError(e.message || 'An unexpected error occurred during profile update.');
        setUser(oldUser); // Rollback optimistic update
        return { success: false, error: e.message || 'An unexpected error occurred during profile update.' };
    }
  }, [supabase, user, authError]);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    authError,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
    supabase,
  }), [user, isLoading, authError, signIn, signUp, signOut, updateUserProfile, supabase]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
