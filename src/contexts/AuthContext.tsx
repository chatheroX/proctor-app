
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
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

const DICEBEAR_TECH_KEYWORDS = ['coder', 'debugger', 'techie', 'pixelninja', 'cswizard', 'binary', 'script', 'stack', 'keyboard', 'neonbyte', 'glitch', 'algorithm', 'syntax', 'kernel'];
const DICEBEAR_STYLES = ['micah', 'adventurer', 'bottts-neutral', 'pixel-art-neutral'];

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean; // Renamed from authContextLoading for clarity
  authError: string | null;
  supabaseInitializationError: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: CustomUser['role']) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateEnhancedDiceBearAvatar = (role: CustomUser['role'], userId: string, styleOverride?: string): string => {
  const selectedStyle = styleOverride || DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const randomKeyword = DICEBEAR_TECH_KEYWORDS[Math.floor(Math.random() * DICEBEAR_TECH_KEYWORDS.length)];
  const userRoleStr = role || 'user';
  const uniqueSuffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).substring(2, 6);
  const seed = `${randomKeyword}-${userRoleStr}-${userId}-${uniqueSuffix}`;
  return `https://api.dicebear.com/8.x/${selectedStyle}/svg?seed=${encodeURIComponent(seed)}`;
};


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabaseInitializationError, setSupabaseInitializationError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('[AuthContext SupabaseClientInitEffect] Attempting Supabase client initialization...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = "CRITICAL: Supabase URL or Anon Key missing. Check .env and NEXT_PUBLIC_ prefix.";
      console.error("[AuthContext SupabaseClientInitEffect] " + errorMsg);
      setAuthError(errorMsg);
      setSupabaseInitializationError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Critical: ensure loading stops
      return;
    }
    try {
      const client = createSupabaseBrowserClient();
      setSupabase(client);
      console.log('[AuthContext SupabaseClientInitEffect] Supabase client initialized successfully.');
    } catch (e: any) {
      const errorMsg = e.message || "Failed to initialize Supabase client.";
      console.error("[AuthContext SupabaseClientInitEffect] CRITICAL: " + errorMsg, e);
      setAuthError(errorMsg);
      setSupabaseInitializationError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Critical: ensure loading stops
    }
  }, []);

  const loadUserFromCookie = useCallback(async (client: ReturnType<typeof createSupabaseBrowserClient>) => {
    console.log('[AuthContext loadUserFromCookie] Starting. Current user state:', user, 'isLoading:', isLoading);
    if (!isLoading) setIsLoading(true); // Ensure loading is true if we proceed
    setAuthError(null);

    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);

    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME); // Also remove role cookie if session is gone
      // setIsLoading(false) will be handled in finally
      return;
    }
    
    // Optimization: if user context is already populated and matches cookie, and we are NOT in the initial loading phase for this function call
    if (user && user.email === userEmailFromCookie && !isLoading) { // Re-check isLoading for this specific call
        console.log('[AuthContext loadUserFromCookie] User already in context and matches cookie, skipping DB fetch.');
        // setIsLoading(false) will be handled in finally
        return;
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
        console.warn('[AuthContext loadUserFromCookie] Error fetching user or user not found from DB. Email:', userEmailFromCookie, 'Error:', dbError?.message);
        setUser(null);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        // Don't set authError for "No rows found" (PGRST116) unless it's a different critical error
        if (dbError && dbError.code !== 'PGRST116') {
          setAuthError(dbError.message || "Failed to fetch user data from DB.");
        }
      } else {
        const loadedUser: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? 'User',
          role: data.role as CustomUser['role'] ?? null, // Role might be null if not set
          avatar_url: data.avatar_url || generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id),
        };
        console.log('[AuthContext loadUserFromCookie] User loaded from DB:', loadedUser.email, "Role:", loadedUser.role, "ID:", loadedUser.user_id);
        setUser(loadedUser);
        setAuthError(null); // Clear any previous auth error
        if (loadedUser.role) Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        else Cookies.remove(ROLE_COOKIE_NAME);
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
  }, [user, isLoading]); // Removed loadUserFromCookie from its own dependency array to avoid re-triggering.

  useEffect(() => {
    console.log(`[AuthContext Initial Load Effect] Running. Supabase client: ${!!supabase}, Supabase Init Error: ${supabaseInitializationError}`);
    if (supabase && !supabaseInitializationError) {
      console.log('[AuthContext Initial Load Effect] Supabase client ready, calling loadUserFromCookie.');
      loadUserFromCookie(supabase);
    } else if (supabaseInitializationError && isLoading) {
      console.warn('[AuthContext Initial Load Effect] Supabase init error present, ensuring isLoading is false.');
      setIsLoading(false);
    } else if (!supabase && isLoading) {
      console.log('[AuthContext Initial Load Effect] Supabase client not yet ready, initial user load deferred.');
      // setIsLoading(false) will be called by the SupabaseClientInitEffect if it fails.
      // Or if SupabaseClientInitEffect succeeds, this effect will re-run and call loadUserFromCookie.
    }
  }, [supabase, supabaseInitializationError, loadUserFromCookie]);


  const getRedirectPathForRole = useCallback((role: CustomUser['role']) => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    if (role === 'student') return STUDENT_DASHBOARD_ROUTE;
    return DEFAULT_DASHBOARD_ROUTE; // Fallback
  }, []);

  useEffect(() => {
    console.log(`[AuthContext Route Guard Effect] Running. isLoading: ${isLoading}, Path: ${pathname}, User: ${user?.email}, Role: ${user?.role}, AuthError: ${authError}, SupabaseInitError: ${supabaseInitializationError}`);

    if (isLoading) {
      console.log('[AuthContext Route Guard Effect] Still loading. Aborting route protection for this render cycle.');
      return;
    }
    if (authError && !supabaseInitializationError) { // If authError is not the Supabase init error
      console.warn('[AuthContext Route Guard Effect] AuthError present but not Supabase init error. Proceeding with route checks but session might be invalid.');
      // Potentially allow routing to /auth even with other authErrors.
    }
    if (supabaseInitializationError) {
      console.error('[AuthContext Route Guard Effect] Supabase init error. Routing logic might be affected. App may not function correctly.');
      // On critical Supabase init error, it's safer to not redirect, might show error page or just /auth.
      // If current path isn't /auth, perhaps redirect there.
      if (pathname !== AUTH_ROUTE && !pathname.startsWith('/_next/static')) { // Avoid redirecting static assets
        // For now, let's not redirect on supabase init error, as AuthProvider might not be fully ready
        // console.log(`[AuthContext Route Guard Effect] Supabase init error, trying to redirect to ${AUTH_ROUTE}`);
        // router.replace(AUTH_ROUTE);
      }
      return; // Stop further routing logic if Supabase isn't working
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboardArea = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboardArea = pathname?.startsWith('/teacher/dashboard');
    const isExamSessionPage = pathname?.startsWith('/exam-session/');

    if (user) { // User IS authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`[AuthContext Route Guard Effect] User authenticated (${user.email}, Role: ${user.role}). Path: ${pathname}. Target dashboard: ${targetDashboard}`);
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
      console.log(`[AuthContext Route Guard Effect] User not authenticated. Path: ${pathname}`);
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
  }, [user, isLoading, pathname, router, authError, supabaseInitializationError, getRedirectPathForRole]);

  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    setAuthError(null);

    if (!supabase) {
      const errorMsg = supabaseInitializationError || "Supabase client not initialized. Cannot sign in.";
      console.error('[AuthContext signIn] Aborted:', errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }

    try {
      console.time('Supabase SignIn Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, pass, name, role, avatar_url')
        .eq('email', email)
        .single();
      console.timeEnd('Supabase SignIn Query');

      if (dbError || !data) {
        let errorDetail = 'User with this email not found.';
        if (dbError && dbError.code !== 'PGRST116') {
            errorDetail = dbError.message || 'Failed to fetch user data.';
        }
        console.warn('[AuthContext signIn] Failed to fetch user or user not found. Email:', email, 'Error:', errorDetail);
        setAuthError(errorDetail);
        // setUser(null); // Ensure user is null on error
        return { success: false, error: errorDetail };
      }
      console.log('[AuthContext signIn] User data fetched from DB:', data.email, data.role);

      if (data.pass === pass) { // Plaintext password comparison - SECURITY RISK
        const userData: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? 'User',
          role: data.role as CustomUser['role'] ?? null,
          avatar_url: data.avatar_url || generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id),
        };
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        else Cookies.remove(ROLE_COOKIE_NAME);
        
        setUser(userData);
        setAuthError(null); // Clear any previous auth error
        console.log('[AuthContext signIn] Success. User set in context:', userData.email, 'Role:', userData.role);
        return { success: true, user: userData };
      } else {
        console.warn('[AuthContext signIn] Incorrect password for email:', email);
        setAuthError('Incorrect password.');
        // setUser(null);
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      console.error('[AuthContext signIn] Exception during sign in:', e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign in.';
      setAuthError(errorMsg);
      // setUser(null);
      return { success: false, error: errorMsg };
    } finally {
        console.log('[AuthContext signIn] Finished. Setting isLoading to false.');
        setIsLoading(false);
    }
  }, [supabase, supabaseInitializationError]);

  const generateShortId = useCallback(() => {
    // Basic 6-char alphanumeric ID (not cryptographically secure or collision-proof for large scale)
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: CustomUser['role']): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    setIsLoading(true);
    setAuthError(null);

    if (!supabase) {
      const errorMsg = supabaseInitializationError || "Supabase client not initialized. Cannot sign up.";
      console.error('[AuthContext signUp] Aborted:', errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    if (!role) {
      const errorMsg = "Role must be selected for registration.";
      console.error('[AuthContext signUp] Aborted:', errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }

    try {
      const { data: existingUser, error: selectError } = await supabase
        .from('proctorX')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') {
        const errorMsg = 'Error checking existing user: ' + selectError.message;
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }
      if (existingUser) {
        const errorMsg = 'User with this email already exists.';
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const newUserId = generateShortId();
      const defaultAvatar = generateEnhancedDiceBearAvatar(role, newUserId, 'micah');

      const newUserRecord: ProctorXTableType['Insert'] = {
        user_id: newUserId,
        email: email,
        pass: pass, // Plaintext password - SECURITY RISK
        name: name,
        role: role,
        avatar_url: defaultAvatar,
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('proctorX')
        .insert(newUserRecord)
        .select('user_id, email, name, role, avatar_url')
        .single();

      if (insertError || !insertedData) {
        const errorDetail = insertError?.message || "Could not retrieve user data after insert.";
        const errorMsg = 'Registration failed: ' + errorDetail;
        setAuthError(errorMsg);
        return { success: false, error: errorMsg };
      }

      const newUserData: CustomUser = {
        user_id: insertedData.user_id,
        email: insertedData.email,
        name: insertedData.name ?? 'User',
        role: insertedData.role as CustomUser['role'] ?? null,
        avatar_url: insertedData.avatar_url || defaultAvatar,
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      
      setUser(newUserData);
      setAuthError(null);
      console.log('[AuthContext signUp] Success. User set in context:', newUserData);
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign up.';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
        console.log('[AuthContext signUp] Finished. Setting isLoading to false.');
        setIsLoading(false);
    }
  }, [supabase, supabaseInitializationError, generateShortId]);

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    setIsLoading(true); // Indicate activity
    setUser(null);
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setAuthError(null);
    console.log('[AuthContext signOut] User and cookies cleared. Setting isLoading to false and redirecting.');
    setIsLoading(false); 
    // The useEffect for routing will pick up user === null and isLoading === false
    // and redirect to AUTH_ROUTE if not already there.
    // For an immediate visual change if already on a protected route:
    if (pathname !== AUTH_ROUTE) {
      router.replace(AUTH_ROUTE);
    }
  }, [pathname, router]);

  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext updateUserProfile] Attempting update for user_id:', user?.user_id, 'Data:', profileData);
    setIsLoading(true);
    setAuthError(null);

    if (!supabase) {
      const errorMsg = supabaseInitializationError || "Supabase client not initialized. Cannot update profile.";
      console.error('[AuthContext updateUserProfile] Aborted:', errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    if (!user || !user.user_id) {
      const errorMsg = "User not authenticated or user_id missing for profile update.";
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }

    const updates: Partial<ProctorXTableType['Update']> = {
      name: profileData.name,
    };
    if (profileData.password) {
      if (profileData.password.length < 6) {
        const errorMsg = "New password must be at least 6 characters long.";
        setAuthError(errorMsg);
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }
      updates.pass = profileData.password; // Plaintext password - SECURITY RISK
    }
    if (profileData.avatar_url !== undefined) { // Allow setting avatar_url to null or empty string if intended
      updates.avatar_url = profileData.avatar_url;
    }

    try {
      const { error: updateError } = await supabase
        .from('proctorX')
        .update(updates)
        .eq('user_id', user.user_id);

      if (updateError) {
        console.error('[AuthContext updateUserProfile] Error updating DB:', updateError.message);
        setAuthError(updateError.message);
        return { success: false, error: updateError.message };
      }

      // Fetch the updated user data to refresh the context
      const { data: updatedUserData, error: fetchError } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role, avatar_url')
        .eq('user_id', user.user_id)
        .single();

      if (fetchError || !updatedUserData) {
        console.error('[AuthContext updateUserProfile] Error fetching updated user data:', fetchError?.message);
        // Don't necessarily set authError here as the update might have succeeded.
        // The user state might become stale, but it's better than showing a global auth error.
        // Consider a specific "profile refresh error" if needed.
        return { success: true }; // Assume update succeeded, but refresh failed
      }

      const refreshedUser: CustomUser = {
        user_id: updatedUserData.user_id,
        email: updatedUserData.email,
        name: updatedUserData.name ?? 'User',
        role: updatedUserData.role as CustomUser['role'] ?? null,
        avatar_url: updatedUserData.avatar_url || generateEnhancedDiceBearAvatar(updatedUserData.role as CustomUser['role'], updatedUserData.user_id),
      };
      setUser(refreshedUser);
      console.log('[AuthContext updateUserProfile] Success. Profile updated and context refreshed.');
      return { success: true };
    } catch (e: any) {
      console.error('[AuthContext updateUserProfile] Exception:', e.message);
      const errorMsg = e.message || 'An unexpected error occurred during profile update.';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      console.log('[AuthContext updateUserProfile] Finished. Setting isLoading to false.');
      setIsLoading(false);
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
  }), [user, isLoading, authError, supabaseInitializationError, signIn, signUp, signOut, updateUserProfile]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
