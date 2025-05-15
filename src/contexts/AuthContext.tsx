
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
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE;

export const DICEBEAR_STYLES: string[] = ['micah', 'adventurer', 'bottts-neutral', 'pixel-art-neutral'];
export const DICEBEAR_TECH_KEYWORDS: string[] = ['coder', 'debugger', 'techie', 'pixelninja', 'cswizard', 'binary', 'script', 'stack', 'keyboard', 'neonbyte', 'glitch', 'algorithm', 'syntax', 'kernel'];

export const generateEnhancedDiceBearAvatar = (role: CustomUser['role'] | null, userId: string, styleOverride?: string, keywordsOverride?: string[]): string => {
  const selectedStyle = styleOverride || DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
  const selectedKeywords = keywordsOverride || DICEBEAR_TECH_KEYWORDS;
  const randomKeyword = selectedKeywords[Math.floor(Math.random() * selectedKeywords.length)];
  const userRoleStr = role || 'user';
  // Added more elements to seed for increased uniqueness to avoid DiceBear caching identical seeds too aggressively
  const uniqueSuffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).substring(2, 6);
  const seed = `${randomKeyword}-${userRoleStr}-${userId}-${uniqueSuffix}`;
  return `https://api.dicebear.com/8.x/${selectedStyle}/svg?seed=${encodeURIComponent(seed)}`;
};

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  authError: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: CustomUser['role']) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: string }>;
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
    console.log('[AuthContext SupabaseClientInitEffect] Attempting Supabase client initialization...');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const errorMsg = "CRITICAL: Supabase URL or Anon Key missing. Check .env and NEXT_PUBLIC_ prefix.";
      console.error("[AuthContext SupabaseClientInitEffect] " + errorMsg);
      setAuthError(errorMsg);
      setSupabase(null);
      setIsLoading(false); // Critical: ensure loading stops on init error
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
      setSupabase(null);
      setIsLoading(false); // Critical: ensure loading stops on init error
    }
  }, []);

  const getRedirectPathForRole = useCallback((userRole: CustomUser['role']) => {
    if (userRole === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    if (userRole === 'student') return STUDENT_DASHBOARD_ROUTE;
    console.warn(`[AuthContext getRedirectPathForRole] Unknown or null role: ${userRole}, defaulting to: ${DEFAULT_DASHBOARD_ROUTE}`);
    return DEFAULT_DASHBOARD_ROUTE;
  }, []);

  const loadUserFromCookie = useCallback(async (client: ReturnType<typeof createSupabaseBrowserClient>) => {
    console.log('[AuthContext loadUserFromCookie] Starting...');
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);

    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME);
      setIsLoading(false); // Ensure loading stops if no cookie
      return;
    }
    
    // if (user && user.email === userEmailFromCookie && !isLoading) {
    //   console.log('[AuthContext loadUserFromCookie] User already in context and matches cookie, not currently loading. Skipping DB fetch.');
    //   return; // isLoading remains false
    // }
    
    if (!isLoading) setIsLoading(true); // Set loading true only if not already loading

    try {
      console.log(`[AuthContext loadUserFromCookie] Fetching user data for email: ${userEmailFromCookie}`);
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
        if (dbError && dbError.code !== 'PGRST116') { // PGRST116 means "No rows found"
          setAuthError(dbError.message || "Failed to fetch user data.");
        } else if (!data) {
          setAuthError(null); // If simply no user found, it's not an "error" state for auth context
        }
      } else {
        const loadedUser: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? 'User',
          role: data.role as CustomUser['role'] || null,
          avatar_url: data.avatar_url || generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id),
        };
        console.log('[AuthContext loadUserFromCookie] User loaded:', loadedUser.email, "Role:", loadedUser.role, "ID:", loadedUser.user_id);
        setUser(loadedUser);
        if (loadedUser.role) Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        else Cookies.remove(ROLE_COOKIE_NAME);
        setAuthError(null);
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
  }, [isLoading]); // Added isLoading to dependencies as it's checked inside

  useEffect(() => {
    console.log(`[AuthContext Initial User Load Effect] Running. Supabase client: ${!!supabase}, isLoading: ${isLoading}, AuthError: ${authError}`);
    if (supabase && !authError) {
      loadUserFromCookie(supabase);
    } else if (authError && isLoading) {
        console.log('[AuthContext Initial User Load Effect] Supabase init error present, ensuring isLoading is false.');
        setIsLoading(false);
    } else if (!supabase && isLoading && !authError) { 
        // This case means Supabase client isn't ready yet, but no error occurred during its init.
        // We don't set isLoading to false here, as the client init effect will do that.
        console.log('[AuthContext Initial User Load Effect] Supabase client not yet initialized, initial load deferred.');
    }
  }, [supabase, authError, loadUserFromCookie]);


  useEffect(() => {
    console.log(`[AuthContext Route Guard Effect] Running. isLoading: ${isLoading}, Path: ${pathname}, User: ${user?.email}, Role: ${user?.role}, AuthError: ${authError}`);

    if (isLoading || authError) {
      console.log(`[AuthContext Route Guard Effect] Still loading (isLoading: ${isLoading}) or authError present (${authError}). Aborting route protection for this cycle.`);
      return;
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboardArea = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboardArea = pathname?.startsWith('/teacher/dashboard');
    // const isExamSessionPage = pathname?.startsWith('/exam-session/'); // Keep for future SEB routing logic

    if (user) { // User is authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`[AuthContext Route Guard Effect] User authenticated (${user.email}, Role: ${user.role}). Path: ${pathname}. Target dashboard: ${targetDashboard}`);
      if (isAuthPg) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Route Guard Effect] User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        }
        return;
      }
      // Role-based dashboard access check
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

    } else { // User is not authenticated
      console.log(`[AuthContext Route Guard Effect] User not authenticated. Path: ${pathname}`);
      const isProtectedRoute = isStudentDashboardArea || isTeacherDashboardArea || pathname?.startsWith('/exam-session/');
      if (isProtectedRoute) {
        if (pathname !== AUTH_ROUTE) {
          console.log(`[AuthContext Route Guard Effect] Unauthenticated on protected route ${pathname}, redirecting to ${AUTH_ROUTE}`);
          router.replace(AUTH_ROUTE);
        }
        return;
      }
      console.log('[AuthContext Route Guard Effect] User not authenticated and on public page or /auth.');
    }
  }, [user, isLoading, pathname, router, authError, getRedirectPathForRole]);

  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    if (!supabase) {
      const errorMsg = "Supabase client not initialized. Cannot sign in.";
      console.error('[AuthContext signIn] Aborted:', errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
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
        let errorDetail = 'User with this email not found.';
        if (dbError && dbError.code !== 'PGRST116') {
            errorDetail = dbError.message || 'Failed to fetch user data during sign in.';
        } else if (!data) {
            errorDetail = 'User with this email not found (no data returned).';
        }
        console.warn('[AuthContext signIn] Failed to fetch user or user not found. Email:', email, 'Error:', errorDetail);
        setAuthError(errorDetail);
        setUser(null);
        return { success: false, error: errorDetail };
      }
      
      console.log('[AuthContext signIn] User data fetched from DB:', data.email, data.role);

      if (data.pass === pass) {
        const userData: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? 'User',
          role: data.role as CustomUser['role'] || null,
          avatar_url: data.avatar_url || generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id),
        };
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        else Cookies.remove(ROLE_COOKIE_NAME);
        
        setUser(userData); // Update user state first
        console.log('[AuthContext signIn] Success. User set in context:', userData.email, 'Role:', userData.role);
        return { success: true, user: userData };
      } else {
        console.warn('[AuthContext signIn] Incorrect password for email:', email);
        setAuthError('Incorrect password.');
        setUser(null);
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
      console.error('[AuthContext signIn] Exception during sign in:', e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign in.';
      setAuthError(errorMsg);
      setUser(null);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: CustomUser['role']): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
     if (!supabase) {
      const errorMsg = "Supabase client not initialized. Cannot sign up.";
      console.error('[AuthContext signUp] Aborted:', errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false);
      return { success: false, error: errorMsg };
    }
    if (!role) {
      const errorMsg = "Role must be selected for registration.";
      console.error('[AuthContext signUp] Aborted:', errorMsg);
      setAuthError(errorMsg);
      setIsLoading(false); // Ensure loading state is reset
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
        console.error('[AuthContext signUp] Insert Error:', errorMsg);
        setAuthError(errorMsg);
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
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      
      setUser(newUserData); // Update user state first
      console.log('[AuthContext signUp] Success. User set in context:', newUserData);
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      const errorMsg = e.message || 'An unexpected error occurred during sign up.';
      setAuthError(errorMsg);
      setUser(null);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [supabase, generateShortId]);

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    setUser(null);
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setAuthError(null);
    setIsLoading(false); 
    console.log('[AuthContext signOut] User and cookies cleared. isLoading set to false.');
    if (pathname !== AUTH_ROUTE) {
        router.replace(AUTH_ROUTE);
    } else {
      // If already on auth page, ensure any loaders depending on isLoading are reset
      // This is more of a failsafe, as isLoading should be false.
    }
  }, [pathname, router]);

  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
    console.log('[AuthContext updateUserProfile] Attempting update for user_id:', user?.user_id, 'Data:', JSON.stringify(profileData));
    
    if (!supabase) {
      const errorMsg = "Supabase client not initialized. Cannot update profile.";
      console.error('[AuthContext updateUserProfile] Aborted:', errorMsg);
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
      updates.pass = profileData.password;
    }
    if (profileData.avatar_url !== undefined) { 
      updates.avatar_url = profileData.avatar_url || null; // Allow explicitly setting avatar_url to null
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

      // Optimistically update user state, or re-fetch for full consistency
      const refreshedUser: CustomUser = {
        ...user,
        name: updates.name ?? user.name, // Use new name if provided, else old
        avatar_url: updates.avatar_url !== undefined ? updates.avatar_url : user.avatar_url, // Use new avatar_url if provided, else old
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
      setIsLoading(false);
    }
  }, [supabase, user]);

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
