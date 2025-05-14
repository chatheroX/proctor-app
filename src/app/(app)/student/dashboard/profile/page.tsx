
'use client';

import { UserProfileForm } from '@/components/shared/user-profile-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { CustomUser } from '@/types/supabase';

export default function StudentProfilePage() {
  const { user, isLoading: authLoading, updateUserProfile } = useAuth(); 
  const { toast } = useToast();

  const handleSaveProfile = async (data: { name: string; currentEmail: string; password?: string; avatarFile?: File }) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" });
      return;
    }
    
    const result = await updateUserProfile({ ...data });

    if (result.success) {
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
      });
    } else {
      toast({
        title: "Update Failed",
        description: result.error || "Could not update your profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (authLoading || (!user && user !== null)) { 
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) { 
    return (
      <div className="flex justify-center items-center h-full">
        <p>Please log in to view your profile.</p>
      </div>
    );
  }
  
  // User is guaranteed to be CustomUser here due to checks above
  const profileData: CustomUser = user;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <UserProfileForm 
        user={profileData} 
        onSave={(data) => handleSaveProfile({ ...data, currentEmail: user.email })} 
      />
    </div>
  );
}
