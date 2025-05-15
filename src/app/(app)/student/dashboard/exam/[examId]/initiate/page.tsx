
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, Clock, HelpCircle, ListChecks, PlayCircle } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam, Question, FlaggedEvent } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { format } from 'date-fns';

export default function InitiateExamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examLocallyStarted, setExamLocallyStarted] = useState(false);
  const [effectiveStatus, setEffectiveStatus] = useState<string | null>(null);

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    console.log(`[InitiatePage] Fetching exam data for examId: ${examId}`);
    setIsLoading(true);
    setError(null); // Clear previous errors before fetching
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      console.log("[InitiatePage] Exam data fetched:", currentExam);
      setExamDetails(currentExam);
      setQuestions(currentExam.questions || []);
      setEffectiveStatus(getEffectiveExamStatus(currentExam));

    } catch (e: any) {
      console.error("[InitiatePage] Failed to fetch exam data for initiation:", e);
      setError(e.message || "Failed to load exam data.");
      setExamDetails(null); // Ensure examDetails is null on error
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase]);

  useEffect(() => {
    if (examId && !authLoading && supabase) {
      // Fetch only if examDetails are not yet loaded or if examId changed
      if (!examDetails || examDetails.exam_id !== examId) {
         fetchExamData();
      }
    }
  }, [examId, authLoading, supabase, fetchExamData, examDetails]);

  const handleActualStartExam = useCallback(() => {
    console.log("[InitiatePage] handleActualStartExam called. Current examDetails:", examDetails);
    if (!studentUser?.user_id) {
      toast({ title: "Authentication Error", description: "Student details not found. Cannot start exam.", variant: "destructive" });
      setError("Student details not found. Please re-login.");
      return;
    }
    if (!examDetails) { // Ensure examDetails is loaded
        toast({ title: "Error", description: "Exam details are not loaded. Please wait or refresh.", variant: "destructive" });
        return;
    }
    if (effectiveStatus !== 'Ongoing') {
      toast({ title: "Cannot Start", description: `Exam is ${effectiveStatus?.toLowerCase() || 'not available'}.`, variant: "destructive" });
      return;
    }
    if (!examDetails.questions || examDetails.questions.length === 0) {
      toast({ title: "No Questions", description: "This exam has no questions. Please contact your teacher.", variant: "destructive" });
      return;
    }
    setExamLocallyStarted(true);
    console.log("[InitiatePage] TODO: Create ExamSubmissionsX record for student:", studentUser.user_id, "exam:", examId);
  }, [studentUser?.user_id, examDetails, effectiveStatus, toast, examId]);


  const handleSubmitExamActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUser?.user_id || !examDetails) {
      console.error("[InitiatePage] handleSubmitExamActual: Missing studentUser or examDetails.");
      toast({ title: "Submission Error", description: "Could not submit exam due to missing data.", variant: "destructive"});
      return;
    }
    console.log('[InitiatePage] Submitting answers to backend:', answers);
    console.log('[InitiatePage] Flagged Events to backend:', flaggedEvents);
    // TODO: Update 'ExamSubmissionsX' record
    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulation)." });
    router.push('/student/dashboard/exam-history');
  }, [studentUser?.user_id, examDetails, toast, router]);

  const handleTimeUpActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUser?.user_id || !examDetails) {
      console.error("[InitiatePage] handleTimeUpActual: Missing studentUser or examDetails.");
      toast({ title: "Auto-Submission Error", description: "Could not auto-submit exam due to missing data.", variant: "destructive"});
      return;
    }
    console.log("[InitiatePage] Time is up. Auto-submitting answers:", answers);
    console.log("[InitiatePage] Time is up. Auto-submitting flagged events:", flaggedEvents);
    // TODO: Update 'ExamSubmissionsX' record
    toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up (simulation)." });
    router.push('/student/dashboard/exam-history');
  }, [studentUser?.user_id, examDetails, toast, router]);


  if (authLoading || (isLoading && !examDetails && !error)) { // Show loader if auth is loading OR page is loading initial exam data
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam details...</p>
      </div>
    );
  }

  // This error display is for critical failures to load exam data initially
  if (error && !examDetails && !examLocallyStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <Button onClick={() => router.push('/student/dashboard/join-exam')} className="mt-4">
          Back to Join Exam
        </Button>
      </div>
    );
  }

  // If exam details are simply not found after loading (and no critical error shown above)
  if (!examDetails && !isLoading && !examLocallyStarted) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground text-center">Exam details not found.</p>
         <Button onClick={() => router.push('/student/dashboard/join-exam')} className="mt-4">
          Back to Join Exam
        </Button>
      </div>
    );
  }


  // If exam has started locally, attempt to render the exam taking interface
  if (examLocallyStarted) {
    // CRITICAL CHECK: Ensure examDetails are available before rendering the interface
    if (!examDetails) {
      // This state means the user clicked "Start Test", but examDetails are now missing.
      // This could be due to a rapid re-fetch error or an unexpected state update.
      // Show a loader or a specific error message.
      console.error("[InitiatePage] examLocallyStarted is true, but examDetails is null. This should not happen if handleActualStartExam guards are correct.");
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
          <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
          <p className="text-lg text-muted-foreground">Finalizing exam setup...</p>
          {error && <p className="text-sm text-destructive mt-2">Error: {error}</p>}
          {!error && <p className="text-sm text-muted-foreground mt-2">If this persists, please try rejoining the exam.</p>}
           <Button onClick={() => router.push(`/student/dashboard/exam/${examId}/initiate`)} variant="outline" className="mt-4 mr-2">
            Retry
          </Button>
          <Button onClick={() => router.push('/student/dashboard/join-exam')} className="mt-4">
            Back to Join Exam
          </Button>
        </div>
      );
    }
    // If examDetails is populated, render the ExamTakingInterface
    console.log("[InitiatePage] Rendering ExamTakingInterface with examDetails:", examDetails);
    return (
      <ExamTakingInterface
        examDetails={examDetails}
        questions={questions} // questions state is also managed in initiate/page
        isLoading={false} // Loading is handled by this parent page before this point
        error={null}      // Error handling is done by this parent page before this point
        examStarted={true} // This component is only rendered if exam is locally started
        onAnswerChange={(questionId, optionId) => {
          // TODO: Local storage auto-save
          console.log(`[InitiatePage] Answer changed for QID ${questionId}: OptionID ${optionId}`);
        }}
        onSubmitExam={handleSubmitExamActual}
        onTimeUp={handleTimeUpActual}
        isDemoMode={false}
        userIdForActivityMonitor={studentUser?.user_id || 'anonymous_student_initiate'}
      />
    );
  }

  // Pre-exam information screen (if not examLocallyStarted and examDetails are available)
  // This check is implicitly handled by the !examDetails checks above, but to be safe:
  if (!examDetails) {
     // This case should ideally be caught by the loaders/error screens above.
     // If it reaches here, it means examDetails somehow became null after initial checks.
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground text-center">Could not display exam information.</p>
         <Button onClick={() => router.push('/student/dashboard/join-exam')} className="mt-4">
          Back to Join Exam
        </Button>
      </div>
    );
  }

  const canStartTest = effectiveStatus === 'Ongoing';
  const examTimeInfo = examDetails.start_time && examDetails.end_time
    ? `${format(new Date(examDetails.start_time), "dd MMM yyyy, hh:mm a")} - ${format(new Date(examDetails.end_time), "hh:mm a")}`
    : "Timing not specified";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left Column: Exam Details */}
        <div className="space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">{examDetails.title}</h1>
          {examDetails.description && <p className="text-gray-600">{examDetails.description}</p>}

          <div className="flex items-center space-x-2 text-gray-500 bg-gray-100 p-2 rounded-md text-sm">
            <Clock size={18} />
            <span>{examTimeInfo}</span>
          </div>

          <div className="grid grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-700">{examDetails.duration}</p>
              <p className="text-xs text-gray-500">MINUTES</p>
              <p className="text-xs text-gray-500">Duration</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-700">100</p> {/* Placeholder */}
              <p className="text-xs text-gray-500">MARKS</p>
              <p className="text-xs text-gray-500">Max Marks</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-gray-700">{questions.length}</p>
              <p className="text-xs text-gray-500">QUESTIONS</p>
              <p className="text-xs text-gray-500">Total Questions</p>
            </div>
          </div>

          {canStartTest ? (
            <Button
              onClick={handleActualStartExam}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg rounded-md shadow-md"
              disabled={authLoading || !studentUser || isLoading} // Disable if page is loading or auth is happening
            >
              {(authLoading || isLoading) ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2" />}
              Start Test
            </Button>
          ) : (
            <div className="text-center p-4 bg-gray-100 rounded-md shadow">
              <p className="text-gray-700 font-medium">
                This test {effectiveStatus === 'Completed' ? 'has ended' : (effectiveStatus === 'Published' || effectiveStatus === 'Upcoming') ? 'has not started yet' : 'is not currently available'}.
              </p>
              {effectiveStatus !== 'Ongoing' && <p className="text-sm text-gray-500 mt-1">Please check the exam schedule or contact your administrator.</p>}
            </div>
          )}
           {error && !examLocallyStarted && ( // Show non-critical errors on this screen if exam hasn't started
            <Alert variant="destructive" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Right Column: Illustration */}
        <div className="hidden md:flex justify-center items-center">
          <Image
            src="https://placehold.co/600x450.png"
            alt="Exam illustration"
            width={600}
            height={450}
            className="rounded-lg shadow-lg"
            data-ai-hint="student taking exam"
          />
        </div>
      </div>
    </div>
  );
}
