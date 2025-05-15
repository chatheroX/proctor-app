
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';

// This page is for teacher's demo of an exam.
// It will fetch exam data and render the ExamTakingInterface in demo mode.

export default function TeacherDemoExamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: teacherUser, isLoading: authLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const teacherUserId = teacherUser?.user_id;
  const teacherUserRole = teacherUser?.role;

  const fetchExamData = useCallback(async () => {
    console.log('[TeacherDemoExamPage] fetchExamData called. examId:', examId);
    if (!examId ) { setError("Exam ID is missing."); setIsLoading(false); return; }
    if (!supabase) { setError("Supabase client not available for demo."); setIsLoading(false); return; }
    if (!teacherUserId || teacherUserRole !== 'teacher') { 
      setError("Access denied. Only teachers can demo exams they own."); 
      setIsLoading(false); 
      return; 
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, status, teacher_id, start_time, end_time')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found for demo.");

      if (data.teacher_id !== teacherUserId) {
        setError("Access denied. You can only demo exams you have created.");
        setExamDetails(null);
        setQuestions([]);
        setIsLoading(false);
        return;
      }
      
      if (!data.questions || data.questions.length === 0) {
        setError("This exam has no questions. Please add questions first to take a demo.");
        setExamDetails(data as Exam); // Set details even if no questions, for context
        setQuestions([]);
        setIsLoading(false);
        return;
      }

      setExamDetails(data as Exam);
      setQuestions(data.questions || []); 
      console.log('[TeacherDemoExamPage] Fetched exam details:', data);
    } catch (e: any) {
      console.error("[TeacherDemoExamPage] Failed to fetch exam data for demo:", e);
      setError(e.message || "Failed to load exam data for demo.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, teacherUserId, teacherUserRole]);

  useEffect(() => {
    if (examId && !authLoading && teacherUserId && teacherUserRole === 'teacher') { 
      if (!examDetails && !error && isLoading) { 
        console.log('[TeacherDemoExamPage] useEffect triggering fetchExamData.');
        fetchExamData();
      }
    } else if (!authLoading && (!examId || !teacherUserId || teacherUserRole !== 'teacher') && !error && isLoading) {
        const missingParamError = !examId ? "Exam ID is missing." : "Teacher authentication details missing or incorrect role.";
        setError(missingParamError);
        setIsLoading(false);
    }
  }, [examId, authLoading, teacherUserId, teacherUserRole, examDetails, error, isLoading, fetchExamData]);


  const handleDemoAnswerChange = useCallback((questionId: string, optionId: string) => {
    console.log(`[TeacherDemoExamPage] Demo Answer for QID ${questionId}: OptionID ${optionId}`);
  }, []);

  const handleDemoSubmitExam = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log('[TeacherDemoExamPage] Demo Exam Submitted (Simulated)');
    console.log('Demo Answers:', answers);
    console.log('Demo Flagged Events (Informational):', flaggedEvents);
    toast({ title: "Demo Exam Finished!", description: "This was a simulation. No data was saved." });
    if (examId) router.push(`/teacher/dashboard/exams/${examId}/details`);
    else router.push('/teacher/dashboard/exams');
  }, [toast, router, examId]);

  const handleDemoTimeUp = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log("[TeacherDemoExamPage] Demo exam time is up. Answers:", answers, "Flagged Events:", flaggedEvents);
    toast({ title: "Demo Time's Up!", description: "The demo exam duration has ended. No data was saved." });
    if (examId) router.push(`/teacher/dashboard/exams/${examId}/details`);
    else router.push('/teacher/dashboard/exams');
  }, [toast, router, examId]);


  if (authLoading || (isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading demo exam...</p>
      </div>
    );
  }
  
  if (error && !isLoading) { // Error state after loading attempt
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <ServerCrash className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Cannot Start Demo Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
         <Button onClick={() => examId ? router.push(`/teacher/dashboard/exams/${examId}/details`) : router.push('/teacher/dashboard/exams')} className="mt-4">
            Back to Exams
        </Button>
      </div>
    );
  }
  
  if (!examDetails && !isLoading && !error) { // No details, no error, loading finished - likely exam not found/access issue
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Exam Data Not Available</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not retrieve details for this exam demo.</p>
         <Button onClick={() => examId ? router.push(`/teacher/dashboard/exams/${examId}/details`) : router.push('/teacher/dashboard/exams')} className="mt-4">
            Back to Exams
        </Button>
      </div>
    );
  }

  // examStarted prop for ExamTakingInterface is true because this page's purpose is to immediately show the exam interface for demo.
  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={isLoading} 
      error={null} // Errors are handled above, ExamTakingInterface handles its own internal errors
      examStarted={true} 
      onAnswerChange={handleDemoAnswerChange}
      onSubmitExam={handleDemoSubmitExam}
      onTimeUp={handleDemoTimeUp}
      isDemoMode={true}
      userIdForActivityMonitor={`teacher_demo_${teacherUserId || 'unknown'}`}
    />
  );
}
