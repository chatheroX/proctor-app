'use client';

import { UserProfileForm } from '@/components/shared/user-profile-form';

// Mock user data and save function
const mockStudentUser = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  avatarUrl: 'https://placehold.co/100x100.png?text=JD',
};

const handleSaveProfile = async (data: { name: string; email: string; password?: string; avatarFile?: File }) => {
  console.log('Saving student profile:', data);
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  // In a real app, you would update the user's data in the backend
  // and potentially update the local state or re-fetch user data.
  if (data.avatarFile) {
    console.log('Avatar file to upload:', data.avatarFile.name);
  }
  mockStudentUser.name = data.name;
  mockStudentUser.email = data.email;
  // mockStudentUser.avatarUrl = new preview URL if uploaded
};

export default function StudentProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Profile</h1>
      <UserProfileForm user={mockStudentUser} onSave={handleSaveProfile} />
    </div>
  );
}

export const metadata = {
  title: 'My Profile | Student Dashboard | ProctorPrep',
};
