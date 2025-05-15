
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | undefined>(undefined); // Undefined initially

  const studentUserId = studentUser?.user_id;
  const studentName = studentUser?.name;

  // Effect for token validation
  useEffect(() => {
    console.log("[ExamSessionPage] Token validation effect. AuthLoading:", authIsLoading, "StudentUserID:", studentUserId);
    if (authIsLoading) {
      console.log("[ExamSessionPage] Auth still loading, deferring token validation.");
      return; // Wait for auth context to settle
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
        throw new Error("Invalid token payload. Session mismatch. Please re-initiate the exam.");
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
  }, [searchParams, examId, studentUserId, authIsLoading]); // Dependencies include authIsLoading & studentUserId

  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase || !studentUserId) {
      const missingInfo = [];
      if (!examId) missingInfo.push("Exam ID");
      if (!supabase) missingInfo.push("Supabase client");
      if (!studentUserId) missingInfo.push("Student details");
      setError(`${missingInfo.join(', ')} unavailable.`);
      setIsLoading(false);
      return;
    }

    console.log(`[ExamSessionPage] Fetching exam data for examId: ${examId}, studentId: ${studentUserId}`);
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
  }, [examId, supabase, studentUserId]); // Removed setError, setIsLoading, etc. from deps

  // Effect for fetching exam data once session is validated
  useEffect(() => {
    console.log("[ExamSessionPage] Exam data fetch effect. IsValidSession:", isValidSession, "ExamDetails:", !!examDetails, "Error:", error);
    if (isValidSession === true) { // Only proceed if session is explicitly valid
        if (!examDetails && !error) { // And no exam details or error yet
            console.log("[ExamSessionPage] Valid session, fetching exam data.");
            fetchExamData();
        } else if (examDetails || error) {
            console.log("[ExamSessionPage] Exam data already fetched or error exists, stopping loading.");
            setIsLoading(false); 
        }
    } else if (isValidSession === false && !isLoading) { // If explicitly invalid and not already loading
        console.log("[ExamSessionPage] Session explicitly invalid, ensuring loading is false.");
        setIsLoading(false);
    }
    // If isValidSession is undefined, it means token validation is pending.
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
    };

    // TODO: Save final submission data to Supabase ExamSubmissionsX:
    console.log("[ExamSessionPage] TODO: Save submission:", submissionData);
    // const { error: submissionError } = await supabase.from('ExamSubmissionsX').upsert(submissionData, { onConflict: 'exam_id, student_user_id' });
    // if (submissionError) { 
    //   toast({ title: "Submission Error", description: submissionError.message, variant: "destructive" });
    //   throw submissionError; 
    // }
    
    await new Promise(resolve => setTimeout(resolve, 1500)); 

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
    };
    
    // TODO: Auto-save final submission data (Time Up):
    console.log("[ExamSessionPage] TODO: Auto-save submission (Time Up):", submissionData);
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({ title: "Exam Auto-Submitted!", description: "Your responses have been recorded due to time up. You can close this tab." });
  }, [studentUserId, examDetails, toast, supabase]);

  // Initial loading state covers auth and token validation
  if (authIsLoading || isValidSession === undefined || (isValidSession && isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 text-center">
        {/* TODO: Add Framer Motion loader animation */}
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <h2 className="text-2xl font-semibold text-foreground mb-2">Preparing Your Exam...</h2>
        <p className="text-muted-foreground">
          {authIsLoading ? "Authenticating your session..." : 
           isValidSession === undefined ? "Validating exam session..." :
           isLoading && !examDetails && !error ? "Loading exam content..." : 
           "Almost there, please wait."}
        </p>
      </div>
    );
  }
  
  if (error) { 
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-destructive/10 via-background to-background p-4 text-center">
        {/* TODO: Add Framer Motion error animation */}
        <Card className="w-full max-w-lg glass-card shadow-2xl p-6 md:p-8">
          <CardHeader>
            <ShieldAlert className="h-20 w-20 text-destructive mx-auto mb-6" />
            <CardTitle className="text-3xl font-bold text-destructive mb-3">Cannot Start Exam</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground mb-6 max-w-md mx-auto">{error}</p>
            <p className="text-sm text-muted-foreground">Please try re-initiating the exam from your dashboard or contact support if the issue persists.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!examDetails) { // This case should ideally be covered by `error` if fetching failed
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-destructive/10 via-background to-background p-4 text-center">
        <Card className="w-full max-w-lg glass-card shadow-2xl p-6 md:p-8">
          <CardHeader>
            <AlertTriangle className="h-20 w-20 text-destructive mx-auto mb-6" />
            <CardTitle className="text-3xl font-bold text-destructive mb-3">Exam Data Not Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-muted-foreground mb-6 max-w-md mx-auto">Could not load the details for this exam. This might be a temporary issue.</p>
            <p className="text-sm text-muted-foreground">Please try again or contact your teacher/support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      isLoading={false} // isLoading on this page handles data loading, ExamTakingInterface is ready
      error={null} // Error handling is done on this page      
      examStarted={true} // By this point, exam is considered started for the interface
      onAnswerChange={ (qid, oid) => console.log(`[ExamSessionPage] Answer changed Q:${qid} O:${oid}`) /* TODO: Auto-save logic */ }
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false}
      userIdForActivityMonitor={studentUserId || 'anonymous_student_session'}
      studentName={studentName}
      studentRollNumber={studentUser?.user_id} 
    />
  );
}
