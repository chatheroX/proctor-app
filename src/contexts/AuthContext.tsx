
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType, Exam, ExamInsert, ExamUpdate } from '@/types/supabase'; // Added Exam types
import { AlertTriangle, Loader2 } from 'lucide-react'; // For error display

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  authError: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  // Added Supabase client instance directly for other potential uses, though direct table access should be minimized.
  supabase: ReturnType<typeof createSupabaseBrowserClient> | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [supabase, setSupabase] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log('[AuthContext] Initializing Supabase client and loading user...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = "Supabase URL or Anon Key is missing in environment variables.";
      console.error("CRITICAL: [AuthContext] " + errorMsg);
      setAuthError(errorMsg);
      setSupabase(null); // Ensure supabase client is null
      setIsLoading(false); // Critical: ensure loading stops
      return;
    }

    try {
      const client = createSupabaseBrowserClient();
      setSupabase(client);
      console.log('[AuthContext] Supabase client initialized successfully.');
    } catch (e: any) {
      const errorMsg = e.message || "Failed to initialize Supabase client.";
      console.error("CRITICAL: [AuthContext] " + errorMsg, e);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Critical: ensure loading stops
    }
  }, []);


  const getRedirectPathForRole = useCallback((userRole?: CustomUser['role'] | null) => {
    if (userRole === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    if (userRole === 'student') return STUDENT_DASHBOARD_ROUTE;
    console.warn('[AuthContext getRedirectPathForRole] Unknown or null role, defaulting to student dashboard.');
    return STUDENT_DASHBOARD_ROUTE;
  }, []);

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    console.log('[AuthContext loadUserFromCookie] Starting. Current isLoading:', isLoading);
    if (!supabase) {
      console.warn('[AuthContext loadUserFromCookie] Supabase client not available yet. Aborting.');
      // If Supabase client itself failed to init, authError should be set, and isLoading should become false.
      // If supabase is just not ready yet, isLoading should remain true until it is.
      // This path should ideally not be hit if the supabase client useEffect runs first.
      if (!authError) setIsLoading(true); // ensure loading stays true if no error but no client
      else setIsLoading(false);
      return;
    }

    // If user is already set from signIn/signUp, and cookie matches, no need to re-fetch immediately
    // This check is tricky because loadUserFromCookie is also for initial page load
    // For now, let's simplify: always try to load from cookie if supabase is available.
    // The routing useEffect will handle redirects if user changes.

    setIsLoading(true); // Explicitly set loading true for this operation
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);

    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME); // Clean up role cookie if session is gone
      setIsLoading(false);
      return;
    }

    console.log(`[AuthContext loadUserFromCookie] Session cookie found. Email: ${userEmailFromCookie}. Fetching user from DB.`);
    try {
      console.time('Supabase LoadUserFromCookie Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role')
        .eq('email', userEmailFromCookie)
        .single();
      console.timeEnd('Supabase LoadUserFromCookie Query');

      if (dbError || !data) {
        console.warn('[AuthContext loadUserFromCookie] Error fetching user or user not found for email:', userEmailFromCookie, dbError?.message);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        setUser(null);
      } else {
        const loadedUser: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? '', // Ensure name is always a string
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
    } catch (e: any)      {
      console.error('[AuthContext loadUserFromCookie] Exception during user session processing:', e.message);
      Cookies.remove(SESSION_COOKIE_NAME);
      Cookies.remove(ROLE_COOKIE_NAME);
      setUser(null);
      setAuthError(e.message || "Error processing user session.");
    } finally {
      console.log('[AuthContext loadUserFromCookie] Finished. Setting isLoading to false.');
      setIsLoading(false);
    }
  }, [supabase, authError, isLoading]); // isLoading was added here, consider if it's needed or causes loops

  // Effect for initial user loading (depends on supabase client being ready)
  useEffect(() => {
    console.log('[AuthContext Initial User Load Effect] Running. Supabase client available:', !!supabase, "AuthError:", authError);
    if (authError) { // If Supabase client failed to init, don't try to load user
      console.warn("[AuthContext Initial User Load Effect] AuthError present, skipping user load. isLoading is already false from client init effect.");
      return;
    }
    if (supabase) { // Only load if supabase client is available
      loadUserFromCookie();
    }
    // If supabase is null and no authError, means client is still initializing. isLoading is true.
  }, [supabase, authError, loadUserFromCookie]);


  // Effect for route protection and redirection
  useEffect(() => {
    console.log(`[AuthContext Route Guard Effect] Running. Path: ${pathname}, isLoading: ${isLoading}, User: ${JSON.stringify(user)}, AuthError: ${authError}`);

    if (authError) {
      console.warn(`[AuthContext Route Guard Effect] AuthError ('${authError}') present. Halting route protection logic.`);
      return; // Don't proceed if there's a fundamental auth error
    }

    if (isLoading) {
      console.log(`[AuthContext Route Guard Effect] Still loading. Aborting route protection for this render.`);
      return; // Don't do anything if still loading
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboard = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboard = pathname?.startsWith('/teacher/dashboard');
    const isProtectedRoute = isStudentDashboard || isTeacherDashboard;

    if (user) { // User IS authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`[AuthContext Route Guard Effect] User IS authenticated. Role: ${user.role}, Target dashboard: ${targetDashboard}`);

      if (isAuthPg) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Route Guard Effect] User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        } else {
           console.log(`[AuthContext Route Guard Effect] User on /auth, but target is current path. Path: ${pathname}`);
        }
        return;
      }

      if (user.role === 'student' && isTeacherDashboard) {
        console.log(`[AuthContext Route Guard Effect] Student on teacher dashboard, redirecting to ${STUDENT_DASHBOARD_ROUTE}`);
        if (pathname !== STUDENT_DASHBOARD_ROUTE) router.replace(STUDENT_DASHBOARD_ROUTE);
        return;
      }
      if (user.role === 'teacher' && isStudentDashboard) {
        console.log(`[AuthContext Route Guard Effect] Teacher on student dashboard, redirecting to ${TEACHER_DASHBOARD_ROUTE}`);
        if (pathname !== TEACHER_DASHBOARD_ROUTE) router.replace(TEACHER_DASHBOARD_ROUTE);
        return;
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
        return;
      }
      console.log('[AuthContext Route Guard Effect] User not authenticated and on public page or /auth.');
    }
  }, [user, isLoading, pathname, router, getRedirectPathForRole, authError]);


  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    // setAuthError(null); // Clear previous errors for this attempt

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
          setIsLoading(false);
          return { success: false, error: 'User with this email not found.' };
        }
        setIsLoading(false);
        return { success: false, error: 'Login failed: ' + dbError.message };
      }

      if (data && data.pass === pass) {
        const userData: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? '',
          role: data.role as CustomUser['role'] ?? null,
        };
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) {
          Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        } else {
          Cookies.remove(ROLE_COOKIE_NAME);
        }
        setUser(userData);
        console.log('[AuthContext signIn] Success. User set:', userData);
        // Redirect is handled by useEffect, isLoading will be set to false by it after user state update
      } else {
        setIsLoading(false);
        return { success: false, error: 'Incorrect password.' };
      }
      setIsLoading(false); // Ensure isLoading is false on successful path too
      return { success: true, user: data as CustomUser }; // data is CustomUser after checks
    } catch (e: any) {
      console.error('[AuthContext signIn] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign in.');
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred during sign in.' };
    }
  }, [supabase, authError]);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: 'student' | 'teacher'): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized." };
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    setIsLoading(true);
    // setAuthError(null);

    try {
      const { data: existingUser, error: selectError } = await supabase
        .from('proctorX')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 means no rows found, which is good here
        setIsLoading(false);
        return { success: false, error: 'Error checking existing user: ' + selectError.message };
      }
      if (existingUser) {
        setIsLoading(false);
        return { success: false, error: 'User with this email already exists.' };
      }

      const newUserId = generateShortId();
      const newUserRecord: Omit<ProctorXTableType['Insert'], 'created_at'> = { // ProctorXTableType['Insert'] might be better if defined
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
        setIsLoading(false);
        return { success: false, error: 'Registration failed: ' + (insertError?.message || "Could not retrieve user after insert.") };
      }

      const newUserData: CustomUser = {
        user_id: insertedData.user_id,
        email: insertedData.email,
        name: insertedData.name ?? '',
        role: insertedData.role as CustomUser['role'] ?? null,
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) {
        Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      }
      setUser(newUserData);
      console.log('[AuthContext signUp] Success. User set:', newUserData);
      // Redirect handled by useEffect
      setIsLoading(false);
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign up.');
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred during sign up.' };
    }
  }, [supabase, authError, generateShortId]);

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    // No Supabase interaction needed for custom auth sign out other than clearing local state/cookies
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null);
    setIsLoading(false); // User state changed, loading is complete for this action
    console.log('[AuthContext signOut] User set to null, isLoading set to false. Redirect will be handled by route guard effect.');
    // router.push(AUTH_ROUTE); // Explicit redirect for sign out
  }, []);

  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!supabase || authError) return { success: false, error: authError || "Supabase client not initialized." };
    if (!user || !user.user_id) return { success: false, error: "User not authenticated or user_id missing." };
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id);

    const updates: Partial<ProctorXTableType['Update']> = { name: profileData.name };
    if (profileData.password && profileData.password.length >= 6) {
      updates.pass = profileData.password;
    } else if (profileData.password && profileData.password.length > 0 && profileData.password.length < 6) {
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

    setUser(prevUser => prevUser ? ({ ...prevUser, name: profileData.name || prevUser.name }) : null);
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
    supabase, // Provide the client instance
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
