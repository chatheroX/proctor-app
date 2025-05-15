
'use client';

import { createContext, useContext, useEffect, useState, useCallback } _from_ 'react';
import { createSupabaseBrowserClient } _from_ '@/lib/supabase/client';
import { useRouter, usePathname } _from_ 'next/navigation';
import Cookies _from_ 'js-cookie';
import type { CustomUser, ProctorXTable } _from_ '@/types/supabase';

const SESSION_COOKIE_NAME = 'proctorprep-user-email';
const ROLE_COOKIE_NAME = 'proctorprep-user-role';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
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
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signUp: (email: string, pass: string, name: string, role: 'student' | 'teacher') => Promise<{ success: boolean; error?: string; user?: CustomUser | null }>;
  signOut: () => Promise<void>;
  updateUserProfile: (data: { name: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const getRedirectPathForRole = useCallback((role: CustomUser['role']) => {
    if (role === 'teacher') return TEACHER_DASHBOARD_ROUTE;
    return STUDENT_DASHBOARD_ROUTE;
  }, []);

  const loadUserFromCookie = useCallback(async () => {
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);
    const userRoleFromCookie = Cookies.get(ROLE_COOKIE_NAME) as CustomUser['role'];
    
    console.log('[AuthContext loadUserFromCookie] Cookie email:', userEmailFromCookie, 'Cookie role:', userRoleFromCookie);

    // If user context is already populated and matches cookie, skip DB fetch
    if (user && user.email === userEmailFromCookie && user.role === userRoleFromCookie) {
      console.log('[AuthContext loadUserFromCookie] User in context matches cookie. Skipping DB fetch. Current isLoading:', isLoading);
      if (isLoading) setIsLoading(false);
      return;
    }

    if (!userEmailFromCookie) {
      console.log('[AuthContext loadUserFromCookie] No session cookie found.');
      if (user !== null) setUser(null);
      if (isLoading) setIsLoading(false);
      return;
    }

    console.log('[AuthContext loadUserFromCookie] Session cookie found. Fetching user from DB for email:', userEmailFromCookie);
    if(!isLoading) setIsLoading(true);

    try {
      console.time('Supabase LoadUserFromCookie Query');
      const { data, error: dbError } _from_ await supabase
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
        if (dbError.code !== 'PGRST116') { // PGRST116: No rows found, expected if cookie is stale
            console.error('Supabase query error in loadUserFromCookie:', dbError.message);
        }
      } else if (data) {
        const loadedUser: CustomUser = { 
            user_id: data.user_id, 
            email: data.email, 
            name: data.name ?? null, 
            role: data.role as CustomUser['role'] 
        };
        console.log('[AuthContext loadUserFromCookie] User loaded from DB:', loadedUser);
        setUser(loadedUser);
        // Ensure role cookie is consistent
        if (loadedUser.role && Cookies.get(ROLE_COOKIE_NAME) !== loadedUser.role) {
          Cookies.set(ROLE_COOKIE_NAME, loadedUser.role, { expires: 7, path: '/' });
        }
      } else { // No data, no error (should be caught by PGRST116)
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user, isLoading]); // Only re-run if supabase client changes or user/isLoading changes externally (which they shouldn't much)

  useEffect(() => {
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); // Reload user on pathname change to ensure session is fresh

  useEffect(() => {
    console.log(`[AuthContext Effect - Route Guard] Running. isLoading: ${isLoading}, Pathname: ${pathname}, User: ${user ? `{user_id: ${user.user_id}, email: ${user.email}, role: ${user.role}}` : JSON.stringify(user)}`);

    if (isLoading) {
      console.log('[AuthContext Effect - Route Guard] Still loading, returning.');
      return;
    }

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
        return;
      }
      
      // Role-based dashboard access check for PROTECTED routes
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
  }, [user, isLoading, pathname, router, getRedirectPathForRole]);

  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser | null }> => {
    console.log('[AuthContext signIn] Attempting sign in for:', email);
    setIsLoading(true);
    try {
      console.time('Supabase SignIn Query');
      const { data, error: dbError } _from_ await supabase
        .from('proctorX')
        .select('user_id, email, pass, name, role')
        .eq('email', email)
        .single();
      console.timeEnd('Supabase SignIn Query');

      if (dbError) {
        if (dbError.code === 'PGRST116') { // No rows found
          return { success: false, error: 'User with this email not found.' };
        }
        return { success: false, error: 'Login failed: ' + dbError.message };
      }
      
      if (data && data.pass === pass) { // Plaintext password check - NOT SECURE
        const userData: CustomUser = { 
            user_id: data.user_id, 
            email: data.email, 
            name: data.name ?? null, 
            role: data.role as CustomUser['role'] 
        };
        Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
        if (userData.role) {
          Cookies.set(ROLE_COOKIE_NAME, userData.role, { expires: 7, path: '/' });
        }
        setUser(userData); // This state update will trigger the useEffect for redirection
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
    try {
      // Check if email already exists
      const { data: existingUser, error: selectError } _from_ await supabase
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

      const newUserId = generateShortId(); // Generate 6-char ID

      const newUserRecord: ProctorXTable['Insert'] = {
        user_id: newUserId,
        email: email,
        pass: pass, // Plaintext password - NOT SECURE
        name: name,
        role: role,
      };
      
      const { data: insertedData, error: insertError } _from_ await supabase
        .from('proctorX')
        .insert(newUserRecord)
        .select('user_id, email, name, role') // Select the fields we need for CustomUser
        .single();

      if (insertError || !insertedData) {
        return { success: false, error: 'Registration failed: ' + (insertError?.message || "Could not retrieve user after insert.") };
      }
      
      const newUserData: CustomUser = { 
          user_id: insertedData.user_id, 
          email: insertedData.email, 
          name: insertedData.name ?? null, 
          role: insertedData.role as CustomUser['role'] 
      };
      Cookies.set(SESSION_COOKIE_NAME, newUserData.email, { expires: 7, path: '/' });
      if (newUserData.role) {
          Cookies.set(ROLE_COOKIE_NAME, newUserData.role, { expires: 7, path: '/' });
      }
      setUser(newUserData); // This state update will trigger the useEffect for redirection
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
    setUser(null); // Set user to null first
    setIsLoading(false); // Then set loading to false
    console.log('[AuthContext signOut] User set to null, isLoading set to false. Redirect will be handled by useEffect.');
    // No direct router.push here, useEffect will handle it.
  };
  
  const updateUserProfile = async (profileData: { name: string; password?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!user || !user.user_id) return { success: false, error: "User not authenticated or user_id missing."};
    console.log('[AuthContext updateUserProfile] Updating profile for user_id:', user.user_id);
    setIsLoading(true);
    
    const updates: Partial<ProctorXTable['Update']> = { name: profileData.name };
    if (profileData.password && profileData.password.length >=6 ) {
      updates.pass = profileData.password; // Plaintext password update - NOT SECURE
    } else if (profileData.password && profileData.password.length > 0 && profileData.password.length < 6 ) {
        setIsLoading(false);
        return { success: false, error: "New password must be at least 6 characters long." };
    }

    const { error: updateError } _from_ await supabase
      .from('proctorX')
      .update(updates)
      .eq('user_id', user.user_id);

    if (updateError) {
      setIsLoading(false);
      console.error('[AuthContext updateUserProfile] Error:', updateError.message);
      return { success: false, error: updateError.message };
    }
    
    // Update user context locally
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

    