
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent, ExamSubmissionInsert } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  const [isLoading, setIsLoading] = useState(true); // For this page's data loading
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | undefined>(undefined); 

  const studentUserId = studentUser?.user_id;
  const studentName = studentUser?.name;

  // Effect for token validation
  useEffect(() => {
    console.log("[ExamSessionPage] Token validation effect. AuthLoading:", authIsLoading, "StudentUserID:", studentUserId);
    if (authIsLoading) {
      console.log("[ExamSessionPage] Auth still loading, deferring token validation.");
      return; 
    }

    if (!studentUserId) {
      console.error("[ExamSessionPage] Student user ID not available after auth loading. Cannot validate token.");
      setError("Authentication details missing. Please ensure you are logged in and try re-initiating the exam.");
      setIsValidSession(false);
      setIsLoading(false);
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      console.error("[ExamSessionPage] Missing exam token.");
      setError("Access denied. Missing required exam token. Please re-initiate the exam from the dashboard.");
      setIsValidSession(false);
      setIsLoading(false);
      return;
    }

    try {
      const decoded = typeof window !== 'undefined' ? atob(decodeURIComponent(token)) : '';
      const payload = JSON.parse(decoded);
      console.log("[ExamSessionPage] Decoded token payload:", payload);
      
      if (payload.examId !== examId || payload.studentId !== studentUserId) {
        console.error("[ExamSessionPage] Token mismatch. Decoded ExamId:", payload.examId, "URL ExamId:", examId, "Decoded StudentId:", payload.studentId, "Context StudentId:", studentUserId);
        throw new Error("Invalid token payload. Session mismatch.");
      }
      console.log("[ExamSessionPage] Token validation successful.");
      setIsValidSession(true);
      setError(null); 
    } catch (e: any) {
      console.error("[ExamSessionPage] Error validating token:", e.message);
      setError(e.message || "Invalid or expired exam session token. Please re-initiate the exam.");
      setIsValidSession(false);
      setIsLoading(false);
    }
  }, [searchParams, examId, studentUserId, authIsLoading]);

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase || !studentUserId) {
      const missingInfo = [];
      if (!examId) missingInfo.push("Exam ID");
      if (!supabase) missingInfo.push("Supabase client");
      if (!studentUserId) missingInfo.push("Student details");
      setError(`${missingInfo.join(', ')} unavailable for exam data fetch.`);
      setIsLoading(false);
      return;
    }

    console.log(`[ExamSessionPage] Fetching exam data for examId: ${examId}, studentId: ${studentUserId}`);
    setIsLoading(true); 
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, start_time, end_time, status') // Select only needed fields
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      const effectiveStatus = getEffectiveExamStatus(currentExam);
      console.log("[ExamSessionPage] Fetched Exam Data:", currentExam, "Effective Status:", effectiveStatus);

      if (effectiveStatus !== 'Ongoing') {
         setError(`This exam is currently ${effectiveStatus.toLowerCase()} and cannot be taken. Please close this tab.`);
         setExamDetails(currentExam); 
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
      console.log("[ExamSessionPage] TODO: Create/Update ExamSubmissionsX record for student:", studentUserId, "exam:", examId);

    } catch (e: any) {
      console.error("[ExamSessionPage] Error fetching exam data:", e.message);
      setError(e.message || "Failed to load exam data. You may close this tab.");
      setQuestions([]);
      setExamDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, studentUserId]);

  useEffect(() => {
    console.log("[ExamSessionPage] Exam data fetch effect. IsValidSession:", isValidSession, "ExamDetails:", !!examDetails, "Error:", error, "isLoading (page):", isLoading);
    if (isValidSession === true) { 
        if (!examDetails && !error && isLoading) { 
            console.log("[ExamSessionPage] Valid session, fetching exam data.");
            fetchExamData();
        } else if (examDetails || error) {
             console.log("[ExamSessionPage] Exam data already fetched or error exists, ensuring page isLoading is false.");
            if(isLoading) setIsLoading(false); 
        }
    } else if (isValidSession === false && isLoading) {
        console.log("[ExamSessionPage] Session explicitly invalid, ensuring page isLoading is false.");
        setIsLoading(false);
    }
  }, [isValidSession, examId, fetchExamData, examDetails, error, isLoading]);


  const handleSubmitExamActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId || !examDetails) {
        toast({title: "Error", description: "Student or Exam details missing for submission.", variant: "destructive"});
        return;
    }
    
    const submissionData: ExamSubmissionInsert = {
        exam_id: examDetails.exam_id,
        student_user_id: studentUserId,
        answers: answers as any, 
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed',
        submitted_at: new Date().toISOString(),
        // score will be calculated later or on the backend
    };

    console.log("[ExamSessionPage] Submitting exam. Data:", submissionData);
    // TODO: Actually save submissionData to Supabase 'ExamSubmissionsX' table
    // For example:
    // const { error: submissionError } = await supabase.from('ExamSubmissionsX').insert(submissionData);
    // if (submissionError) { 
    //   console.error("[ExamSessionPage] Submission Error:", submissionError);
    //   toast({ title: "Submission Error", description: submissionError.message, variant: "destructive" });
    //   throw submissionError; 
    // }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

    toast({ title: "Exam Submitted!", description: "Your responses have been recorded. You can close this tab now." });
  }, [studentUserId, examDetails, toast, supabase]);

  const handleTimeUpActual = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    if (!studentUserId || !examDetails) {
        toast({title: "Error: Time Up", description: "Student or Exam details missing for auto-submission.", variant: "destructive"});
        return;
    }

     const submissionData: ExamSubmissionInsert = {
        exam_id: examDetails.exam_id,
        student_user_id: studentUserId,
        answers: answers as any,
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed',
        submitted_at: new Date().toISOString(),
        // score will be calculated later or on the backend
    };
    
    console.log("[ExamSessionPage] Time up. Auto-submitting exam. Data:", submissionData);
    // TODO: Actually save submissionData to Supabase 'ExamSubmissionsX' table
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

    toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up. You can close this tab." });
  }, [studentUserId, examDetails, toast, supabase]);

  // Initial loading state covers auth and token validation
  if (authIsLoading || isValidSession === undefined || (isValidSession && isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-gray-900 p-4 text-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-foreground mb-1">Preparing Your Exam...</h2>
        <p className="text-sm text-muted-foreground">
          {authIsLoading ? "Authenticating session..." : 
           isValidSession === undefined ? "Validating exam session..." :
           isLoading && !examDetails && !error ? "Loading exam content..." : 
           "Please wait."}
        </p>
      </div>
    );
  }
  
  // This error covers token validation failures or issues after token validation but before exam data load starts
  if (error && (!examDetails || (examDetails && questions.length === 0 && !isLoading)) ) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-gray-900 p-4 text-center">
        <Card className="w-full max-w-md modern-card shadow-lg p-6">
          <CardHeader>
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-xl font-semibold text-destructive mb-2">Cannot Start Exam</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <p className="text-xs text-muted-foreground">Please try re-initiating the exam from your dashboard or contact support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // If loading is done, but examDetails are still null (should be caught by error above, but defensive)
  if (!examDetails && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-gray-900 p-4 text-center">
        <Card className="w-full max-w-md modern-card shadow-lg p-6">
          <CardHeader>
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-xl font-semibold text-destructive mb-2">Exam Data Not Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Could not load the details for this exam.</p>
            <p className="text-xs text-muted-foreground">Please try again or contact your teacher/support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      parentIsLoading={isLoading && !examDetails} // True if page is loading exam data
      examLoadingError={error} // Pass any error during exam data fetch from this page
      examStarted={true} 
      onAnswerChange={ (qid, oid) => console.log(`[ExamSessionPage] Answer changed Q:${qid} O:${oid}`) }
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false}
      userIdForActivityMonitor={studentUserId || 'anonymous_student_session'}
      studentName={studentName}
      studentRollNumber={studentUser?.user_id} 
    />
  );
}
