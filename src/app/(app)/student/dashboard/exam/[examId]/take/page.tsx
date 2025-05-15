
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authIsLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Page specific loading for exam data
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);

  const studentUserId = studentUser?.user_id;

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      if (!examId) setError("Exam ID is missing.");
      else setError("Supabase client not available.");
      setIsLoading(false);
      return;
    }
    // Student user ID check will happen before starting exam or on submission

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
         setError(`This exam is currently ${effectiveStatus.toLowerCase()} and cannot be taken at this time.`);
         setExamDetails(currentExam); // Set details even if not ongoing, for display purposes
         setQuestions([]); // No questions if not ongoing
         setIsLoading(false);
         return;
      }

      if (!currentExam.questions || currentExam.questions.length === 0) {
        setError("This exam has no questions. Please contact your teacher.");
        setExamDetails(currentExam);
        setQuestions([]);
        setIsLoading(false);
        return;
      }

      setExamDetails(currentExam);
      setQuestions(currentExam.questions || []);
    } catch (e: any) {
      console.error("Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase]);

  useEffect(() => {
    if (examId && !authIsLoading) { // Only fetch if examId is present and auth state is resolved
        if (!examDetails && !error && isLoading) { // Fetch only if not already fetched/errored and currently in page loading state
            fetchExamData();
        }
    } else if (!isLoading && (!examId)) {
        setError("Exam ID is missing for fetch.");
    }
  }, [examId, authIsLoading, examDetails, error, isLoading, fetchExamData]);

  const handleStartExam = useCallback(() => {
    if (!studentUserId) {
        toast({ title: "Authentication Error", description: "Student details not found. Cannot start exam.", variant: "destructive"});
        setError("Student details not found. Please re-login.");
        return;
    }
    if (error && !examDetails) {
        toast({ title: "Cannot Start", description: error || "An error occurred while loading the exam.", variant: "destructive" });
        return;
    }
    if (examDetails) {
        const effectiveStatus = getEffectiveExamStatus(examDetails);
        if (effectiveStatus !== 'Ongoing') {
            toast({ title: "Cannot Start", description: `Exam is ${effectiveStatus.toLowerCase()}.`, variant: "destructive" });
            setError(`Exam is ${effectiveStatus.toLowerCase()}.`);
            return;
        }
        if (!examDetails.questions || examDetails.questions.length === 0) {
          toast({ title: "No Questions", description: "This exam has no questions. Please contact your teacher.", variant: "destructive" });
          setError("This exam has no questions.");
          return;
        }
    }
    if(!isLoading && !error && examDetails && examDetails.questions && examDetails.questions.length > 0) {
        setExamStarted(true);
        // TODO: Create an initial 'ExamSubmissionsX' record here with status 'In Progress'
        // This is important for auto-save and resume functionality later.
        console.log("TODO: Create ExamSubmissionsX record on exam start for student:", studentUserId, "exam:", examId);
    }
  }, [isLoading, error, examDetails, toast, studentUserId, examId]);

  const handleAnswerChangeLocal = useCallback((questionId: string, optionId: string) => {
    // TODO: Auto-save this answer to local storage AND attempt to patch to Supabase 'ExamSubmissionsX'
    console.log(`Student Answer for QID ${questionId} saved locally (simulated): OptionID ${optionId}`);
    // Example of patching (requires submission_id from the record created on exam start):
    // if (submissionId) {
    //   supabase.from('ExamSubmissionsX').update({ answers: { ...currentAnswers, [questionId]: optionId } }).eq('submission_id', submissionId) ...
    // }
  }, []);

  const handleSubmitExamActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId) {
        toast({title: "Error", description: "Student not authenticated for submission.", variant: "destructive"});
        return;
    }
    console.log('Submitting answers to backend:', answers);
    console.log('Flagged Events to backend:', flaggedEvents);

    // TODO: Update 'ExamSubmissionsX' record to 'Completed', save final answers, flagged_events, calculate score.
    // This is a placeholder.
    const submissionData: Partial<ExamSubmissionInsert> = {
        exam_id: examId,
        student_user_id: studentUserId,
        answers: answers as any, // Cast if your answers structure matches Json
        flagged_events: flaggedEvents as any, // Cast if FlaggedEvent matches Json structure
        status: 'Completed',
        submitted_at: new Date().toISOString(),
        // score: calculateScore(answers, questions), // Implement scoring logic
    };
    console.log("TODO: Save final submission data to Supabase ExamSubmissionsX:", submissionData);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulation)." });
    router.push('/student/dashboard/exam-history'); // Or a specific "submission successful" page
  }, [studentUserId, toast, router, examId]);

  const handleTimeUpActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId) {
        toast({title: "Error: Time Up", description: "Student not authenticated for auto-submission.", variant: "destructive"});
        return;
    }
    console.log("Time is up. Auto-submitting answers:", answers);
    console.log("Time is up. Auto-submitting flagged events:", flaggedEvents);

    // TODO: Same as handleSubmitExamActual, but might have a different note or handling for auto-submission.
    const submissionData: Partial<ExamSubmissionInsert> = {
        exam_id: examId,
        student_user_id: studentUserId,
        answers: answers as any,
        flagged_events: flaggedEvents as any,
        status: 'Completed', // Or 'Completed (Time Up)'
        submitted_at: new Date().toISOString(),
        // score: calculateScore(answers, questions),
    };
    console.log("TODO: Auto-save final submission data to Supabase ExamSubmissionsX (Time Up):", submissionData);
     await new Promise(resolve => setTimeout(resolve, 1500));

     toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up (simulation)." });
     router.push('/student/dashboard/exam-history');
  }, [studentUserId, toast, router, examId]);


  if (authIsLoading || (isLoading && !examDetails && !error)) { // Show loader if auth is loading OR page is loading exam data
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam: {examId}...</p>
      </div>
    );
  }

  // This covers errors during initial data fetch or if student auth is missing post-load
  if ((!isLoading && error && !examDetails) || (!authIsLoading && !studentUserId && !examStarted)) {
     const displayError = error || (!studentUserId ? "Student authentication details missing." : "Could not load exam details.");
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">{error ? "Error Loading Exam" : "Cannot Proceed"}</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{displayError}</p>
         <Button onClick={() => router.push('/student/dashboard')} className="mt-4">
            Back to Dashboard
        </Button>
      </div>
    );
  }

  // Specific check for errors that might occur even if examDetails has some data (e.g. status changed after initial load, and user hasn't started)
   if (!isLoading && error && examDetails && !examStarted) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Cannot Proceed with Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
         <Button onClick={() => router.push('/student/dashboard')} className="mt-4">
            Back to Dashboard
        </Button>
      </div>
    );
  }


  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={isLoading && !examDetails} // True if loading and examDetails not yet populated
      error={error} // Error message from data fetching for the exam
      examStarted={examStarted}
      onStartExam={handleStartExam}
      onAnswerChange={handleAnswerChangeLocal}
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false}
      userIdForActivityMonitor={studentUserId || 'anonymous_student'}
    />
  );
}

    