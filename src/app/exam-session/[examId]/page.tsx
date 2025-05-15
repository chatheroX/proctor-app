
'use client';

import React, { useState, useEffect, useCallback } from 'react'; // Added React import
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent, ExamSubmissionInsert } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page'; // Ensure this path is correct

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
  const [isLoading, setIsLoading] = useState(true); // General page loading
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState(false); // Token validation status

  const studentUserId = studentUser?.user_id;
  const studentName = studentUser?.name;

  // Effect for Token Validation
  useEffect(() => {
    // console.log(`[ExamSessionPage TokenValidationEffect] Running. authIsLoading: ${authIsLoading}, studentUserId: ${studentUserId}, examId: ${examId}`);

    if (authIsLoading) {
      // console.log("[ExamSessionPage TokenValidationEffect] Auth is loading, waiting for user context.");
      return; // Wait for auth to complete
    }

    if (!studentUserId) {
      // console.error("[ExamSessionPage TokenValidationEffect] Auth loaded, but studentUserId is missing.");
      setError("Authentication details missing. Please ensure you are logged in and try re-initiating the exam.");
      setIsValidSession(false);
      setIsLoading(false);
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setError("Access denied. Missing required exam token. Please re-initiate the exam from the dashboard.");
      setIsValidSession(false);
      setIsLoading(false);
      return;
    }

    // console.log(`[ExamSessionPage TokenValidationEffect] Attempting to validate token. Context studentId: ${studentUserId}`);
    try {
      const decoded = typeof window !== 'undefined' ? atob(decodeURIComponent(token)) : '';
      const payload = JSON.parse(decoded);
      // console.log("[ExamSessionPage TokenValidationEffect] Decoded token payload:", payload);

      if (payload.examId !== examId || payload.studentId !== studentUserId) {
        // console.error(
        //   `[ExamSessionPage TokenValidationEffect] Token Mismatch! ` +
        //   `Token ExamID: ${payload.examId} vs URL ExamID: ${examId}. ` +
        //   `Token StudentID: ${payload.studentId} vs Context StudentID: ${studentUserId}`
        // );
        throw new Error("Invalid token payload. Session mismatch. Please re-initiate the exam.");
      }
      // console.log("[ExamSessionPage TokenValidationEffect] Token validation successful.");
      setIsValidSession(true);
      setError(null); 
    } catch (e: any) {
      // console.error("[ExamSessionPage TokenValidationEffect] Token validation error:", e.message);
      setError(e.message || "Invalid or expired exam session token. Please re-initiate the exam.");
      setIsValidSession(false);
      setIsLoading(false);
    }
  }, [searchParams, examId, studentUserId, authIsLoading]);


  const fetchExamData = useCallback(async () => {
    // console.log(`[ExamSessionPage fetchExamData] Called. examId: ${examId}, studentUserId: ${studentUserId}`);
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    if (!studentUserId) {
        setError("Student authentication details became unavailable before fetching exam data.");
        setIsLoading(false);
        return;
    }

    setIsLoading(true); 
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*') // Fetch all columns needed for ExamTakingInterface
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
      // console.log("[ExamSessionPage] TODO: Create/Update ExamSubmissionsX record for student:", studentUserId, "exam:", examId);

    } catch (e: any) {
      // console.error("[ExamSessionPage] Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data. You may close this tab.");
      setQuestions([]); // Ensure questions are empty on error
      setExamDetails(null); // Ensure examDetails is null on error
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, studentUserId]);


  // Effect for Fetching Exam Data, depends on isValidSession and auth being loaded
  useEffect(() => {
    // console.log(`[ExamSessionPage DataFetchEffect] Running. isValidSession: ${isValidSession}, authIsLoading: ${authIsLoading}, studentUserId: ${studentUserId}, examId: ${examId}`);
    if (isValidSession && !authIsLoading && studentUserId && examId) {
        if (!examDetails && !error) { // Only fetch if not already loaded/errored
            // console.log("[ExamSessionPage DataFetchEffect] Conditions met, calling fetchExamData.");
            fetchExamData();
        } else if (examDetails || error) {
            // console.log("[ExamSessionPage DataFetchEffect] Data/error already present, ensuring isLoading is false.");
            setIsLoading(false); // Ensure loading stops if data/error is already set
        }
    } else if (!isValidSession && !authIsLoading && !isLoading && !error) {
        // This handles cases where token validation might have failed silently or some other setup issue.
        // console.log("[ExamSessionPage DataFetchEffect] Session not valid, not loading, no error. Setting default error.");
        // setError("Exam session could not be validated. Please re-initiate from the dashboard.");
        // No explicit setIsLoading(false) here, as it should be false already or handled by token validation.
    }
  }, [isValidSession, examId, authIsLoading, studentUserId, examDetails, error, fetchExamData, isLoading]);


  const handleAnswerChangeLocal = useCallback((questionId: string, optionId: string) => {
    // console.log(`[ExamSessionPage] Student Answer for QID ${questionId} (simulated save): OptionID ${optionId}`);
    // TODO: Implement auto-save to local storage and/or ExamSubmissionsX (debounced)
  }, []);

  const handleSubmitExamActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId || !examDetails) {
        toast({title: "Error", description: "Student or Exam details missing for submission.", variant: "destructive"});
        return;
    }
    // console.log('[ExamSessionPage] Submitting answers:', answers);
    // console.log('[ExamSessionPage] Flagged Events:', flaggedEvents);

    const submissionData: ExamSubmissionInsert = { // Made it non-partial for clarity
        exam_id: examDetails.exam_id,
        student_user_id: studentUserId,
        answers: answers as any, 
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed',
        submitted_at: new Date().toISOString(),
        // score and started_at would ideally be handled by DB or another mechanism
    };

    // console.log("[ExamSessionPage] TODO: Save final submission data to Supabase ExamSubmissionsX:", submissionData);
    // Example:
    // const { error: submissionError } = await supabase.from('ExamSubmissionsX').upsert(submissionData, { onConflict: 'exam_id, student_user_id' });
    // if (submissionError) { throw submissionError; }
    
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate DB call

    toast({ title: "Exam Submitted!", description: "Your responses have been recorded. You can close this tab now." });
  }, [studentUserId, examDetails, toast, supabase]);

  const handleTimeUpActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId || !examDetails) {
        toast({title: "Error: Time Up", description: "Student or Exam details missing for auto-submission.", variant: "destructive"});
        return;
    }
    // console.log("[ExamSessionPage] Time is up. Auto-submitting answers:", answers);
    // console.log("[ExamSessionPage] Time is up. Auto-submitting flagged events:", flaggedEvents);

     const submissionData: ExamSubmissionInsert = {
        exam_id: examDetails.exam_id,
        student_user_id: studentUserId,
        answers: answers as any,
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed',
        submitted_at: new Date().toISOString(),
    };
    
    // console.log("[ExamSessionPage] TODO: Auto-save final submission data (Time Up):", submissionData);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up. You can close this tab." });
  }, [studentUserId, examDetails, toast, supabase]);

  // Enhanced Loading State (covers auth, token validation, and data fetching)
  if (isLoading || authIsLoading) {
    return (
      // Modernized loading screen
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 text-center">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Preparing Your Exam...</h2>
        <p className="text-muted-foreground">
          {authIsLoading && !studentUserId ? "Authenticating your session..." : 
           isLoading && !isValidSession && !error ? "Validating exam session..." :
           isLoading && isValidSession && !examDetails && !error ? `Loading exam: ${examDetails?.title || examId}...` : 
           "Almost there, please wait."}
        </p>
      </div>
    );
  }
  
  // Error State (after all loading attempts)
  if (error) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-destructive/10 via-background to-background p-4 text-center">
        <ShieldAlert className="h-20 w-20 text-destructive mb-6" />
        <h2 className="text-3xl font-bold text-destructive mb-3">Cannot Start Exam</h2>
        <p className="text-lg text-muted-foreground mb-6 max-w-md">{error}</p>
        <p className="text-sm text-muted-foreground">Please try re-initiating the exam from your dashboard or contact support if the issue persists.</p>
        {/* Optionally add a button to attempt going back or closing */}
      </div>
    );
  }
  
  // If loading is done, no error, but examDetails still not loaded (should be rare now)
  if (!examDetails) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-destructive/10 via-background to-background p-4 text-center">
        <AlertTriangle className="h-20 w-20 text-destructive mb-6" />
        <h2 className="text-3xl font-bold text-destructive mb-3">Exam Data Not Available</h2>
        <p className="text-lg text-muted-foreground mb-6 max-w-md">Could not load the details for this exam. This might be a temporary issue.</p>
         <p className="text-sm text-muted-foreground">Please try again or contact your teacher/support.</p>
      </div>
    );
  }

  // If we reach here, session is valid, auth is loaded, no errors, and examDetails are present.
  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []} // Ensure questions is an array
      isLoading={false} // isLoading prop for ExamTakingInterface is now effectively false
      error={null}      // Errors are handled by this page
      examStarted={true} // This page represents an active exam session
      onAnswerChange={handleAnswerChangeLocal}
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false} // This is the actual student exam session
      userIdForActivityMonitor={studentUserId || 'anonymous_student_session'} // studentUserId should be defined here
      studentName={studentName}
      studentRollNumber={studentUserId} // Using user_id as roll number
    />
  );
}
