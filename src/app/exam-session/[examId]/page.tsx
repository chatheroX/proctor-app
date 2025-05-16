
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam, FlaggedEvent, ExamSubmissionInsert } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle, ShieldAlert, ServerCrash } from 'lucide-react';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


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
  const [isLoading, setIsLoading] = useState(true); 
  const [pageError, setPageError] = useState<string | null>(null); // Changed from 'error' to 'pageError'
  const [isValidSession, setIsValidSession] = useState<boolean | undefined>(undefined); 

  const studentUserId = studentUser?.user_id;
  const studentName = studentUser?.name;
  const studentAvatarUrl = studentUser?.avatar_url;


  useEffect(() => {
    console.log("[ExamSessionPage] Token validation effect. AuthLoading:", authIsLoading, "StudentUserID:", studentUserId);
    if (authIsLoading) {
      console.log("[ExamSessionPage] Auth still loading, deferring token validation.");
      return; 
    }

    if (!studentUserId) {
      console.error("[ExamSessionPage] Student user ID not available after auth loading. Cannot validate token.");
      setPageError("Authentication details missing. Please ensure you are logged in and try re-initiating the exam.");
      setIsValidSession(false);
      if (isLoading) setIsLoading(false);
      return;
    }

    const token = searchParams.get('token');
    if (!token) {
      console.error("[ExamSessionPage] Missing exam token.");
      setPageError("Access denied. Missing required exam token. Please re-initiate the exam from the dashboard.");
      setIsValidSession(false);
      if (isLoading) setIsLoading(false);
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
      setPageError(null); 
    } catch (e: any) {
      console.error("[ExamSessionPage] Error validating token:", e.message);
      setPageError(e.message || "Invalid or expired exam session token. Please re-initiate the exam.");
      setIsValidSession(false);
      if (isLoading) setIsLoading(false);
    }
  }, [searchParams, examId, studentUserId, authIsLoading, isLoading]); // Added isLoading to dependency array

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase || !studentUserId) {
      const missingInfo = [];
      if (!examId) missingInfo.push("Exam ID");
      if (!supabase) missingInfo.push("Supabase client");
      if (!studentUserId) missingInfo.push("Student details");
      setPageError(`${missingInfo.join(', ')} unavailable for exam data fetch.`);
      setIsLoading(false);
      return;
    }

    console.log(`[ExamSessionPage] Fetching exam data for examId: ${examId}, studentId: ${studentUserId}`);
    // setIsLoading(true); // Already set by parent or initial state
    setPageError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, start_time, end_time, status')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      const effectiveStatus = getEffectiveExamStatus(currentExam);
      console.log("[ExamSessionPage] Fetched Exam Data:", currentExam, "Effective Status:", effectiveStatus);

      if (effectiveStatus !== 'Ongoing') {
         setPageError(`This exam is currently ${effectiveStatus.toLowerCase()} and cannot be taken. Please close this tab.`);
         setExamDetails(currentExam); 
         setQuestions([]);
         setIsLoading(false);
         return;
      }

      if (!currentExam.questions || currentExam.questions.length === 0) {
        setPageError("This exam has no questions. Please contact your teacher and close this tab.");
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
      setPageError(e.message || "Failed to load exam data. You may close this tab.");
      setQuestions([]);
      setExamDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, studentUserId]);

  useEffect(() => {
    console.log("[ExamSessionPage] Exam data fetch effect. IsValidSession:", isValidSession, "ExamDetails:", !!examDetails, "PageError:", pageError, "isLoading (page):", isLoading);
    if (isValidSession === true) { 
        if (!examDetails && !pageError && isLoading) { 
            console.log("[ExamSessionPage] Valid session, fetching exam data.");
            fetchExamData();
        } else if (examDetails || pageError) {
             console.log("[ExamSessionPage] Exam data already fetched or error exists, ensuring page isLoading is false.");
            if(isLoading) setIsLoading(false); 
        }
    } else if (isValidSession === false && isLoading) {
        console.log("[ExamSessionPage] Session explicitly invalid, ensuring page isLoading is false.");
        setIsLoading(false);
    }
  }, [isValidSession, examId, fetchExamData, examDetails, pageError, isLoading]);


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
    try {
        const { error: submissionError } = await supabase.from('ExamSubmissionsX').insert(submissionData);
        if (submissionError) { 
          console.error("[ExamSessionPage] Submission Error:", submissionError);
          toast({ title: "Submission Error", description: submissionError.message, variant: "destructive" });
          throw submissionError; 
        }
        toast({ title: "Exam Submitted!", description: "Your responses have been recorded. You can close this tab now." });
    } catch(e) {
        // Error already handled by toast above
        console.error("[ExamSessionPage] Catch block for submission error", e);
    }
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
    try {
        const { error: submissionError } = await supabase.from('ExamSubmissionsX').insert(submissionData);
        if (submissionError) { 
          console.error("[ExamSessionPage] Auto-Submission Error (Time Up):", submissionError);
          toast({ title: "Auto-Submission Error", description: submissionError.message, variant: "destructive" });
          throw submissionError; 
        }
        toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up. You can close this tab." });
    } catch (e) {
        console.error("[ExamSessionPage] Catch block for auto-submission error", e);
    }
  }, [studentUserId, examDetails, toast, supabase]);

  // Combined initial loading check
  if (authIsLoading || isValidSession === undefined || (isValidSession && isLoading && !examDetails && !pageError)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4 text-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-slate-200 mb-1">Preparing Your Exam...</h2>
        <p className="text-sm text-slate-400">
          {authIsLoading ? "Authenticating session..." : 
           isValidSession === undefined ? "Validating exam session..." :
           isLoading && !examDetails && !pageError ? "Loading exam content..." : 
           "Please wait."}
        </p>
      </div>
    );
  }
  
  // Error display after loading attempts
  if (pageError && (!examDetails || (examDetails && questions.length === 0 && !isLoading)) ) { 
     return (
       <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
          <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Cannot Start Exam</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">{pageError}</p>
             <Button onClick={() => window.close()} className="w-full btn-primary-solid">Close Tab</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Exam not found or invalid after loading
  if (!examDetails && !isLoading) { // isValidSession must be true here or previous block would catch it
     return (
       <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Exam Data Not Available</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">Could not load the details for this exam. Please try re-initiating the exam.</p>
             <Button onClick={() => window.close()} className="w-full btn-primary-solid">Close Tab</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If examDetails exist but questions are empty (should have been caught by fetchExamData logic setting pageError)
  if (examDetails && (!questions || questions.length === 0) && !isLoading && !pageError) {
      setPageError("This exam has no questions. Please contact your teacher and close this tab.");
      // This will cause a re-render and the error block above will catch it.
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4 text-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
            <p className="text-slate-300">Verifying exam content...</p>
        </div>
      );
  }


  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={isLoading && !examDetails} // Pass specific loading state
      examLoadingError={pageError} // Pass pageError as examLoadingError
      onAnswerChange={ (qid, oid) => console.log(`[ExamSessionPage] Answer changed Q:${qid} O:${oid}`) }
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false}
      userIdForActivityMonitor={studentUserId || 'anonymous_student_session'}
      studentName={studentName}
      studentRollNumber={studentUserId} 
      studentAvatarUrl={studentAvatarUrl}
    />
  );
}
