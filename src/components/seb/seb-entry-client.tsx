
// src/components/seb/seb-entry-client.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, PlayCircle, ShieldCheck, XCircle, Info, LogOut, ServerCrash } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns';
import { isSebEnvironment, isOnline, areDevToolsLikelyOpen, isWebDriverActive, isVMLikely } from '@/lib/seb-utils';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';

interface ValidatedSessionData {
  student_user_id: string;
  exam_id: string;
  student_name?: string; 
}

export function SebEntryClient() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [sessionData, setSessionData] = useState<ValidatedSessionData | null>(null);
  const [performingChecks, setPerformingChecks] = useState(false);
  const [examLocallyStarted, setExamLocallyStarted] = useState(false); 
  const [currentStatusMessage, setCurrentStatusMessage] = useState("Initializing secure session...");
  const [entryTokenFromHash, setEntryTokenFromHash] = useState<string | null>(null);

  const handleExitSeb = useCallback(() => {
    toast({ title: "Exiting SEB", description: "Safe Exam Browser will attempt to close.", duration: 3000 });
    if (typeof window !== 'undefined') window.location.href = "seb://quit";
  }, [toast]);

  // Step 1: Check SEB environment and parse entryToken from window.location.hash
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setCurrentStatusMessage("Verifying SEB environment...");

    if (typeof window === 'undefined') {
      // Should not happen in a client component, but as a guard
      setError("CRITICAL: Window object not found. Cannot proceed.");
      setIsLoading(false);
      return;
    }

    if (!isSebEnvironment()) {
      setError("CRITICAL: This page must be accessed within Safe Exam Browser.");
      toast({ title: "SEB Required", description: "Redirecting to unsupported browser page...", variant: "destructive", duration: 5000 });
      // Redirect to a generic unsupported page, as this page shouldn't be reachable outside SEB.
      setTimeout(() => router.replace('/unsupported-browser'), 4000); 
      setIsLoading(false);
      return;
    }
    console.log("[SebEntryClient] SEB Environment Confirmed.");
    setCurrentStatusMessage("Extracting entry token from URL hash...");

    const hash = window.location.hash.substring(1); // Remove #
    const params = new URLSearchParams(hash);
    const token = params.get('entryToken');

    if (!token) {
      const errMsg = "Exam entry token missing from URL hash. Cannot start exam. Please re-initiate from the dashboard. SEB will quit.";
      console.error("[SebEntryClient] Error:", errMsg, "Current hash:", window.location.hash);
      setError(errMsg);
      toast({ title: "Invalid Session", description: "Token missing from URL hash. Quitting SEB.", variant: "destructive", duration: 8000 });
      setTimeout(handleExitSeb, 7000);
      setIsLoading(false);
      return;
    }
    
    console.log("[SebEntryClient] Entry token found in hash:", token);
    setEntryTokenFromHash(token);
    // Proceed to next step (token validation) in the following useEffect
    // setIsLoading(false) will be handled after token validation attempt
  }, [router, toast, handleExitSeb]);


  // Step 2: Validate Entry Token (from hash) via API
  useEffect(() => {
    if (!entryTokenFromHash) {
        // If still loading or error already set from previous step, do nothing here.
        if (isLoading && !error) { 
          // This indicates the previous step to get token hasn't completed or failed silently
          // However, isLoading true should show loader, so this branch might not be hit if error is set.
        }
      return;
    }
    
    // Ensure we are not already in an error state or loading from a previous step
    if (error) {
      setIsLoading(false); // Ensure loader stops if an error was set before token validation
      return;
    }

    setCurrentStatusMessage("Validating entry token via API...");
    console.log("[SebEntryClient] Validating entry token from hash via API:", entryTokenFromHash);

    fetch('/api/seb/validate-entry-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: entryTokenFromHash }),
    })
    .then(async res => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to parse error response from token validation.' }));
        throw new Error(errData.error || `Token validation failed with status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      console.log("[SebEntryClient] Token validated successfully by API. Session data:", data);
      setSessionData({ student_user_id: data.student_user_id, exam_id: data.exam_id });
      setCurrentStatusMessage("Fetching exam and student details...");
      // Fetching details will happen in the next useEffect dependent on sessionData
    })
    .catch(e => {
      console.error("[SebEntryClient] Entry token validation API error:", e);
      setError(`Entry token validation failed: ${e.message}. SEB will quit.`);
      toast({ title: "Invalid Session", description: `Token error: ${e.message}. Quitting SEB.`, variant: "destructive", duration: 8000 });
      setTimeout(handleExitSeb, 7000);
    })
    .finally(() => {
      // setIsLoading(false) will be managed by the next effect that fetches exam details,
      // or if an error occurred here, it's already handled.
    });
  }, [entryTokenFromHash, toast, handleExitSeb, isLoading, error]); // Added isLoading and error

  // Step 3: Fetch exam and student details once sessionData is available
  useEffect(() => {
    if (!sessionData?.exam_id || !sessionData?.student_user_id) {
        // If still loading from token validation, or error already set, do nothing here
        if (isLoading && !error && sessionData === null && entryTokenFromHash) {
           // This means token validation is in progress or just finished and sessionData is not yet set
        } else if (!isLoading && sessionData === null && entryTokenFromHash && !error) {
           // Token validation might have failed to set sessionData without explicit error, or is stuck.
           // This scenario should ideally be caught by the error handling in token validation.
           // For safety, if we reach here and sessionData is still null after loading, set an error.
           // setError("Failed to retrieve session details after token validation. SEB will quit.");
           // setTimeout(handleExitSeb, 7000);
        }
      return;
    }

    // Ensure we are not already in an error state
    if (error) {
        setIsLoading(false);
        return;
    }

    console.log("[SebEntryClient] Fetching exam and student details for exam_id:", sessionData.exam_id, "student_user_id:", sessionData.student_user_id);
    setCurrentStatusMessage("Fetching exam and student details...");

    Promise.all([
      supabase.from('ExamX').select('*').eq('exam_id', sessionData.exam_id).single(),
      supabase.from('proctorX').select('name').eq('user_id', sessionData.student_user_id).single()
    ])
    .then(([examRes, studentRes]) => {
      if (examRes.error || !examRes.data) {
        throw new Error(examRes.error?.message || "Exam not found.");
      }
      if (studentRes.error || !studentRes.data) {
        console.warn("[SebEntryClient] Student name not found for ID:", sessionData.student_user_id, studentRes.error?.message);
        // Proceed without student name, use a default.
      }
      setExamDetails(examRes.data as Exam);
      setSessionData(prev => prev ? ({ ...prev, student_name: studentRes.data?.name || "Student" }) : null);
      console.log("[SebEntryClient] Exam details fetched:", examRes.data, "Student name:", studentRes.data?.name || "Student");
      setCurrentStatusMessage("Exam details loaded. Ready for system checks.");
      setError(null); 
    })
    .catch(e => {
      console.error("[SebEntryClient] Error fetching exam/student details:", e);
      setError(`Failed to load exam information: ${e.message}. SEB will quit.`);
      toast({ title: "Exam Load Error", description: e.message, variant: "destructive", duration: 8000 });
      setTimeout(handleExitSeb, 7000);
    })
    .finally(() => setIsLoading(false)); // This is the main point where isLoading should become false after all setup
  }, [sessionData?.exam_id, sessionData?.student_user_id, supabase, toast, handleExitSeb, error, isLoading, entryTokenFromHash]);


  const handleStartSystemChecksAndExam = useCallback(async () => {
    if (!examDetails || !sessionData?.student_user_id || !entryTokenFromHash) {
      setError("Cannot start: Missing exam details, student session, or token information.");
      return;
    }
    setPerformingChecks(true);
    setCurrentStatusMessage("Performing system checks...");
    setError(null);
    console.log("[SebEntryClient] Performing system checks...");

    const checks = [
      { label: "SEB Environment", pass: isSebEnvironment(), details: isSebEnvironment() ? "Confirmed" : "Not in SEB!" },
      { label: "Internet Connectivity", pass: isOnline(), details: isOnline() ? "Online" : "Offline!" },
      { label: "Developer Tools", pass: !areDevToolsLikelyOpen(), details: areDevToolsLikelyOpen() ? "Potentially Open" : "Not Detected" },
      { label: "WebDriver/Automation", pass: !isWebDriverActive(), details: isWebDriverActive() ? "Detected" : "Not Detected" },
      { label: "Virtual Machine", pass: !isVMLikely(), details: isVMLikely() ? "Potentially Detected" : "Not Detected" },
    ];
    
    const failedChecks = checks.filter(check => !check.pass);
    const allPass = failedChecks.length === 0;

    if (allPass) {
      toast({ title: "System Checks Passed!", description: "Proceeding to live exam environment.", duration: 3000 });
      router.push(`/seb/live-test?examId=${examDetails.exam_id}&studentId=${sessionData.student_user_id}`);
    } else {
      const errorMessages = failedChecks.map(fc => `${fc.label}: ${fc.details || 'Failed'}`).join('; ');
      setError(`System integrity checks failed: ${errorMessages}. Cannot start exam. SEB will quit.`);
      toast({ title: "System Checks Failed", description: errorMessages + ". Quitting SEB.", variant: "destructive", duration: 10000 });
      setTimeout(handleExitSeb, 9000);
    }
    setPerformingChecks(false);
  }, [examDetails, sessionData, entryTokenFromHash, router, toast, handleExitSeb]);

  useEffect(() => {
    if (examDetails?.exam_id && typeof window !== 'undefined') {
      const examFinishedFlag = sessionStorage.getItem(`exam-${examDetails.exam_id}-finished`);
      if (examFinishedFlag === 'true') {
        setExamLocallyStarted(true); 
        setError(null); 
        setIsLoading(false);
      }
    }
  }, [examDetails?.exam_id]);


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <h2 className="text-xl font-medium text-slate-200 mb-2">
          {currentStatusMessage}
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-destructive">
        <CardHeader className="pt-8 pb-4">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-5" />
          <CardTitle className="text-2xl text-destructive">Exam Access Error</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground mb-6">{error}</p>
          <Button onClick={handleExitSeb} className="w-full btn-gradient-destructive">
            Exit SEB
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  if (examLocallyStarted && examDetails) { 
    return (
         <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-green-500">
            <CardHeader className="pt-8 pb-4">
                <ShieldCheck className="h-16 w-16 text-green-500 mx-auto mb-5" />
                <CardTitle className="text-2xl text-green-400">Exam Session Concluded</CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
                <p className="text-sm text-muted-foreground mb-6">
                    Your session for the exam "{examDetails.title}" has finished.
                </p>
                <Button onClick={handleExitSeb} className="w-full btn-gradient-positive">
                    Exit SEB
                </Button>
            </CardContent>
        </Card>
    );
  }

  if (!examDetails || !sessionData?.student_name) { 
    return (
      <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg">
        <CardHeader className="pt-8 pb-4">
          <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-5" />
          <CardTitle className="text-2xl text-slate-300">{currentStatusMessage || "Loading exam information..."}</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground">Please wait while we finalize details for your exam. If this takes too long, there might be an issue with the exam setup or your connection.</p>
        </CardContent>
      </Card>
    );
  }
  
  const effectiveStatus = getEffectiveExamStatus(examDetails);
  const canStartExam = effectiveStatus === 'Ongoing';
  const examEnded = effectiveStatus === 'Completed';
  const examNotReadyForStart = (!examDetails.questions || examDetails.questions.length === 0);

  return (
    <Card className="w-full max-w-2xl modern-card shadow-2xl bg-card/90 backdrop-blur-xl border-border/30">
      <CardHeader className="text-center border-b border-border/20 pb-6">
        <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
        <CardTitle className="text-3xl font-bold text-foreground">{examDetails.title}</CardTitle>
        <CardDescription className="text-muted-foreground mt-2">
          Student: {sessionData.student_name} (ID: {sessionData.student_user_id})
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <Alert variant="default" className="bg-blue-900/30 border-blue-700 text-blue-300">
          <Info className="h-5 w-5 text-blue-400" />
          <AlertTitle className="font-semibold text-blue-300">Exam Instructions</AlertTitle>
          <AlertDescription className="text-blue-400/90 text-sm">
            This exam must be taken in Safe Exam Browser. Ensure you are in a quiet environment.
            Activity is monitored. Do not attempt to exit SEB or switch applications.
            The timer starts once you click "Start Exam".
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg bg-slate-800/40 text-slate-300">
          <div><p className="font-medium text-slate-400">Duration:</p><p className="font-semibold">{examDetails.duration} minutes</p></div>
          <div><p className="font-medium text-slate-400">Questions:</p><p className="font-semibold">{examDetails.questions?.length || 0}</p></div>
          <div><p className="font-medium text-slate-400">Status:</p><p className="font-semibold">{effectiveStatus}</p></div>
           {examDetails.start_time && isValid(parseISO(examDetails.start_time)) && <div><p className="font-medium text-slate-400">Starts:</p><p className="font-semibold">{format(parseISO(examDetails.start_time), "dd MMM yyyy, hh:mm a")}</p></div>}
        </div>
         {performingChecks && (
            <div className="text-center p-4">
                <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-2" />
                <p className="text-slate-300">Performing system checks...</p>
            </div>
        )}

      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 p-6 border-t border-border/20">
        <Button variant="outline" onClick={handleExitSeb} className="btn-outline-subtle text-slate-300 border-slate-600 hover:bg-slate-700 w-full sm:w-auto order-2 sm:order-1">
          <LogOut className="mr-2 h-4 w-4" /> Exit SEB
        </Button>
        {examEnded ? (
            <Badge variant="destructive" className="px-4 py-2 text-base bg-red-700 text-white order-1 sm:order-2">This Exam Has Ended</Badge>
        ) : (
          <Button 
            onClick={handleStartSystemChecksAndExam} 
            className="btn-primary-solid w-full sm:w-auto py-3 text-base order-1 sm:order-2"
            disabled={isLoading || performingChecks || !canStartExam || examNotReadyForStart}
          >
            {performingChecks || isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
            {examNotReadyForStart ? "No Questions in Exam" :
             !canStartExam ? `Exam is ${effectiveStatus}` : 
             "Start Exam & System Checks"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
