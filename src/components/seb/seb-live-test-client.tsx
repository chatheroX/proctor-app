
// src/components/seb/seb-live-test-client.tsx
'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react'; // Added Suspense
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam, Question, ExamSubmissionInsert, FlaggedEvent } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle, ShieldAlert, ServerCrash, XCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { decryptData } from '@/lib/crypto-utils';
import { isSebEnvironment, attemptBlockShortcuts, disableContextMenu, disableCopyPaste, isOnline, areDevToolsLikelyOpen, isWebDriverActive } from '@/lib/seb-utils';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const TOKEN_VALIDITY_MINUTES_SEB = 15;

interface DecryptedTokenPayload {
  examId: string;
  studentId: string;
  timestamp: number;
  examCode: string;
}

export function SebLiveTestClient() {
  const router = useRouter();
  const searchParams = useSearchParams(); 
  const { user: studentUser, isLoading: authLoading } = useAuth();
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pageIsLoading, setPageIsLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [isValidSession, setIsValidSession] = useState<boolean | undefined>(undefined);
  const [isClientSide, setIsClientSide] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const examIdFromUrl = searchParams?.get('examId'); 
  const encryptedTokenFromUrl = searchParams?.get('token');

  useEffect(() => {
    setIsClientSide(true);
  }, []);

  // Step 1: SEB Environment Check & Token Validation & Initial Security Listeners
  useEffect(() => {
    if (!isClientSide || authLoading || !examIdFromUrl || !encryptedTokenFromUrl) {
      if (isClientSide && !authLoading && (!examIdFromUrl || !encryptedTokenFromUrl) && pageIsLoading && !pageError) {
        setPageError("Exam ID or session token missing from URL. Invalid entry point.");
        setIsValidSession(false);
        setPageIsLoading(false);
      }
      return;
    }

    console.log("[SebLiveTestClient] Initializing. SEB Check, Token Validation.");

    if (!isSebEnvironment()) {
      setPageError("CRITICAL: Not in SEB environment. This page is restricted.");
      toast({ title: "SEB Required", description: "Redirecting to unsupported browser page...", variant: "destructive", duration: 4000 });
      setTimeout(() => router.replace('/unsupported-browser'), 3000);
      setIsValidSession(false);
      setPageIsLoading(false);
      return;
    }
    // Check other immediate security concerns. More checks can be added.
    if (!isOnline() || areDevToolsLikelyOpen() || isWebDriverActive()) {
        setPageError("Critical system integrity check failed. Cannot proceed with exam. SEB will quit.");
        toast({ title: "Security Alert", description: "System integrity compromised.", variant: "destructive", duration: 7000});
        setIsValidSession(false);
        setPageIsLoading(false);
        setTimeout(() => { if(typeof window !== 'undefined') window.location.href = "seb://quit"; }, 6000);
        return;
    }
    console.log("[SebLiveTestClient] SEB environment and basic integrity confirmed.");
    
    if (!studentUser || !studentUser.user_id) {
      setPageError("Student authentication details missing. Cannot validate exam session. SEB will quit.");
      toast({ title: "Auth Error", description: "Student session invalid.", variant: "destructive", duration: 7000 });
      setIsValidSession(false);
      setPageIsLoading(false);
      setTimeout(() => { if(typeof window !== 'undefined') window.location.href = "seb://quit"; }, 6000);
      return;
    }
    
    decryptData<DecryptedTokenPayload>(encryptedTokenFromUrl)
      .then(payload => {
        if (!payload) throw new Error("Invalid or corrupt session token from URL.");
        if (payload.examId !== examIdFromUrl) throw new Error("Token-Exam ID mismatch in URL.");
        if (payload.studentId !== studentUser.user_id) throw new Error("Token-Student ID mismatch.");
        
        const tokenAgeMinutes = (Date.now() - payload.timestamp) / (1000 * 60);
        if (tokenAgeMinutes > TOKEN_VALIDITY_MINUTES_SEB) {
          throw new Error('SEB live session link expired. Please re-initiate.');
        }
        console.log("[SebLiveTestClient] Token decrypted and validated for live test.");
        setIsValidSession(true);
        setPageError(null);
      })
      .catch((e: any) => {
        const errorMsg = 'Live session validation failed: ' + e.message + '. SEB will attempt to quit.';
        setPageError(errorMsg);
        toast({ title: "Session Error", description: errorMsg, variant: "destructive", duration: 7000 });
        setIsValidSession(false);
        setPageIsLoading(false);
        setTimeout(() => { if(typeof window !== 'undefined') window.location.href = "seb://quit"; }, 6000);
      });
  }, [isClientSide, authLoading, examIdFromUrl, encryptedTokenFromUrl, studentUser, router, toast, pageIsLoading, pageError]);


  // Step 2: Fetch Exam Data if session is valid
  const fetchExamData = useCallback(async () => {
    if (!examIdFromUrl || !supabase || !studentUser?.user_id || isValidSession === false) {
      if (isValidSession !== false && !pageError) setPageError("Cannot fetch exam: Critical information missing or invalid session.");
      setPageIsLoading(false);
      return;
    }
    
    console.log('[SebLiveTestClient] Fetching exam data for examId: ' + examIdFromUrl);
    setPageIsLoading(true);
    setPageError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, start_time, end_time, status')
        .eq('exam_id', examIdFromUrl)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found in database.");

      const currentExam = data as Exam;

      if (!currentExam.questions || currentExam.questions.length === 0) {
        throw new Error("This exam has no questions. Please contact your teacher.");
      }

      setExamDetails(currentExam);
      setQuestions(currentExam.questions || []);
      console.log("[SebLiveTestClient] Exam data fetched successfully.");

      const { error: submissionUpsertError } = await supabase
        .from('ExamSubmissionsX')
        .upsert({
            exam_id: currentExam.exam_id,
            student_user_id: studentUser.user_id,
            status: 'In Progress', // This will overwrite if they somehow re-enter
            started_at: new Date().toISOString()
        }, { onConflict: 'exam_id, student_user_id', ignoreDuplicates: false }) // Consider behavior on re-entry more carefully
        .select();
      
      if (submissionUpsertError) {
        console.error("[SebLiveTestClient] Error upserting 'In Progress' submission:", submissionUpsertError);
        toast({title: "Warning", description: "Could not record exam start time. Proceeding.", variant: "default"});
      } else {
        console.log("[SebLiveTestClient] 'In Progress' submission recorded/updated for student:", studentUser.user_id);
      }

    } catch (e: any) {
      console.error("[SebLiveTestClient] Error fetching exam data:", e.message);
      const errorMsg = e.message || "Failed to load exam data.";
      setPageError(errorMsg);
      toast({ title: "Exam Load Error", description: errorMsg, variant: "destructive", duration: 7000 });
      setQuestions([]);
      setExamDetails(null);
    } finally {
      setPageIsLoading(false);
    }
  }, [examIdFromUrl, supabase, studentUser, isValidSession, toast, pageError, setPageError, setPageIsLoading, setExamDetails, setQuestions]);

  useEffect(() => {
    if (isValidSession === true && !examDetails && !pageError) { // fetch only if session is valid and data not yet fetched
        fetchExamData();
    }
  }, [isValidSession, examDetails, pageError, fetchExamData]);


  // Step 3: Add SEB-specific event listeners for security
  useEffect(() => {
    if (!isClientSide || !isSebEnvironment() || !isValidSession) return;

    console.log("[SebLiveTestClient] Adding SEB security event listeners.");
    document.addEventListener('contextmenu', disableContextMenu);
    window.addEventListener('keydown', attemptBlockShortcuts);
    document.addEventListener('copy', disableCopyPaste);
    document.addEventListener('paste', disableCopyPaste);
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
        console.warn("[SebLiveTestClient] Attempt to unload/refresh page blocked.");
        toast({ title: "Navigation Blocked", description: "Page refresh/close is disabled during the exam.", variant:"destructive", duration: 3000 });
        event.preventDefault();
        event.returnValue = 'Are you sure you want to leave? Exam progress might be lost.'; // Standard message
        return event.returnValue;
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);

    return () => {
      console.log("[SebLiveTestClient] Removing SEB security event listeners.");
      document.removeEventListener('contextmenu', disableContextMenu);
      window.removeEventListener('keydown', attemptBlockShortcuts);
      document.removeEventListener('copy', disableCopyPaste);
      document.removeEventListener('paste', disableCopyPaste);
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, [isClientSide, isValidSession, toast]); // Added toast


  const handleActualSubmit = useCallback(async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[], submissionType: 'submit' | 'timeup') => {
    if (!studentUser?.user_id || !examDetails) {
        toast({title: "Submission Error", description: "Student or Exam details missing. Cannot submit.", variant: "destructive"});
        return;
    }
    
    const submissionData: ExamSubmissionInsert = {
        exam_id: examDetails.exam_id,
        student_user_id: studentUser.user_id,
        answers: answers as any, 
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed',
        submitted_at: new Date().toISOString(),
        // started_at is set when exam loads
    };

    console.log('[SebLiveTestClient] ' + (submissionType === 'submit' ? 'Submitting' : 'Auto-submitting') + ' exam. Data:', submissionData);
    try {
        const { error: submissionError } = await supabase
            .from('ExamSubmissionsX')
            .update({ 
                answers: submissionData.answers,
                flagged_events: submissionData.flagged_events,
                status: 'Completed',
                submitted_at: submissionData.submitted_at,
             })
            .eq('exam_id', examDetails.exam_id)
            .eq('student_user_id', studentUser.user_id);

        if (submissionError) { 
          console.error("[SebLiveTestClient] Submission Error:", submissionError);
          setPageError('Failed to save exam: ' + submissionError.message + ". Please contact support. SEB will quit.");
          toast({ title: "Submission Error", description: 'Failed to save exam: ' + submissionError.message, variant: "destructive", duration: 10000 });
        } else {
          setIsSubmitted(true); // Set submitted state to show success UI
          toast({ title: submissionType === 'submit' ? "Exam Submitted!" : "Exam Auto-Submitted!", description: "Your responses have been recorded. SEB will now quit.", duration: 10000 });
        }
    } catch(e: any) {
        console.error("[SebLiveTestClient] Catch block for submission error", e);
        setPageError("An unexpected critical error occurred while submitting. Please contact support. SEB will quit.");
        toast({ title: "Critical Submission Error", description: "An unexpected error occurred. SEB will quit.", variant: "destructive", duration: 10000 });
    } finally {
        // SEB quit will be handled by the success/error UI in the render block
    }
  }, [studentUser?.user_id, examDetails, supabase, toast, setIsSubmitted, setPageError]);

  const handleSubmitExamSeb = useCallback((answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    return handleActualSubmit(answers, flaggedEvents, 'submit');
  }, [handleActualSubmit]);

  const handleTimeUpSeb = useCallback((answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    return handleActualSubmit(answers, flaggedEvents, 'timeup');
  }, [handleActualSubmit]);

  const handleSebQuitFromInterface = useCallback(() => {
     toast({ title: "Exiting SEB", description: "Safe Exam Browser will close.", duration: 3000 });
     if (typeof window !== 'undefined') window.location.href = "seb://quit";
  },[toast]);


  if (pageIsLoading || isValidSession === undefined || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4 text-center">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <h2 className="text-xl font-medium text-slate-200 mb-1">
          {authLoading ? "Verifying Student Session..." :
           isValidSession === undefined ? "Validating Secure Exam Link..." : 
           "Loading Live Exam Environment..."}
        </h2>
         <ShieldAlert className="h-5 w-5 text-yellow-400 mt-4 inline-block mr-2" />
         <p className="text-sm text-yellow-400">Secure Exam Environment Active</p>
      </div>
    );
  }
  
  if (pageError || isValidSession === false) { 
     return (
       <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-700 to-red-900 p-4">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
          <CardHeader className="pt-8 pb-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Exam Session Error</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">{pageError || "Invalid exam session. SEB will quit."}</p>
             <Button onClick={handleSebQuitFromInterface} className="w-full btn-gradient-destructive">Exit SEB</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!examDetails) {
     return (
       <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-orange-500 mx-auto mb-5" />
            <CardTitle className="text-2xl text-orange-500">Exam Data Not Available</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">Could not load the exam content. This may be due to an invalid link or server issue. SEB will attempt to quit.</p>
             <Button onClick={handleSebQuitFromInterface} className="w-full btn-gradient-destructive">Exit SEB</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 backdrop-blur-md p-6 text-center">
        <Card className="w-full max-w-lg modern-card shadow-2xl p-8 bg-card/90 dark:bg-card/80">
          <CardHeader className="pb-5">
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-5" />
            <h2 className="text-2xl font-semibold text-foreground">Exam Submitted Successfully!</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              Your responses for "{examDetails.title}" have been recorded.
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">You may now exit Safe Exam Browser.</p>
          </CardContent>
          <CardFooter className="mt-6">
            <Button onClick={handleSebQuitFromInterface} className="btn-gradient-positive w-full py-3 text-base rounded-lg shadow-lg hover:shadow-primary/30">
                <LogOut className="mr-2 h-4 w-4"/> Exit SEB
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
      parentIsLoading={false} 
      examLoadingError={null} // Handled by this component's error states
      persistentError={null} 
      cantStartReason={null} // Start is implicit by reaching this page
      onAnswerChange={ (qid, oid) => console.log('[SebLiveTestClient] Answer changed Q:' + qid + ' O:' + oid) }
      onSubmitExam={handleSubmitExamSeb}
      onTimeUp={handleTimeUpSeb}
      isDemoMode={false} // This is the live SEB test
      userIdForActivityMonitor={studentUser?.user_id || 'unknown_seb_student'}
      studentName={studentUser?.name}
      studentRollNumber={studentUser?.user_id} 
      studentAvatarUrl={studentUser?.avatar_url}
      examStarted={true} // Exam starts when this component renders successfully
    />
  );
}
