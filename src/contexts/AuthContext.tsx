
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import type { CustomUser, Database } from '@/types/supabase'; // Ensure Database is imported if needed by createSupabaseBrowserClient

const SESSION_COOKIE_NAME = 'proctorprep-user-session';
const AUTH_ROUTE = '/auth';
const DEFAULT_DASHBOARD_ROUTE = '/student/dashboard/overview'; 
const PROTECTED_ROUTES_PATTERNS = ['/student/dashboard', '/teacher/dashboard'];


type AuthContextType = {
  user: CustomUser | null;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<{ success: boolean; error?: string; user?: CustomUser }>;
  signUp: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string; user?: CustomUser }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUserFromCookie = useCallback(async () => {
    const userEmailFromCookie = Cookies.get(SESSION_COOKIE_NAME);

    if (user && user.email === userEmailFromCookie && !isLoading) {
      // User context is already set and matches cookie, and not forced loading, skip DB.
      // This helps prevent re-fetch immediately after login/signup if state is already good.
      // If isLoading was true, it means we *want* to reload or are in an initial state.
      return; 
    }
    
    setIsLoading(true);

    if (userEmailFromCookie) {
      console.time('Supabase LoadUserFromCookie Query');
      try {
        // Fetch only necessary fields, id (email) and name
        const { data, error } = await supabase
          .from('proctorX')
          .select('id, name') 
          .eq('id', userEmailFromCookie)
          .single(); // Use single() as email (id) should be unique
        console.timeEnd('Supabase LoadUserFromCookie Query');

        if (data && !error) {
          const loadedUser: CustomUser = { email: data.id, name: data.name ?? null };
          setUser(loadedUser);
        } else {
          Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
          setUser(null);
          if (error && error.code !== 'PGRST116') { // PGRST116: "Searched for a single row, but found no rows" - expected if cookie is stale
            console.error('Error re-validating user from DB:', error.message);
          }
        }
      } catch (e: any) {
        console.error('Error processing user session:', e);
        Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, user?.email]); // Removed user from dep array to avoid loop, user?.email covers change

  useEffect(() => {
    loadUserFromCookie();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]); 

  useEffect(() => {
    if (!isLoading) {
      const isAuthRoute = pathname === AUTH_ROUTE;
      const isProtectedRoute = PROTECTED_ROUTES_PATTERNS.some(p => pathname?.startsWith(p));

      if (user && isAuthRoute) {
        router.replace(DEFAULT_DASHBOARD_ROUTE);
      } else if (!user && isProtectedRoute) {
        router.replace(AUTH_ROUTE);
      }
    }
  }, [user, isLoading, pathname, router]);


  const signIn = async (email: string, pass: string): Promise<{ success: boolean; error?: string; user?: CustomUser }> => {
    setIsLoading(true);
    console.time('Supabase SignIn Query');
    const { data, error } = await supabase
      .from('proctorX')
      .select('id, pass, name') // Select specific columns
      .eq('id', email) // Filter by email
      .single(); // Expect a single row
    console.timeEnd('Supabase SignIn Query');

    if (error) { // Handles query errors or if no row is found (as .single() errors on no row)
      setIsLoading(false);
      if (error.code === 'PGRST116') { // "Searched for a single row, but found no rows"
        return { success: false, error: 'User not found.' };
      }
      return { success: false, error: error.message };
    }

    // No need to check !data here, as .single() would have errored if no data.
    
    if (data.pass === pass) {
      const userData: CustomUser = { email: data.id, name: data.name ?? null };
      Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
      setUser(userData);
      setIsLoading(false);
      return { success: true, user: userData };
    } else {
      setIsLoading(false);
      return { success: false, error: 'Incorrect password.' };
    }
  };

  const signUp = async (email: string, pass: string, name: string): Promise<{ success: boolean; error?: string; user?: CustomUser }> => {
    setIsLoading(true);
    // Check if user already exists
    const { data: existingUser, error: selectError } = await supabase
      .from('proctorX')
      .select('id')
      .eq('id', email)
      .maybeSingle(); // Use maybeSingle to not error if user doesn't exist

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 means no user found, which is good for signup
      setIsLoading(false);
      return { success: false, error: 'Error checking existing user: ' + selectError.message };
    }
    if (existingUser) {
      setIsLoading(false);
      return { success: false, error: 'User with this email already exists.' };
    }

    // Insert new user
    const { error: insertError } = await supabase
      .from('proctorX')
      .insert([{ id: email, pass: pass, name: name }]);

    if (insertError) {
      setIsLoading(false);
      return { success: false, error: 'Registration failed: ' + insertError.message };
    }

    const userData: CustomUser = { email, name };
    Cookies.set(SESSION_COOKIE_NAME, userData.email, { expires: 7, path: '/' });
    setUser(userData);
    setIsLoading(false);
    return { success: true, user: userData };
  };

  const signOut = async () => {
    setIsLoading(true); 
    Cookies.remove(SESSION_COOKIE_NAME, { path: '/' });
    setUser(null);
    router.push(AUTH_ROUTE); 
    // setIsLoading(false); // loadUserFromCookie will set it after path change
  };

  const value = {
    user,
    isLoading,
    signIn,
    signUp,
    signOut,
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
