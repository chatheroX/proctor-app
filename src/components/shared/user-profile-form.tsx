
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Lock, Camera, Save, Loader2, Hash, Briefcase, Wand2, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { CustomUser } from '@/types/supabase';

interface UserProfileFormProps {
  user: CustomUser;
  onSave: (data: { name: string; currentEmail: string; password?: string; avatar_url?: string }) => Promise<void>;
}

const diceBearStyles = [
  { value: 'micah', label: 'Micah (Cartoonish)' },
  { value: 'adventurer', label: 'Adventurer (Pixel)' },
  { value: 'bottts-neutral', label: 'Bottts (Robots)' },
  { value: 'pixel-art-neutral', label: 'Pixel Art (Neutral)' },
];

export function UserProfileForm({ user, onSave }: UserProfileFormProps) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user.avatar_url || '');
  const [newAvatarPreviewUrl, setNewAvatarPreviewUrl] = useState<string | null>(null);
  const [selectedDiceBearStyle, setSelectedDiceBearStyle] = useState(diceBearStyles[0].value);

  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setName(user.name || '');
    setEmail(user.email);
    setCurrentAvatarUrl(user.avatar_url || '');
    setNewAvatarPreviewUrl(null); // Reset preview on user change
  }, [user]);

  const handleGenerateNewAvatar = useCallback(() => {
    if (!user?.user_id || !user?.role) {
      toast({ title: "Error", description: "User details missing for avatar generation.", variant: "destructive" });
      return;
    }
    const seed = `${user.role}-${user.user_id}-${selectedDiceBearStyle}-${Date.now()}`;
    const newUrl = `https://api.dicebear.com/8.x/${selectedDiceBearStyle}/svg?seed=${seed}`;
    setNewAvatarPreviewUrl(newUrl);
    toast({ description: "New avatar preview generated. Click 'Save Changes' to apply."});
  }, [user?.user_id, user?.role, selectedDiceBearStyle, toast]);

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
    setIsSaving(true);
    try {
      await onSave({
        name: name,
        currentEmail: user.email,
        password: password || undefined,
        avatar_url: newAvatarPreviewUrl || currentAvatarUrl || undefined,
      });
      setPassword('');
      setConfirmPassword('');
      if (newAvatarPreviewUrl) {
        setCurrentAvatarUrl(newAvatarPreviewUrl); // Persist preview as current on successful save
        setNewAvatarPreviewUrl(null); // Clear preview
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update profile. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatarUrl = newAvatarPreviewUrl || currentAvatarUrl;

  return (
    <Card className="w-full max-w-2xl mx-auto modern-card">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="text-2xl">Edit Profile</CardTitle>
          <CardDescription>Update your personal information and avatar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24 border-2 border-primary/30 shadow-md">
              <AvatarImage src={displayAvatarUrl || undefined} alt={name || 'User'} />
              <AvatarFallback className="text-2xl bg-muted text-muted-foreground">
                {(user.name || user.email || 'U').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="w-full max-w-sm space-y-3 p-4 border rounded-md bg-background/50">
                <Label htmlFor="diceBearStyle" className="text-sm font-medium">Change Avatar Style (DiceBear)</Label>
                 <div className="flex items-center gap-2">
                    <Select value={selectedDiceBearStyle} onValueChange={setSelectedDiceBearStyle}>
                        <SelectTrigger id="diceBearStyle" className="flex-grow">
                            <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent>
                            {diceBearStyles.map(style => (
                            <SelectItem key={style.value} value={style.value}>{style.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={handleGenerateNewAvatar} title="Generate New Avatar Preview">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                 </div>
                 <p className="text-xs text-muted-foreground">Select a style and click refresh to preview. Save changes to apply.</p>
            </div>
            <div className="relative">
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('avatarUpload')?.click()} disabled>
                <Camera className="mr-2 h-4 w-4" /> Upload Custom Photo (Soon)
              </Button>
              <Input
                id="avatarUpload"
                type="file"
                className="hidden"
                accept="image/*"
                disabled
              />
            </div>
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
          <Button type="submit" className="ml-auto btn-primary-solid" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
