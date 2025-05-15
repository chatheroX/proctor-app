
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTable } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE; // Default if role is unknown initially
const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];

// Helper function to generate a 6-character alphanumeric ID
// WARNING: This is NOT collision-proof for production.
// For production, use database UUIDs or a more robust unique ID generation strategy.
const generateShortId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};


type AuthContextType = {
  user: CustomUser | null | undefined; // undefined: initial loading, null: no user, CustomUser: user loaded
  isLoading: boolean;
  authError: string | null; // For errors during Supabase client init
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  let supabaseInstance;
  let supabaseInitializationError: string | null = null;
  try {
    supabaseInstance = createSupabaseBrowserClient();
  } catch (e: any) {
    console.error("CRITICAL: Failed to initialize Supabase client in AuthContext:", e.message);
    supabaseInitializationError = e.message || "Failed to initialize Supabase client.";
  }
  const supabase = supabaseInstance!; // Assume it initializes or handle error
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(supabaseInitializationError);


  const getRedirectPathForRole = useCallback((role: CustomUser['role']) => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    return STUDENT_DASHBOARD_ROUTE;
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    const userRoleFromCookie = Cookies.get(ROLE_COOKIE_NAME) as CustomUser['role'];
    
    console.log('[AuthContext loadUserFromCookie] Attempting. Cookie email:', userEmailFromCookie, 'Cookie role:', userRoleFromCookie);

    if (user && user.email === userEmailFromCookie && user.role === userRoleFromCookie) {
      console.log('[AuthContext loadUserFromCookie] User in context matches cookie. Skipping DB fetch. Current isLoading:', isLoading);
      if (isLoading) setIsLoading(false);
      return;
    }
    
    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found. Setting user to null.');
      setUser(null);
      setIsLoading(false);
      return;
    }

    console.log('[AuthContext loadUserFromCookie] Session cookie found. Fetching user from DB for email:', userEmailFromCookie);
    if (!isLoading) setIsLoading(true); // Set loading only if not already loading

    try {
      console.time('Supabase LoadUserFromCookie Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role')
        .eq('email', userEmailFromCookie)
        .single();
      console.timeEnd('Supabase LoadUserFromCookie Query');

      if (dbError) {
        console.warn('[AuthContext loadUserFromCookie] Error fetching user or user not found in DB. Clearing session.', dbError.message);
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        setUser(null);
      } else if (data) {
        const loadedUser: CustomUser = { 
            user_id: data.user_id, 
            email: data.email, 
            name: data.name ?? null, 
            role: data.role as CustomUser['role'] ?? null
        };
        console.log('[AuthContext loadUserFromCookie] User loaded from DB:', loadedUser);
        setUser(loadedUser);
        if (loadedUser.role && Cookies.get(ROLE_COOKIE_NAME) !== loadedUser.role) {
          Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        }
      } else {
        console.log('[AuthContext loadUserFromCookie] User not found in DB for cookie email. Clearing session.');
        Cookies.remove(SESSION_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        setUser(null);
      }
    } catch (e: any) {
      console.error('[AuthContext loadUserFromCookie] Exception during user session processing:', e.message);
      Cookies.remove(SESSION_COOKIE_NAME);
      Cookies.remove(ROLE_COOKIE_NAME);
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('[AuthContext loadUserFromCookie] Finished. isLoading set to false.');
    }
  }, [supabase, user, isLoading]);

  useEffect(() => {
    if (authError) { // If Supabase client failed to init, don't try to load user
      setIsLoading(false);
      setUser(null);
      return;
    }
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, authError]); // Reload user on pathname change or if authError changes

  useEffect(() => {
    // This effect handles navigation based on auth state.
    // It only runs when isLoading is false AND supabase client is initialized.
    if (isLoading || authError) {
      console.log(`[AuthContext Effect - Route Guard] Waiting. isLoading: ${isLoading}, authError: ${authError}`);
      return;
    }

    console.log(`[AuthContext Effect - Route Guard] Running. Pathname: ${pathname}, User: ${user ? `{user_id: ${user.user_id}, email: ${user.email}, role: ${user.role}}` : JSON.stringify(user)}`);

    const isAuthRoute = pathname === AUTH_ROUTE;
    const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname?.startsWith(p));

    if (user) { // User IS authenticated
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`[AuthContext Effect - Route Guard] User IS authenticated. Role: ${user.role}, Target dashboard: ${targetDashboard}`);
      
      if (isAuthRoute) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Effect - Route Guard] User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        } else {
          console.log(`[AuthContext Effect - Route Guard] User on /auth, but target is /auth or already on target. Path: ${pathname}`);
        }
        return; // Important: stop further execution if redirect initiated
      }
      
      const expectedDashboardPrefix = user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
      if (isProtectedRoute && !pathname.startsWith(expectedDashboardPrefix)) {
        console.log(`[AuthContext Effect - Route Guard] User on wrong protected route (${pathname}), attempting redirect to ${targetDashboard}`);
        if (pathname !== targetDashboard) {
           router.replace(targetDashboard);
        } else {
           console.log(`[AuthContext Effect - Route Guard] User on wrong dashboard, but target is current path. Path: ${pathname}`);
        }
        return; // Important: stop further execution if redirect initiated
      }
      console.log('[AuthContext Effect - Route Guard] User authenticated and on correct page or non-protected page.');

    } else { // User is NOT authenticated (user is null)
      console.log('[AuthContext Effect - Route Guard] User NOT authenticated.');
      if (isProtectedRoute) {
        console.log(`[AuthContext Effect - Route Guard] User on protected route (${pathname}), attempting redirect to ${AUTH_ROUTE}`);
        if (pathname !== AUTH_ROUTE) {
          router.replace(AUTH_ROUTE);
        } else {
          console.log(`[AuthContext Effect - Route Guard] Already on /auth. Path: ${pathname}`);
        }
        return; // Important: stop further execution if redirect initiated
      }
      console.log('[AuthContext Effect - Route Guard] User not authenticated and on public page or /auth.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, pathname, router, getRedirectPathForRole, authError]);


  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (authError) return { success: false, error: authError };
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    try {
      console.time('Supabase SignIn Query');
      const { data, error: dbError } = await supabase
        .from('proctorX')
        .select('user_id, email, pass, name, role') // Ensure role is selected
        .eq('email', email) // Query by email
        .single();
      console.timeEnd('Supabase SignIn Query');

      if (dbError) {
        if (dbError.code === 'PGRST116') { 
          return { success: false, error: 'User with this email not found.' };
        }
        return { success: false, error: 'Login failed: ' + dbError.message };
      }
      
      if (data && data.pass === pass) {
        const userData: CustomUser = { 
            user_id: data.user_id, 
            email: data.email, 
            name: data.name ?? null, 
            role: data.role as CustomUser['role'] ?? null 
        };
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) {
          Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        }
        setUser(userData); 
        console.log('[AuthContext signIn] Success. User set:', userData);
        return { success: true, user: userData };
      } else {
        return { success: false, error: 'Incorrect password.' };
      }
    } catch (e: any) {
        console.error('[AuthContext signIn] Exception:', e.message);
        return { success: false, error: 'An unexpected error occurred during sign in.' };
    } finally {
        setIsLoading(false);
        console.log('[AuthContext signIn] Finished. isLoading set to false.');
    }
  };

  const signUp = async (email: string, pass: string, name: string, role: 'student' | 'teacher'): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    if (authError) return { success: false, error: authError };
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    setIsLoading(true);
    try {
      const { data: existingUser, error: selectError } = await supabase
        .from('proctorX')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      if (selectError && selectError.code !== 'PGRST116') {
        return { success: false, error: 'Error checking existing user: ' + selectError.message };
      }
      if (existingUser) {
        return { success: false, error: 'User with this email already exists.' };
      }

      const newUserId = generateShortId(); 

      const newUserRecord: ProctorXTable['Insert'] = {
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
        return { success: false, error: 'Registration failed: ' + (insertError?.message || "Could not retrieve user after insert.") };
      }
      
      const newUserData: CustomUser = { 
          user_id: insertedData.user_id, 
          email: insertedData.email, 
          name: insertedData.name ?? null, 
          role: insertedData.role as CustomUser['role'] ?? null 
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) {
          Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      }
      setUser(newUserData);
      console.log('[AuthContext signUp] Success. User set:', newUserData);
      return { success: true, user: newUserData };
    } catch (e: any) {
        console.error('[AuthContext signUp] Exception:', e.message);
        return { success: false, error: 'An unexpected error occurred during sign up.' };
    } finally {
        setIsLoading(false);
        console.log('[AuthContext signUp] Finished. isLoading set to false.');
    }
  };

  const signOut = async () => {
    console.log('[AuthContext signOut] Signing out.');
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null); 
    setIsLoading(false); 
    console.log('[AuthContext signOut] User set to null, isLoading set to false. Redirect will be handled by useEffect.');
  };
  
  const updateUserProfile = async (profileData: { name: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (authError) return { success: false, error: authError };
    if (!user || !user.user_id) return { success: false, error: "User not authenticated or user_id missing."};
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id);
    setIsLoading(true);
    
    const updates: Partial<ProctorXTable['Update']> = { name: profileData.name };
    if (profileData.password && profileData.password.length >=6 ) {
      updates.pass = profileData.password; 
    } else if (profileData.password && profileData.password.length > 0 && profileData.password.length < 6 ) {
        setIsLoading(false);
        return { success: false, error: "New password must be at least 6 characters long." };
    }

    const { error: updateError } = await supabase
      .from('proctorX')
      .update(updates)
      .eq('user_id', user.user_id);

    if (updateError) {
      setIsLoading(false);
      console.error('[AuthContext updateUserProfile] Error:', updateError.message);
      return { success: false, error: updateError.message };
    }
    
    setUser(prevUser => prevUser ? ({...prevUser, name: profileData.name }) : null);
    setIsLoading(false);
    console.log('[AuthContext updateUserProfile] Success. Profile updated in context.');
    return { success: true };
  };

  const value = {
    user,
    isLoading,
    authError,
    signIn,
    signUp,
    signOut,
    updateUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
