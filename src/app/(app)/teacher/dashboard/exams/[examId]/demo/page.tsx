
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle } from 'lucide-react';

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
  const [examLocallyStarted, setExamLocallyStarted] = useState(false);

  const teacherUserId = teacherUser?.user_id;
  const teacherName = teacherUser?.name; // For demo, teacher acts as student

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    if (!teacherUserId && !authIsLoading) {
      setError("Teacher authentication details missing for demo.");
      setIsLoading(false);
      return;
    }
    console.log(`[TeacherDemoPage] Fetching exam data for demo, examId: ${examId}`);
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*')
        .eq('exam_id', examId)
        // .eq('teacher_id', teacherUserId) // Teacher should be able to demo any of their exams
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found or not authorized for demo.");
      
      setExamDetails(data as Exam);
      setQuestions((data as Exam).questions || []);
      if (!data.questions || data.questions.length === 0) {
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
        if (!examDetails && !error && isLoading) {
             fetchExamData();
        }
    } else if (!isLoading && (!examId || !teacherUserId) && !authIsLoading) {
        setError(examId ? "Teacher details missing for demo." : "Exam ID missing for demo.");
        setIsLoading(false);
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
      return;
    }
    console.log('[TeacherDemoPage] Starting demo locally.');
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
    // Typically redirect or show a summary. For now, just resets the demo.
    // router.push(`/teacher/dashboard/exams/${examId}/details`);
    setExamLocallyStarted(false); // To go back to the "Start Demo" screen
  }, [examId, router, toast]);

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

  if (error && !examDetails) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Cannot Load Demo</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }
  
  if (!examDetails && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Demo Exam Not Found</p>
        <p className="text-sm text-muted-foreground text-center mb-4">Could not load details for this demo exam.</p>
        <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
      </div>
    );
  }

  if (!examLocallyStarted) {
    // This is the "Ready to Start Demo" screen
    const cantStartReason = (!questions || questions.length === 0) ? "This exam has no questions. Add questions to run a demo." : null;
    const persistentError = error && examDetails ? error : null; // Show general fetch error if details are partially loaded

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl md:text-3xl font-bold text-gray-800">
              Ready to Start Demo: {examDetails?.title || 'Exam'}
            </CardTitle>
            {examDetails?.description && <CardDescription className="text-gray-600 mt-1">{examDetails.description}</CardDescription>}
            <p className="text-sm text-orange-500 font-semibold mt-2">(DEMO MODE)</p>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
             <div className="grid grid-cols-2 gap-4 p-3 border rounded-lg bg-white shadow-sm text-sm">
                <div>
                    <p className="font-medium text-gray-500">Duration</p>
                    <p className="text-lg font-semibold text-gray-700">{examDetails?.duration || 'N/A'} minutes</p>
                </div>
                <div>
                    <p className="font-medium text-gray-500">Questions</p>
                    <p className="text-lg font-semibold text-gray-700">{questions?.length || 0}</p>
                </div>
             </div>
            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-700">
              <ShieldCheck className="h-5 w-5 text-blue-500" />
              <AlertTitle className="font-semibold">Secure Environment (Simulated)</AlertTitle>
              <AlertDescription>
                This demo exam environment is simulated. Activity such as switching tabs or exiting fullscreen may be noted for demo purposes.
              </AlertDescription>
            </Alert>
            {(cantStartReason || persistentError) && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{cantStartReason ? "Cannot Start Demo" : "Error"}</AlertTitle>
                <AlertDescription>{cantStartReason || persistentError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t">
            <Button
              onClick={handleStartDemoExam}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg"
              disabled={parentIsLoading || !examDetails || !!cantStartReason || (!!persistentError && !cantStartReason)}
            >
              {(parentIsLoading || (isLoading && !examDetails)) ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />}
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

  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={isLoading && !examDetails} 
      error={error}
      examStarted={true} // Since examLocallyStarted is true here
      onAnswerChange={handleDemoAnswerChange}
      onSubmitExam={handleDemoSubmitExam}
      onTimeUp={handleDemoTimeUp}
      isDemoMode={true}
      userIdForActivityMonitor={teacherUserId || 'anonymous_teacher_demo'}
      studentName={teacherName || 'Demo Teacher'}
      studentRollNumber={teacherUserId || 'DEMO001'}
    />
  );
}

