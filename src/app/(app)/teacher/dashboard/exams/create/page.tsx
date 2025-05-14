
'use client';

import { ExamForm } from '@/components/teacher/exam-form';
import { generateId } from 'lucide-react'; // Not for this, just an example

interface ExamData {
  id?: string;
  title: string;
  description: string;
  duration: number; // in minutes
  allowBacktracking: boolean;
  questions: Array<{ id: string; text: string; options: string[]; correctAnswer: string; }>;
}

// Mock save function
const handleCreateExam = async (data: ExamData) => {
  const newExam = {
    ...data,
    id: `exam-${Date.now()}-${Math.random().toString(36).substring(2,7).toUpperCase()}`, // Create a more unique ID
    examCode: data.title.substring(0,3).toUpperCase() + Math.random().toString(36).substring(2,6).toUpperCase(), // Generate a mock exam code
    createdAt: new Date().toISOString(),
    status: 'Draft', // Default status for new exams
  };
  console.log('Creating exam:', newExam);
  // In a real app, you would save this to a database.
  // For demo, we can store it in localStorage or just log it.
  // localStorage.setItem('exams', JSON.stringify([...JSON.parse(localStorage.getItem('exams') || '[]'), newExam]));
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
};

export default function CreateExamPage() {
  return (
    <div className="space-y-6">
      {/* h1 title is inside ExamForm now */}
      <ExamForm onSave={handleCreateExam} />
    </div>
  );
}

// Removed metadata export as this is a Client Component
// export const metadata = {
//   title: 'Create New Exam | Teacher Dashboard | ProctorPrep',
// };
