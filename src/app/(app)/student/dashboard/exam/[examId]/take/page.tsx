
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent, ExamStatus } from '@/types/supabase';
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
  const { user: studentUser } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);

  const studentUserId = studentUser?.user_id;

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase || !studentUserId) {
      if (!examId) setError("Exam ID is missing.");
      else if (!studentUserId) setError("Student not authenticated for fetch.");
      else setError("Supabase client not available.");
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('*') // Fetch all details for effective status check
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const effectiveStatus = getEffectiveExamStatus(data as Exam);
      if (effectiveStatus !== 'Ongoing') {
         setError(`This exam is currently ${effectiveStatus.toLowerCase()} and cannot be taken.`);
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
  }, [examId, supabase, studentUserId]);

  useEffect(() => {
    if (examId && studentUserId && !examDetails && isLoading) {
        fetchExamData();
    } else if (!isLoading && (!examId || !studentUserId)) {
        if (!examId) setError("Exam ID is missing for fetch.");
        else if(!studentUserId) setError("Student authentication details missing for fetch.");
    }
  }, [examId, studentUserId, fetchExamData, isLoading, examDetails]);

  const handleStartExam = useCallback(() => {
    if (error && !examDetails) {
        toast({ title: "Cannot Start", description: error || "An error occurred.", variant: "destructive" });
        return;
    }
    if (examDetails) {
        const effectiveStatus = getEffectiveExamStatus(examDetails);
        if (effectiveStatus !== 'Ongoing') {
            toast({ title: "Cannot Start", description: `Exam is ${effectiveStatus.toLowerCase()}.`, variant: "destructive" });
            return;
        }
    }
    if(examDetails && (questions === null || questions.length === 0) && !isLoading) {
        toast({ title: "No Questions", description: "This exam has no questions. Please contact your teacher.", variant: "destructive" });
        return;
    }
    if (!isLoading && !error && examDetails) {
        setExamStarted(true);
    }
  }, [questions, isLoading, error, examDetails, toast]);

  const handleAnswerChangeLocal = useCallback((questionId: string, optionId: string) => {
    console.log(`Student Answer for QID ${questionId} saved locally (simulated): OptionID ${optionId}`);
  }, []);

  const handleSubmitExamActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId) {
        toast({title: "Error", description: "Student not authenticated for submission.", variant: "destructive"});
        return;
    }
    console.log('Submitting answers to backend:', answers);
    console.log('Flagged Events to backend:', flaggedEvents);

    // TODO: Implement actual submission to Supabase 'ExamSubmissionsX' table
    // Update exam status to 'Completed' if this student was the last one or based on exam end time
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulation)." });
    router.push('/student/dashboard/exam-history');
  }, [studentUserId, toast, router]);

  const handleTimeUpActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId) {
        toast({title: "Error: Time Up", description: "Student not authenticated for auto-submission.", variant: "destructive"});
        return;
    }
    console.log("Time is up. Auto-submitting answers:", answers);
    console.log("Time is up. Auto-submitting flagged events:", flaggedEvents);
     await new Promise(resolve => setTimeout(resolve, 1500));
     toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up (simulation)." });
     router.push('/student/dashboard/exam-history');
  }, [studentUserId, toast, router]);


  if (isLoading && !examDetails && !examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam: {examId}...</p>
      </div>
    );
  }
  
  if (!isLoading && !examDetails && !examStarted) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">{error ? "Error Loading Exam" : "Exam Data Not Available"}</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error || "Could not load exam details."}</p>
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
      isLoading={isLoading && !examDetails}
      error={error}
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
