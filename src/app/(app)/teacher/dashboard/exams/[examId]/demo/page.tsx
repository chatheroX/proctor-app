
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle, PlayCircle, ShieldCheck, Info } from 'lucide-react'; // Added PlayCircle, ShieldCheck, Info
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';


export default function TeacherDemoExamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: teacherUser, isLoading: authIsLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examLocallyStarted, setExamLocallyStarted] = useState(false); // To show pre-start screen

  const teacherUserId = teacherUser?.user_id;
  const teacherName = teacherUser?.name;

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing for demo.");
      setIsLoading(false);
      return;
    }
    if (!teacherUserId && !authIsLoading) {
      setError("Teacher authentication details missing for demo.");
      setIsLoading(false);
      return;
    }
    console.log(`[TeacherDemoPage] Fetching exam data for demo. ExamId: ${examId}, TeacherId: ${teacherUserId}`);
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*')
        .eq('exam_id', examId)
        // .eq('teacher_id', teacherUserId) // Allow demo of any exam if user is teacher, not just own for flexibility
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found or not authorized for demo.");
      
      const currentExam = data as Exam;
      setExamDetails(currentExam);
      setQuestions(currentExam.questions || []);
      if (!currentExam.questions || currentExam.questions.length === 0) {
        // Set as an error that prevents starting the demo
        setError("This exam has no questions. Add questions to run a demo.");
      }
    } catch (e: any) {
      console.error("[TeacherDemoPage] Failed to fetch exam data for demo:", e);
      setError(e.message || "Failed to load exam data for demo.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, teacherUserId, authIsLoading]);

  useEffect(() => {
    if (examId && !authIsLoading && teacherUserId) {
        if (!examDetails && !error && isLoading) { // Only fetch if not already loaded/errored and page is loading
             fetchExamData();
        }
    } else if (!isLoading && (!examId || (!teacherUserId && !authIsLoading))) { // If page not loading and critical IDs missing
        setError(examId ? "Teacher details missing for demo." : "Exam ID missing for demo.");
        setIsLoading(false); // Ensure loading stops if critical info is missing
    }
  }, [examId, authIsLoading, teacherUserId, examDetails, error, isLoading, fetchExamData]);

  const handleStartDemoExam = useCallback(() => {
    console.log('[TeacherDemoPage] handleStartDemoExam called.');
    if (!examDetails) {
      toast({ title: "Error", description: "Exam details not loaded for demo.", variant: "destructive" });
      return;
    }
    if (!questions || questions.length === 0) {
      console.log('[TeacherDemoPage] Aborting demo start: No questions for demo.');
      toast({ title: "No Questions", description: "This exam has no questions to demo.", variant: "destructive" });
      // This state should also be reflected in the button's disabled state via 'error' or a similar flag.
      setError("This exam has no questions. Add questions to run a demo."); // Ensure error state reflects this
      return;
    }
    console.log('[TeacherDemoPage] Starting demo locally.');
    setError(null); // Clear any "no questions" error before starting
    setExamLocallyStarted(true);
  }, [examDetails, questions, toast]);


  const handleDemoAnswerChange = useCallback((questionId: string, optionId: string) => {
    console.log(`[TeacherDemoPage] Demo Answer for QID ${questionId}: OptionID ${optionId}`);
    // No actual saving, just log for demo
  }, []);

  const handleDemoSubmitExam = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log('[TeacherDemoPage] Demo exam submitted with answers:', answers);
    console.log('[TeacherDemoPage] Demo flagged events:', flaggedEvents);
    toast({ title: "Demo Exam Ended", description: "The demo exam has been submitted (simulated)." });
    setExamLocallyStarted(false); // Go back to "Start Demo" screen
  }, [toast]);

  const handleDemoTimeUp = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log("[TeacherDemoPage] Demo time is up. Auto-submitting answers:", answers);
    console.log("[TeacherDemoPage] Demo time is up. Auto-submitting flagged events:", flaggedEvents);
    toast({ title: "Demo Time Up!", description: "The demo exam time has ended (simulated)." });
    setExamLocallyStarted(false);
  }, [toast]);


  if (authIsLoading || (isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading demo exam: {examId}...</p>
      </div>
    );
  }

  // This error state covers failures to load examDetails *before* the pre-start screen
  if (error && !examDetails && !examLocallyStarted) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Cannot Load Demo Environment</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }
  
  // If loading is done, but examDetails are still null (should be caught by error above, but defensive)
  if (!examDetails && !isLoading && !examLocallyStarted) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Demo Exam Not Found</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not load details for this demo exam.</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  // Pre-start screen for the demo
  if (!examLocallyStarted && examDetails) {
    // 'error' here could be "no questions" or other issues identified after examDetails loaded.
    const cantStartReason = error; // If 'error' state is set (e.g., no questions), that's the reason.
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl md:text-3xl font-bold text-gray-800">
              Ready to Start Demo: {examDetails.title}
            </CardTitle>
            {examDetails.description && <CardDescription className="text-gray-600 mt-1">{examDetails.description}</CardDescription>}
            <p className="text-sm text-orange-500 font-semibold mt-2">(DEMO MODE - Status: {examDetails.status})</p>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
             <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-white shadow-sm text-sm">
                <div>
                    <p className="font-medium text-gray-500">Duration</p>
                    <p className="text-lg font-semibold text-gray-700">{examDetails.duration || 'N/A'} minutes</p>
                </div>
                <div>
                    <p className="font-medium text-gray-500">Questions</p>
                    <p className="text-lg font-semibold text-gray-700">{questions?.length || 0}</p>
                </div>
             </div>
            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
              <Info className="h-5 w-5 text-blue-500" />
              <AlertTitle className="font-semibold">Demo Environment</AlertTitle>
              <AlertDescription>
                This is a simulation of the student exam environment. Activity monitoring (like tab switching) will be noted for informational purposes in the console and via toasts.
              </AlertDescription>
            </Alert>
            {cantStartReason && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{cantStartReason.includes("no questions") ? "Cannot Start Demo" : "Error"}</AlertTitle>
                <AlertDescription>{cantStartReason}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t">
            <Button
              onClick={handleStartDemoExam}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg"
              disabled={isLoading || !examDetails || !!cantStartReason } // Disabled if loading, no details, or a reason not to start
            >
              {(isLoading && !examDetails) ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />}
              Start Demo Exam
            </Button>
            <Button variant="outline" onClick={() => router.back()} className="w-full">
              Cancel / Back to Exam Details
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  // If examLocallyStarted is true and examDetails are loaded
  if (examLocallyStarted && examDetails) {
    return (
      <ExamTakingInterface
        examDetails={examDetails}
        questions={questions || []} // Ensure questions is an array
        isLoading={isLoading && !examDetails} // True if initial load in progress
        error={error} // Error during exam data fetch (e.g. no questions, if not caught above)
        examStarted={true} // By definition, if this part renders, demo exam has "started"
        onAnswerChange={handleDemoAnswerChange}
        onSubmitExam={handleDemoSubmitExam}
        onTimeUp={handleDemoTimeUp}
        isDemoMode={true}
        userIdForActivityMonitor={teacherUserId || 'anonymous_teacher_demo'}
        studentName={teacherName || 'Demo Teacher'}
        studentRollNumber={teacherUserId || 'DEMO001'} // Using teacher's ID as roll number for demo
      />
    );
  }

  // Fallback if somehow examDetails is null when examLocallyStarted is true (should not happen with guards)
  return (
     <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error in Demo Setup</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not initialize the demo exam interface correctly.</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
  );
}

    