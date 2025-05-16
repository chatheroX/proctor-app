
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, User, Mail, Lock, Loader2, Briefcase, ArrowRight, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { CustomUser } from '@/types/supabase';

type AuthAction = 'login' | 'register';

const AUTH_ROUTE = '/auth';
const STUDENT_DASHBOARD_ROUTE = '/student/dashboard/overview';
const TEACHER_DASHBOARD_ROUTE = '/teacher/dashboard/overview';
const DEFAULT_DASHBOARD_ROUTE = STUDENT_DASHBOARD_ROUTE;


export function AuthForm() {
  const pathname = usePathname(); // Moved to top
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, isLoading: authContextLoading, signIn, signUp } = useAuth();

  const initialAction = (searchParams.get('action') as AuthAction) || 'login';
  
  const [action, setAction] = useState<AuthAction>(initialAction);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CustomUser['role'] | ''>(''); // Role for registration
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission loading state


  const resetFormFields = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setRole('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, []);

  // Effect to sync URL action param with local state and reset form
  useEffect(() => {
    const actionFromParams = (searchParams.get('action') as AuthAction) || 'login';
    if (actionFromParams !== action) {
      resetFormFields();
      setAction(actionFromParams);
    }
  }, [searchParams, action, resetFormFields]);


  // Effect to handle redirection if user is already logged in and on /auth page
  useEffect(() => {
    console.log(`[AuthForm Effect - User Check] Running. isLoading: ${authContextLoading}, Path: ${pathname}, User: ${user?.email}`);
    if (!authContextLoading && user && pathname === AUTH_ROUTE) {
      const targetDashboard = user.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;
      console.log(`[AuthForm Effect - User Check] User on /auth, attempting redirect to: ${targetDashboard}`);
      router.replace(targetDashboard);
    }
  }, [user, authContextLoading, router, pathname]);


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFullName(fullName.trim()); // Trim fullName before validation/use
    setEmail(email.trim()); // Trim email

    const trimmedEmail = email.trim(); // Use this for operations

    if (!trimmedEmail || !password) {
      toast({ title: "Error", description: "Email and password are required.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    let result: { success: boolean; error?: string; user?: CustomUser | null };
    let targetDashboard = DEFAULT_DASHBOARD_ROUTE;
    
    if (action === 'register') {
      const trimmedFullName = fullName.trim();
      if (!trimmedFullName) {
        toast({ title: "Error", description: "Full name is required for registration.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      const selectedRole = role as CustomUser['role'];
      if (!selectedRole) {
        toast({ title: "Error", description: "Please select a role (Student or Teacher).", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      if (password !== confirmPassword) {
        toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
       if (password.length < 6) {
        toast({ title: "Error", description: "Password must be at least 6 characters.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      console.log('[AuthForm] Attempting to register with email:', trimmedEmail, 'name:', trimmedFullName, 'role:', selectedRole);
      result = await signUp(trimmedEmail, password, trimmedFullName, selectedRole);
      if (result.success && result.user) {
        toast({ title: "Registration Successful!", description: "Redirecting to dashboard..." });
        // Redirection logic is now primarily handled by AuthContext effect
      } else {
        toast({ title: "Registration Error", description: result.error || "An unknown error occurred.", variant: "destructive" });
      }
    } else { // Login
      console.log('[AuthForm] Attempting sign in for:', trimmedEmail);
      result = await signIn(trimmedEmail, password);
      if (result.success && result.user) {
        toast({ title: "Login Successful!", description: "Redirecting to dashboard..." });
        // Redirection logic is now primarily handled by AuthContext effect
      } else {
        toast({ title: "Login Error", description: result.error || "Invalid credentials or server error.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
    // No direct router.push here; AuthContext's useEffect will handle redirection based on user state change.
  };
  
  // Loader for when AuthContext is initializing and we are on /auth page AND user state is not yet determined
  if (authContextLoading && pathname === AUTH_ROUTE && user === null) { 
    console.log('[AuthForm] AuthContext loading, user is null, on /auth. Showing full page loader.');
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Message if user is already authenticated and somehow lands on /auth page (AuthContext should redirect quickly)
  if (user && !authContextLoading && pathname === AUTH_ROUTE) {
    console.log('[AuthForm] User authenticated, on /auth. AuthContext should redirect. Showing finalizing message.');
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] py-12">
        <Card className="p-6 rounded-lg shadow-md bg-card text-center modern-card">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3"/>
          <p className="text-md font-medium text-foreground">Finalizing session & redirecting to dashboard...</p>
          <p className="mt-1 text-xs text-muted-foreground">User: {user.email}</p>
        </Card>
      </div>
    );
  }

  const handleTabChange = (value: string) => {
    setAction(value as AuthAction);
    resetFormFields();
    // Update URL query param without full page reload
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('action', value);
    router.replace(newUrl.toString(), { scroll: false });
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12 px-4">
      <Card className="w-full max-w-md modern-card shadow-xl border-border/50">
        <Tabs value={action} onValueChange={handleTabChange} className="w-full">
          <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-3"> {/* Provide padding for TabsList */}
            <TabsList className="grid w-full grid-cols-2 bg-muted p-1 rounded-md"> {/* Removed m-4 */}
              <TabsTrigger 
                value="login" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/90 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-primary-foreground data-[state=inactive]:hover:bg-primary/20 rounded-[0.3rem] py-2 text-sm font-medium transition-all"
              >
                Login
              </TabsTrigger>
              <TabsTrigger 
                value="register" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/90 data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-primary-foreground data-[state=inactive]:hover:bg-primary/20 rounded-[0.3rem] py-2 text-sm font-medium transition-all"
              >
                Register
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          
          {/* Form wraps the TabsContent to handle submission for both login and register */}
          <form onSubmit={handleAuth}>
            <TabsContent value="login">
              <CardHeader className="text-center pt-4 sm:pt-6 pb-3">
                <CardTitle className="text-2xl font-semibold text-foreground">Welcome Back!</CardTitle>
                <CardDescription className="text-muted-foreground pt-1 text-sm">Access your ZenTest account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-6 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="login-email" 
                      type="email" 
                      placeholder="you@example.com" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      className="pl-10 py-2.5 text-sm rounded-md border-border/70 focus:border-primary focus:ring-primary bg-background/70 dark:bg-slate-800/50" 
                      autoComplete="email" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="login-password" 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="pl-10 pr-10 py-2.5 text-sm rounded-md border-border/70 focus:border-primary focus:ring-primary bg-background/70 dark:bg-slate-800/50" 
                      autoComplete="current-password" 
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col p-4 sm:p-6 pt-0 pb-6">
                <Button type="submit" className="btn-gradient w-full text-sm py-2.5 rounded-md" disabled={isSubmitting || authContextLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Logging in...' : 'Login'}
                  {!isSubmitting && <ArrowRight className="ml-1.5 h-4 w-4"/>}
                </Button>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button type="button" className="font-medium text-primary hover:underline focus:outline-none" onClick={() => handleTabChange('register')}>
                    Register here
                  </button>
                </p>
              </CardFooter>
            </TabsContent>

            <TabsContent value="register">
              <CardHeader className="text-center pt-4 sm:pt-6 pb-3">
                <CardTitle className="text-2xl font-semibold text-foreground">Create Account</CardTitle>
                <CardDescription className="text-muted-foreground pt-1 text-sm">Join ZenTest. It&apos;s quick and easy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3.5 p-4 sm:p-6 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="register-fullname">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="register-fullname" 
                      placeholder="John Doe" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)} 
                      required 
                      className="pl-10 py-2.5 text-sm rounded-md border-border/70 focus:border-primary focus:ring-primary bg-background/70 dark:bg-slate-800/50" 
                      autoComplete="name" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="register-email" 
                      type="email" 
                      placeholder="you@example.com" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      className="pl-10 py-2.5 text-sm rounded-md border-border/70 focus:border-primary focus:ring-primary bg-background/70 dark:bg-slate-800/50" 
                      autoComplete="email" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="register-password" 
                      type={showPassword ? 'text' : 'password'} 
                      placeholder="•••••••• (min. 6 characters)" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="pl-10 pr-10 py-2.5 text-sm rounded-md border-border/70 focus:border-primary focus:ring-primary bg-background/70 dark:bg-slate-800/50" 
                      autoComplete="new-password" 
                    />
                     <Button type="button" variant="ghost" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="confirm-password" 
                      type={showConfirmPassword ? 'text' : 'password'} 
                      placeholder="••••••••" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      required 
                      className="pl-10 pr-10 py-2.5 text-sm rounded-md border-border/70 focus:border-primary focus:ring-primary bg-background/70 dark:bg-slate-800/50" 
                      autoComplete="new-password" 
                    />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-role">Register as</Label>
                  <div className="relative">
                     <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                    <Select value={role || ''} onValueChange={(value) => setRole(value as CustomUser['role'])} required>
                      <SelectTrigger id="register-role" className="pl-10 py-2.5 text-sm rounded-md border-border/70 focus:border-primary focus:ring-primary bg-background/70 dark:bg-slate-800/50">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border shadow-lg rounded-md">
                        <SelectItem value="student" className="py-2 text-sm hover:bg-primary/10 focus:bg-primary/10">Student</SelectItem>
                        <SelectItem value="teacher" className="py-2 text-sm hover:bg-primary/10 focus:bg-primary/10">Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col p-4 sm:p-6 pt-0 pb-6">
                <Button type="submit" className="btn-gradient w-full text-sm py-2.5 rounded-md" disabled={isSubmitting || authContextLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Registering...' : 'Create Account'}
                   {!isSubmitting && <ArrowRight className="ml-1.5 h-4 w-4"/>}
                </Button>
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" className="font-medium text-primary hover:underline focus:outline-none" onClick={() => handleTabChange('login')}>
                    Login here
                  </button>
                </p>
              </CardFooter>
            </TabsContent>
          </form>
        </Tabs>
      </Card>
    </div>
  );
}

    