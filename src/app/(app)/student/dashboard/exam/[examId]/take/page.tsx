
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
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page'; // Re-using this helper

export default function TakeExamPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams(); // For potential token later
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authIsLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studentUserId = studentUser?.user_id;
  const studentName = studentUser?.name;
  // studentRollNumber will be studentUser.user_id as per current setup

  // Validation of "token" from URL if needed (for future SEB integration)
  // For now, assume direct access after initiate page is for dev testing or simplified flow.
  // useEffect(() => {
  //   const token = searchParams.get('token');
  //   if (!token) {
  //     setError("Access denied. Missing required exam token.");
  //     setIsLoading(false);
  //     return;
  //   }
  //   // TODO: Validate token against a server-side mechanism (this is complex)
  //   // For example, decode and check timestamp, studentId, examId.
  //   try {
  //     const decoded = atob(decodeURIComponent(token));
  //     const payload = JSON.parse(decoded);
  //     if (payload.examId !== examId || payload.studentId !== studentUserId /* or some other check */) {
  //       throw new Error("Invalid token payload.");
  //     }
  //     // Check timestamp if payload.timestamp is too old etc.
  //   } catch (e) {
  //     setError("Invalid or expired exam session token. Please re-initiate the exam.");
  //     setIsLoading(false);
  //     return;
  //   }
  // }, [searchParams, examId, studentUserId]);


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

    console.log(`[TakeExamPage] Fetching exam data for examId: ${examId}`);
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*') // Fetch all exam details
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      const effectiveStatus = getEffectiveExamStatus(currentExam);

      // Students can only take exams that are currently 'Ongoing'
      if (effectiveStatus !== 'Ongoing') {
         setError(`This exam is currently ${effectiveStatus.toLowerCase()} and cannot be taken at this time. Please close this tab.`);
         setExamDetails(currentExam); // Set details even if error for display
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
      // This should ideally happen server-side or in a more robust way
      // For now, we'll log and proceed.
      console.log("[TakeExamPage] TODO: Create/Update ExamSubmissionsX record on exam start for student:", studentUserId, "exam:", examId);
      // Example:
      // const { error: submissionError } = await supabase.from('ExamSubmissionsX').upsert({
      //   exam_id: examId,
      //   student_user_id: studentUserId,
      //   status: 'In Progress',
      //   started_at: new Date().toISOString()
      // }, { onConflict: 'exam_id,student_user_id' }); // Assuming unique constraint
      // if(submissionError) console.error("Error starting submission record:", submissionError);


    } catch (e: any) {
      console.error("[TakeExamPage] Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data. You may close this tab.");
      setQuestions([]); // Clear questions on error
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, studentUserId, authIsLoading]);

  useEffect(() => {
    if (examId && !authIsLoading) {
        // Only fetch if studentUserId is available
        if (studentUserId) {
            // Only fetch if details are not loaded and no error yet and page is in loading state
            if (!examDetails && !error && isLoading) { // Check isLoading to prevent re-fetch if error already set
                fetchExamData();
            }
        } else if (!error && isLoading) { // If still loading but no studentUserId, set error
            setError("Student authentication details are not available. Cannot load exam.");
            setIsLoading(false);
        }
    } else if (!isLoading && !examId) { // If not loading and no examId
        setError("Exam ID is missing for fetch.");
        setIsLoading(false);
    }
  }, [examId, authIsLoading, studentUserId, examDetails, error, isLoading, fetchExamData]);


  const handleAnswerChangeLocal = useCallback((questionId: string, optionId: string) => {
    // This function is called by ExamTakingInterface on each answer change.
    // Here you could implement periodic auto-save to local storage or to backend.
    console.log(`[TakeExamPage] Student Answer for QID ${questionId} saved locally (simulated): OptionID ${optionId}`);
    // For actual auto-save to backend:
    // supabase.from('ExamSubmissionsX').update({ answers: updatedAnswersObject })
    //  .eq('exam_id', examId).eq('student_user_id', studentUserId);
  }, []); // Add studentUserId, examId to deps if saving to backend

  const handleSubmitExamActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId) {
        toast({title: "Error", description: "Student not authenticated for submission.", variant: "destructive"});
        return;
    }
    console.log('[TakeExamPage] Submitting answers to backend:', answers);
    console.log('[TakeExamPage] Flagged Events to backend:', flaggedEvents);

    const submissionData: Partial<ExamSubmissionInsert> = {
        exam_id: examId,
        student_user_id: studentUserId,
        answers: answers as any, // Cast if answers structure is complex JSON
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed', // Mark as completed
        submitted_at: new Date().toISOString(),
        // Score calculation would happen here or server-side
    };

    // TODO: Save final submission data to Supabase ExamSubmissionsX
    console.log("[TakeExamPage] TODO: Save final submission data to Supabase ExamSubmissionsX:", submissionData);
    // const { error: submissionError } = await supabase.from('ExamSubmissionsX')
    //   .update(submissionData) // or upsert if initial record might not exist
    //   .eq('exam_id', examId)
    //   .eq('student_user_id', studentUserId);
    // if (submissionError) { 
    //   toast({ title: "Submission Failed", description: submissionError.message, variant: "destructive" });
    //   throw submissionError; // Re-throw to be caught by ExamTakingInterface
    // }
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate DB call

    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulation). You can close this tab." });
    // ExamTakingInterface will show the finished screen.
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
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed', // Mark as completed
        submitted_at: new Date().toISOString(), // Record submission time
    };
    // TODO: Auto-save final submission data to Supabase ExamSubmissionsX
    console.log("[TakeExamPage] TODO: Auto-save final submission data to Supabase ExamSubmissionsX (Time Up):", submissionData);
    // const { error: submissionError } = await supabase.from('ExamSubmissionsX')
    //   .update(submissionData)
    //   .eq('exam_id', examId)
    //   .eq('student_user_id', studentUserId);
    // if (submissionError) { 
    //   toast({ title: "Auto-Submission Failed", description: submissionError.message, variant: "destructive" });
    //   throw submissionError; // Re-throw
    // }
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up (simulation). You can close this tab." });
  }, [studentUserId, toast, examId]);


  // Initial Loading state for the page itself, before ExamTakingInterface takes over
  if (authIsLoading || (isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam session: {examId}...</p>
      </div>
    );
  }

  // If there's an error that prevents exam details from loading (e.g., exam not found, not ongoing)
  if (error) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Cannot Start Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        {/* For SEB, closing the tab might be the only option. For browser, offer a way back. */}
        <p className="text-xs text-muted-foreground text-center mt-2">You may close this tab.</p>
        {/* <Button onClick={() => router.push('/student/dashboard/join-exam')} className="mt-4">Back to Join Exam</Button> */}
      </div>
    );
  }
  
  // If loading is finished but examDetails are still null (should be caught by error state above, but defensive)
  if (!examDetails && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Exam Not Found</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not load details for this exam. You may close this tab.</p>
      </div>
    );
  }

  // If we reach here, examDetails should be loaded, and no major error occurred yet.
  // Pass examStarted={true} as this page is the actual exam environment.
  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={isLoading && !examDetails} // True if still loading exam details (though parent loader should catch most)
      error={error} // Pass any errors to the interface, though it might have its own display
      examStarted={true} // This page is the exam, so it's "started" by definition
      onAnswerChange={handleAnswerChangeLocal}
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false} // This is the actual student exam page
      userIdForActivityMonitor={studentUserId || 'anonymous_student_take'} // Fallback for safety
      studentName={studentName}
      studentRollNumber={studentUserId} // Use studentUserId as roll number
    />
  );
}

    