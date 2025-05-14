
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, User, Mail, Lock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

type AuthAction = 'login' | 'register';

export function AuthForm() {
  const pathname = usePathname(); // Initialize pathname first
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { user, isLoading: authLoading, signIn, signUp } = useAuth();

  const initialAction = (searchParams.get('action') as AuthAction) || 'login';
  const [action, setAction] = useState<AuthAction>(initialAction);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setAction(initialAction);
  }, [initialAction]);

  // This effect handles redirecting away from /auth if user is already logged in.
  useEffect(() => {
    if (!authLoading && user && pathname === '/auth') {
      router.replace('/student/dashboard/overview'); // Default redirect for logged-in users trying to access /auth
    }
  }, [user, authLoading, router, pathname]);


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const trimmedEmail = email.trim();
    const trimmedFullName = fullName.trim();
    
    console.log('Attempting auth with email (trimmed):', trimmedEmail);


    if (!trimmedEmail || !password) {
      toast({ title: "Error", description: "Email and password are required.", variant: "destructive" });
      setIsSubmitting(false);
      return;
    }

    if (action === 'register') {
      if (!trimmedFullName) {
        toast({ title: "Error", description: "Full name is required for registration.", variant: "destructive" });
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

      const { success, error } = await signUp(trimmedEmail, password, trimmedFullName);
      if (success) {
        toast({ title: "Registration Successful!", description: "Redirecting to dashboard..." });
        router.push('/student/dashboard/overview'); 
      } else {
        toast({ title: "Registration Error", description: error || "An unknown error occurred.", variant: "destructive" });
      }
    } else { // Login
      const { success, error } = await signIn(trimmedEmail, password);
      if (success) {
        toast({ title: "Login Successful!", description: "Redirecting to dashboard..." });
        router.push('/student/dashboard/overview'); 
      } else {
        toast({ title: "Login Error", description: error || "Invalid credentials or server error.", variant: "destructive" });
      }
    }
    setIsSubmitting(false);
  };
  

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user && !authLoading && pathname === '/auth') { 
      return (
        <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
            <p>Already logged in. Redirecting to dashboard...</p>
            <Loader2 className="ml-2 h-5 w-5 animate-spin text-primary" />
        </div>
    );
  }


  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-10rem)] py-12">
      <Card className="w-full max-w-md shadow-xl">
        <Tabs value={action} onValueChange={(value) => setAction(value as AuthAction)} className="w-full">
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
                  <Label htmlFor="login-email">Email (Gmail)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10 pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col">
                <Button type="submit" className="w-full" disabled={isSubmitting || authLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Logging in...' : 'Login'}
                </Button>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Don&apos;t have an account?{' '}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setAction('register'); setEmail(''); setPassword(''); setFullName(''); setConfirmPassword('');}}>
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
                    <Input id="register-fullname" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-email">Email (Gmail)</Label>
                   <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="register-password" type={showPassword ? 'text' : 'password'} placeholder="•••••••• (min. 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10 pr-10" />
                    <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="pl-10 pr-10" />
                     <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col">
                <Button type="submit" className="w-full" disabled={isSubmitting || authLoading}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSubmitting ? 'Registering...' : 'Register'}
                </Button>
                 <p className="mt-4 text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setAction('login'); setEmail(''); setPassword(''); setFullName(''); setConfirmPassword('');}}>
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
