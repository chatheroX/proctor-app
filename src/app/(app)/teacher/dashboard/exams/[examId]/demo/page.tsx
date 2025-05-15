
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TeacherDemoExamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: teacherUser } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For loading exam data
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);

  const teacherUserId = teacherUser?.user_id;
  const teacherUserRole = teacherUser?.role;

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase || !teacherUserId || teacherUserRole !== 'teacher') {
      if (!examId) setError("Exam ID is missing.");
      else if (!teacherUserId || teacherUserRole !== 'teacher') setError("Access denied or user data unavailable for demo.");
      else setError("Supabase client not available for demo.");
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

      setExamDetails(data as Exam);
      setQuestions(data.questions || []);
    } catch (e: any) {
      console.error("Failed to fetch exam data for demo:", e);
      setError(e.message || "Failed to load exam data for demo.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, teacherUserId, teacherUserRole]); // setError, setExamDetails, setQuestions, setIsLoading are stable

  useEffect(() => {
    if (examId && teacherUserId && teacherUserRole === 'teacher' && !examDetails && isLoading) { // Only fetch if needed and params are ready
      fetchExamData();
    } else if (!isLoading && (!examId || !teacherUserId || teacherUserRole !== 'teacher')) {
        if (!examId) setError("Exam ID is missing for fetch.");
        else setError("Teacher authentication details missing for fetch or incorrect role.");
        // setIsLoading(false); // Already false
    }
  }, [examId, teacherUserId, teacherUserRole, fetchExamData, isLoading, examDetails]); // Added examDetails & isLoading to dependencies

  const handleStartDemoExam = useCallback(() => {
    if (error && !examDetails) {
        toast({ title: "Cannot Start Demo", description: error || "An error occurred.", variant: "destructive" });
        return;
    }
    if (examDetails && (questions === null || questions.length === 0) && !isLoading) {
        toast({ title: "No Questions", description: "This exam has no questions to demo.", variant: "destructive" });
        return;
    }
    if (!isLoading && !error && examDetails) {
        setExamStarted(true);
    }
  }, [questions, isLoading, error, examDetails, toast]); // setExamStarted is stable

  const handleDemoAnswerChange = useCallback((questionId: string, optionId: string) => {
    console.log(`Demo Answer for QID ${questionId}: OptionID ${optionId}`);
  }, []);

  const handleDemoSubmitExam = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log('Demo Exam Submitted (Simulated)');
    console.log('Demo Answers:', answers);
    console.log('Demo Flagged Events (Informational):', flaggedEvents);
    toast({ title: "Demo Exam Finished!", description: "This was a simulation. No data was saved." });
    router.push(`/teacher/dashboard/exams/${examId}/details`);
  }, [toast, router, examId]);

  const handleDemoTimeUp = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log("Demo exam time is up. Answers:", answers, "Flagged Events:", flaggedEvents);
    toast({ title: "Demo Time's Up!", description: "The demo exam duration has ended. No data was saved." });
    router.push(`/teacher/dashboard/exams/${examId}/details`);
  }, [toast, router, examId]);

  if (isLoading && !examDetails && !examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam for demo...</p>
      </div>
    );
  }

  if (!isLoading && !examDetails && !examStarted) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">{error ? "Error Loading Demo Exam" : "Exam Data Not Available"}</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error || "Could not load exam details for the demo."}</p>
         <Button onClick={() => router.push(`/teacher/dashboard/exams/${examId}/details`)} className="mt-4">
            Back to Exam Details
        </Button>
      </div>
    );
  }

  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []} // Ensure questions is not null
      isLoading={isLoading && !examDetails}
      error={error}
      examStarted={examStarted}
      onStartExam={handleStartDemoExam}
      onAnswerChange={handleDemoAnswerChange}
      onSubmitExam={handleDemoSubmitExam}
      onTimeUp={handleDemoTimeUp}
      isDemoMode={true}
      userIdForActivityMonitor={`teacher_demo_${teacherUserId || 'unknown'}`}
    />
  );
}

  