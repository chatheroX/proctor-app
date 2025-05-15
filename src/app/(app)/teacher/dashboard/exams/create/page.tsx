
'use client';

import { ExamForm, ExamFormData } from '@/components/teacher/exam-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam, ExamStatus } from '@/types/supabase'; // Import ExamStatus

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

    const newExamData: Omit<Exam, 'exam_id' | 'created_at' | 'updated_at'> & { teacher_id: string } = {
      teacher_id: user.user_id,
      title: data.title,
      description: data.description || null,
      duration: data.duration,
      allow_backtracking: data.allowBacktracking,
      questions: data.questions,
      exam_code: generateExamCode(),
      status: data.status, // Status from form
      start_time: data.startTime ? data.startTime.toISOString() : null,
      end_time: data.endTime ? data.endTime.toISOString() : null,
    };

    try {
      // Retry generating exam code if it collides (simple retry mechanism)
      let insertedExam: Exam | null = null;
      let error: any = null;
      for (let i = 0; i < 3; i++) { // Try up to 3 times
        const { data: attemptData, error: attemptError } = await supabase
          .from('ExamX')
          .insert(newExamData)
          .select()
          .single();
        
        if (attemptError) {
          error = attemptError;
          if (attemptError.code === '23505' && attemptError.message.includes('ExamX_exam_code_key')) {
            newExamData.exam_code = generateExamCode(); // Generate new code and retry
            continue;
          }
          break; // Other error, break loop
        }
        insertedExam = attemptData;
        error = null; // Clear error on success
        break; // Success, break loop
      }


      if (error) {
        console.error('Error creating exam:', error);
        if (error.code === '23505' && error.message.includes('ExamX_exam_code_key')) {
             return { success: false, error: "Failed to generate a unique exam code after multiple attempts. Please try again." };
        }
        return { success: false, error: error.message || "Failed to create exam."};
      }
      if (!insertedExam) {
        return { success: false, error: "Failed to create exam, no data returned." };
      }
      
      return { success: true, examId: insertedExam.exam_id };

    } catch (e: any) {
      console.error('Unexpected error creating exam:', e);
      return { success: false, error: e.message || "An unexpected error occurred." };
    }
  };

  const defaultFormData: ExamFormData = {
    title: '',
    description: '',
    duration: 60,
    allowBacktracking: true,
    questions: [],
    startTime: null,
    endTime: null,
    status: 'Draft',
  };

  return (
    <div className="space-y-6">
      <ExamForm initialData={defaultFormData} onSave={handleCreateExam} />
    </div>
  );
}
