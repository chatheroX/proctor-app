
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent, ExamSubmissionInsert } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle } from 'lucide-react';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';

export default function ExamSessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authIsLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);

  const studentUserId = studentUser?.user_id;
  const studentName = studentUser?.name;

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError("Access denied. Missing required exam token.");
      setIsLoading(false);
      setIsValidSession(false);
      return;
    }
    try {
      const decoded = typeof window !== 'undefined' ? atob(decodeURIComponent(token)) : '';
      const payload = JSON.parse(decoded);
      if (payload.examId !== examId || payload.studentId !== studentUserId) {
        throw new Error("Invalid token payload. Session mismatch.");
      }
      // Optional: Check timestamp if payload.timestamp is too old etc.
      // For simplicity, we're just checking examId and studentId match.
      setIsValidSession(true);
    } catch (e: any) {
      setError(e.message || "Invalid or expired exam session token. Please re-initiate the exam.");
      setIsLoading(false);
      setIsValidSession(false);
    }
  }, [searchParams, examId, studentUserId]);


  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
     if (!studentUserId && !authIsLoading) {
      setError("Student authentication details missing.");
      setIsLoading(false);
      return;
    }

    console.log(`[ExamSessionPage] Fetching exam data for examId: ${examId}`);
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      const effectiveStatus = getEffectiveExamStatus(currentExam);

      if (effectiveStatus !== 'Ongoing') {
         setError(`This exam is currently ${effectiveStatus.toLowerCase()} and cannot be taken. Please close this tab.`);
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
      
      // TODO: Create or update ExamSubmissionsX record on exam start
      // This is a critical step for tracking progress and submissions.
      console.log("[ExamSessionPage] TODO: Create/Update ExamSubmissionsX record on exam start for student:", studentUserId, "exam:", examId);

    } catch (e: any) {
      console.error("[ExamSessionPage] Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data. You may close this tab.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, studentUserId, authIsLoading]);

  useEffect(() => {
    if (isValidSession && examId && !authIsLoading) {
        if (studentUserId) {
            if (!examDetails && !error && isLoading) {
                fetchExamData();
            }
        } else if (!error && isLoading) {
            setError("Student authentication details are not available. Cannot load exam.");
            setIsLoading(false);
        }
    } else if (!isValidSession && !isLoading && !error) {
        // If session is not valid and we are not already loading/errored, set an error.
        // The initial useEffect for token validation should set an error if token is bad.
        if (!searchParams.get('token')) { // Redundant check, but safe.
             setError("Access denied. Missing required exam token.");
        }
    }
  }, [isValidSession, examId, authIsLoading, studentUserId, examDetails, error, isLoading, fetchExamData, searchParams]);


  const handleAnswerChangeLocal = useCallback((questionId: string, optionId: string) => {
    console.log(`[ExamSessionPage] Student Answer for QID ${questionId} (simulated save): OptionID ${optionId}`);
    // TODO: Implement auto-save to local storage and/or ExamSubmissionsX
  }, []);

  const handleSubmitExamActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId || !examDetails) {
        toast({title: "Error", description: "Student or Exam details missing for submission.", variant: "destructive"});
        return;
    }
    console.log('[ExamSessionPage] Submitting answers:', answers);
    console.log('[ExamSessionPage] Flagged Events:', flaggedEvents);

    const submissionData: Partial<ExamSubmissionInsert> = {
        exam_id: examDetails.exam_id,
        student_user_id: studentUserId,
        answers: answers as any,
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed',
        submitted_at: new Date().toISOString(),
        // Score calculation would happen server-side on submission or by teacher later
    };

    // TODO: Implement actual submission to 'ExamSubmissionsX' table
    console.log("[ExamSessionPage] TODO: Save final submission data to Supabase ExamSubmissionsX:", submissionData);
    // Example:
    // const { error: submissionError } = await supabase.from('ExamSubmissionsX')
    //   .update(submissionData) // or .upsert if an initial record was made
    //   .eq('exam_id', examDetails.exam_id)
    //   .eq('student_user_id', studentUserId);
    // if (submissionError) { 
    //   toast({ title: "Submission Failed", description: submissionError.message, variant: "destructive" });
    //   throw submissionError; 
    // }
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate DB call

    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulated). You can close this tab." });
    // ExamTakingInterface will show the finished screen.
  }, [studentUserId, examDetails, toast, supabase]);

  const handleTimeUpActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId || !examDetails) {
        toast({title: "Error: Time Up", description: "Student or Exam details missing for auto-submission.", variant: "destructive"});
        return;
    }
    console.log("[ExamSessionPage] Time is up. Auto-submitting answers:", answers);
    console.log("[ExamSessionPage] Time is up. Auto-submitting flagged events:", flaggedEvents);

    const submissionData: Partial<ExamSubmissionInsert> = {
        exam_id: examDetails.exam_id,
        student_user_id: studentUserId,
        answers: answers as any,
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed',
        submitted_at: new Date().toISOString(),
    };
    
    // TODO: Implement actual auto-submission to 'ExamSubmissionsX' table
    console.log("[ExamSessionPage] TODO: Auto-save final submission data (Time Up):", submissionData);
    // Example:
    // const { error: submissionError } = await supabase.from('ExamSubmissionsX')
    //   .update(submissionData)
    //   .eq('exam_id', examDetails.exam_id)
    //   .eq('student_user_id', studentUserId);
    // if (submissionError) { 
    //   toast({ title: "Auto-Submission Failed", description: submissionError.message, variant: "destructive" });
    //   throw submissionError;
    // }
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up (simulation). You can close this tab." });
  }, [studentUserId, examDetails, toast, supabase]);

  if (!isValidSession && !isLoading && error) {
    // This error is specifically for invalid session/token before exam data fetch attempt
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Invalid Exam Session</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <p className="text-xs text-muted-foreground text-center mt-2">Please re-initiate the exam from your dashboard or contact support.</p>
      </div>
    );
  }

  if (authIsLoading || (isLoading && !examDetails && !error && isValidSession)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam: {examId}...</p>
      </div>
    );
  }

  if (error && isValidSession) { // Error during exam data fetching, but session token was valid
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Cannot Start Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <p className="text-xs text-muted-foreground text-center mt-2">You may close this tab.</p>
      </div>
    );
  }
  
  if (!examDetails && !isLoading && isValidSession) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Exam Not Found</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not load details for this exam after session validation. You may close this tab.</p>
      </div>
    );
  }

  if (!isValidSession && !isLoading && !error) { // Should be caught by initial token check error
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Exam Session Invalid</p>
        <p className="text-sm text-muted-foreground text-center mb-4">The exam session could not be validated. Please try joining the exam again.</p>
      </div>
    );
  }

  if (!examDetails || !isValidSession) {
      // Final catch-all if examDetails is null or session invalid by this point.
      // Should be caught by earlier checks.
       return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-lg text-destructive">Could not start exam.</p>
            <p className="text-sm text-muted-foreground">Missing exam details or invalid session.</p>
        </div>
        );
  }

  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={isLoading && !examDetails} 
      error={error}
      examStarted={true} // This page represents an active exam session
      onAnswerChange={handleAnswerChangeLocal}
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false}
      userIdForActivityMonitor={studentUserId || 'anonymous_student_session'}
      studentName={studentName}
      studentRollNumber={studentUserId} // Using user_id as roll number
    />
  );
}
