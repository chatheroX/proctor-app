
'use client';

import { ExamForm, ExamFormData } from '@/components/teacher/exam-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { ExamInsert } from '@/types/supabase'; // Use ExamInsert type

const generateExamCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export default function CreateExamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();

  const handleCreateExam = async (data: ExamFormData): Promise<{ success: boolean; error?: string; examId?: string }> => {
    if (!user || user.role !== 'teacher') {
      return { success: false, error: "You must be logged in as a teacher to create exams." };
    }
    if (!data.startTime || !data.endTime) {
      return { success: false, error: "Start and end times are required for published exams."};
    }

    const newExamData: ExamInsert = {
      teacher_id: user.user_id,
      title: data.title,
      description: data.description || null,
      duration: data.duration,
      allow_backtracking: data.allowBacktracking,
      questions: data.questions,
      exam_code: generateExamCode(),
      status: 'Published', // Always 'Published'
      start_time: data.startTime.toISOString(),
      end_time: data.endTime.toISOString(),
    };

    try {
      let insertedExamId: string | undefined = undefined;
      let attemptError: any = null;

      for (let i = 0; i < 3; i++) { // Try up to 3 times for unique exam code
        const { data: attemptData, error: dbError } = await supabase
          .from('ExamX')
          .insert(newExamData)
          .select('exam_id') // Only select exam_id
          .single();
        
        if (dbError) {
          attemptError = dbError;
          if (dbError.code === '23505' && dbError.message.includes('ExamX_exam_code_key')) {
            newExamData.exam_code = generateExamCode(); // Generate new code and retry
            continue;
          }
          break; 
        }
        insertedExamId = attemptData?.exam_id;
        attemptError = null; 
        break; 
      }

      if (attemptError) {
        console.error('Error creating exam:', attemptError);
        if (attemptError.code === '23505' && attemptError.message.includes('ExamX_exam_code_key')) {
             return { success: false, error: "Failed to generate a unique exam code after multiple attempts. Please try again." };
        }
        return { success: false, error: attemptError.message || "Failed to create exam."};
      }
      if (!insertedExamId) {
        return { success: false, error: "Failed to create exam, no exam ID returned." };
      }
      
      return { success: true, examId: insertedExamId };

    } catch (e: any) {
      console.error('Unexpected error creating exam:', e);
      return { success: false, error: e.message || "An unexpected error occurred." };
    }
  };

  // Default form data for creating a new exam
  const defaultFormData: ExamFormData = {
    title: '',
    description: '',
    duration: 60,
    allowBacktracking: true,
    questions: [],
    startTime: null, // Explicitly null
    endTime: null,   // Explicitly null
    status: 'Published', // Default to 'Published'
  };

  return (
    <div className="space-y-6">
      <ExamForm initialData={defaultFormData} onSave={handleCreateExam} />
    </div>
  );
}
