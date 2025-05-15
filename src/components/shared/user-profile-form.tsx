
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Mail, Lock, Camera, Save, Loader2, Hash, Briefcase, Wand2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CustomUser } from '@/types/supabase';

// Define constants for DiceBear avatar generation
const DICEBEAR_STYLES = ['micah', 'adventurer', 'bottts-neutral', 'pixel-art-neutral'];
const DICEBEAR_TECH_KEYWORDS = ['coder', 'debugger', 'techie', 'pixelninja', 'cswizard', 'binary', 'script', 'stack', 'keyboard', 'neonbyte', 'glitch', 'algorithm', 'syntax', 'kernel'];

interface UserProfileFormProps {
  user: CustomUser;
  onSave: (data: { name: string; password?: string; avatar_url?: string }) => Promise<void>;
}

const generateEnhancedDiceBearUrl = (style: string, role: CustomUser['role'], userId: string): string => {
  const randomKeyword = DICEBEAR_TECH_KEYWORDS[Math.floor(Math.random() * DICEBEAR_TECH_KEYWORDS.length)];
  const userRoleStr = role || 'user'; // Default if role is null
  const uniqueSuffix = Date.now().toString(36).slice(-6); // More unique suffix
  const seed = `${randomKeyword}-${userRoleStr}-${userId}-${uniqueSuffix}`;
  return `https://api.dicebear.com/8.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};


export function UserProfileForm({ user, onSave }: UserProfileFormProps) {
  const [name, setName] = useState(user.name || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // currentAvatarUrl will hold the URL that is currently saved/displayed
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user.avatar_url || '');
  // newAvatarPreviewUrl will hold a newly generated URL before saving
  const [newAvatarPreviewUrl, setNewAvatarPreviewUrl] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setName(user.name || '');
    // If avatar_url from user prop changes (e.g. after successful save & context update), reflect it
    setCurrentAvatarUrl(user.avatar_url || ''); 
    setNewAvatarPreviewUrl(null); // Clear preview if main user data changes
  }, [user]);

  const handleGenerateNewAvatar = useCallback(() => {
    if (!user?.user_id || !user?.role) {
      toast({ title: "Error", description: "User details missing for avatar generation.", variant: "destructive" });
      return;
    }
    const randomStyle = DICEBEAR_STYLES[Math.floor(Math.random() * DICEBEAR_STYLES.length)];
    const newUrl = generateEnhancedDiceBearUrl(randomStyle, user.role, user.user_id);
    setNewAvatarPreviewUrl(newUrl); // Set for preview
    toast({ description: "New avatar preview generated. Click 'Save Changes' to apply."});
  }, [user?.user_id, user?.role, toast]);

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
    setIsSaving(true);
    try {
      // If newAvatarPreviewUrl is set, use it. Otherwise, use currentAvatarUrl (which might be empty if never set).
      const avatarToSave = newAvatarPreviewUrl || currentAvatarUrl;

      await onSave({
        name: name.trim() || user.name || "User",
        password: password || undefined,
        avatar_url: avatarToSave || undefined, // Send undefined if it's an empty string or null
      });
      setPassword('');
      setConfirmPassword('');
      if (newAvatarPreviewUrl) {
        setCurrentAvatarUrl(newAvatarPreviewUrl); // Make preview the current one after save
        setNewAvatarPreviewUrl(null); 
      }
      // Toast for success is handled by parent page which calls onSave
    } catch (error: any) {
      toast({ title: "Error Saving Profile", description: error.message || "Failed to update profile. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // The avatar to display is the preview if available, otherwise the current one.
  const displayAvatarUrl = newAvatarPreviewUrl || currentAvatarUrl;

  return (
    <Card className="w-full max-w-2xl mx-auto glass-card shadow-xl">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground">Edit Your Profile</CardTitle>
          <CardDescription className="text-muted-foreground/90">Update your personal information and avatar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-2 pb-6">
          <div className="flex flex-col items-center space-y-6">
            <Avatar className="h-28 w-28 border-4 border-primary/30 shadow-lg rounded-full bg-muted">
              <AvatarImage src={displayAvatarUrl || undefined} alt={name || 'User'} className="rounded-full" />
              <AvatarFallback className="text-3xl text-muted-foreground font-semibold rounded-full">
                {(name || user.email || 'U').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="w-full max-w-xs space-y-2 p-4 border rounded-lg bg-card/30 backdrop-blur-sm shadow-sm border-border/30">
                <Label htmlFor="refreshAvatar" className="text-sm font-medium text-foreground/90 flex items-center gap-2 justify-center">
                    <Wand2 className="h-4 w-4 text-primary" />
                    Avatar Options
                </Label>
                <Button id="refreshAvatar" type="button" variant="outline" onClick={handleGenerateNewAvatar} title="Generate New Avatar Preview" className="w-full border-border/50 hover:bg-primary/10 hover:border-primary/50 text-sm">
                    <RefreshCw className="mr-2 h-4 w-4 text-primary" />
                    Refresh Avatar
                </Button>
                 <p className="text-xs text-muted-foreground/80 text-center pt-1">Click to generate a new random avatar.</p>
            </div>

            <div className="relative">
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('avatarUpload')?.click()} disabled className="border-border/50 text-sm">
                <Camera className="mr-2 h-4 w-4" /> Upload Custom Photo (Soon)
              </Button>
              <Input
                id="avatarUpload"
                type="file"
                className="hidden"
                accept="image/*"
                disabled // Custom upload not implemented
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border/20">
            <div className="space-y-1.5">
              <Label htmlFor="user_id">Roll Number / User ID</Label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input id="user_id" value={user.user_id} readOnly className="pl-10 bg-muted/60 cursor-not-allowed border-border/40 text-sm glass-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address (Login)</Label>
               <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input id="email" type="email" value={user.email} readOnly className="pl-10 bg-muted/60 cursor-not-allowed border-border/40 text-sm glass-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} required className="pl-10 border-border/50 focus:ring-primary/50 text-sm glass-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <div className="relative">
                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input id="role" value={user.role || 'N/A'} readOnly className="pl-10 capitalize bg-muted/60 cursor-not-allowed border-border/40 text-sm glass-input" />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-6 border-t border-border/20">
            <Label className="font-medium text-foreground/90">Change Password (optional)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input type="password" placeholder="New Password (min. 6)" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 border-border/50 focus:ring-primary/50 text-sm glass-input" />
              </div>
              <div className="relative">
                 <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 border-border/50 focus:ring-primary/50 text-sm glass-input" />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/20 p-6">
          <Button type="submit" className="ml-auto btn-primary-gradient py-2.5 px-6 rounded-md text-sm" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
