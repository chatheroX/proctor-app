
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
  const { user: teacherUser, isLoading: authLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For loading exam data
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);

  const teacherUserId = teacherUser?.user_id;
  const teacherUserRole = teacherUser?.role;

  const fetchExamData = useCallback(async () => {
    console.log('[TeacherDemoExamPage] fetchExamData called.');
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
      setQuestions(data.questions || []); // Ensure questions is at least an empty array
      console.log('[TeacherDemoExamPage] Fetched exam details:', data, 'Questions:', data.questions || []);
    } catch (e: any) {
      console.error("[TeacherDemoExamPage] Failed to fetch exam data for demo:", e);
      setError(e.message || "Failed to load exam data for demo.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, teacherUserId, teacherUserRole, setIsLoading, setError, setExamDetails, setQuestions]);

  useEffect(() => {
    // Ensures that fetch only runs when necessary parameters are available and not already loading/loaded.
    if (examId && teacherUserId && teacherUserRole === 'teacher' && !authLoading) { // Ensure auth is not loading
      if (!examDetails && !error) { // Fetch only if no details and no prior error
        console.log('[TeacherDemoExamPage] useEffect triggering fetchExamData.');
        fetchExamData();
      }
    } else if (!authLoading && (!examId || !teacherUserId || teacherUserRole !== 'teacher')) {
        if (!examId) setError("Exam ID is missing for fetch.");
        else setError("Teacher authentication details missing for fetch or incorrect role.");
    }
  }, [examId, teacherUserId, teacherUserRole, authLoading, examDetails, error, fetchExamData]);


  const handleStartDemoExam = useCallback(() => {
    console.log('[TeacherDemoExamPage] handleStartDemoExam called.');
    console.log({
      parent_isLoading: isLoading,
      parent_error: error,
      parent_examDetails_exists: !!examDetails,
      parent_questions_length: questions ? questions.length : 'null',
    });

    if (error && !examDetails) {
        toast({ title: "Cannot Start Demo", description: error || "An error occurred.", variant: "destructive" });
        console.log('[TeacherDemoExamPage] Aborting start: Error and no examDetails.');
        return;
    }
    // Ensure questions is not null before checking length
    if (examDetails && (!questions || questions.length === 0) && !isLoading) {
        toast({ title: "No Questions", description: "This exam has no questions to demo.", variant: "destructive" });
        console.log('[TeacherDemoExamPage] Aborting start: No questions for demo.');
        return;
    }
    if (!isLoading && !error && examDetails) {
        console.log('[TeacherDemoExamPage] Starting exam: setExamStarted(true).');
        setExamStarted(true);
    } else {
        console.log('[TeacherDemoExamPage] Conditions not met for starting exam.');
         if(isLoading) console.log("Reason: isLoading is true");
         if(error) console.log("Reason: error is present:", error);
         if(!examDetails) console.log("Reason: examDetails is null/undefined");
    }
  }, [questions, isLoading, error, examDetails, toast, setExamStarted]);

  const handleDemoAnswerChange = useCallback((questionId: string, optionId: string) => {
    console.log(`Demo Answer for QID ${questionId}: OptionID ${optionId}`);
  }, []);

  const handleDemoSubmitExam = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log('[TeacherDemoExamPage] Demo Exam Submitted (Simulated)');
    console.log('Demo Answers:', answers);
    console.log('Demo Flagged Events (Informational):', flaggedEvents);
    toast({ title: "Demo Exam Finished!", description: "This was a simulation. No data was saved." });
    router.push(`/teacher/dashboard/exams/${examId}/details`);
  }, [toast, router, examId]);

  const handleDemoTimeUp = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log("[TeacherDemoExamPage] Demo exam time is up. Answers:", answers, "Flagged Events:", flaggedEvents);
    toast({ title: "Demo Time's Up!", description: "The demo exam duration has ended. No data was saved." });
    router.push(`/teacher/dashboard/exams/${examId}/details`);
  }, [toast, router, examId]);

  if (authLoading || (!teacherUser && teacherUser !== null)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading user data...</p>
      </div>
    );
  }
  
  if (!teacherUser || teacherUser.role !== 'teacher') {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive">Access Denied</p>
        <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
         <Button onClick={() => router.push('/teacher/dashboard')} className="mt-4">
            Back to Dashboard
        </Button>
      </div>
    );
  }

  // This loader shows when the exam data itself is loading or if there was an error before examDetails is set
  if (isLoading && !examDetails && !error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam for demo...</p>
      </div>
    );
  }

  // This shows if there was an error during fetch AND examDetails is still null (or became null)
  if (error && !examDetails && !examStarted) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Demo Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error || "Could not load exam details for the demo."}</p>
         <Button onClick={() => router.push(`/teacher/dashboard/exams/${examId}/details`)} className="mt-4">
            Back to Exam Details
        </Button>
      </div>
    );
  }
  
  // If not loading, no error, but still no examDetails (e.g. examId invalid or access issue not caught as error)
  if (!isLoading && !error && !examDetails && !examStarted) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Exam Data Not Available</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not retrieve details for this exam demo.</p>
         <Button onClick={() => router.push(`/teacher/dashboard/exams/${examId}/details`)} className="mt-4">
            Back to Exam Details
        </Button>
      </div>
    );
  }


  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={isLoading && !examDetails} // isLoading for the interface is true if parent is loading AND details aren't set
      error={error} // Pass down the error state
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
