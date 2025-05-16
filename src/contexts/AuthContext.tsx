
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'zentest-user-email';
const ROLE_COOKIE_NAME = 'zentest-user-role';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE;

// DiceBear Avatar Configuration
export const DICEBEAR_STYLES: string[] = ['micah', 'adventurer', 'bottts-neutral', 'pixel-art-neutral'];
export const DICEBEAR_TECH_KEYWORDS: string[] = ['coder', 'debugger', 'techie', 'pixelninja', 'cswizard', 'binary', 'script', 'stack', 'keyboard', 'neonbyte', 'glitch', 'algorithm', 'syntax', 'kernel'];

export const generateEnhancedDiceBearAvatar = (role: CustomUser['role'] | null, userId: string, styleOverride?: string, keywordsOverride?: string[]): string => {
  const selectedStyle = styleOverride || DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const selectedKeywords = keywordsOverride || DICEBEAR_TECH_KEYWORDS;
  const randomKeyword = selectedKeywords[Math.floor(Math.random() * selectedKeywords.length)];
  const userRoleStr = role || 'user';
  const timestamp = Date.now().toString().slice(-5); // Add a timestamp for more uniqueness on regeneration
  const seed = `${randomKeyword}-${userRoleStr}-${userId}-${timestamp}`;
  return `https://api.dicebear.com/8.x/${selectedStyle}/svg?seed=${encodeURIComponent(seed)}`;
};


type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
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
  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const initialLoadAttempted = React.useRef(false);

  const router = useRouter();
  const pathname = usePathname();

  // Effect for Supabase client initialization
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
      setIsLoading(false); // Crucial: stop loading if client can't init
      return;
    }
    try {
      const client = createSupabaseBrowserClient();
      setSupabase(client);
      console.log(`${effectId} Supabase client initialized successfully.`);
      setAuthError(null);
      // isLoading will be set to false by loadUserFromCookie or its initial load effect
    } catch (e: any) {
      const errorMsg = e.message || "Failed to initialize Supabase client.";
      console.error(`${effectId} CRITICAL: ${errorMsg}`, e);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Crucial: stop loading if client init throws
    }
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    const effectId = `[AuthContext loadUserFromCookie ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Starting. Supabase client:`, supabase ? 'Available' : 'NULL');

    if (!supabase) {
      console.warn(`${effectId} Aborted: Supabase client not available for session check.`);
      setAuthError("Service connection unavailable. Cannot check session.");
      setIsLoading(false); // Stop loading if no client
      return;
    }
    
    // Only set isLoading true if we are actually going to fetch
    // This prevents a loop if called multiple times while already loading
    if (!isLoading) setIsLoading(true);
    setAuthError(null);

    try {
      const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
      console.log(`${effectId} Cookie '${SESSION_COOKIE_NAME}' value:`, userEmailFromCookie);

      if (!userEmailFromCookie) {
        console.log(`${effectId} No session cookie found.`);
        setUser(null);
        Cookies.remove(ROLE_COOKIE_NAME);
        return; // isLoading will be handled in finally
      }
      
      console.log(`${effectId} Session cookie found for email:`, userEmailFromCookie, ". Fetching user from DB...");
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role, avatar_url')
        .eq('email', userEmailFromCookie)
        .single();

      console.log(`${effectId} DB query result - Data:`, data, 'Error:', dbError);

      if (dbError || !data) {
        let errorDetail = 'User from session cookie not found or DB error.';
        if (dbError && dbError.code === 'PGRST116') {
          errorDetail = 'User from session cookie not found in database. Clearing stale session.';
        } else if (dbError) {
          errorDetail = `DB Error: ${dbError.message}`;
        }
        console.warn(`${effectId} ${errorDetail} Email:`, userEmailFromCookie);
        setUser(null);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        return; // isLoading will be handled in finally
      }
      
      const loadedUser: CustomUser = {
        user_id: data.user_id,
        email: data.email,
        name: data.name ?? null,
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
  }, [supabase, authError, isLoading]); // Added isLoading to prevent re-entry if already loading

  // Effect for initial user load
  useEffect(() => {
    const effectId = `[AuthContext InitialUserLoadEffect ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Running. Supabase:`, supabase ? 'Available' : 'NULL', 'AuthError:', authError, 'InitialLoadAttempted:', initialLoadAttempted.current);
    
    if (authError) {
      console.log(`${effectId} Aborting due to critical authError: '${authError}'. isLoading should already be false.`);
      if(isLoading) setIsLoading(false); // Ensure it's false if authError is set
      return;
    }
    if (supabase && !initialLoadAttempted.current) {
      initialLoadAttempted.current = true;
      console.log(`${effectId} Supabase client available & first attempt. Calling loadUserFromCookie.`);
      loadUserFromCookie();
    } else if (!supabase && isLoading) {
        // If supabase client is still not set and we are in initial loading state, wait.
        // If client init failed, authError would be set and isLoading would become false.
        console.log(`${effectId} Supabase client not yet available, initial isLoading is true. Waiting.`);
    } else if (initialLoadAttempted.current && isLoading) {
        // This case should ideally not happen if loadUserFromCookie's finally block is robust
        console.warn(`${effectId} Initial load attempted, but isLoading is still true. This might be a bug.`);
    }
  }, [supabase, authError, loadUserFromCookie, isLoading]);

  const getRedirectPathForRole = useCallback((userRole: CustomUser['role']) => {
    if (userRole === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    // STUDENT_DASHBOARD_ROUTE is the default
    return STUDENT_DASHBOARD_ROUTE;
  }, []);

  // Effect for route protection and redirection
  useEffect(() => {
    const effectId = `[AuthContext Route Guard Effect ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Running. isLoading: ${isLoading}, Path: ${pathname}, User: ${user?.email}, Role: ${user?.role}, ContextAuthError: ${authError}`);

    if (isLoading) {
      console.log(`${effectId} Waiting: isLoading is true.`);
      return;
    }
    if (authError) { // If there was a critical error like Supabase client init failing
      console.log(`${effectId} Critical authError ('${authError}') exists. No routing by context guard.`);
      // If on a protected route and auth system itself is broken, might redirect to a generic error page or auth
      // For now, this means UI might show the error via dashboard layouts.
      return;
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboardArea = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboardArea = pathname?.startsWith('/teacher/dashboard');
    const isExamSessionPage = pathname?.startsWith('/exam-session/'); // This route is outside (app)

    if (user) { // User IS authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`${effectId} User authenticated (${user.email}, Role: ${user.role}). Target dashboard: ${targetDashboard}, Current path: ${pathname}`);
      
      if (isAuthPg) {
        if (pathname !== targetDashboard) {
          console.log(`${effectId} User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
          return; 
        }
      }
      // Role-based access checks for dashboard areas
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
        if (pathname !== AUTH_ROUTE) { // Avoid redirect loop if already on auth
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
      setAuthError(errorMsg);
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
        if (dbError && dbError.code === 'PGRST116') {
            errorDetail = 'User with this email not found.';
        } else if (dbError) {
            errorDetail = dbError.message || 'Failed to fetch user data.';
        }
        console.warn(`${operationId} Failed to fetch user. Email:`, email, 'Error:', errorDetail);
        setUser(null);
        return { success: false, error: errorDetail };
      }
      
      console.log(`${operationId} User data fetched from DB:`, data.email, "Role:", data.role);

      if (data.pass === pass) { // Plaintext password comparison - SECURITY RISK
        const userData: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? null,
          role: data.role as CustomUser['role'] || null,
          avatar_url: data.avatar_url || generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id),
        };
        
        setUser(userData); // This is the critical state update
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        else Cookies.remove(ROLE_COOKIE_NAME);
        
        console.log(`${operationId} Success. User set in context:`, userData.email, 'Role:', userData.role);
        // isLoading will be set to false in the finally block
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
      setIsLoading(false);
      console.log(`${operationId} signIn Finished. isLoading set to false.`);
    }
  }, [supabase]);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: CustomUser['role']): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    const operationId = `[AuthContext signUp ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Attempting sign up for:`, email, 'Role:', role);

    if (!supabase) {
      const errorMsg = "Service connection error. Please try again later.";
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    if (!role) { // Role is now mandatory
        const errorMsg = "Role must be selected for registration.";
        setIsLoading(false);
        return { success: false, error: errorMsg };
    }
    setIsLoading(true);
    setAuthError(null);

    try {
      console.time(`${operationId} Supabase SignUp Check Existing User Query`);
      const { data: existingUser, error: selectError } = await supabase
        .from('proctorX')
        .select('email')
        .eq('email', email)
        .maybeSingle(); // Use maybeSingle to not error if no user found
      console.timeEnd(`${operationId} Supabase SignUp Check Existing User Query`);

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116: No rows found, which is good
        const errorMsg = 'Error checking existing user: ' + selectError.message;
        console.error(`${operationId} DB Select Error:`, errorMsg);
        return { success: false, error: errorMsg };
      }
      if (existingUser) {
        const errorMsg = 'User with this email already exists.';
        console.warn(`${operationId} User Exists:`, email);
        return { success: false, error: errorMsg };
      }

      const newUserId = generateShortId();
      const defaultAvatar = generateEnhancedDiceBearAvatar(role, newUserId);
      const newUserRecord: ProctorXTableType['Insert'] = {
        user_id: newUserId,
        email: email,
        pass: pass, // Storing plaintext password - SECURITY RISK
        name: name,
        role: role,
        avatar_url: defaultAvatar,
      };

      console.time(`${operationId} Supabase SignUp Insert Query`);
      const { data: insertedData, error: insertError } = await supabase
        .from('proctorX')
        .insert(newUserRecord)
        .select('user_id, email, name, role, avatar_url') // Select the fields of the new user
        .single(); // Expect a single row back
      console.timeEnd(`${operationId} Supabase SignUp Insert Query`);

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
        name: insertedData.name ?? null,
        role: insertedData.role as CustomUser['role'], // Already ensured role is not null
        avatar_url: insertedData.avatar_url || defaultAvatar,
      };
      
      setUser(newUserData);
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' }); // Role is guaranteed
      
      console.log(`${operationId} Success. User set in context:`, newUserData);
      return { success: true, user: newUserData };

    } catch (e: any) {
      console.error(`${operationId} Exception during sign up:`, e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign up.';
      setUser(null);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
      console.log(`${operationId} signUp Finished. isLoading set to false.`);
    }
  }, [supabase, generateShortId]);

  const signOut = useCallback(async () => {
    const operationId = `[AuthContext signOut ${Date.now().toString().slice(-4)}]`;
    console.log(`${operationId} Signing out.`);
    
    setUser(null);
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setAuthError(null);
    
    // Set isLoading to false to allow the route guard to process the unauthenticated state.
    // If already on AUTH_ROUTE, this helps re-enable the form if it was showing a loader.
    setIsLoading(false); 
    
    console.log(`${operationId} User and cookies cleared. isLoading set to false. Current path: ${pathname}`);
    // Let the route guard effect handle redirection
  }, [pathname]);


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
      setAuthError(errorMsg);
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
      updates.pass = profileData.password; // Storing plaintext password
    }
    if (profileData.avatar_url !== undefined) { 
      updates.avatar_url = profileData.avatar_url;
    }

    try {
      const { error: updateError } = await supabase
        .from('proctorX')
        .update(updates)
        .eq('user_id', user.user_id); // Update by user_id

      if (updateError) {
        console.error(`${operationId} Error updating DB:`, updateError.message);
        // Log the specific Supabase error details if available
        if (updateError.details) console.error("Supabase error details:", updateError.details);
        if (updateError.hint) console.error("Supabase error hint:", updateError.hint);
        return { success: false, error: `Failed to update profile: ${updateError.message}` };
      }

      // Optimistically update context or re-fetch. For simplicity, update context.
      const refreshedUser: CustomUser = {
        ...user,
        name: updates.name ?? user.name,
        avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url,
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
      console.log(`${operationId} updateUserProfile Finished. isLoading set to false.`);
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
