
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
import { decryptData } from '@/lib/crypto-utils'; // Import decryption utility

const TOKEN_VALIDITY_MINUTES = 5; // Token generated on initiate page is valid for this long

export default function ExamSessionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authIsLoading } = useAuth();

  const examIdFromUrl = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pageIsLoading, setPageIsLoading] = useState(true); 
  const [pageError, setPageError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | undefined>(undefined);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0); // In milliseconds

  const studentUserId = studentUser?.user_id;
  const studentName = studentUser?.name;
  const studentAvatarUrl = studentUser?.avatar_url;

  // Simulate fetching server time offset
  useEffect(() => {
    // In a real app, this would be an API call to your server
    // const fetchedOffset = await fetch('/api/time-sync').then(res => res.json()).offset;
    // For demo, assume client and server time are perfectly synced (offset = 0)
    // or a small fixed/random offset for testing.
    setServerTimeOffset(0); 
    console.log('[ExamSessionPage] Simulated server time offset:', 0);
  }, []);


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
      if (pageIsLoading) setPageIsLoading(false);
      return;
    }

    const encryptedToken = searchParams.get('token');
    if (!encryptedToken) {
      console.error("[ExamSessionPage] Missing exam token.");
      setPageError("Access denied. Missing required exam token. Please re-initiate the exam from the dashboard.");
      setIsValidSession(false);
      if (pageIsLoading) setPageIsLoading(false);
      return;
    }

    decryptData<{ examId: string; studentId: string; timestamp: number, examCode: string }>(encryptedToken)
      .then(payload => {
        if (!payload) {
          throw new Error("Invalid token: Decryption failed.");
        }
        console.log("[ExamSessionPage] Decrypted token payload:", payload);
        
        if (payload.examId !== examIdFromUrl) {
           console.error("[ExamSessionPage] Token mismatch. Decoded ExamId:", payload.examId, "URL ExamId:", examIdFromUrl);
           throw new Error("Invalid token payload: Exam ID mismatch.");
        }
        if (payload.studentId !== studentUserId) {
            console.error("[ExamSessionPage] Token mismatch. Decoded StudentId:", payload.studentId, "Context StudentId:", studentUserId);
            throw new Error("Invalid token payload: Student ID mismatch.");
        }

        const tokenAgeMinutes = (Date.now() - payload.timestamp) / (1000 * 60);
        if (tokenAgeMinutes > TOKEN_VALIDITY_MINUTES) {
            console.error(`[ExamSessionPage] Token expired. Age: ${tokenAgeMinutes.toFixed(2)} minutes.`);
            throw new Error(`Exam session link expired (valid for ${TOKEN_VALIDITY_MINUTES} minutes). Please re-initiate the exam.`);
        }

        console.log("[ExamSessionPage] Token validation successful.");
        setIsValidSession(true);
        setPageError(null); 
      })
      .catch((e: any) => {
        console.error("[ExamSessionPage] Error validating token:", e.message);
        setPageError(e.message || "Invalid or expired exam session token. Please re-initiate the exam.");
        setIsValidSession(false);
        if (pageIsLoading) setPageIsLoading(false);
      });
  }, [searchParams, examIdFromUrl, studentUserId, authIsLoading, pageIsLoading]);

  const fetchExamData = useCallback(async () => {
    if (!examIdFromUrl || !supabase || !studentUserId) {
      const missingInfo = [];
      if (!examIdFromUrl) missingInfo.push("Exam ID");
      if (!supabase) missingInfo.push("Supabase client");
      if (!studentUserId) missingInfo.push("Student details");
      setPageError(`${missingInfo.join(', ')} unavailable for exam data fetch.`);
      setPageIsLoading(false);
      return;
    }

    console.log(`[ExamSessionPage] Fetching exam data for examId: ${examIdFromUrl}, studentId: ${studentUserId}`);
    setPageIsLoading(true); 
    setPageError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, start_time, end_time, status')
        .eq('exam_id', examIdFromUrl)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      // Consider serverTimeOffset for status calculation
      const nowWithOffset = new Date(Date.now() - serverTimeOffset);
      const effectiveStatus = getEffectiveExamStatus(currentExam, nowWithOffset); 
      console.log("[ExamSessionPage] Fetched Exam Data:", currentExam, "Effective Status (with offset):", effectiveStatus);

      if (effectiveStatus !== 'Ongoing') {
         setPageError(`This exam is currently ${effectiveStatus.toLowerCase()} and cannot be taken. Please close this tab.`);
         setExamDetails(currentExam); 
         setQuestions([]);
         setPageIsLoading(false);
         return;
      }

      if (!currentExam.questions || currentExam.questions.length === 0) {
        setPageError("This exam has no questions. Please contact your teacher and close this tab.");
        setExamDetails(currentExam);
        setQuestions([]);
        setPageIsLoading(false);
        return;
      }

      setExamDetails(currentExam);
      setQuestions(currentExam.questions || []);
      
      // TODO: Create or update ExamSubmissionsX record on exam start
      // Check if a submission for this exam_id and student_user_id already exists with status 'In Progress'
      // If yes, load answers. If no, create new.
      // For now, we assume a fresh start.
      console.log("[ExamSessionPage] TODO: Create/Update ExamSubmissionsX record for student:", studentUserId, "exam:", examIdFromUrl);

    } catch (e: any) {
      console.error("[ExamSessionPage] Error fetching exam data:", e.message);
      setPageError(e.message || "Failed to load exam data. You may close this tab.");
      setQuestions([]);
      setExamDetails(null);
    } finally {
      setPageIsLoading(false);
    }
  }, [examIdFromUrl, supabase, studentUserId, serverTimeOffset]);

  useEffect(() => {
    console.log("[ExamSessionPage] Exam data fetch effect. IsValidSession:", isValidSession, "ExamDetails:", !!examDetails, "PageError:", pageError, "pageIsLoading:", pageIsLoading);
    if (isValidSession === true) { 
        if (!examDetails && !pageError && pageIsLoading) { 
            console.log("[ExamSessionPage] Valid session, fetching exam data.");
            fetchExamData();
        } else if (examDetails || pageError) {
             console.log("[ExamSessionPage] Exam data already fetched or error exists, ensuring pageIsLoading is false.");
            if(pageIsLoading) setPageIsLoading(false); 
        }
    } else if (isValidSession === false && pageIsLoading) {
        console.log("[ExamSessionPage] Session explicitly invalid, ensuring pageIsLoading is false.");
        setPageIsLoading(false);
    }
  }, [isValidSession, examIdFromUrl, fetchExamData, examDetails, pageError, pageIsLoading]);


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
        // score would be calculated on server or by teacher later
    };

    console.log("[ExamSessionPage] Submitting exam. Data:", submissionData);
    try {
        // Upsert to handle potential existing 'In Progress' submission
        const { error: submissionError } = await supabase
            .from('ExamSubmissionsX')
            .upsert(submissionData, { onConflict: 'exam_id, student_user_id' })
            .eq('exam_id', examDetails.exam_id) // Ensure upsert targets correctly
            .eq('student_user_id', studentUserId);

        if (submissionError) { 
          console.error("[ExamSessionPage] Submission Error:", submissionError);
          toast({ title: "Submission Error", description: submissionError.message, variant: "destructive" });
          throw submissionError; 
        }
        toast({ title: "Exam Submitted!", description: "Your responses have been recorded. You can close this tab now." });
    } catch(e) {
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
    };
    
    console.log("[ExamSessionPage] Time up. Auto-submitting exam. Data:", submissionData);
    try {
        const { error: submissionError } = await supabase
            .from('ExamSubmissionsX')
            .upsert(submissionData, { onConflict: 'exam_id, student_user_id' })
            .eq('exam_id', examDetails.exam_id)
            .eq('student_user_id', studentUserId);

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

  if (authIsLoading || isValidSession === undefined || (isValidSession && pageIsLoading && !examDetails && !pageError)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4 text-center">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <h2 className="text-xl font-medium text-slate-200 mb-1">Preparing Your Exam Session...</h2>
        <p className="text-sm text-slate-400">
          {authIsLoading ? "Authenticating session..." : 
           isValidSession === undefined ? "Validating exam token..." :
           pageIsLoading && !examDetails && !pageError ? "Loading exam content..." : 
           "Please wait."}
        </p>
         {/* Add a warning about the demo crypto key */}
        <Alert variant="destructive" className="mt-8 max-w-md bg-destructive/20 border-destructive/30 text-destructive-foreground">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <AlertTitle className="font-semibold">Security Notice (Development)</AlertTitle>
            <AlertDescription className="text-xs">
                This exam session uses demo-level encryption for URL parameters. 
                For production, ensure robust key management.
            </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (pageError && (!examDetails || (examDetails && questions.length === 0 && !pageIsLoading)) ) { 
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
  
  if (!examDetails && !pageIsLoading) {
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

  // This case should be caught by pageError with "no questions" message
  if (examDetails && (!questions || questions.length === 0) && !pageIsLoading && !pageError) {
      setPageError("This exam has no questions. Please contact your teacher and close this tab.");
      // Re-render will show the error screen
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
      parentIsLoading={pageIsLoading && !examDetails} 
      examLoadingError={pageError} 
      persistentError={null} 
      cantStartReason={pageError}
      onAnswerChange={ (qid, oid) => console.log(`[ExamSessionPage] Answer changed Q:${qid} O:${oid}`) }
      onSubmitExam={handleSubmitExamActual}
      onTimeUp={handleTimeUpActual}
      isDemoMode={false}
      userIdForActivityMonitor={studentUserId || 'anonymous_student_session'}
      studentName={studentName}
      studentRollNumber={studentUserId} 
      studentAvatarUrl={studentAvatarUrl}
      examStarted={true}
    />
  );
}

