
'use client';

import { ExamForm } from '@/components/teacher/exam-form';
import { notFound, useParams, useRouter } from 'next/navigation'; // Using useParams and useRouter
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react'; // Added Loader2
import { Button } from '@/components/ui/button'; // Added Button
import { ArrowLeft } from 'lucide-react'; // Added ArrowLeft

interface QuestionOption { // Updated to match ExamForm
  id: string;
  text: string;
}
interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
}
interface ExamData {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  allowBacktracking: boolean;
  questions: Question[];
}

// No more mock exam data
// const mockExams: ExamData[] = [ ... ];

// Mock save function - replace with actual API call
const handleUpdateExam = async (data: ExamData) => {
  console.log('Updating exam:', data);
  // In a real app, you would update this in a database.
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
  // Example: await yourApi.updateExam(data.id, data);
};

export default function EditExamPage() {
  const params = useParams();
  const router = useRouter(); // Added router
  const examId = params.id as string; 
  const [examData, setExamData] = useState<ExamData | null | undefined>(undefined); 
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExamToEdit = async () => {
      if (!examId) {
          setIsLoading(false);
          notFound();
          return;
      }
      setIsLoading(true);
      // Simulate fetching exam data
      await new Promise(resolve => setTimeout(resolve, 1000));
      // const foundExam = await yourApi.getExamById(examId);
      // setExamData(foundExam || null); 
      // For now, setting to null as mock data is removed
      setExamData(null);
      setIsLoading(false);
    };
    fetchExamToEdit();
  }, [examId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading exam data for editing...</p>
      </div>
    );
  }

  if (!examData) {
    return (
       <div className="space-y-6 text-center py-10">
         <h1 className="text-2xl font-semibold">Exam Not Found</h1>
         <p className="text-muted-foreground">The exam data could not be loaded for editing. It might have been deleted or the ID is incorrect.</p>
         <Button variant="outline" onClick={() => router.push('/teacher/dashboard/exams')}>
           <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
         </Button>
       </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <ExamForm initialData={examData} onSave={handleUpdateExam} isEditing={true} />
    </div>
  );
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  // In a real app, fetch exam title here for dynamic metadata
  // const exam = await yourApi.getExamTitleById(params.id); 
  const examTitle = "Exam"; // Placeholder
  return {
    title: `Edit ${examTitle} | ProctorPrep`,
  };
}
