
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, ProctorXTable } from '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email'; // Stores user's email
const ROLE_COOKIE_NAME = 'proctorprep-user-role'; // Stores user's role

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];

const generateShortId = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { user_id: string; name: string; password?: string}) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null | undefined>(undefined); // undefined initially
  const [isLoading, setIsLoading] = useState(true);

  const getRedirectPathForRole = useCallback((role: CustomUser['role'] | null) => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    return STUDENT_DASHBOARD_ROUTE; // Default for student or null/undefined role
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    console.log('[AuthContext loadUserFromCookie] Attempting to load user from cookie.');
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    const userRoleFromCookie = Cookies.get(ROLE_COOKIE_NAME) as CustomUser['role'];

    if (user !== undefined && user?.email === userEmailFromCookie && user?.role === userRoleFromCookie) {
      console.log('[AuthContext loadUserFromCookie] User in context matches cookie. Skipping DB fetch. Current isLoading:', isLoading);
      if (isLoading) setIsLoading(false); // Ensure loading is false if we skip.
      return;
    }
    
    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      if (user !== null) setUser(null); // Only set if different
      if (isLoading) setIsLoading(false);
      return;
    }

    console.log('[AuthContext loadUserFromCookie] Session cookie found. Fetching user from DB for email:', userEmailFromCookie);
    if (!isLoading) setIsLoading(true); // Set loading true only if we proceed to DB call

    try {
      console.time('Supabase LoadUserFromCookie Query');
      const { data, error } = await supabase
        .from('proctorX')
        .select('user_id, email, name, role')
        .eq('email', userEmailFromCookie)
        .single();
      console.timeEnd('Supabase LoadUserFromCookie Query');

      if (data && !error) {
        const loadedUser: CustomUser = { 
            user_id: data.user_id, 
            email: data.email, 
            name: data.name ?? null, 
            role: data.role as CustomUser['role'] 
        };
        console.log('[AuthContext loadUserFromCookie] User loaded from DB:', loadedUser);
        setUser(loadedUser);
        if (loadedUser.role && Cookies.get(ROLE_COOKIE_NAME) !== loadedUser.role) {
          Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        }
      } else {
        console.warn('[AuthContext loadUserFromCookie] Error fetching user or user not found in DB. Clearing session.', error?.message);
        Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
        Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
        setUser(null);
        if (error && error.code !== 'PGRST116') { 
          console.error('Supabase query error in loadUserFromCookie:', error.message);
        }
      }
    } catch (e: any) {
      console.error('[AuthContext loadUserFromCookie] Exception during user session processing:', e.message);
      Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
      Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
      setUser(null);
    } finally {
      setIsLoading(false);
      console.log('[AuthContext loadUserFromCookie] Finished. isLoading set to false.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user, isLoading]); // Added isLoading to dependencies

  useEffect(() => {
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); 

  useEffect(() => {
    console.log(`[AuthContext Effect - Route Guard] Running. isLoading: ${isLoading}, Pathname: ${pathname}, User: ${user ? `{email: ${user.email}, role: ${user.role}}` : JSON.stringify(user)}`);

    if (isLoading) {
      console.log('[AuthContext Effect - Route Guard] Still loading, returning.');
      return;
    }

    const isAuthRoute = pathname === AUTH_ROUTE;
    const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname?.startsWith(p));

    if (user) { 
      const targetDashboard = getRedirectPathForRole(user.role);
      console.log(`[AuthContext Effect - Route Guard] User IS authenticated. Role: ${user.role}, Target dashboard: ${targetDashboard}`);
      if (isAuthRoute) {
        if (pathname !== targetDashboard) {
          console.log(`[AuthContext Effect - Route Guard] User on /auth, attempting redirect to: ${targetDashboard}`);
          router.replace(targetDashboard);
        } else {
          console.log(`[AuthContext Effect - Route Guard] User on /auth, but target is /auth or already on target. Path: ${pathname}`);
        }
        return; 
      }
      
      const expectedDashboardPrefix = user.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
      if (isProtectedRoute && !pathname.startsWith(expectedDashboardPrefix)) {
        console.log(`[AuthContext Effect - Route Guard] User on wrong protected route (${pathname}), attempting redirect to ${targetDashboard}`);
        if (pathname !== targetDashboard) {
           router.replace(targetDashboard);
        } else {
           console.log(`[AuthContext Effect - Route Guard] User on wrong dashboard, but target is current path. Path: ${pathname}`);
        }
        return; 
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
        return; 
      }
      console.log('[AuthContext Effect - Route Guard] User not authenticated and on public page or /auth.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading, pathname, router]); 

  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    let userData: CustomUser | null = null;
    try {
      console.time('Supabase SignIn Query');
      const { data, error } = await supabase
        .from('proctorX')
        .select('user_id, email, pass, name, role')
        .eq('email', email)
        .single(); 
      console.timeEnd('Supabase SignIn Query');

      if (error) {
        if (error.code === 'PGRST116') { 
          return { success: false, error: 'User not found.' };
        }
        return { success: false, error: 'Login failed: ' + error.message };
      }
      
      if (data && data.pass === pass) { 
        userData = { 
            user_id: data.user_id, 
            email: data.email, 
            name: data.name ?? null, 
            role: data.role as CustomUser['role'] 
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
    console.log('[AuthContext signUp] Attempting sign up for:', email, 'Role:', role);
    setIsLoading(true);
    let newUserData: CustomUser | null = null;
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
      
      const { data: insertedData, error: insertError } = await supabase
        .from('proctorX')
        .insert([{ user_id: newUserId, email: email, pass: pass, name: name, role: role }])
        .select('user_id, email, name, role')
        .single();

      if (insertError || !insertedData) {
        return { success: false, error: 'Registration failed: ' + (insertError?.message || "Could not retrieve user after insert.") };
      }
      
      newUserData = { 
          user_id: insertedData.user_id, 
          email: insertedData.email, 
          name: insertedData.name ?? null, 
          role: insertedData.role as CustomUser['role'] 
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) {
          Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      }
      setUser(newUserData);
      console.log('[AuthContext signUp] Success. User set:', newUserData);
      return { success: true, user: newUserData };
    } catch (e:any) {
        console.error('[AuthContext signUp] Exception:', e.message);
        return { success: false, error: 'An unexpected error occurred during sign up.' };
    } finally {
        setIsLoading(false);
        console.log('[AuthContext signUp] Finished. isLoading set to false.');
    }
  };

  const signOut = async () => {
    console.log('[AuthContext signOut] Signing out.');
    setIsLoading(true); 
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    Cookies.remove(ROLE_COOKIE_NAME, { path: '/' });
    setUser(null);
    setIsLoading(false); 
    console.log('[AuthContext signOut] User set to null, isLoading set to false.');
    // Redirection to AUTH_ROUTE will be handled by the useEffect
  };
  
  const updateUserProfile = async (profileData: { user_id: string; name: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "User not authenticated."};
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', profileData.user_id);
    setIsLoading(true);
    const updates: Partial<ProctorXTable['Update']> = { name: profileData.name };
    if (profileData.password && profileData.password.length >=6) { // Ensure password is not empty if provided
      updates.pass = profileData.password; 
    } else if (profileData.password && profileData.password.length > 0 && profileData.password.length < 6) {
        setIsLoading(false);
        return { success: false, error: "New password must be at least 6 characters long." };
    }


    const { error } = await supabase
      .from('proctorX')
      .update(updates)
      .eq('user_id', profileData.user_id); 

    if (error) {
      setIsLoading(false);
      console.error('[AuthContext updateUserProfile] Error:', error.message);
      return { success: false, error: error.message };
    }
    
    setUser(prevUser => prevUser ? ({...prevUser, name: profileData.name }) : null);
    setIsLoading(false);
    console.log('[AuthContext updateUserProfile] Success. Profile updated in context.');
    return { success: true };
  };

  const value = {
    user,
    isLoading,
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
