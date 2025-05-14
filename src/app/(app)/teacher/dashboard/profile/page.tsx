'use client';

import { UserProfileForm } from '@/components/shared/user-profile-form';

// Mock user data and save function
const mockTeacherUser = {
  name: 'Dr. Alan Grant',
  email: 'alan.grant@example.com',
  avatarUrl: 'https://placehold.co/100x100.png?text=AG',
};

const handleSaveProfile = async (data: { name: string; email: string; password?: string; avatarFile?: File }) => {
  console.log('Saving teacher profile:', data);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  // In a real app, you would update the user's data in the backend
  mockTeacherUser.name = data.name;
  mockTeacherUser.email = data.email;
};

export default function TeacherProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <UserProfileForm user={mockTeacherUser} onSave={handleSaveProfile} />
    </div>
  );
}

export const metadata = {
  title: 'My Profile | Teacher Dashboard | ProctorPrep',
};
