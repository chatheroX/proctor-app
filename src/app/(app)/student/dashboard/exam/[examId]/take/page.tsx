
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


export default function TakeExamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } _from_ useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser } _from_ useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);
  // Answers will be managed by ExamTakingInterface, but we might need them for submission

  const fetchExamData = useCallback(async () => {
    if (!examId) {
      setError("Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } _from_ await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, status')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      if (data.status !== 'Published' && data.status !== 'Ongoing') {
         setError(`This exam is currently ${data.status.toLowerCase()} and cannot be taken.`);
         setExamDetails(data as Exam);
         setQuestions([]);
         setIsLoading(false);
         return;
      }
      
      setExamDetails(data as Exam);
      setQuestions(data.questions || []);
    } catch (e: any) {
      console.error("Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  const handleStartExam = () => {
    if (examDetails?.status !== 'Published' && examDetails?.status !== 'Ongoing') {
        toast({ title: "Cannot Start", description: `Exam is ${examDetails?.status.toLowerCase()}.`, variant: "destructive" });
        return;
    }
    if(questions.length === 0) {
        toast({ title: "No Questions", description: "This exam has no questions. Please contact your teacher.", variant: "destructive" });
        return;
    }
    setExamStarted(true);
  };

  const handleAnswerChangeLocal = (questionId: string, optionId: string) => {
    // TODO: Implement local storage auto-save here
    console.log(`Student Answer for QID ${questionId} saved locally (simulated): OptionID ${optionId}`);
    // This state would likely live in a higher context or be managed more robustly for auto-save
  };

  const handleSubmitExamActual = async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUser) {
        toast({title: "Error", description: "Student not authenticated.", variant: "destructive"});
        return;
    }
    console.log('Submitting answers to backend:', answers);
    console.log('Flagged Events to backend:', flaggedEvents);
    
    // TODO: Implement actual submission to a new 'ExamSubmissionsX' table
    // This would include student_id, exam_id, answers, score (if auto-graded), flagged_events, submission_time etc.
    // For now, simulate submission.
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    
    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulation)." });
    // The ExamTakingInterface handles setting examFinished=true
  };
  
  const handleTimeUpActual = async () => {
    // Similar to handleSubmitExamActual, but triggered by timer.
    // The actual submission logic would be invoked here, possibly with current answers.
    // ExamTakingInterface handles its own toast for time up
    // await handleSubmitExamActual(currentAnswers, currentFlaggedEvents); // Need a way to get these from interface or manage state here
    console.log("Time is up. Auto-submission logic would run here.");
  };

  if (isLoading && !examStarted) { // Initial page load before exam details are fetched
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam: {examId}...</p>
      </div>
    );
  }
  
  // This critical error state remains for when examDetails *could not* be fetched at all
  if (error && !examDetails && !isLoading) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error loading exam</p>
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
      questions={questions}
      isLoading={isLoading}
      error={error} // Pass down error related to fetching exam data (e.g., exam not active)
      examStarted={examStarted}
      onStartExam={handleStartExam}
      onAnswerChange={handleAnswerChangeLocal}
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false}
      userIdForActivityMonitor={studentUser?.user_id || 'anonymous_student'}
    />
  );
}

    