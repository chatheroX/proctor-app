
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Lock, Camera, Save, Loader2, Hash, Briefcase } from 'lucide-react'; // Changed Fingerprint to Hash
import { useToast } from '@/hooks/use-toast';
import type { CustomUser } from '@/types/supabase';

interface UserProfileFormProps {
  user: CustomUser;
  onSave: (data: { name: string; currentEmail: string; password?: string; avatarFile?: File }) => Promise<void>;
}

export function UserProfileForm({ user, onSave }: UserProfileFormProps) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email); 
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(undefined); 
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email);
    const initial = (user.name || user.email || 'U').substring(0, 2).toUpperCase();
    // Use user_id for placeholder if name/email are short or missing
    const placeholderText = user.name?.substring(0,2) || user.email.substring(0,2) || user.user_id.substring(0,2) || 'U';
    setAvatarPreview(`https://placehold.co/100x100.png?text=${placeholderText.toUpperCase()}`);
  }, [user]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email !== user.email) {
        toast({title: "Info", description: "Email (your login ID) cannot be changed.", variant: "default"});
        setEmail(user.email); 
        return;
    }

    if (password && password.length < 6) {
      toast({ title: "Error", description: "New password must be at least 6 characters long.", variant: "destructive" });
      return;
    }
    if (password && password !== confirmPassword) {
      toast({ title: "Error", description: "New passwords do not match.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      await onSave({ 
        name: name, 
        currentEmail: user.email, 
        password: password || undefined, 
      });
      setPassword(''); 
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update profile. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="text-2xl">Edit Profile</CardTitle>
          <CardDescription>Update your personal information. User ID and Email are your unique identifiers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarPreview} alt={name || 'User'} data-ai-hint="person portrait" />
              <AvatarFallback>{(user.name || user.email || 'U').substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="relative">
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('avatarUpload')?.click()} disabled>
                <Camera className="mr-2 h-4 w-4" /> Change Photo (Disabled)
              </Button>
              <Input 
                id="avatarUpload" 
                type="file" 
                className="hidden" 
                accept="image/*" 
                disabled
              />
            </div>
             <p className="text-xs text-muted-foreground">Avatar functionality not supported with current setup.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="user_id">User ID (Roll Number)</Label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="user_id" value={user.user_id} readOnly className="pl-10 bg-muted/50 cursor-not-allowed" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address (Login)</Label>
               <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="email" type="email" value={email} readOnly className="pl-10 bg-muted/50 cursor-not-allowed" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="role" value={user.role || 'N/A'} readOnly className="pl-10 capitalize bg-muted/50 cursor-not-allowed" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Change Password (optional)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input type="password" placeholder="New Password (min. 6)" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" />
              </div>
              <div className="relative">
                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10" />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="ml-auto" disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
