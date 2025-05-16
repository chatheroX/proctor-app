
// src/app/seb/live-test/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam, Question, ExamSubmissionInsert, FlaggedEvent } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { ExamTakingInterface } from '@/components/shared/exam-taking-interface';
import { Loader2, AlertTriangle, ShieldAlert, ServerCrash, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { decryptData } from '@/lib/crypto-utils';
import { isSebEnvironment, attemptBlockShortcuts, disableContextMenu, disableCopyPaste } from '@/lib/seb-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const TOKEN_VALIDITY_MINUTES_SEB = 10; // Token for SEB launch should still be somewhat short-lived

interface DecryptedTokenPayload {
  examId: string;
  studentId: string;
  timestamp: number;
  examCode: string; // examCode might not be strictly needed here if examId is primary
}

export default function SebLiveTestPage() {
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

  const examIdFromUrl = searchParams.get('examId');
  const encryptedTokenFromUrl = searchParams.get('token');

  useEffect(() => {
    setIsClientSide(true);
  }, []);

  // Step 1: SEB Environment Check & Token Validation
  useEffect(() => {
    if (!isClientSide || authLoading) return;

    console.log("[SebLiveTest] Initializing. SEB Check, Token Validation.");

    if (!isSebEnvironment()) {
      setPageError("CRITICAL: Not in SEB environment. This page is restricted.");
      toast({ title: "SEB Required", description: "Redirecting...", variant: "destructive" });
      setTimeout(() => router.replace('/unsupported-browser'), 2000);
      setIsValidSession(false); // Explicitly set invalid
      setPageIsLoading(false);
      return;
    }
    console.log("[SebLiveTest] SEB environment confirmed.");

    if (!examIdFromUrl || !encryptedTokenFromUrl) {
      setPageError("Missing exam ID or session token in URL. Cannot proceed.");
      setIsValidSession(false);
      setPageIsLoading(false);
      return;
    }
    
    if (!studentUser || !studentUser.user_id) {
      setPageError("Student authentication details missing. Cannot validate exam session.");
      setIsValidSession(false);
      setPageIsLoading(false);
      return;
    }
    
    decryptData<DecryptedTokenPayload>(encryptedTokenFromUrl)
      .then(payload => {
        if (!payload) throw new Error("Invalid or corrupt session token.");
        if (payload.examId !== examIdFromUrl) throw new Error("Token-Exam ID mismatch.");
        if (payload.studentId !== studentUser.user_id) throw new Error("Token-Student ID mismatch.");
        
        const tokenAgeMinutes = (Date.now() - payload.timestamp) / (1000 * 60);
        if (tokenAgeMinutes > TOKEN_VALIDITY_MINUTES_SEB) {
          throw new Error(`SEB session link expired. Please re-initiate.`);
        }
        console.log("[SebLiveTest] Token decrypted and validated for live test.");
        setIsValidSession(true);
        setPageError(null);
        // Fetch exam data will be triggered by the next effect if session is valid
      })
      .catch((e: any) => {
        setPageError(`Session validation failed: ${e.message}. SEB will attempt to quit.`);
        toast({ title: "Session Error", description: e.message, variant: "destructive", duration: 7000 });
        setIsValidSession(false);
        setPageIsLoading(false);
        setTimeout(() => { window.location.href = "seb://quit"; }, 6000);
      });
  }, [isClientSide, authLoading, examIdFromUrl, encryptedTokenFromUrl, studentUser, router, toast]);


  // Step 2: Fetch Exam Data if session is valid
  const fetchExamData = useCallback(async () => {
    if (!examIdFromUrl || !supabase || !studentUser?.user_id || isValidSession === false) {
      if (isValidSession !== false) setPageError("Cannot fetch exam: Critical information missing or invalid session.");
      setPageIsLoading(false);
      return;
    }
    
    console.log(`[SebLiveTest] Fetching exam data for examId: ${examIdFromUrl}`);
    setPageIsLoading(true);
    setPageError(null); // Clear previous errors before fetch attempt
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, start_time, end_time, status')
        .eq('exam_id', examIdFromUrl)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found in database.");

      const currentExam = data as Exam;
      // TODO: Re-check effectiveStatus against server time if critical for live test page
      // For now, assume /seb/exam-view has already gate-kept this.

      if (!currentExam.questions || currentExam.questions.length === 0) {
        throw new Error("This exam has no questions. Please contact your teacher.");
      }

      setExamDetails(currentExam);
      setQuestions(currentExam.questions || []);
      console.log("[SebLiveTest] Exam data fetched successfully.");

      // Upsert 'In Progress' submission record
      const { error: submissionUpsertError } = await supabase
        .from('ExamSubmissionsX')
        .upsert({
            exam_id: currentExam.exam_id,
            student_user_id: studentUser.user_id,
            status: 'In Progress',
            started_at: new Date().toISOString()
        }, { onConflict: 'exam_id, student_user_id', ignoreDuplicates: false }) // `ignoreDuplicates: false` ensures it updates if exists
        .select();
      
      if (submissionUpsertError) {
        console.error("[SebLiveTest] Error upserting 'In Progress' submission:", submissionUpsertError);
        // Non-fatal for starting exam, but log it
        toast({title: "Warning", description: "Could not record exam start time. Proceeding with exam.", variant: "default"});
      } else {
        console.log("[SebLiveTest] 'In Progress' submission recorded/updated for student:", studentUser.user_id);
      }


    } catch (e: any) {
      console.error("[SebLiveTest] Error fetching exam data:", e.message);
      setPageError(e.message || "Failed to load exam data.");
      setQuestions([]);
      setExamDetails(null);
    } finally {
      setPageIsLoading(false);
    }
  }, [examIdFromUrl, supabase, studentUser, isValidSession, toast]);

  useEffect(() => {
    if (isValidSession === true) {
        fetchExamData();
    }
  }, [isValidSession, fetchExamData]);


  // Step 3: Add SEB-specific event listeners for security
  useEffect(() => {
    if (!isClientSide || !isSebEnvironment()) return; // Only if in SEB

    console.log("[SebLiveTest] Adding SEB security event listeners.");
    document.addEventListener('contextmenu', disableContextMenu);
    window.addEventListener('keydown', attemptBlockShortcuts);
    document.addEventListener('copy', disableCopyPaste);
    document.addEventListener('paste', disableCopyPaste);
    // Try to prevent refresh/back
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
        console.warn("[SebLiveTest] Attempt to unload/refresh page blocked (simulated).");
        event.preventDefault();
        event.returnValue = ''; // For older browsers
    };
    window.addEventListener('beforeunload', beforeUnloadHandler);


    return () => {
      console.log("[SebLiveTest] Removing SEB security event listeners.");
      document.removeEventListener('contextmenu', disableContextMenu);
      window.removeEventListener('keydown', attemptBlockShortcuts);
      document.removeEventListener('copy', disableCopyPaste);
      document.removeEventListener('paste', disableCopyPaste);
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    };
  }, [isClientSide]);


  const handleActualSubmit = async (answers: Record<string, string>, flaggedEvents: FlaggedEvent[], submissionType: 'submit' | 'timeup') => {
    if (!studentUser?.user_id || !examDetails) {
        toast({title: "Submission Error", description: "Student or Exam details missing.", variant: "destructive"});
        return;
    }
    
    const submissionData: ExamSubmissionInsert = {
        exam_id: examDetails.exam_id,
        student_user_id: studentUser.user_id,
        answers: answers as any, 
        flagged_events: flaggedEvents.length > 0 ? flaggedEvents as any : null,
        status: 'Completed',
        submitted_at: new Date().toISOString(),
        // score would be calculated on server or by teacher later
    };

    console.log(`[SebLiveTest] ${submissionType === 'submit' ? 'Submitting' : 'Auto-submitting'} exam. Data:`, submissionData);
    try {
        const { error: submissionError } = await supabase
            .from('ExamSubmissionsX')
            .update({ // Update the existing 'In Progress' record
                answers: submissionData.answers,
                flagged_events: submissionData.flagged_events,
                status: 'Completed',
                submitted_at: submissionData.submitted_at,
             })
            .eq('exam_id', examDetails.exam_id)
            .eq('student_user_id', studentUser.user_id);

        if (submissionError) { 
          console.error("[SebLiveTest] Submission Error:", submissionError);
          toast({ title: "Submission Error", description: `Failed to save exam: ${submissionError.message}`, variant: "destructive", duration: 7000 });
        } else {
          toast({ title: submissionType === 'submit' ? "Exam Submitted!" : "Exam Auto-Submitted!", description: "Your responses recorded. SEB will now quit.", duration: 7000 });
        }
    } catch(e: any) {
        console.error("[SebLiveTest] Catch block for submission error", e);
        toast({ title: "Critical Submission Error", description: "An unexpected error occurred while submitting. Please contact support.", variant: "destructive", duration: 7000 });
    } finally {
        // Quit SEB regardless of submission success to prevent re-attempts on error.
        // The actual record state determines if it was saved.
        setTimeout(() => { window.location.href = "seb://quit"; }, 6000);
    }
  };

  const handleSubmitExamSeb = (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    return handleActualSubmit(answers, flaggedEvents, 'submit');
  };
  const handleTimeUpSeb = (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => {
    return handleActualSubmit(answers, flaggedEvents, 'timeup');
  };


  if (pageIsLoading || isValidSession === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4 text-center">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <h2 className="text-xl font-medium text-slate-200 mb-1">
          {isValidSession === undefined ? "Validating SEB Session..." : "Loading Live Exam..."}
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
             <Button onClick={() => window.location.href="seb://quit"} className="w-full btn-gradient-destructive">Exit SEB</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!examDetails) { // Should be caught by pageError usually
     return (
       <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Exam Data Not Available</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">Could not load the exam content. SEB will quit.</p>
             <Button onClick={() => window.location.href="seb://quit"} className="w-full btn-gradient-destructive">Exit SEB</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ExamTakingInterface
      examDetails={examDetails}
      questions={questions || []}
      parentIsLoading={false} // Loading is handled by this page
      examLoadingError={null}  // Errors are handled by this page
      persistentError={null} 
      cantStartReason={null} // Initial checks done in /seb/exam-view
      onAnswerChange={ (qid, oid) => console.log(`[SebLiveTest] Answer changed Q:${qid} O:${oid}`) } // Basic logging
      onSubmitExam={handleSubmitExamSeb}
      onTimeUp={handleTimeUpSeb}
      isDemoMode={false} // This is the live SEB test
      userIdForActivityMonitor={studentUser?.user_id || 'unknown_seb_student'}
      studentName={studentUser?.name}
      studentRollNumber={studentUser?.user_id} 
      studentAvatarUrl={studentUser?.avatar_url}
      examStarted={true} // If this page loads successfully, exam is considered started
    />
  );
}
    