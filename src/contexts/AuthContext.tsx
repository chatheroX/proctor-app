
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'zentest-user-email'; // Changed from proctorprep
const ROLE_COOKIE_NAME = 'zentest-user-role'; // Changed from proctorprep

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE;

export const DICEBEAR_STYLES: string[] = ['micah', 'adventurer', 'bottts-neutral', 'pixel-art-neutral'];
export const DICEBEAR_TECH_KEYWORDS: string[] = ['coder', 'debugger', 'techie', 'pixelninja', 'cswizard', 'binary', 'script', 'stack', 'keyboard', 'neonbyte', 'glitch', 'algorithm', 'syntax', 'kernel'];

export const generateEnhancedDiceBearAvatar = (role: CustomUser['role'] | null, userId: string, styleOverride?: string, keywordsOverride?: string[]): string => {
  const selectedStyle = styleOverride || DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const selectedKeywords = keywordsOverride || DICEBEAR_TECH_KEYWORDS;
  const randomKeyword = selectedKeywords[Math.floor(Math.random() * selectedKeywords.length)];
  const userRoleStr = role || 'user';
  // Use a simpler, more stable seed part if userId itself is already quite unique (like a UUID or short ID)
  // Adding Date.now() makes the URL change on every generation, which might not be desired for a default if user_id is stable.
  // Let's use a combination that's unique per user but consistent for that user unless regenerated.
  const seed = `${randomKeyword}-${userRoleStr}-${userId}`;
  return `https://api.dicebear.com/8.x/${selectedStyle}/svg?seed=${encodeURIComponent(seed)}`;
};

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean; // True if AuthContext is performing an async auth operation or initial load
  authError: string | null;
  supabase: ReturnType<typeof createSupabaseBrowserClient> | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: CustomUser['role']) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [user, setUser] = useState<CustomUser | null>(null); // Start as null
  const [isLoading, setIsLoading] = useState(true); // Start true until initial check is done
  const [authError, setAuthError] = useState<string | null>(null);
  const initialLoadAttempted = React.useRef(false);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const effectId = `[AuthContext SupabaseClientInitEffect ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Running...`);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = "CRITICAL: Supabase URL or Anon Key missing. Check .env variables.";
      console.error(`${effectId} ${errorMsg}`);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false); 
      return;
    }
    try {
      const client = createSupabaseBrowserClient();
      setSupabase(client);
      console.log(`${effectId} Supabase client initialized successfully.`);
      setAuthError(null);
    } catch (e: any) {
      const errorMsg = e.message || "Failed to initialize Supabase client.";
      console.error(`${effectId} CRITICAL: ${errorMsg}`, e);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false);
    }
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    const effectId = `[AuthContext loadUserFromCookie ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Starting. Supabase client:`, supabase ? 'Available' : 'NULL');

    if (!supabase) {
      console.warn(`${effectId} Aborted: Supabase client not available for session check.`);
      setAuthError("Service connection unavailable. Cannot check session.");
      setIsLoading(false); // Ensure loading stops
      return;
    }

    setIsLoading(true); // Explicitly set loading true for this operation
    setAuthError(null);

    try {
      const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
      console.log(`${effectId} Cookie '${SESSION_COOKIE_NAME}' value:`, userEmailFromCookie);

      if (!userEmailFromCookie) {
        console.log(`${effectId} No session cookie found.`);
        setUser(null);
        Cookies.remove(ROLE_COOKIE_NAME);
        // setIsLoading(false) will be handled in finally
        return;
      }
      
      console.log(`${effectId} Session cookie found for email:`, userEmailFromCookie, ". Fetching user from DB...");
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role, avatar_url')
        .eq('email', userEmailFromCookie) // Query by email, as it's stored in the cookie
        .single();

      console.log(`${effectId} DB query result - Data:`, data, 'Error:', dbError);

      if (dbError || !data) {
        let errorDetail = 'User from session cookie not found or DB error.';
        if (dbError && dbError.code === 'PGRST116') { // No rows found
          errorDetail = 'User from session cookie not found in database. Clearing stale session.';
        } else if (dbError) {
          errorDetail = `DB Error: ${dbError.message}`;
        }
        console.warn(`${effectId} ${errorDetail} Email:`, userEmailFromCookie);
        setUser(null);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        // Don't set global authError for a stale cookie, but log it.
        return;
      }
      
      const loadedUser: CustomUser = {
        user_id: data.user_id,
        email: data.email,
        name: data.name ?? 'User',
        role: data.role as CustomUser['role'] || null,
        avatar_url: data.avatar_url || generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id),
      };
      console.log(`${effectId} User loaded from cookie and DB:`, loadedUser.email, "Role:", loadedUser.role);
      setUser(loadedUser);
      if (loadedUser.role) Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
      else Cookies.remove(ROLE_COOKIE_NAME);

    } catch (e: any) {
      console.error(`${effectId} Exception during user session processing:`, e.message, e);
      setUser(null);
      Cookies.remove(SESSION_COOKIE_NAME);
      Cookies.remove(ROLE_COOKIE_NAME);
      setAuthError(e.message || "Error processing user session.");
    } finally {
      console.log(`${effectId} Finished. Setting isLoading to false.`);
      setIsLoading(false);
    }
  }, [supabase]); // Dependencies: supabase client. setAuthError, setIsLoading, setUser are stable.

  useEffect(() => {
    const effectId = `[AuthContext InitialUserLoadEffect ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Running. Supabase client:`, supabase ? 'Available' : 'NULL', 'AuthError:', authError, 'InitialLoadAttempted:', initialLoadAttempted.current);
    
    if (authError) { // If Supabase client init failed
      console.log(`${effectId} Aborting due to existing critical authError: '${authError}'. isLoading should already be false.`);
      return;
    }
    if (supabase && !initialLoadAttempted.current) {
      initialLoadAttempted.current = true;
      console.log(`${effectId} Supabase client available & first attempt. Calling loadUserFromCookie.`);
      loadUserFromCookie();
    } else if (!supabase) {
      console.log(`${effectId} Supabase client still NULL, authError is also NULL. Client init likely pending. isLoading is:`, isLoading);
      // isLoading should be true here if client init is pending
    } else if (initialLoadAttempted.current) {
        console.log(`${effectId} Initial load already attempted. isLoading is:`, isLoading);
    }
  }, [supabase, authError, loadUserFromCookie, isLoading]);

  const getRedirectPathForRole = useCallback((userRole: CustomUser['role']) => {
    if (userRole === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    if (userRole === 'student') return STUDENT_DASHBOARD_ROUTE;
    console.warn(`[AuthContext getRedirectPathForRole] Unknown or null role: ${userRole}, defaulting to: ${DEFAULT_DASHBOARD_ROUTE}`);
    return DEFAULT_DASHBOARD_ROUTE;
  }, []);

  useEffect(() => {
    const effectId = `[AuthContext Route Guard Effect ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Running. isLoading: ${isLoading}, Path: ${pathname}, User: ${user?.email}, Role: ${user?.role}, AuthError (context): ${authError}`);

    if (isLoading) {
      console.log(`${effectId} Waiting: isLoading is true.`);
      return;
    }
    if (authError) {
      console.log(`${effectId} Critical authError ('${authError}') exists. No routing changes by context guard.`);
      return;
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboardArea = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboardArea = pathname?.startsWith('/teacher/dashboard');
    const isExamSessionPage = pathname?.startsWith('/exam-session/');

    if (user) {
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`${effectId} User authenticated (${user.email}, Role: ${user.role}). Target dashboard: ${targetDashboard}`);
      if (isAuthPg) {
        if (pathname !== targetDashboard) {
          console.log(`${effectId} User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
          return; 
        }
      }
      if (user.role === 'student' && isTeacherDashboardArea) {
        if (pathname !== STUDENT_DASHBOARD_ROUTE) {
          console.log(`${effectId} Student on teacher area, redirecting to ${STUDENT_DASHBOARD_ROUTE}`);
          router.replace(STUDENT_DASHBOARD_ROUTE);
          return;
        }
      }
      if (user.role === 'teacher' && isStudentDashboardArea) {
        if (pathname !== TEACHER_DASHBOARD_ROUTE) {
          console.log(`${effectId} Teacher on student area, redirecting to ${TEACHER_DASHBOARD_ROUTE}`);
          router.replace(TEACHER_DASHBOARD_ROUTE);
          return;
        }
      }
      console.log(`${effectId} Authenticated user on correct page or non-auth public page: ${pathname}. No redirect needed by context guard.`);

    } else { // No user (and isLoading is false, no critical authError)
      console.log(`${effectId} User not authenticated. Path: ${pathname}`);
      const isProtectedRoute = isStudentDashboardArea || isTeacherDashboardArea || isExamSessionPage;
      if (isProtectedRoute) {
        if (pathname !== AUTH_ROUTE) {
          console.log(`${effectId} Unauthenticated on protected route ${pathname}, redirecting to ${AUTH_ROUTE}`);
          router.replace(AUTH_ROUTE);
          return;
        }
      }
      console.log(`${effectId} User not authenticated and on public page or already on /auth: ${pathname}. No redirect needed by context guard.`);
    }
  }, [user, isLoading, pathname, router, authError, getRedirectPathForRole]);

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    const operationId = `[AuthContext signIn ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Attempting sign in for:`, email);

    if (!supabase) {
      const errorMsg = "Service connection error. Please try again later.";
      console.error(`${operationId} Aborted: ${errorMsg}`);
      setAuthError(errorMsg); // Set context-level error
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    setIsLoading(true);
    setAuthError(null);

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
            errorDetail = dbError.message || 'Failed to fetch user data.';
        }
        console.warn(`${operationId} Failed to fetch user. Email:`, email, 'Error:', errorDetail);
        setUser(null); // Ensure user state is null on failure
        // Don't setAuthError for "not found" here, let form handle specific message
        return { success: false, error: errorDetail };
      }
      
      console.log(`${operationId} User data fetched from DB:`, data.email, "Role:", data.role);

      if (data.pass === pass) {
        const userData: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? 'User',
          role: data.role as CustomUser['role'],
          avatar_url: data.avatar_url || generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id),
        };
        
        setUser(userData); // THIS IS THE CRITICAL STATE UPDATE
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        else Cookies.remove(ROLE_COOKIE_NAME);
        
        console.log(`${operationId} Success. User set in context:`, userData.email, 'Role:', userData.role);
        // isLoading will be set to false by the loadUserFromCookie in the next render cycle triggered by setUser
        // OR by the routing useEffect if it navigates away.
        // For direct feedback, we could set it here but want to ensure user state propogates first.
        // setIsLoading(false); // Let effects handle this for consistency.
        return { success: true, user: userData };
      } else {
        console.warn(`${operationId} Incorrect password for email:`, email);
        setUser(null);
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      console.error(`${operationId} Exception during sign in:`, e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign in.';
      setUser(null);
      return { success: false, error: errorMsg };
    } finally {
      // This `finally` block will run AFTER the try/catch.
      // If successful, setUser would have been called, triggering effects.
      // If failed, setUser(null) would have been called.
      // The key is that the main routing effect waits for isLoading to be false.
      // And loadUserFromCookie (if called due to navigation) handles its own isLoading.
      // It might be better for signIn to set isLoading(false) if it directly returns an error.
      if (!user) setIsLoading(false); // If signIn itself determines no user session established *yet*
      console.log(`${operationId} signIn Finished. isLoading state may be updated by subsequent effects.`);
    }
  }, [supabase, user]);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: CustomUser['role']): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    const operationId = `[AuthContext signUp ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Attempting sign up for:`, email, 'Role:', role);

    if (!supabase) {
      const errorMsg = "Service connection error. Please try again later.";
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    if (!role) {
      const errorMsg = "Role must be selected for registration.";
      setIsLoading(false); // Important to set loading false here
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
        return { success: false, error: errorMsg };
      }
      if (existingUser) {
        const errorMsg = 'User with this email already exists.';
        return { success: false, error: errorMsg };
      }

      const newUserId = generateShortId();
      const defaultAvatar = generateEnhancedDiceBearAvatar(role, newUserId);
      const newUserRecord: ProctorXTableType['Insert'] = {
        user_id: newUserId,
        email: email,
        pass: pass,
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
        console.error(`${operationId} Insert Error:`, errorMsg);
        setUser(null);
        return { success: false, error: errorMsg };
      }

      const newUserData: CustomUser = {
        user_id: insertedData.user_id,
        email: insertedData.email,
        name: insertedData.name ?? 'User',
        role: insertedData.role as CustomUser['role'],
        avatar_url: insertedData.avatar_url || defaultAvatar,
      };
      
      setUser(newUserData); // CRITICAL: Update user state
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      else Cookies.remove(ROLE_COOKIE_NAME);
      
      console.log(`${operationId} Success. User set in context:`, newUserData);
      return { success: true, user: newUserData };

    } catch (e: any) {
      console.error(`${operationId} Exception during sign up:`, e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign up.';
      setUser(null);
      return { success: false, error: errorMsg };
    } finally {
      // Similarly to signIn, let effects handle isLoading state based on user change
      if (!user) setIsLoading(false);
      console.log(`${operationId} signUp Finished.`);
    }
  }, [supabase, generateShortId, user]);

  const signOut = useCallback(async () => {
    const operationId = `[AuthContext signOut ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Signing out.`);
    
    setUser(null);
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setAuthError(null);
    setIsLoading(false); // Explicitly set isLoading false *after* user is null
    
    console.log(`${operationId} User and cookies cleared. isLoading set to false. Current path: ${pathname}`);
    if (pathname !== AUTH_ROUTE) { // Prevent redirect loop if already on auth page
        // router.replace(AUTH_ROUTE); // Let the route guard effect handle this for consistency
    }
  }, [pathname, router]);


  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
    const operationId = `[AuthContext updateUserProfile ${Date.now().toString().slice(-4)}]`;
    
    if (!supabase) {
      const errorMsg = "Service connection error.";
      console.error(`${operationId} Aborted: ${errorMsg}`);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    if (!user || !user.user_id) {
      const errorMsg = "User not authenticated or user_id missing.";
      setAuthError(errorMsg); // Could set this for UI display
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    
    console.log(`${operationId} Attempting update for user_id:`, user.user_id);
    setIsLoading(true);
    setAuthError(null);

    const updates: Partial<ProctorXTableType['Update']> = {
      name: profileData.name,
    };
    if (profileData.password) {
      if (profileData.password.length < 6) {
        const errorMsg = "New password must be at least 6 characters long.";
        setIsLoading(false);
        return { success: false, error: errorMsg };
      }
      updates.pass = profileData.password;
    }
    if (profileData.avatar_url !== undefined) { 
      updates.avatar_url = profileData.avatar_url;
    }

    try {
      const { error: updateError } = await supabase
        .from('proctorX')
        .update(updates)
        .eq('user_id', user.user_id);

      if (updateError) {
        console.error(`${operationId} Error updating DB:`, updateError.message);
        return { success: false, error: updateError.message };
      }

      const refreshedUser: CustomUser = {
        ...user,
        name: updates.name ?? user.name,
        avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url, // Keep old if not updated
      };
      setUser(refreshedUser);
      console.log(`${operationId} Success. Profile updated and context refreshed.`);
      return { success: true };

    } catch (e: any) {
      console.error(`${operationId} Exception:`, e.message);
      const errorMsg = e.message || 'An unexpected error occurred during profile update.';
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
      console.log(`${operationId} Finished. isLoading set to false.`);
    }
  }, [supabase, user]);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    authError,
    supabase,
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

