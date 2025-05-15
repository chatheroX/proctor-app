
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, isLoading: authContextLoading, signIn, signUp } = useAuth();
  const pathname = usePathname();

  const initialAction = (searchParams.get('action') as AuthAction) || 'login';
  
  const [action, setAction] = useState<AuthAction>(initialAction);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CustomUser['role'] | ''>(''); // Explicitly allow empty string for initial
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); 

  useEffect(() => {
    const newActionFromParams = (searchParams.get('action') as AuthAction) || 'login';
    if (newActionFromParams !== action) {
      setAction(newActionFromParams);
      setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole('');
    }
  }, [searchParams, action]);


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
      const selectedRole = role as CustomUser['role']; // Assert CustomUser['role'] as it's validated
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
      console.log('Attempting to register with email:', trimmedEmail, 'name:', trimmedFullName, 'role:', selectedRole);
      result = await signUp(trimmedEmail, password, trimmedFullName, selectedRole);
      if (result.success && result.user) {
        toast({ title: "Registration Successful!", description: "Redirecting to dashboard..." });
        targetDashboard = result.user.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;
        // Redirection is now primarily handled by AuthContext's useEffect
      } else {
        toast({ title: "Registration Error", description: result.error || "An unknown error occurred.", variant: "destructive" });
      }
    } else { // Login
      result = await signIn(trimmedEmail, password);
      if (result.success && result.user) {
        toast({ title: "Login Successful!", description: "Redirecting to dashboard..." });
        targetDashboard = result.user.role === 'teacher' ? TEACHER_DASHBOARD_ROUTE : STUDENT_DASHBOARD_ROUTE;
        // Redirection is now primarily handled by AuthContext's useEffect
      } else {
        toast({ title: "Login Error", description: result.error || "Invalid credentials or server error.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
    // If successful, AuthContext useEffect will handle navigation
  };
  
  // Main page loader: Show if AuthContext is still resolving initial user state AND we are on /auth page AND user is not yet known (null)
  if (authContextLoading && pathname === AUTH_ROUTE && user === null) { 
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        {/* TODO: Add Framer Motion loader animation */}
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user IS authenticated (by AuthContext) and on /auth page, show "Finalizing..."
  // AuthContext's useEffect is responsible for the actual redirect.
  if (user && !authContextLoading && pathname === AUTH_ROUTE) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] py-12 bg-gradient-to-br from-primary/10 via-background to-accent/10">
        {/* TODO: Add Framer Motion text animation */}
        <Card className="p-8 rounded-xl shadow-2xl glass-card text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary mb-4"/>
          <p className="text-lg font-medium text-foreground">Finalizing session & redirecting...</p>
          <p className="mt-2 text-sm text-muted-foreground">User: {user.email}, Role: {user.role}</p>
        </Card>
      </div>
    );
  }

  return (
    // TODO: Add Framer Motion container entrance animation
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12 px-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-md glass-card shadow-2xl border-primary/20">
        {/* TODO: Add Framer Motion entrance animation for the card */}
        <Tabs value={action} onValueChange={(value) => {
          setAction(value as AuthAction);
          setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole('');
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-primary/5 p-1.5 rounded-lg m-2">
            <TabsTrigger value="login" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-[hsl(var(--accent-gradient-end))] data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-md py-2.5 text-sm font-medium transition-all">Login</TabsTrigger>
            <TabsTrigger value="register" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-[hsl(var(--accent-gradient-end))] data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg rounded-md py-2.5 text-sm font-medium transition-all">Register</TabsTrigger>
          </TabsList>
          {/* TODO: Add Framer Motion to TabsContent for tab switch animation */}
          <form onSubmit={handleAuth}>
            <TabsContent value="login">
              <CardHeader className="text-center pt-8 pb-4">
                <CardTitle className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-[hsl(var(--accent-gradient-end))]">Welcome Back!</CardTitle>
                <CardDescription className="text-muted-foreground pt-1 text-base">Securely access your ProctorPrep account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary bg-background/70" autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-12 pr-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary bg-background/70" autoComplete="current-password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col p-6 pt-2 pb-8">
                <Button type="submit" className="btn-gradient w-full text-lg py-3 rounded-lg" disabled={isSubmitting || authContextLoading}>
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
              <CardHeader className="text-center pt-8 pb-4">
                <CardTitle className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-[hsl(var(--accent-gradient-end))]">Create Your Account</CardTitle>
                <CardDescription className="text-muted-foreground pt-1 text-base">Join ProctorPrep today. It&apos;s quick and easy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-6">
                <div className="space-y-2">
                  <Label htmlFor="register-fullname">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-fullname" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="pl-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary bg-background/70" autoComplete="name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary bg-background/70" autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="•••••••• (min. 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-12 pr-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary bg-background/70" autoComplete="new-password" />
                     <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="pl-12 pr-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary bg-background/70" autoComplete="new-password" />
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
                      <SelectTrigger id="register-role" className="pl-12 py-3 text-base rounded-lg border-border focus:border-primary focus:ring-primary bg-background/70">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover/80 backdrop-blur-md border-border shadow-xl rounded-lg">
                        <SelectItem value="student" className="py-2.5 hover:bg-primary/10">Student</SelectItem>
                        <SelectItem value="teacher" className="py-2.5 hover:bg-primary/10">Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col p-6 pt-2 pb-8">
                <Button type="submit" className="btn-gradient w-full text-lg py-3 rounded-lg" disabled={isSubmitting || authContextLoading}>
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
