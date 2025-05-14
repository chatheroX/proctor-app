
'use client';

import { UserProfileForm } from '@/components/shared/user-profile-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { CustomUser } from '@/types/supabase';

export default function StudentProfilePage() {
  const { user, isLoading: authLoading, updateUserProfile } = useAuth(); 
  const { toast } = useToast();

  const handleSaveProfile = async (data: { name: string; email: string; password?: string; avatarFile?: File }) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to update your profile.", variant: "destructive" });
      return;
    }
    // Ensure we're passing the current user's email (ID) for the update, especially if email isn't changeable.
    const result = await updateUserProfile({ ...data, currentEmail: user.email });

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

    if (data.avatarFile) {
      toast({ description: `Avatar functionality not supported with current 'proctorX' table.`});
    }
  };

  if (authLoading || !user && user !== null) { // Show loader if auth is loading OR user is undefined (initial state)
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) { // If user is explicitly null, means not logged in (or error fetching)
    return (
      <div className="flex justify-center items-center h-full">
        <p>Please log in to view your profile.</p>
      </div>
    );
  }
  
  const profileData: CustomUser = { // Construct CustomUser from user context
    name: user.name || '', // Default to empty string if name is null
    email: user.email,
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <UserProfileForm user={profileData} onSave={handleSaveProfile} />
    </div>
  );
}

// Removed metadata export as this is a Client Component
// export const metadata = {
//   title: 'My Profile | Student Dashboard | ProctorPrep',
// };
