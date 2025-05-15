
'use client';

import { ExamForm, ExamFormData } from '@/components/teacher/exam-form';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam } from '@/types/supabase'; // Using the specific Exam type

// Helper function to generate a unique exam code (simple version)
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
      exam_code: generateExamCode(), // Generate a unique code
      status: 'Draft', // Default status for new exams
    };

    try {
      const { data: insertedExam, error } = await supabase
        .from('ExamX')
        .insert(newExamData)
        .select()
        .single();

      if (error) {
        console.error('Error creating exam:', error);
        return { success: false, error: error.message };
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

  return (
    <div className="space-y-6">
      <ExamForm onSave={handleCreateExam} />
    </div>
  );
}
