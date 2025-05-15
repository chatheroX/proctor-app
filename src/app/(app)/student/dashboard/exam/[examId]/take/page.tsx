
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent, ExamSubmissionInsert } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';

export default function TakeExamPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams(); // To potentially read the token
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authIsLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // examStarted state is no longer needed here, ExamTakingInterface assumes it's started

  const studentUserId = studentUser?.user_id;

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
     if (!studentUserId && !authIsLoading) { // Wait for auth to resolve before checking studentUserId
      setError("Student authentication details missing.");
      setIsLoading(false);
      return;
    }

    console.log(`[TakeExamPage] Fetching exam data for examId: ${examId}`);
    setIsLoading(true);
    setError(null);
    try {
      // For actual SEB integration, you might validate the token from searchParams here
      // const token = searchParams.get('token');
      // if (!token) { throw new Error("Exam token missing or invalid. Access denied."); }
      // Add server-side token validation if implementing actual encryption/SEB server.

      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*') // Fetch all columns including questions
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      const effectiveStatus = getEffectiveExamStatus(currentExam);

      if (effectiveStatus !== 'Ongoing') {
         setError(`This exam is currently ${effectiveStatus.toLowerCase()} and cannot be taken at this time. Please close this tab.`);
         setExamDetails(currentExam);
         setQuestions([]);
         setIsLoading(false);
         return;
      }

      if (!currentExam.questions || currentExam.questions.length === 0) {
        setError("This exam has no questions. Please contact your teacher and close this tab.");
        setExamDetails(currentExam);
        setQuestions([]);
        setIsLoading(false);
        return;
      }

      setExamDetails(currentExam);
      setQuestions(currentExam.questions || []);
      // TODO: Create an initial 'ExamSubmissionsX' record here with status 'In Progress'
      // This is important for auto-save and resume functionality later.
      // For now, we'll just log.
      console.log("[TakeExamPage] TODO: Create ExamSubmissionsX record on exam start for student:", studentUserId, "exam:", examId);

    } catch (e: any) {
      console.error("[TakeExamPage] Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data. You may close this tab.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, studentUserId, authIsLoading, searchParams]); // Added searchParams for token

  useEffect(() => {
    // Fetch data only if examId is present and auth state is resolved
    if (examId && !authIsLoading) {
        // Check if studentUserId is available before fetching
        if (studentUserId) {
            if (!examDetails && !error && isLoading) { // Fetch only if not already fetched/errored
                fetchExamData();
            }
        } else if (!error && isLoading) { // If studentUser is still null after auth is no longer loading
            setError("Student authentication details are not available. Cannot load exam.");
            setIsLoading(false);
        }
    } else if (!isLoading && !examId) {
        setError("Exam ID is missing for fetch.");
        setIsLoading(false); // Ensure loading stops if no examId
    }
  }, [examId, authIsLoading, studentUserId, examDetails, error, isLoading, fetchExamData]);


  const handleAnswerChangeLocal = useCallback((questionId: string, optionId: string) => {
    // TODO: Auto-save this answer to local storage AND attempt to patch to Supabase 'ExamSubmissionsX'
    console.log(`[TakeExamPage] Student Answer for QID ${questionId} saved locally (simulated): OptionID ${optionId}`);
  }, []);

  const handleSubmitExamActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId) {
        toast({title: "Error", description: "Student not authenticated for submission.", variant: "destructive"});
        return;
    }
    console.log('[TakeExamPage] Submitting answers to backend:', answers);
    console.log('[TakeExamPage] Flagged Events to backend:', flaggedEvents);

    // TODO: Update 'ExamSubmissionsX' record to 'Completed', save final answers, flagged_events, calculate score.
    const submissionData: Partial<ExamSubmissionInsert> = {
        exam_id: examId,
        student_user_id: studentUserId,
        answers: answers as any, // Cast for now, ensure correct type for Supabase
        flagged_events: flaggedEvents as any, // Cast for now
        status: 'Completed',
        submitted_at: new Date().toISOString(),
        // Score calculation would happen server-side or here based on correctOptionId
    };
    console.log("[TakeExamPage] TODO: Save final submission data to Supabase ExamSubmissionsX:", submissionData);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call

    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulation). You can close this tab." });
    // Typically, this tab might auto-close or redirect to a "submission successful" page
    // For now, we leave it to the user to close or the parent tab to handle post-exam navigation
  }, [studentUserId, toast, examId]);

  const handleTimeUpActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId) {
        toast({title: "Error: Time Up", description: "Student not authenticated for auto-submission.", variant: "destructive"});
        return;
    }
    console.log("[TakeExamPage] Time is up. Auto-submitting answers:", answers);
    console.log("[TakeExamPage] Time is up. Auto-submitting flagged events:", flaggedEvents);

    const submissionData: Partial<ExamSubmissionInsert> = {
        exam_id: examId,
        student_user_id: studentUserId,
        answers: answers as any,
        flagged_events: flaggedEvents as any,
        status: 'Completed', // Or 'Auto-Completed'
        submitted_at: new Date().toISOString(),
    };
    console.log("[TakeExamPage] TODO: Auto-save final submission data to Supabase ExamSubmissionsX (Time Up):", submissionData);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up (simulation). You can close this tab." });
  }, [studentUserId, toast, examId]);


  if (authIsLoading || (isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam session: {examId}...</p>
      </div>
    );
  }

  if (error) { // Show any error that occurred during setup or fetching
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Cannot Start Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <p className="text-xs text-muted-foreground text-center mt-2">You may close this tab.</p>
      </div>
    );
  }
  
  if (!examDetails && !isLoading) { // If loading finished but no details (e.g., exam not found, but no specific error set)
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Exam Not Found</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not load details for this exam. You may close this tab.</p>
      </div>
    );
  }


  // ExamTakingInterface now expects examStarted to be implicitly true if rendered
  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={isLoading && !examDetails} 
      error={error} // This error is if examDetails is present but something else is wrong internally
      examStarted={true} // This page only renders the interface if the exam should be active
      onAnswerChange={handleAnswerChangeLocal}
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false} // This is a real student exam attempt
      userIdForActivityMonitor={studentUserId || 'anonymous_student_take'}
    />
  );
}
