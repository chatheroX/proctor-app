
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Lock, Camera, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserProfileFormProps {
  user: {
    name: string;
    email: string;
    avatarUrl?: string;
  };
  onSave: (data: { name: string; email: string; password?: string; avatarFile?: File }) => Promise<void>;
}

export function UserProfileForm({ user, onSave }: UserProfileFormProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email); // Email change might need verification flow with Supabase
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user.avatarUrl);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setAvatarPreview(user.avatarUrl);
  }, [user]);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      // Note: Supabase email change usually requires a confirmation email.
      // Password change is direct. Name/metadata change is direct.
      // Avatar upload involves Supabase Storage.
      // The onSave prop will handle the actual Supabase calls.
      await onSave({ 
        name, 
        email, // If email is changed, onSave should handle Supabase's email change flow.
        password: password || undefined, 
        avatarFile 
      });
      // toast({ title: "Success", description: "Profile update initiated!" }); // onSave should show its own toasts
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
          <CardDescription>Update your personal information. Email or password changes may require verification.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarPreview || `https://placehold.co/100x100.png`} alt={name} data-ai-hint="person portrait" />
              <AvatarFallback>{name?.substring(0, 2)?.toUpperCase() || 'U'}</AvatarFallback>
            </Avatar>
            <div className="relative">
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('avatarUpload')?.click()}>
                <Camera className="mr-2 h-4 w-4" /> Change Photo
              </Button>
              <Input 
                id="avatarUpload" 
                type="file" 
                className="hidden" 
                accept="image/*" 
                onChange={handleAvatarChange} 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
               <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
              </div>
               <p className="text-xs text-muted-foreground">Changing email may require re-verification.</p>
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
