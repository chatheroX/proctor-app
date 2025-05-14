
'use client';

import { UserProfileForm } from '@/components/shared/user-profile-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function StudentProfilePage() {
  const { user, userMetadata, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const handleSaveProfile = async (data: { name: string; email: string; password?: string; avatarFile?: File }) => {
    console.log('Attempting to save student profile (Supabase integration pending):', data);
    // TODO: Implement actual Supabase profile update logic
    // This would involve:
    // 1. supabase.auth.updateUser({ email, password, data: { full_name: data.name } })
    // 2. If avatarFile exists, upload to Supabase Storage, get URL, then update user_metadata.avatar_url or a profiles table.
    // 3. If using a separate 'profiles' table, update that table.
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    
    toast({
      title: "Profile Update (Demo)",
      description: "Profile data logged. Backend update with Supabase is the next step.",
    });

    if (data.avatarFile) {
      console.log('Avatar file to upload (demo):', data.avatarFile.name);
      toast({ description: `Avatar "${data.avatarFile.name}" would be uploaded.`});
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const profileData = {
    name: userMetadata?.full_name || user.email?.split('@')[0] || 'Student User',
    email: user.email || '',
    avatarUrl: userMetadata?.avatar_url || `https://placehold.co/100x100.png?text=${(userMetadata?.full_name || user.email || 'S').substring(0,2).toUpperCase()}`,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <UserProfileForm user={profileData} onSave={handleSaveProfile} />
    </div>
  );
}

export const metadata = {
  title: 'My Profile | Student Dashboard | ProctorPrep',
};
