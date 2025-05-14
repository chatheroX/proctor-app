
'use client';

import { UserProfileForm } from '@/components/shared/user-profile-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function StudentProfilePage() {
  const { user, isLoading: authLoading } = useAuth(); // user is CustomUser type
  const { toast } = useToast();

  const handleSaveProfile = async (data: { name: string; email: string; password?: string; avatarFile?: File }) => {
    // This is a custom auth system. Updating profile means updating the 'proctorX' table.
    // Supabase.auth.updateUser is not applicable here.
    console.log('Attempting to save student profile (custom auth - proctorX table):', data);

    // Example: Update name in proctorX table
    // const supabase = createSupabaseBrowserClient(); // Get client if not available
    // const { error } = await supabase.from('proctorX').update({ name: data.name }).eq('id', data.email);
    // if (error) { toast({ title: "Error", description: `Failed to update name: ${error.message}`, variant: "destructive" }); }
    // else { toast({ title: "Success", description: "Name updated (demo)."}); }
    // Password change would require updating the 'pass' column in 'proctorX' (highly insecure with plaintext).
    // Email change is complex as 'id' (email) is the primary key in 'proctorX'.
    // Avatar uploads are not supported by the 'proctorX' table structure.
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
    
    toast({
      title: "Profile Update (Demo)",
      description: "Profile data logged. Backend update for 'proctorX' table would be implemented here.",
    });

    if (data.avatarFile) {
      toast({ description: `Avatar functionality not supported with current 'proctorX' table.`});
    }
    if (data.password) {
        toast({ description: `Password change for 'proctorX' would be implemented here (Note: plaintext storage is insecure).` });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  // Using CustomUser from AuthContext
  const profileData = {
    name: user.name || user.email?.split('@')[0] || 'Student User',
    email: user.email || '',
    // avatarUrl is not part of proctorX, so using placeholder
    avatarUrl: `https://placehold.co/100x100.png?text=${(user.name || user.email || 'S').substring(0,2).toUpperCase()}`,
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
