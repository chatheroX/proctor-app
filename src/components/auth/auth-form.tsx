
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, User, Mail, Lock, Loader2, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import type { CustomUser } from '@/types/supabase';

type AuthAction = 'login' | 'register';

const AUTH_ROUTE = '/auth';
// Redirection targets are now primarily handled by AuthContext

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname(); // Correctly placed
  const { toast } = useToast();
  const { user, isLoading: authContextLoading, signIn, signUp } = useAuth();

  const initialAction = (searchParams.get('action') as AuthAction) || 'login';
  
  const [action, setAction] = useState<AuthAction>(initialAction);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<CustomUser['role'] | ''>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const newAction = (searchParams.get('action') as AuthAction) || 'login';
    if (newAction !== action) {
        setAction(newAction);
        // Reset fields when action changes via URL
        setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole('');
    }
  }, [searchParams, action]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const trimmedFullName = fullName.trim();

    console.log('[AuthForm] Attempting auth. Action:', action, 'Email (trimmed):', trimmedEmail, "Role:", role);

    if (!trimmedEmail || !password) {
      toast({ title: "Error", description: "Email and password are required.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    let result: { success: boolean; error?: string; user?: CustomUser | null };
    
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
      result = await signUp(trimmedEmail, password, trimmedFullName, role as 'student' | 'teacher');
      if (result.success && result.user) {
        toast({ title: "Registration Successful!", description: "Redirecting to dashboard..." });
        // Redirection is handled by AuthContext's useEffect
      } else {
        toast({ title: "Registration Error", description: result.error || "An unknown error occurred.", variant: "destructive" });
      }
    } else { // Login
      result = await signIn(trimmedEmail, password);
      if (result.success && result.user) {
        toast({ title: "Login Successful!", description: "Redirecting to dashboard..." });
         // Redirection is handled by AuthContext's useEffect
      } else {
        toast({ title: "Login Error", description: result.error || "Invalid credentials or server error.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
  };
  
  // This loader shows when AuthContext is initially determining user state for the /auth page.
  if (authContextLoading && pathname === AUTH_ROUTE && user === null) { // Check user is null, not undefined
    console.log("[AuthForm] AuthContext loading initial state for /auth, showing page loader.");
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is authenticated (by AuthContext) and on /auth page, show "Finalizing..."
  // AuthContext's useEffect is responsible for the actual redirect.
  if (user && !authContextLoading && pathname === AUTH_ROUTE) {
    console.log("[AuthForm] User IS authenticated on /auth page. AuthContext should redirect. User:", user.email, "Role:", user.role);
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
  if (!authContextLoading && !user && pathname === AUTH_ROUTE) {
    console.log("[AuthForm] Ready to render form. authContextLoading:", authContextLoading, "user:", user);
  } else if (pathname !== AUTH_ROUTE && !user && !authContextLoading) {
    // This case should ideally be caught by middleware or AuthContext's main redirect effect
    // but if somehow an unauth user is on a non-auth page, they'll see a brief load.
    console.log("[AuthForm] Unexpected state: Unauthenticated user on non-auth page. Pathname:", pathname);
     return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-2">Loading...</p>
      </div>
    );
  }


  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
      <Card className="w-full max-w-md shadow-xl">
        <Tabs value={action} onValueChange={(value) => {
          setAction(value as AuthAction);
          setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole('');
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>
          <form onSubmit={handleAuth}>
            <TabsContent value="login">
              <CardHeader>
                <CardTitle className="text-2xl">Welcome Back!</CardTitle>
                <CardDescription>Enter your email and password to access your account.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10 pr-10" autoComplete="current-password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col">
                <Button type="submit" className="w-full" disabled={isSubmitting || authContextLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Logging in...' : 'Login'}
                </Button>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setAction('register'); setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole(''); }}>
                    Register here
                  </button>
                </p>
              </CardFooter>
            </TabsContent>
            <TabsContent value="register">
              <CardHeader>
                <CardTitle className="text-2xl">Create an Account</CardTitle>
                <CardDescription>Join ProctorPrep. Enter your details below.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-fullname">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-fullname" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="pl-10" autoComplete="name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="•••••••• (min. 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10 pr-10" autoComplete="new-password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="pl-10 pr-10" autoComplete="new-password" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-role">Register as</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Select value={role || ''} onValueChange={(value) => setRole(value as CustomUser['role'])} required>
                      <SelectTrigger id="register-role" className="pl-10">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="teacher">Teacher</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col">
                <Button type="submit" className="w-full" disabled={isSubmitting || authContextLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Registering...' : 'Register'}
                </Button>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setAction('login'); setEmail(''); setPassword(''); setFullName(''); setConfirmPassword(''); setRole('');}}>
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
