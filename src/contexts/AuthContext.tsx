
'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTableType } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email'; // Stores email
const ROLE_COOKIE_NAME = 'proctorprep-user-role';   // Stores role

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';

const AVATAR_TECH_KEYWORDS = ['coder', 'debugger', 'techie', 'pixelninja', 'cswizard', 'binary', 'script', 'stack', 'keyboard', 'neonbyte', 'glitch', 'algorithm', 'syntax', 'kernel'];
const AVATAR_STYLES = ['micah', 'adventurer', 'bottts-neutral', 'pixel-art-neutral'];

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  authError: string | null;
  supabaseInitializationError: string | null;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: CustomUser['role']) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string; avatar_url?: string }) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const generateEnhancedDiceBearAvatar = (role: CustomUser['role'], userId: string, style?: string): string => {
  const selectedStyle = style || AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
  const randomKeyword = AVATAR_TECH_KEYWORDS[Math.floor(Math.random() * AVATAR_TECH_KEYWORDS.length)];
  const userRole = role || 'student'; // Default role if null for seed generation
  // Use a more random suffix than just timestamp to avoid quick regeneration issues
  const uniqueSuffix = Math.random().toString(36).substring(2, 8); 
  const seed = `${randomKeyword}-${userRole}-${userId}-${uniqueSuffix}`;
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
      setAuthError(errorMsg); // Use authError for this now
      setSupabaseInitializationError(errorMsg);
      setSupabase(null);
      setIsLoading(false);
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
      setIsLoading(false);
    }
  }, []);

  const loadUserFromCookie = useCallback(async (client: ReturnType<typeof createSupabaseBrowserClient>) => {
    console.log('[AuthContext loadUserFromCookie] Starting user load from cookie.');
    if (!isLoading) setIsLoading(true); // Set loading true if not already
    setAuthError(null);

    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      setUser(null);
      Cookies.remove(ROLE_COOKIE_NAME);
      setIsLoading(false);
      return;
    }

    // If user is already loaded and matches cookie, skip DB fetch (optimization)
    if (user && user.email === userEmailFromCookie && !isLoading) {
      console.log('[AuthContext loadUserFromCookie] User already in context and matches cookie, skipping fetch. Ensuring isLoading is false.');
      // No need to set isLoading to true if we skip and it's already false.
      // But if isLoading was true, it needs to become false.
      if(isLoading) setIsLoading(false);
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
        if (dbError && dbError.code !== 'PGRST116') {
          setAuthError(dbError.message || "Failed to fetch user data from DB.");
        }
      } else {
        const loadedUser: CustomUser = {
          user_id: data.user_id,
          email: data.email,
          name: data.name ?? 'User',
          role: data.role as CustomUser['role'] ?? null,
          avatar_url: data.avatar_url || generateEnhancedDiceBearAvatar(data.role as CustomUser['role'], data.user_id),
        };
        console.log('[AuthContext loadUserFromCookie] User loaded from DB:', loadedUser.email, "Role:", loadedUser.role);
        setUser(loadedUser);
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
  }, [isLoading, user]); // Removed setIsLoading from deps as it causes loops if not careful

  useEffect(() => {
    console.log(`[AuthContext Initial User Load Effect] Running. Supabase client: ${!!supabase}, AuthError: ${authError}`);
    if (supabase && !authError) { // Only attempt to load if supabase client exists and no init error
      console.log('[AuthContext Initial User Load Effect] Supabase client ready, calling loadUserFromCookie.');
      loadUserFromCookie(supabase);
    } else if (authError) {
        console.log('[AuthContext Initial User Load Effect] AuthError present, initial user load skipped. Ensuring isLoading is false.');
        if (isLoading) setIsLoading(false); // Ensure loading stops if there was an init error
    } else if (!supabase && isLoading) {
      // This case means Supabase client is still being initialized, isLoading is true.
      // loadUserFromCookie will be called once supabase client is set by the first useEffect.
      console.log('[AuthContext Initial User Load Effect] Supabase client not yet set, initial load deferred.');
    }
  }, [supabase, authError, loadUserFromCookie, isLoading]);


  useEffect(() => {
    console.log(`[AuthContext Effect - Route Guard] Running. isLoading: ${isLoading}, Path: ${pathname}, User: ${user?.email}, Role: ${user?.role}, AuthError: ${authError}`);
    if (isLoading || authError) {
      console.log('[AuthContext Effect - Route Guard] Still loading or authError present. Aborting route protection for this render cycle.');
      return;
    }

    const isAuthPg = pathname === AUTH_ROUTE;
    const isStudentDashboardArea = pathname?.startsWith('/student/dashboard');
    const isTeacherDashboardArea = pathname?.startsWith('/teacher/dashboard');
    const isExamSessionPage = pathname?.startsWith('/exam-session/');

    let targetDashboard = STUDENT_DASHBOARD_ROUTE; // Default
    if (user?.role === 'teacher') targetDashboard = TEACHER_DASHBOARD_ROUTE;
    else if (user?.role === 'student') targetDashboard = STUDENT_DASHBOARD_ROUTE;

    if (user) { // User IS authenticated
      console.log(`[AuthContext Effect - Route Guard] User authenticated (${user.email}, Role: ${user.role}). Current path: ${pathname}`);
      if (isAuthPg) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Effect - Route Guard] User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        }
        return;
      }
      if (user.role === 'student' && isTeacherDashboardArea) {
        if (pathname !== STUDENT_DASHBOARD_ROUTE) {
          console.log(`[AuthContext Effect - Route Guard] Student on teacher area, redirecting to ${STUDENT_DASHBOARD_ROUTE}`);
          router.replace(STUDENT_DASHBOARD_ROUTE);
        }
        return;
      }
      if (user.role === 'teacher' && isStudentDashboardArea) {
         if (pathname !== TEACHER_DASHBOARD_ROUTE) {
          console.log(`[AuthContext Effect - Route Guard] Teacher on student area, redirecting to ${TEACHER_DASHBOARD_ROUTE}`);
          router.replace(TEACHER_DASHBOARD_ROUTE);
        }
        return;
      }
      console.log('[AuthContext Effect - Route Guard] Authenticated user on correct page or non-auth public page.');
    } else { // User is NOT authenticated (user is null)
      console.log(`[AuthContext Effect - Route Guard] User not authenticated. Current path: ${pathname}`);
      const isProtectedRoute = isStudentDashboardArea || isTeacherDashboardArea || isExamSessionPage;
      if (isProtectedRoute) {
        if (pathname !== AUTH_ROUTE) {
          console.log(`[AuthContext Effect - Route Guard] Unauthenticated on protected route ${pathname}, redirecting to ${AUTH_ROUTE}`);
          router.replace(AUTH_ROUTE);
        }
        return;
      }
      console.log('[AuthContext Effect - Route Guard] User not authenticated and on public page or /auth.');
    }
  }, [user, isLoading, pathname, router, authError]);

  const signIn = useCallback(async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase) {
      console.error('[AuthContext signIn] Aborted: Supabase client not initialized.', supabaseInitializationError);
      return { success: false, error: supabaseInitializationError || "Supabase client not initialized." };
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
        const errorDetail = dbError?.message || 'User data not found for this email.';
        console.warn('[AuthContext signIn] Failed to fetch user or user not found. Email:', email, 'Error:', errorDetail);
        setAuthError(dbError && dbError.code === 'PGRST116' ? 'User with this email not found.' : 'Login failed: ' + errorDetail);
        setIsLoading(false);
        return { success: false, error: authError };
      }
      console.log('[AuthContext signIn] User data fetched from DB:', data.email, data.role);

      if (data.pass === pass) { // SECURITY RISK: Plaintext password comparison
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
        
        setUser(userData); // This will trigger the route guard useEffect
        console.log('[AuthContext signIn] Success. User set in context:', userData.email, 'Role:', userData.role);
        setIsLoading(false); // Set loading false AFTER user state is updated
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
  }, [supabase, supabaseInitializationError, authError]); // Added authError

  const generateShortId = useCallback(() => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }, []);

  const signUp = useCallback(async (email: string, pass: string, name: string, role: CustomUser['role']): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (!supabase) {
      console.error('[AuthContext signUp] Aborted: Supabase client not initialized.', supabaseInitializationError);
      return { success: false, error: supabaseInitializationError || "Supabase client not initialized." };
    }
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    if (!role) {
      setAuthError("Role must be selected for registration.");
      return { success: false, error: "Role must be selected for registration." };
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
        setAuthError('Error checking existing user: ' + selectError.message);
        setIsLoading(false);
        return { success: false, error: 'Error checking existing user: ' + selectError.message };
      }
      if (existingUser) {
        setAuthError('User with this email already exists.');
        setIsLoading(false);
        return { success: false, error: 'User with this email already exists.' };
      }

      const newUserId = generateShortId();
      const defaultAvatar = generateEnhancedDiceBearAvatar(role, newUserId, 'micah'); // Use micah style for initial

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
        setAuthError('Registration failed: ' + errorDetail);
        setIsLoading(false);
        return { success: false, error: 'Registration failed: ' + errorDetail };
      }

      const newUserData: CustomUser = {
        user_id: insertedData.user_id,
        email: insertedData.email,
        name: insertedData.name ?? 'User',
        role: insertedData.role as CustomUser['role'] ?? null,
        avatar_url: insertedData.avatar_url || defaultAvatar, // Fallback just in case
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      
      setUser(newUserData);
      console.log('[AuthContext signUp] Success. User set in context:', newUserData);
      setIsLoading(false); // Set loading false AFTER user state is updated
      return { success: true, user: newUserData };
    } catch (e: any) {
      console.error('[AuthContext signUp] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during sign up.');
      setIsLoading(false);
      return { success: false, error: 'An unexpected error occurred during sign up.' };
    }
  }, [supabase, supabaseInitializationError, generateShortId]);

  const signOut = useCallback(async () => {
    console.log('[AuthContext signOut] Signing out.');
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null);
    setAuthError(null);
    setIsLoading(false); // Ensure loading is false so route guard can redirect
  }, []);

  const updateUserProfile = useCallback(async (profileData: { name: string; password?: string; avatar_url?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      console.error('[AuthContext updateUserProfile] Aborted: Supabase client not initialized.', supabaseInitializationError);
      return { success: false, error: supabaseInitializationError || "Supabase client not initialized." };
    }
    if (!user || !user.user_id) {
      setAuthError("User not authenticated or user_id missing.");
      return { success: false, error: "User not authenticated or user_id missing." };
    }
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id, "New data:", profileData);
    setAuthError(null);
    // setIsLoading(true); // Optional: set loading during profile update

    const updates: Partial<ProctorXTableType['Update']> = {
      name: profileData.name,
    };
    if (profileData.password) {
      if (profileData.password.length < 6) {
        setAuthError("New password must be at least 6 characters long.");
        // setIsLoading(false);
        return { success: false, error: "New password must be at least 6 characters long." };
      }
      updates.pass = profileData.password;
    }
    if (profileData.avatar_url !== undefined) {
      updates.avatar_url = profileData.avatar_url;
    }

    const oldUserSnapshot = { ...user }; // For optimistic rollback

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
        setUser(oldUserSnapshot); // Rollback
        // setIsLoading(false);
        return { success: false, error: updateError.message };
      }
      console.log('[AuthContext updateUserProfile] Success. Profile updated in DB.');
      // setIsLoading(false);
      return { success: true };
    } catch (e: any) {
      console.error('[AuthContext updateUserProfile] Exception:', e.message);
      setAuthError(e.message || 'An unexpected error occurred during profile update.');
      setUser(oldUserSnapshot); // Rollback
      // setIsLoading(false);
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
