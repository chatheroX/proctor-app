
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
  onSave: (data: { name: string; password?: string; avatar_url?: string }) => Promise<void>;
}

const diceBearStyles = [
  { value: 'micah', label: 'Micah (Cartoonish)' },
  { value: 'adventurer', label: 'Adventurer (Pixel)' },
  { value: 'bottts-neutral', label: 'Bottts (Robots)' },
  { value: 'pixel-art-neutral', label: 'Pixel Art (Faces)' },
  { value: 'thumbs', label: 'Thumbs (Simple Icons)'},
  { value: 'notionists-neutral', label: 'Notionists (Abstract)'}
];

// Helper to generate DiceBear URL
const generateDiceBearAvatarUrl = (style: string, seed: string): string => {
  return `https://api.dicebear.com/8.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};

export function UserProfileForm({ user, onSave }: UserProfileFormProps) {
  const [name, setName] = useState(user.name || '');
  // Email is read-only based on user object
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(user.avatar_url || '');
  const [newAvatarPreviewUrl, setNewAvatarPreviewUrl] = useState<string | null>(null);
  const [selectedDiceBearStyle, setSelectedDiceBearStyle] = useState(diceBearStyles[0].value);

  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setName(user.name || '');
    // Default avatar if missing, but prefer one from AuthContext
    setCurrentAvatarUrl(user.avatar_url || generateDiceBearAvatarUrl('micah', `${user.role}-${user.user_id}`));
    setNewAvatarPreviewUrl(null);
  }, [user]);

  const handleGenerateNewAvatar = useCallback(() => {
    if (!user?.user_id || !user?.role) {
      toast({ title: "Error", description: "User details missing for avatar generation.", variant: "destructive" });
      return;
    }
    // Add timestamp to seed for more randomness on each click
    const seed = `${user.role}-${user.user_id}-${selectedDiceBearStyle}-${Date.now()}`;
    const newUrl = generateDiceBearAvatarUrl(selectedDiceBearStyle, seed);
    setNewAvatarPreviewUrl(newUrl);
    toast({ description: "New avatar preview generated. Click 'Save Changes' to apply."});
  }, [user?.user_id, user?.role, selectedDiceBearStyle, toast]);

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
      await onSave({
        name: name.trim() || user.name || "User", // Ensure name is not empty
        password: password || undefined,
        avatar_url: newAvatarPreviewUrl || currentAvatarUrl || undefined,
      });
      setPassword('');
      setConfirmPassword('');
      if (newAvatarPreviewUrl) {
        setCurrentAvatarUrl(newAvatarPreviewUrl);
        setNewAvatarPreviewUrl(null); 
      }
      toast({ title: "Profile Updated", description: "Your changes have been saved."})
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update profile. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatarUrl = newAvatarPreviewUrl || currentAvatarUrl;

  return (
    <Card className="w-full max-w-2xl mx-auto modern-card shadow-xl border border-border/20 bg-card/80 backdrop-blur-lg">
      <form onSubmit={handleSubmit}>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-foreground">Edit Your Profile</CardTitle>
          <CardDescription className="text-muted-foreground/90">Update your personal information and avatar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-2 pb-6">
          <div className="flex flex-col items-center space-y-6">
            <Avatar className="h-28 w-28 border-4 border-primary/30 shadow-lg rounded-full">
              <AvatarImage src={displayAvatarUrl || undefined} alt={name || 'User'} className="rounded-full" />
              <AvatarFallback className="text-3xl bg-muted text-muted-foreground font-semibold rounded-full">
                {(user.name || user.email || 'U').substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="w-full max-w-md space-y-4 p-6 border rounded-lg bg-background/70 shadow-sm border-border/30">
                <Label htmlFor="diceBearStyle" className="text-sm font-medium text-foreground/90 flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" />
                    Change Avatar Style (DiceBear)
                </Label>
                 <div className="flex items-center gap-3">
                    <Select value={selectedDiceBearStyle} onValueChange={setSelectedDiceBearStyle}>
                        <SelectTrigger id="diceBearStyle" className="flex-grow bg-background/80 border-border/50 focus:ring-primary/50">
                            <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover border-border shadow-lg rounded-md">
                            {diceBearStyles.map(style => (
                            <SelectItem key={style.value} value={style.value} className="hover:bg-primary/10 focus:bg-primary/10">{style.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="icon" onClick={handleGenerateNewAvatar} title="Generate New Avatar Preview" className="border-border/50 hover:bg-primary/10 hover:border-primary/50">
                        <RefreshCw className="h-4 w-4 text-primary" />
                    </Button>
                 </div>
                 <p className="text-xs text-muted-foreground/80">Select a style and click refresh to preview. Save changes to apply.</p>
            </div>
            <div className="relative">
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('avatarUpload')?.click()} disabled className="border-border/50">
                <Camera className="mr-2 h-4 w-4" /> Upload Custom Photo (Coming Soon)
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/20">
            <div className="space-y-1.5">
              <Label htmlFor="user_id">Roll Number / User ID</Label>
              <div className="relative">
                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input id="user_id" value={user.user_id} readOnly className="pl-10 bg-muted/40 cursor-not-allowed border-border/40 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address (Login)</Label>
               <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input id="email" type="email" value={user.email} readOnly className="pl-10 bg-muted/40 cursor-not-allowed border-border/40 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input id="fullName" value={name} onChange={(e) => setName(e.target.value)} required className="pl-10 border-border/50 focus:ring-primary/50 text-sm" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <div className="relative">
                <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input id="role" value={user.role || 'N/A'} readOnly className="pl-10 capitalize bg-muted/40 cursor-not-allowed border-border/40 text-sm" />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border/20">
            <Label className="font-medium text-foreground/90">Change Password (optional)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input type="password" placeholder="New Password (min. 6)" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 border-border/50 focus:ring-primary/50 text-sm" />
              </div>
              <div className="relative">
                 <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 border-border/50 focus:ring-primary/50 text-sm" />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border/20 p-6">
          <Button type="submit" className="ml-auto btn-primary-solid py-2.5 px-6 rounded-md text-sm" disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
