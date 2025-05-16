
// src/components/seb/seb-entry-client.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, PlayCircle, ShieldCheck, XCircle, Info, LogOut } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, isValid, parseISO } from 'date-fns';
import { isSebEnvironment, isOnline, areDevToolsLikelyOpen, isWebDriverActive, isVMLikely } from '@/lib/seb-utils';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page'; // Re-use this

interface SebEntryClientProps {
  entryTokenFromPath: string | null; // From path param if URL is rewritten
}

interface ValidatedSessionData {
  student_user_id: string;
  exam_id: string;
  student_name?: string; // To be fetched
}

export function SebEntryClient({ entryTokenFromPath }: SebEntryClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [sessionData, setSessionData] = useState<ValidatedSessionData | null>(null);
  const [systemChecksPassed, setSystemChecksPassed] = useState(false);
  const [performingChecks, setPerformingChecks] = useState(false);
  const [examLocallyStarted, setExamLocallyStarted] = useState(false); // To show "Exam Finished" state

  const parseHashParams = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash.substring(1); // Remove #
    const params = new URLSearchParams(hash);
    return params.get('entryToken');
  }, []);

  // Step 1: Validate SEB environment and Entry Token
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    if (!isSebEnvironment()) {
      setError("CRITICAL: This page can only be accessed within Safe Exam Browser.");
      toast({ title: "SEB Required", description: "Redirecting to unsupported browser page...", variant: "destructive", duration: 5000 });
      setTimeout(() => router.replace('/unsupported-browser'), 4000);
      setIsLoading(false);
      return;
    }
    console.log("[SebEntryClient] SEB Environment Confirmed.");

    const tokenFromHash = parseHashParams();
    const currentToken = entryTokenFromPath || tokenFromHash;

    if (!currentToken) {
      setError("Exam entry token missing. Cannot start exam. Please re-initiate from the dashboard.");
      setIsLoading(false);
      return;
    }
    
    // Hide token from address bar if it was in hash
    if (tokenFromHash && !entryTokenFromPath) {
        router.replace(`/seb/entry/${tokenFromHash}`, { scroll: false });
        // The component will re-render with entryTokenFromPath set, skip current execution
        return; 
    }

    console.log("[SebEntryClient] Validating entry token:", currentToken);
    fetch('/api/seb/validate-entry-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentToken }),
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
      console.log("[SebEntryClient] Token validated. Session data:", data);
      setSessionData({ student_user_id: data.student_user_id, exam_id: data.exam_id });
    })
    .catch(e => {
      console.error("[SebEntryClient] Token validation API error:", e);
      setError(`Entry token validation failed: ${e.message}. SEB will quit.`);
      toast({ title: "Invalid Session", description: `Token error: ${e.message}. Quitting SEB.`, variant: "destructive", duration: 8000 });
      setTimeout(() => { if (typeof window !== 'undefined') window.location.href = "seb://quit"; }, 7000);
      setIsLoading(false);
    });
  }, [entryTokenFromPath, router, toast, parseHashParams]);

  // Step 2: Fetch exam and student details once sessionData is available
  useEffect(() => {
    if (!sessionData?.exam_id || !sessionData?.student_user_id) {
      if (sessionData) { // if sessionData is set but incomplete
        setError("Incomplete session data after token validation.");
        setIsLoading(false);
      }
      return;
    }
    console.log("[SebEntryClient] Fetching exam and student details for exam_id:", sessionData.exam_id);
    Promise.all([
      supabase.from('ExamX').select('*').eq('exam_id', sessionData.exam_id).single(),
      supabase.from('proctorX').select('name').eq('user_id', sessionData.student_user_id).single()
    ])
    .then(([examRes, studentRes]) => {
      if (examRes.error || !examRes.data) {
        throw new Error(examRes.error?.message || "Exam not found.");
      }
      if (studentRes.error || !studentRes.data) {
        // Non-critical if name is missing, but log it
        console.warn("[SebEntryClient] Student name not found for ID:", sessionData.student_user_id, studentRes.error?.message);
      }
      setExamDetails(examRes.data as Exam);
      setSessionData(prev => prev ? ({ ...prev, student_name: studentRes.data?.name || "Student" }) : null);
      console.log("[SebEntryClient] Exam details fetched:", examRes.data);
      setError(null);
    })
    .catch(e => {
      console.error("[SebEntryClient] Error fetching exam/student details:", e);
      setError(`Failed to load exam information: ${e.message}. SEB will quit.`);
      toast({ title: "Exam Load Error", description: e.message, variant: "destructive", duration: 8000 });
      setTimeout(() => { if (typeof window !== 'undefined') window.location.href = "seb://quit"; }, 7000);
    })
    .finally(() => setIsLoading(false));
  }, [sessionData?.exam_id, sessionData?.student_user_id, supabase, toast]);


  const handleStartSystemChecksAndExam = useCallback(async () => {
    if (!examDetails || !sessionData?.student_user_id) {
      setError("Cannot start: Missing exam details or student session information.");
      return;
    }
    setPerformingChecks(true);
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
    setSystemChecksPassed(allPass);

    if (allPass) {
      toast({ title: "System Checks Passed!", description: "Proceeding to live exam environment.", duration: 3000 });
      router.push(`/seb/live-test?examId=${examDetails.exam_id}&studentId=${sessionData.student_user_id}`);
    } else {
      const errorMessages = failedChecks.map(fc => `${fc.label}: ${fc.details || 'Failed'}`).join('; ');
      setError(`System integrity checks failed: ${errorMessages}. Cannot start exam. SEB will quit.`);
      toast({ title: "System Checks Failed", description: errorMessages + ". Quitting SEB.", variant: "destructive", duration: 10000 });
      setTimeout(() => { if (typeof window !== 'undefined') window.location.href = "seb://quit"; }, 9000);
    }
    setPerformingChecks(false);
  }, [examDetails, sessionData, router, toast]);

  const handleExitSeb = useCallback(() => {
    toast({ title: "Exiting SEB", description: "Safe Exam Browser will attempt to close.", duration: 3000 });
    if (typeof window !== 'undefined') window.location.href = "seb://quit";
  }, [toast]);

  useEffect(() => {
    // Check if exam was finished (e.g., user navigated back after submission)
    const examFinishedFlag = typeof window !== 'undefined' ? sessionStorage.getItem(`exam-${sessionData?.exam_id}-finished`) : null;
    if (examFinishedFlag === 'true') {
      setExamLocallyStarted(true); // Treat as started to show finished message
      setError(null); // Clear other errors
      setIsLoading(false);
    }
  }, [sessionData?.exam_id]);


  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <h2 className="text-xl font-medium text-slate-200 mb-2">
          Validating Session & Loading Exam Info...
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
  
  if (examLocallyStarted && examDetails) { // Show "Exam Finished" message
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

  if (!examDetails || !sessionData) {
    return (
      <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg">
        <CardHeader className="pt-8 pb-4">
          <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-5" />
          <CardTitle className="text-2xl text-slate-300">Loading Exam Information...</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <p className="text-sm text-muted-foreground">Please wait while we fetch the details for your exam.</p>
        </CardContent>
      </Card>
    );
  }
  
  const effectiveStatus = getEffectiveExamStatus(examDetails);
  const canStartExam = effectiveStatus === 'Ongoing' && systemChecksPassed;
  const examEnded = effectiveStatus === 'Completed';

  return (
    <Card className="w-full max-w-2xl modern-card shadow-2xl bg-card/90 backdrop-blur-xl border-border/30">
      <CardHeader className="text-center border-b border-border/20 pb-6">
        <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
        <CardTitle className="text-3xl font-bold text-foreground">{examDetails.title}</CardTitle>
        <CardDescription className="text-muted-foreground mt-2">
          Student: {sessionData.student_name || sessionData.student_user_id}
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
           {examDetails.start_time && <div><p className="font-medium text-slate-400">Starts:</p><p className="font-semibold">{format(parseISO(examDetails.start_time), "dd MMM yyyy, hh:mm a")}</p></div>}
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
            disabled={isLoading || performingChecks || effectiveStatus !== 'Ongoing' || !examDetails.questions || examDetails.questions.length === 0}
          >
            {performingChecks ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
            {effectiveStatus !== 'Ongoing' ? `Exam is ${effectiveStatus}` : 
             (!examDetails.questions || examDetails.questions.length === 0) ? "No Questions in Exam" :
             "Start Exam & System Checks"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
