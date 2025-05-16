
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'zentest-user-email'; // Updated cookie name
const ROLE_COOKIE_NAME = 'zentest-user-role'; // Updated cookie name

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE; // Fallback, can be adjusted

// DiceBear Avatar Configuration
export const DICEBEAR_STYLES: string[] = ['micah', 'adventurer', 'bottts-neutral', 'pixel-art-neutral'];
export const DICEBEAR_TECH_KEYWORDS: string[] = ['coder', 'debugger', 'techie', 'pixelninja', 'cswizard', 'binary', 'script', 'stack', 'keyboard', 'neonbyte', 'glitch', 'algorithm', 'syntax', 'kernel'];

export const generateEnhancedDiceBearAvatar = (role: CustomUser['role'] | null, userId: string, styleOverride?: string, keywordsOverride?: string[]): string => {
  const selectedStyle = styleOverride || DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const selectedKeywords = keywordsOverride || DICEBEAR_TECH_KEYWORDS;
  const randomKeyword = selectedKeywords[Math.floor(Math.random() * selectedKeywords.length)];
  const userRoleStr = role || 'user';
  const uniqueSuffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).substring(2, 6);
  const seed = `${randomKeyword}-${userRoleStr}-${userId}-${uniqueSuffix}`;
  return `https://api.dicebear.com/8.x/${selectedStyle}/svg?seed=${encodeURIComponent(seed)}`;
};

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  authError: string | null;
  supabase: ReturnType<typeof createSupabaseBrowserClient> | null; // Expose supabase client
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: CustomUser['role']) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Effect 1: Initialize Supabase Client (runs once on mount)
  useEffect(() => {
    console.log('[AuthContext SupabaseClientInitEffect] Running...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = "CRITICAL: Supabase URL or Anon Key missing from environment. Check deployment configuration.";
      console.error("[AuthContext SupabaseClientInitEffect] " + errorMsg);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Critical init error, stop loading.
      return;
    }

    try {
      const client = createSupabaseBrowserClient();
      setSupabase(client);
      console.log('[AuthContext SupabaseClientInitEffect] Supabase client initialized successfully.');
      setAuthError(null); // Clear previous init errors if successful now
      // isLoading will be set to false by InitialUserLoadEffect after attempting user load
    } catch (e: any) {
      const errorMsg = e.message || "Failed to initialize Supabase client during SupabaseClientInitEffect.";
      console.error("[AuthContext SupabaseClientInitEffect] CRITICAL: " + errorMsg, e);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Critical init error, stop loading.
    }
  }, []); // Empty dependency array: runs once on mount

  const loadUserFromCookie = useCallback(async () => {
    const effectId = `[AuthContext loadUserFromCookie ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Starting... Current Supabase client from state:`, supabase ? 'Available' : 'NULL');

    if (!supabase) {
      console.warn(`${effectId} Aborted at start: Supabase client (from context state) not available when attempting to load user.`);
      setAuthError("Service connection unavailable for user session check."); // Set an error
      setIsLoading(false); // Ensure loading stops
      return;
    }

    console.log(`${effectId} Setting isLoading to true.`);
    setIsLoading(true); // Explicitly set loading true for this operation
    setAuthError(null); // Clear previous general auth errors

    try {
      const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
      if (!userEmailFromCookie) {
        console.log(`${effectId} No session cookie found.`);
        setUser(null);
        Cookies.remove(ROLE_COOKIE_NAME);
        // authError remains null as this is not an error, just no session
        return; // Exit early
      }

      console.log(`${effectId} Session cookie found for email:`, userEmailFromCookie, ". Fetching user from DB...");
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role, avatar_url')
        .eq('email', userEmailFromCookie)
        .single();

      if (dbError || !data) {
        let errorDetail = 'User not found or DB error while validating cookie.';
        if (dbError && dbError.code === 'PGRST116') {
          errorDetail = 'User from session cookie not found in database. Clearing stale session.';
        } else if (dbError) {
          errorDetail = `DB Error: ${dbError.message}`;
        }
        console.warn(`${effectId} ${errorDetail} Email:`, userEmailFromCookie);
        setUser(null);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        // Do not set authError here unless it's a persistent DB issue,
        // as a missing user for a stale cookie is not a system error.
        return; // Exit early
      }

      const defaultAvatar = generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id);
      const loadedUser: CustomUser = {
        user_id: data.user_id,
        email: data.email,
        name: data.name ?? 'User',
        role: data.role as CustomUser['role'] || null,
        avatar_url: data.avatar_url || defaultAvatar,
      };

      console.log(`${effectId} User loaded from cookie and DB:`, loadedUser.email, "Role:", loadedUser.role);
      setUser(loadedUser);
      if (loadedUser.role) Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
      else Cookies.remove(ROLE_COOKIE_NAME);
      // authError remains null

    } catch (e: any) {
      console.error(`${effectId} Exception during user session processing:`, e.message);
      setUser(null);
      Cookies.remove(SESSION_COOKIE_NAME);
      Cookies.remove(ROLE_COOKIE_NAME);
      setAuthError(e.message || "Error processing user session.");
    } finally {
      console.log(`${effectId} Finished. Setting isLoading to false.`);
      setIsLoading(false);
    }
  }, [supabase, setAuthError, setIsLoading, setUser]); // Dependencies for loadUserFromCookie

  // Effect 2: Load User Data (runs when supabase client is ready or authError changes from client init)
  useEffect(() => {
    const effectId = `[AuthContext InitialUserLoadEffect ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Running. Supabase client:`, supabase ? 'Available' : 'NULL', 'Auth Error from init:', authError);

    if (authError) { // If there was a critical init error from SupabaseClientInitEffect
      console.log(`${effectId} Aborting user load due to existing critical authError: '${authError}'. isLoading should already be false.`);
      // isLoading is already false if authError was set by SupabaseClientInitEffect
      return;
    }

    if (supabase) { // Client is initialized successfully
      console.log(`${effectId} Supabase client IS available. Calling loadUserFromCookie.`);
      loadUserFromCookie(); // This will manage its own isLoading cycle (true then false)
    } else {
      // Supabase client is null AND no authError from client init.
      // This means SupabaseClientInitEffect hasn't completed setting the client yet.
      // isLoading is still true from its initial state. We wait.
      console.log(`${effectId} Supabase client is NULL and no authError. Client init likely pending. isLoading remains: ${isLoading}`);
    }
  }, [supabase, authError, loadUserFromCookie]); // isLoading removed

  const getRedirectPathForRole = useCallback((userRole: CustomUser['role']) => {
    if (userRole === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    if (userRole === 'student') return STUDENT_DASHBOARD_ROUTE;
    console.warn(`[AuthContext getRedirectPathForRole] Unknown or null role: ${userRole}, defaulting to: ${DEFAULT_DASHBOARD_ROUTE}`);
    return DEFAULT_DASHBOARD_ROUTE;
  }, []);

  // Effect 3: Route Protection & Redirection
  useEffect(() => {
    const effectId = `[AuthContext RouteGuardEffect ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Running. isLoading: ${isLoading}, Path: ${pathname}, User: ${user?.email}, Role: ${user?.role}, AuthError (context): ${authError}`);

    if (isLoading) {
      console.log(`${effectId} Waiting: isLoading is true. Aborting route protection for this cycle.`);
      return;
    }

    if (authError) {
        console.log(`${effectId} Critical authError ('${authError}') exists. Not performing routing logic. App should display error state.`);
        // If on auth page with critical error, might be okay. Otherwise, this indicates a problem.
        return;
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboardArea = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboardArea = pathname?.startsWith('/teacher/dashboard');
    const isExamSessionPage = pathname?.startsWith('/exam-session/'); // Assuming this needs auth

    if (user) { // User is authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`${effectId} User authenticated (${user.email}, Role: ${user.role}). Path: ${pathname}. Target dashboard: ${targetDashboard}`);
      if (isAuthPg) {
        if (pathname !== targetDashboard) {
          console.log(`${effectId} User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        }
        return;
      }
      // Role-based access for dashboards
      if (user.role === 'student' && isTeacherDashboardArea) {
         if (pathname !== STUDENT_DASHBOARD_ROUTE) { // Redirect to their own dashboard
            console.log(`${effectId} Student on teacher area, redirecting to ${STUDENT_DASHBOARD_ROUTE}`);
            router.replace(STUDENT_DASHBOARD_ROUTE);
         }
         return;
      }
      if (user.role === 'teacher' && isStudentDashboardArea) {
          if (pathname !== TEACHER_DASHBOARD_ROUTE) { // Redirect to their own dashboard
            console.log(`${effectId} Teacher on student area, redirecting to ${TEACHER_DASHBOARD_ROUTE}`);
            router.replace(TEACHER_DASHBOARD_ROUTE);
          }
          return;
      }
      console.log(`${effectId} Authenticated user on correct page or non-auth public page.`);

    } else { // User is not authenticated (and isLoading is false, no authError)
      console.log(`${effectId} User not authenticated. Path: ${pathname}`);
      const isProtectedRoute = isStudentDashboardArea || isTeacherDashboardArea || isExamSessionPage;
      if (isProtectedRoute) {
        if (pathname !== AUTH_ROUTE) {
          console.log(`${effectId} Unauthenticated on protected route ${pathname}, redirecting to ${AUTH_ROUTE}`);
          router.replace(AUTH_ROUTE);
        }
        return;
      }
      console.log(`${effectId} User not authenticated and on public page or already on /auth.`);
    }
  }, [user, isLoading, pathname, router, authError, getRedirectPathForRole]);

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    const operationId = `[AuthContext signIn ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Attempting sign in for:`, email);

    if (!supabase) {
      const errorMsg = "Supabase client not initialized. Cannot sign in.";
      console.error(`${operationId} Aborted:`, errorMsg);
      setAuthError(errorMsg); // Set context-level error
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    setIsLoading(true);
    setAuthError(null); // Clear previous errors for this operation

    try {
      console.time(`${operationId} Supabase SignIn Query`);
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, pass, name, role, avatar_url')
        .eq('email', email)
        .single();
      console.timeEnd(`${operationId} Supabase SignIn Query`);

      if (dbError || !data) {
        let errorDetail = 'User with this email not found or DB error.';
        if (dbError && dbError.code === 'PGRST116') { // No rows found
            errorDetail = 'User with this email not found.';
        } else if (dbError) {
            errorDetail = dbError.message || 'Failed to fetch user data during sign in.';
        }
        console.warn(`${operationId} Failed to fetch user or user not found. Email:`, email, 'Error:', errorDetail);
        setAuthError(errorDetail);
        setUser(null); // Ensure user is null on failure
        return { success: false, error: errorDetail };
      }
      
      console.log(`${operationId} User data fetched from DB:`, data.email, data.role);

      if (data.pass === pass) { // Plaintext password comparison - SECURITY RISK
        const defaultAvatar = generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id);
        const userData: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? 'User',
          role: data.role as CustomUser['role'] || null,
          avatar_url: data.avatar_url || defaultAvatar,
        };
        
        setUser(userData); // This must happen before setting cookies for consistency if effects depend on user state
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        else Cookies.remove(ROLE_COOKIE_NAME);
        
        console.log(`${operationId} Success. User set in context:`, userData.email, 'Role:', userData.role);
        return { success: true, user: userData };
      } else {
        console.warn(`${operationId} Incorrect password for email:`, email);
        setAuthError('Incorrect password.');
        setUser(null);
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      console.error(`${operationId} Exception during sign in:`, e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign in.';
      setAuthError(errorMsg);
      setUser(null);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
      console.log(`${operationId} Finished. isLoading set to false.`);
    }
  }, [supabase, setAuthError, setIsLoading, setUser]);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: CustomUser['role']): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    const operationId = `[AuthContext signUp ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Attempting sign up for:`, email, 'Role:', role);
    if (!supabase) {
      const errorMsg = "Supabase client not initialized. Cannot sign up.";
      console.error(`${operationId} Aborted:`, errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
     if (!role) { // Role is now mandatory
      const errorMsg = "Role (student or teacher) must be selected for registration.";
      console.error(`${operationId} Aborted:`, errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
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
      const defaultAvatar = generateEnhancedDiceBearAvatar(role, newUserId);

      const newUserRecord: ProctorXTableType['Insert'] = {
        user_id: newUserId,
        email: email,
        pass: pass, // Plaintext - SECURITY RISK
        name: name,
        role: role,
        avatar_url: defaultAvatar,
        // created_at will be set by DB default
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('proctorX')
        .insert(newUserRecord)
        .select('user_id, email, name, role, avatar_url')
        .single();

      if (insertError || !insertedData) {
        const errorDetail = insertError?.message || "Could not retrieve user data after insert.";
        const errorMsg = 'Registration failed: ' + errorDetail;
        console.error(`${operationId} Insert Error:`, errorMsg);
        setAuthError(errorMsg);
        setUser(null);
        return { success: false, error: errorMsg };
      }

      const newUserData: CustomUser = {
        user_id: insertedData.user_id,
        email: insertedData.email,
        name: insertedData.name ?? 'User',
        role: insertedData.role as CustomUser['role'], // Should be not null from insert
        avatar_url: insertedData.avatar_url || defaultAvatar,
      };
      
      setUser(newUserData);
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' }); // Role is not null
      
      console.log(`${operationId} Success. User set in context:`, newUserData);
      return { success: true, user: newUserData };

    } catch (e: any) {
      console.error(`${operationId} Exception:`, e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign up.';
      setAuthError(errorMsg);
      setUser(null);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
      console.log(`${operationId} Finished. isLoading set to false.`);
    }
  }, [supabase, generateShortId, setAuthError, setIsLoading, setUser]);

  const signOut = useCallback(async () => {
    const operationId = `[AuthContext signOut ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Signing out.`);
    
    setUser(null);
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setAuthError(null);
    setIsLoading(false); // User is now definitively known (null), so loading is false.
    
    // The route guard effect will handle redirection if necessary
    // No direct router.replace here to avoid conflicts with the effect.
    console.log(`${operationId} User and cookies cleared. isLoading set to false.`);
  }, [setAuthError, setIsLoading, setUser]);


  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
    const operationId = `[AuthContext updateUserProfile ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Attempting update for user_id:`, user?.user_id);
    
    if (!supabase) {
      const errorMsg = "Supabase client not initialized. Cannot update profile.";
      console.error(`${operationId} Aborted:`, errorMsg);
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }
    if (!user || !user.user_id) {
      const errorMsg = "User not authenticated or user_id missing.";
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    }
    
    setIsLoading(true);
    setAuthError(null);

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
      updates.pass = profileData.password; // Plaintext - SECURITY RISK
    }
    if (profileData.avatar_url !== undefined) { 
      updates.avatar_url = profileData.avatar_url; // Can be null or new URL
    }

    try {
      // Omitting .select() as it's not strictly needed for an update unless you need the updated row back
      const { error: updateError } = await supabase
        .from('proctorX')
        .update(updates)
        .eq('user_id', user.user_id);

      if (updateError) {
        console.error(`${operationId} Error updating DB:`, updateError.message);
        setAuthError(updateError.message);
        return { success: false, error: updateError.message };
      }

      // Update user state in context
      const defaultAvatarIfNeeded = generateEnhancedDiceBearAvatar(user.role, user.user_id);
      const refreshedUser: CustomUser = {
        ...user,
        name: updates.name ?? user.name,
        avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : (user.avatar_url || defaultAvatarIfNeeded),
      };
      setUser(refreshedUser);
      console.log(`${operationId} Success. Profile updated and context refreshed.`);
      return { success: true };

    } catch (e: any) {
      console.error(`${operationId} Exception:`, e.message);
      const errorMsg = e.message || 'An unexpected error occurred during profile update.';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
      console.log(`${operationId} Finished. isLoading set to false.`);
    }
  }, [supabase, user, setAuthError, setIsLoading, setUser]);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    authError,
    supabase, // Expose supabase client
    signIn,
    signUp,
    signOut,
    updateUserProfile,
  }), [user, isLoading, authError, supabase, signIn, signUp, signOut, updateUserProfile]);

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
