
'use client';

import { useState, useEffect, useCallback } _from_ 'react';
import { useParams, useRouter } _from_ 'next/navigation';
import { useToast } _from_ '@/hooks/use-toast';
import { createSupabaseBrowserClient } _from_ '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent } _from_ '@/types/supabase';
import { useAuth } _from_ '@/contexts/AuthContext';
import { ExamTakingInterface } _from_ '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle } _from_ 'lucide-react';
import { Button } _from_ '@/components/ui/button';

export default function TeacherDemoExamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } _from_ useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: teacherUser } _from_ useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);

  const fetchExamData = useCallback(async () => {
    if (!examId) {
      setError("Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    if (!teacherUser || teacherUser.role !== 'teacher') {
      setError("Access denied. You must be a teacher to demo an exam.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } _from_ await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, status, teacher_id')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");
      
      // Ensure the logged-in teacher owns this exam to demo it
      if (data.teacher_id !== teacherUser.user_id) {
        setError("Access denied. You can only demo exams you have created.");
        setExamDetails(null);
        setQuestions([]);
        setIsLoading(false);
        return;
      }
      
      setExamDetails(data as Exam);
      setQuestions(data.questions || []);
    } catch (e: any) {
      console.error("Failed to fetch exam data for demo:", e);
      setError(e.message || "Failed to load exam data for demo.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, teacherUser]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  const handleStartDemoExam = () => {
    if (questions.length === 0 && !isLoading) { // Check even if isLoading is false but questions are not there
        toast({ title: "No Questions", description: "This exam has no questions to demo.", variant: "destructive" });
        return;
    }
    if (error && examDetails === null) { // Critical error like access denied
        toast({ title: "Cannot Start Demo", description: error || "An error occurred.", variant: "destructive" });
        return;
    }
    setExamStarted(true);
  };

  const handleDemoAnswerChange = (questionId: string, optionId: string) => {
    // In demo mode, we might not persist answers, or just log them
    console.log(`Demo Answer for QID ${questionId}: OptionID ${optionId}`);
  };

  const handleDemoSubmitExam = async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    console.log('Demo Exam Submitted (Simulated)');
    console.log('Demo Answers:', answers);
    console.log('Demo Flagged Events (Informational):', flaggedEvents);
    toast({ title: "Demo Exam Finished!", description: "This was a simulation. No data was saved." });
    // ExamTakingInterface handles setting examFinished=true
  };

  const handleDemoTimeUp = async () => {
    console.log("Demo exam time is up.");
    // ExamTakingInterface handles its own toast for time up
  };
  
  if (isLoading && !examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam for demo...</p>
      </div>
    );
  }
  
  if (error && !examDetails && !isLoading) { // Critical error, exam details couldn't be fetched or access denied
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Demo Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
         <Button onClick={() => router.push(`/teacher/dashboard/exams/${examId}/details`)} className="mt-4">
            Back to Exam Details
        </Button>
      </div>
    );
  }


  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions}
      isLoading={isLoading} // isLoading for fetching data for the "Ready to Start" screen
      error={error} // Error for fetching data for "Ready to Start"
      examStarted={examStarted}
      onStartExam={handleStartDemoExam}
      onAnswerChange={handleDemoAnswerChange}
      onSubmitExam={handleDemoSubmitExam}
      onTimeUp={handleDemoTimeUp}
      isDemoMode={true}
      userIdForActivityMonitor={`teacher_demo_${teacherUser?.user_id || 'unknown'}`}
    />
  );
}

    