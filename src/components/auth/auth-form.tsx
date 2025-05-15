
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, User, Mail, Lock, Loader2, Briefcase, ArrowRight } from 'lucide-react';
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
  const { user, isLoading: authContextLoading, signIn, signUp } = useAuth();
  const { toast } = useToast();

  const initialAction = (searchParams.get('action') as AuthAction) || 'login';
  
  const [action, setAction] = useState<AuthAction>(initialAction);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CustomUser['role'] | ''>(''); // Role is string 'student' or 'teacher'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission loading state

  useEffect(() => {
    const newActionFromParams = (searchParams.get('action') as AuthAction) || 'login';
    if (newActionFromParams !== action) {
      setAction(newActionFromParams);
      // Reset fields when action changes via URL to avoid stale data in other tab
      setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole('');
    }
  }, [searchParams, action]);


  // This effect redirects already logged-in users away from /auth
  useEffect(() => {
    // console.log(`[AuthForm Effect] Running. Path: ${pathname}, authContextLoading: ${authContextLoading}, User: ${JSON.stringify(user)}`);
    if (!authContextLoading && user && pathname === AUTH_ROUTE) {
      const targetDashboard = user.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;
      // console.log(`[AuthForm Effect] User IS authenticated on /auth page. Redirecting to: ${targetDashboard}`);
      router.replace(targetDashboard);
    }
  }, [user, authContextLoading, router, pathname]);


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const trimmedFullName = fullName.trim();

    if (!trimmedEmail || !password) {
      toast({ title: "Error", description: "Email and password are required.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    let result: { success: boolean; error?: string; user?: CustomUser | null };
    let targetDashboard = DEFAULT_DASHBOARD_ROUTE;
    
    if (action === 'register') {
      if (!trimmedFullName) {
        toast({ title: "Error", description: "Full name is required for registration.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      if (!role) {
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
      // console.log('[AuthForm] Attempting to register with email:', trimmedEmail, "Role:", role);
      result = await signUp(trimmedEmail, password, trimmedFullName, role as 'student' | 'teacher');
      if (result.success && result.user) {
        toast({ title: "Registration Successful!", description: "Redirecting to dashboard..." });
        // Redirection is primarily handled by AuthContext's useEffect after user state updates
      } else {
        toast({ title: "Registration Error", description: result.error || "An unknown error occurred.", variant: "destructive" });
      }
    } else { // Login
      // console.log('[AuthForm] Attempting to sign in with email:', trimmedEmail);
      result = await signIn(trimmedEmail, password);
      if (result.success && result.user) {
        toast({ title: "Login Successful!", description: "Redirecting to dashboard..." });
        // Redirection is primarily handled by AuthContext's useEffect
      } else {
        toast({ title: "Login Error", description: result.error || "Invalid credentials or server error.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
  };
  
  // Show main page loader if AuthContext is still resolving initial user state AND we are on /auth page
  if (authContextLoading && user === null && pathname === AUTH_ROUTE) {
    // console.log("[AuthForm] AuthContext loading initial state for /auth, showing page loader.");
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user IS authenticated (by AuthContext) and on /auth page, show "Finalizing..."
  // AuthContext's useEffect is responsible for the actual redirect.
  if (user && !authContextLoading && pathname === AUTH_ROUTE) {
    // console.log("[AuthForm] User IS authenticated on /auth page. AuthContext should redirect. User:", user.email);
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] py-12">
        <p className="mb-2 text-lg">Finalizing session & redirecting to dashboard...</p>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-muted-foreground">User: {user.email}, Role: {user.role}</p>
      </div>
    );
  }
  
  // If explicitly not loading, and no user, and on /auth page, render the form.
  // This handles the case after initial load where user is determined to be unauthenticated.
  // if (!authContextLoading && !user && pathname === AUTH_ROUTE) {
    // console.log("[AuthForm] Ready to render form. authContextLoading:", authContextLoading, "user:", user);
  // }

  return (
    // Add Framer Motion to this container for entrance animation
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-md glass-card shadow-2xl border-primary/20">
        <Tabs value={action} onValueChange={(value) => {
          setAction(value as AuthAction);
          // Clear fields when switching tabs for better UX
          setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole('');
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-primary/10 p-1">
            <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md py-2">Login</TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-md py-2">Register</TabsTrigger>
          </TabsList>
          {/* Add Framer Motion to TabsContent for tab switch animation */}
          <form onSubmit={handleAuth}>
            <TabsContent value="login">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-bold text-primary">Welcome Back!</CardTitle>
                <CardDescription className="text-muted-foreground pt-1">Securely access your ProctorPrep account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary" autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-12 pr-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary" autoComplete="current-password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col p-6 pt-2">
                <Button type="submit" className="w-full text-lg py-3 rounded-lg shadow-md hover:shadow-primary/40" disabled={isSubmitting || authContextLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  {isSubmitting ? 'Logging in...' : 'Login'}
                  {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5"/>}
                </Button>
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setAction('register'); setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole(''); }}>
                    Register here
                  </button>
                </p>
              </CardFooter>
            </TabsContent>
            <TabsContent value="register">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-bold text-primary">Create Your Account</CardTitle>
                <CardDescription className="text-muted-foreground pt-1">Join ProctorPrep today. It&apos;s quick and easy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="space-y-2">
                  <Label htmlFor="register-fullname">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-fullname" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="pl-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary" autoComplete="name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary" autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="•••••••• (min. 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-12 pr-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary" autoComplete="new-password" />
                     <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="pl-12 pr-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary" autoComplete="new-password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-role">Register as</Label>
                  <div className="relative">
                     <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground z-10" />
                    <Select value={role || ''} onValueChange={(value) => setRole(value as CustomUser['role'])} required>
                      <SelectTrigger id="register-role" className="pl-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover/80 backdrop-blur-md border-border shadow-xl">
                        <SelectItem value="student" className="py-2.5">Student</SelectItem>
                        <SelectItem value="teacher" className="py-2.5">Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col p-6 pt-2">
                <Button type="submit" className="w-full text-lg py-3 rounded-lg shadow-md hover:shadow-primary/40" disabled={isSubmitting || authContextLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  {isSubmitting ? 'Registering...' : 'Create Account'}
                   {!isSubmitting && <ArrowRight className="ml-2 h-5 w-5"/>}
                </Button>
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" className="font-semibold text-primary hover:underline" onClick={() => { setAction('login'); setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole('');}}>
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
