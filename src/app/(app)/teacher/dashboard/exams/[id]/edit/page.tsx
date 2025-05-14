'use client';

import { ExamForm } from '@/components/teacher/exam-form';
import { notFound, useParams } from 'next/navigation'; // Using useParams
import { useEffect, useState } from 'react';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
}
interface ExamData {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  allowBacktracking: boolean;
  questions: Question[];
}

// Mock exam data - in a real app, fetch this based on ID
const mockExams: ExamData[] = [
  { 
    id: 'exam001', 
    title: 'Calculus Midterm S1', 
    description: 'Covers chapters 1-5 of the Calculus textbook. Focus on differentiation and basic integration.',
    duration: 90, 
    allowBacktracking: true, 
    questions: [
      {id: 'q1', text: 'What is the derivative of x^2?', options: ['2x', 'x', 'x/2', '2'], correctAnswer: '2x'},
      {id: 'q2', text: 'What is the integral of 1/x dx?', options: ['ln|x| + C', 'x^2 + C', '-1/x^2 + C', '1 + C'], correctAnswer: 'ln|x| + C'},
    ] 
  },
  // ... other mock exams if needed
];

// Mock save function
const handleUpdateExam = async (data: ExamData) => {
  console.log('Updating exam:', data);
  // In a real app, you would update this in a database.
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
};

export default function EditExamPage() {
  const params = useParams();
  const examId = params.id as string; // Type assertion
  const [examData, setExamData] = useState<ExamData | null | undefined>(undefined); // undefined for loading state

  useEffect(() => {
    // Simulate fetching exam data
    const foundExam = mockExams.find(exam => exam.id === examId);
    setExamData(foundExam || null); // null if not found, triggering notFound()
  }, [examId]);

  if (examData === undefined) {
    return <div className="flex justify-center items-center h-full"><p>Loading exam data...</p></div>; // Or a skeleton loader
  }

  if (!examData) {
    notFound(); // If examData is null after "fetch"
  }

  return (
    <div className="space-y-6">
      <ExamForm initialData={examData} onSave={handleUpdateExam} isEditing={true} />
    </div>
  );
}

// metadata can't be dynamic in client components directly in this way for page.tsx
// export const metadata = {
//   title: `Edit Exam | Teacher Dashboard | ProctorPrep`,
// };
// For dynamic metadata with client components, you'd typically use a server component wrapper or generateMetadata function if this were a server component.
// Since this is a client component due to hooks, we'll skip dynamic metadata for now, or set a generic one.
// Or, in Next.js 13+ app router, you can export generateMetadata for dynamic titles.
// However, to keep it simple for now, I'll set a generic title or rely on a higher-level layout.
// The example below for generateMetadata would work if this was a server component or if logic was hoisted.

export async function generateMetadata({ params }: { params: { id: string } }) {
  // Mock fetch or lookup
  const exam = mockExams.find(e => e.id === params.id);
  const examTitle = exam ? exam.title : "Exam";
  return {
    title: `Edit ${examTitle} | ProctorPrep`,
  };
}
