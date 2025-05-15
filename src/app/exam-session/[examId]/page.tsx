
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
  const [isLoading, setIsLoading] = useState(true); // General page loading, true until token validated & data fetched or failed
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState(false);

  const studentUserId = studentUser?.user_id;
  const studentName = studentUser?.name;

  // Effect for Token Validation
  useEffect(() => {
    console.log(`[ExamSessionPage TokenValidationEffect] Running. authIsLoading: ${authIsLoading}, studentUserId: ${studentUserId}, examId: ${examId}`);

    if (authIsLoading) {
      console.log("[ExamSessionPage TokenValidationEffect] Auth is loading, waiting for user context.");
      // Still loading auth, don't validate token yet. Keep main `isLoading` true.
      // setIsLoading(true); // Already true by default
      return;
    }

    // Auth is loaded, now check if we have a studentUserId
    if (!studentUserId) {
      console.error("[ExamSessionPage TokenValidationEffect] Auth loaded, but studentUserId is missing. Cannot validate token.");
      setError("Authentication details missing. Please ensure you are logged in and try re-initiating the exam.");
      setIsValidSession(false);
      setIsLoading(false); // Stop page loading, validation failed
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      setError("Access denied. Missing required exam token. Please re-initiate the exam.");
      setIsValidSession(false);
      setIsLoading(false); // Stop page loading
      return;
    }

    console.log(`[ExamSessionPage TokenValidationEffect] Attempting to validate token. Context studentId: ${studentUserId}`);
    try {
      const decoded = typeof window !== 'undefined' ? atob(decodeURIComponent(token)) : '';
      const payload = JSON.parse(decoded);
      console.log("[ExamSessionPage TokenValidationEffect] Decoded token payload:", payload);

      if (payload.examId !== examId || payload.studentId !== studentUserId) {
        console.error(
          `[ExamSessionPage TokenValidationEffect] Token Mismatch! ` +
          `Token ExamID: ${payload.examId} vs URL ExamID: ${examId}. ` +
          `Token StudentID: ${payload.studentId} vs Context StudentID: ${studentUserId}`
        );
        throw new Error("Invalid token payload. Session mismatch. Please re-initiate the exam.");
      }
      console.log("[ExamSessionPage TokenValidationEffect] Token validation successful.");
      setIsValidSession(true);
      setError(null); // Clear any previous errors
      // setIsLoading(true); // Keep true, data fetching will handle setting it to false
    } catch (e: any) {
      console.error("[ExamSessionPage TokenValidationEffect] Token validation error:", e.message);
      setError(e.message || "Invalid or expired exam session token. Please re-initiate the exam.");
      setIsValidSession(false);
      setIsLoading(false); // Stop page loading, token invalid
    }
  }, [searchParams, examId, studentUserId, authIsLoading]); // Key dependencies

  const fetchExamData = useCallback(async () => {
    console.log(`[ExamSessionPage fetchExamData] Called. examId: ${examId}, studentUserId: ${studentUserId}`);
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    // studentUserId check is now more robustly handled by the token validation effect triggering this.
    // However, a guard here is still good practice.
    if (!studentUserId) {
        setError("Student authentication details became unavailable before fetching exam data.");
        setIsLoading(false);
        return;
    }

    setIsLoading(true); // Explicitly set loading for data fetch
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
         setExamDetails(currentExam); // Still set details for context if needed
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
      console.log("[ExamSessionPage] TODO: Create/Update ExamSubmissionsX record on exam start for student:", studentUserId, "exam:", examId);

    } catch (e: any) {
      console.error("[ExamSessionPage] Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data. You may close this tab.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, studentUserId]); // Removed authIsLoading as it's handled by the calling effect

  // Effect for Fetching Exam Data, depends on isValidSession
  useEffect(() => {
    console.log(`[ExamSessionPage DataFetchEffect] Running. isValidSession: ${isValidSession}, authIsLoading: ${authIsLoading}, studentUserId: ${studentUserId}, examId: ${examId}`);
    if (isValidSession && !authIsLoading && studentUserId && examId) {
        // Only fetch if session is valid, auth is loaded, studentUserId is present,
        // and we haven't already fetched successfully or encountered an error that prevents fetching.
        if (!examDetails && !error) {
            console.log("[ExamSessionPage DataFetchEffect] Conditions met, calling fetchExamData.");
            fetchExamData();
        } else if (examDetails) {
            console.log("[ExamSessionPage DataFetchEffect] Exam details already loaded.");
            setIsLoading(false); // Ensure loading is false if details already present
        } else if (error) {
             console.log("[ExamSessionPage DataFetchEffect] Error present, not fetching exam data.");
             setIsLoading(false); // Ensure loading is false if error present
        }
    } else if (!isValidSession && !authIsLoading && !isLoading && !error) {
        // If session became invalid after auth load (e.g., token check failed after auth loaded but before token was processed)
        // and we're not already showing an error from token validation.
        // This case might be redundant if token validation sets error correctly.
        console.log("[ExamSessionPage DataFetchEffect] Session is not valid and not loading auth/data, and no primary error. Setting generic token error.");
        // setError("Exam session could not be validated. Please re-initiate.");
        // No need to set isLoading(false) here as it's already false or handled by token validation.
    }
  }, [isValidSession, examId, authIsLoading, studentUserId, examDetails, error, fetchExamData, isLoading]);


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
        answers: answers as any, // Cast for now, ensure Question type is correct
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null, // Cast for now
        status: 'Completed',
        submitted_at: new Date().toISOString(),
    };

    console.log("[ExamSessionPage] TODO: Save final submission data to Supabase ExamSubmissionsX:", submissionData);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate DB call

    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulated). You can close this tab." });
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
    
    console.log("[ExamSessionPage] TODO: Auto-save final submission data (Time Up):", submissionData);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up (simulation). You can close this tab." });
  }, [studentUserId, examDetails, toast, supabase]);


  // Initial loading states: Could be auth loading OR token validation OR data fetching
  if (isLoading || authIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">
          {authIsLoading && !studentUserId ? "Authenticating session..." : 
           isLoading && !isValidSession && !error ? "Validating exam session..." :
           isLoading ? `Loading exam: ${examId}...` : 
           "Preparing exam..."}
        </p>
      </div>
    );
  }
  
  // After all loading, if there's an error (from token validation or data fetch)
  if (error) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Cannot Start Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <p className="text-xs text-muted-foreground text-center mt-2">You may close this tab or try re-initiating the exam process.</p>
      </div>
    );
  }
  
  // If loading is done, no error, but examDetails still not loaded (should be rare if logic above is correct)
  if (!examDetails) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Exam Data Not Available</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not load details for this exam. Please try again or contact support.</p>
      </div>
    );
  }

  // If we reach here, session is valid, auth is loaded, no errors, and examDetails are present.
  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={false} // Data fetching isLoading is handled by this page now
      error={null} // Errors are handled by this page
      examStarted={true} // This page represents an active exam session
      onAnswerChange={handleAnswerChangeLocal}
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false}
      userIdForActivityMonitor={studentUserId || 'anonymous_student_session'} // studentUserId should be defined here
      studentName={studentName}
      studentRollNumber={studentUserId} // Using user_id as roll number
    />
  );
}
