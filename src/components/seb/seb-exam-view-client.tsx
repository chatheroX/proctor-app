
// src/components/seb/seb-exam-view-client.tsx
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
import { decryptData } from '@/lib/crypto-utils';
import { isSebEnvironment, isOnline, areDevToolsLikelyOpen, isWebDriverActive, isVMLikely } from '@/lib/seb-utils';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

const TOKEN_VALIDITY_MINUTES_SEB = 15; // Token from join page is valid for this long for SEB launch

interface DecryptedTokenPayload {
  examId: string;
  studentId: string;
  timestamp: number;
  examCode: string;
}

export function SebExamViewClient() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authLoading } = useAuth();

  const [pageIsLoading, setPageIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  
  const [isClientSide, setIsClientSide] = useState(false);
  const [examIdFromHash, setExamIdFromHash] = useState<string | null>(null);
  const [tokenFromHash, setTokenFromHash] = useState<string | null>(null);
  const [systemChecksPassed, setSystemChecksPassed] = useState<boolean | null>(null);
  const [checkResultsLog, setCheckResultsLog] = useState<string[]>([]);


  useEffect(() => {
    setIsClientSide(true);
  }, []);
  
  // Step 1: Parse token and examId from hash (client-side only)
  useEffect(() => {
    if (!isClientSide) return; 

    console.log("[SebExamViewClient] Component mounted. Parsing hash.");
    const hash = window.location.hash.substring(1); 
    const paramsFromHash = new URLSearchParams(hash);
    const examIdParam = paramsFromHash.get('examId');
    const tokenParam = paramsFromHash.get('token');

    if (!examIdParam || !tokenParam) {
      setError("Exam ID or session token missing from SEB launch parameters. Please re-initiate from dashboard.");
      toast({ title: "Launch Error", description: "Invalid SEB parameters. SEB will quit.", variant: "destructive", duration: 7000 });
      setPageIsLoading(false);
      setTimeout(() => { if(typeof window !== 'undefined') window.location.href = "seb://quit"; }, 6000);
      return;
    }
    setExamIdFromHash(examIdParam);
    setTokenFromHash(tokenParam);
    // Next effect handles decryption and data fetching once auth is loaded
  }, [isClientSide, router, toast]);


  // Step 2: Decrypt token and fetch exam details (once studentUser and token are available)
  useEffect(() => {
    if (!isClientSide || !examIdFromHash || !tokenFromHash || authLoading) {
      if (isClientSide && !authLoading && (!examIdFromHash || !tokenFromHash) && pageIsLoading && !error) {
           setError("SEB launch parameters missing or invalid after auth load. Cannot proceed.");
           setPageIsLoading(false);
      }
      return;
    }

    if (!studentUser || !studentUser.user_id) {
      setError("Student authentication details missing. Cannot validate exam session. SEB will quit.");
      toast({ title: "Auth Error", description: "Student session invalid for SEB.", variant: "destructive", duration: 7000 });
      setPageIsLoading(false);
      setTimeout(() => { if(typeof window !== 'undefined') window.location.href = "seb://quit"; }, 6000);
      return;
    }

    console.log("[SebExamViewClient] Decrypting token...");
    decryptData<DecryptedTokenPayload>(tokenFromHash)
      .then(payload => {
        if (!payload) throw new Error("Invalid or corrupt session token.");
        if (payload.examId !== examIdFromHash) throw new Error("Token-Exam ID mismatch in hash.");
        if (payload.studentId !== studentUser.user_id) throw new Error("Token-Student ID mismatch.");
        
        const tokenAgeMinutes = (Date.now() - payload.timestamp) / (1000 * 60);
        if (tokenAgeMinutes > TOKEN_VALIDITY_MINUTES_SEB) {
          throw new Error('SEB session link expired (valid for ' + TOKEN_VALIDITY_MINUTES_SEB + ' min). Re-initiate.');
        }
        console.log("[SebExamViewClient] Token decrypted and validated. Payload:", payload);
        
        setPageIsLoading(true); 
        supabase.from('ExamX')
          .select('*') 
          .eq('exam_id', payload.examId)
          .single()
          .then(({ data, error: fetchError }) => {
            if (fetchError) throw fetchError;
            if (!data) throw new Error("Exam not found in database.");
            setExamDetails(data as Exam);
            console.log("[SebExamViewClient] Exam details fetched:", data);
            setError(null); 
          }).catch((e: any) => {
            const errorMsg = 'Failed to load exam details: ' + e.message;
            setError(errorMsg);
            toast({ title: "Exam Load Error", description: errorMsg, variant: "destructive", duration: 7000 });
            setExamDetails(null);
          }).finally(() => setPageIsLoading(false));
      })
      .catch((e: any) => {
        const errorMsg = 'Session validation failed: ' + e.message + '. Please re-initiate from the dashboard.';
        setError(errorMsg);
        toast({ title: "Session Error", description: errorMsg, variant: "destructive", duration: 7000 });
        setPageIsLoading(false);
        setTimeout(() => { if(typeof window !== 'undefined') window.location.href = "seb://quit"; }, 6000);
      });
  }, [isClientSide, examIdFromHash, tokenFromHash, authLoading, studentUser, supabase, toast, router, pageIsLoading, error]);


  const performSystemChecks = useCallback(async () => {
    if (!examDetails || !examIdFromHash || !tokenFromHash) { 
      setError("Cannot start: Missing exam details or session information.");
      return;
    }

    setError(null);
    setCheckResultsLog([]);
    console.log("[SebExamViewClient] Performing system checks...");
    let allChecksPass = true;
    const newCheckResults: string[] = [];

    const addResult = (label: string, pass: boolean, details = "") => {
        newCheckResults.push(`${label}: ${pass ? "Passed" : "Failed"}${details ? ` (${details})` : ""}`);
        if (!pass) allChecksPass = false;
    };

    addResult("SEB Environment", isSebEnvironment(), isSebEnvironment() ? "Confirmed" : "Not in SEB!");
    addResult("Internet Connectivity", isOnline(), isOnline() ? "Online" : "Offline!");
    addResult("Developer Tools Check", !areDevToolsLikelyOpen(), areDevToolsLikelyOpen() ? "Potentially Open" : "Not Detected");
    addResult("WebDriver/Automation Check", !isWebDriverActive(), isWebDriverActive() ? "Detected" : "Not Detected");
    addResult("Virtual Machine Check", !isVMLikely(), isVMLikely() ? "Potentially Detected" : "Not Detected");
    // Keyboard/Mouse restrictions are primarily SEB config; JS is supplemental.
    addResult("Input Restrictions Check", true, "SEB config primary; JS supplemental checks active in live test.");

    setCheckResultsLog(newCheckResults);
    setSystemChecksPassed(allChecksPass);
    console.log("[SebExamViewClient] System Check Results:", newCheckResults.join(' | '));
    toast({
      title: allChecksPass ? "System Checks Passed!" : "System Checks Failed!",
      description: newCheckResults.join(' | '),
      duration: 8000,
      variant: allChecksPass ? "default" : "destructive",
    });

    if (allChecksPass) {
      toast({ title: "Redirecting to Live Exam...", description: "Your exam will begin shortly.", duration: 3000 });
      // Pass examId and token as query params to live-test page
      router.push(`/seb/live-test?examId=${examIdFromHash}&token=${encodeURIComponent(tokenFromHash!)}`);
    } else {
      setError("One or more critical system checks failed. Cannot start exam. SEB will attempt to quit.");
      setTimeout(() => { if (typeof window !== 'undefined') { window.location.href = "seb://quit"; } }, 7000);
    }
  }, [examDetails, examIdFromHash, tokenFromHash, router, toast, setCheckResultsLog, setSystemChecksPassed, setError]); 

  const handleExitSeb = useCallback(() => {
    toast({ title: "Exiting SEB", description: "Safe Exam Browser will attempt to close.", duration: 3000 });
    if (typeof window !== 'undefined') window.location.href = "seb://quit";
  }, [toast]);
  
  // Redirect if not in SEB (initial client-side check)
  useEffect(() => {
    if (isClientSide && !pageIsLoading && !isSebEnvironment() && !error ) {
      setError("CRITICAL: This page can only be accessed within Safe Exam Browser. Redirecting to unsupported browser page...");
      setTimeout(() => router.replace('/unsupported-browser'), 3000);
    }
  }, [isClientSide, pageIsLoading, router, error]);


  if (pageIsLoading || authLoading || (!isClientSide && !error) ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-slate-300">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg">
          {authLoading ? "Authenticating student..." : 
           pageIsLoading ? "Loading exam view..." : 
           "Initializing SEB session..."}
        </p>
         <p className="text-sm mt-2 text-yellow-400">Please wait, preparing secure environment.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-red-700 to-red-900 text-white">
        <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
          <CardHeader className="pt-8 pb-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Exam Access Error</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button onClick={handleExitSeb} className="w-full btn-gradient-destructive">
              Exit SEB
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!examDetails) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-900 to-slate-950">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-orange-500 mx-auto mb-5" />
            <CardTitle className="text-2xl text-orange-500">Exam Data Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">The requested exam details could not be loaded. This might be due to an invalid exam ID or server issue. SEB will attempt to quit.</p>
            <Button onClick={handleExitSeb} className="w-full btn-primary-solid">
              Exit SEB
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const examTimeInfo = examDetails.start_time && examDetails.end_time
    ? format(new Date(examDetails.start_time), "dd MMM yyyy, hh:mm a") + ' - ' + format(new Date(examDetails.end_time), "hh:mm a")
    : "Timing not specified";

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-800 p-6">
      <Card className="w-full max-w-2xl modern-card shadow-2xl">
        <CardHeader className="text-center border-b border-border/20 pb-6">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-foreground">{examDetails.title}</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Exam Instructions & System Readiness Check
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <Alert variant="default" className="bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="font-semibold text-blue-700 dark:text-blue-300">Welcome, {studentUser?.name || 'Student'}!</AlertTitle>
            <AlertDescription className="text-blue-600/90 dark:text-blue-400/90 text-sm">
              You are about to start the exam: <strong>{examDetails.title}</strong>.
              Please read the instructions carefully. This exam must be taken in Safe Exam Browser.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg bg-background/50 dark:bg-slate-800/40">
            <div>
                <p className="font-medium text-muted-foreground">Exam ID:</p>
                <p className="text-foreground font-semibold">{examDetails.exam_id}</p>
            </div>
            <div>
                <p className="font-medium text-muted-foreground">Duration:</p>
                <p className="text-foreground font-semibold">{examDetails.duration} minutes</p>
            </div>
            <div>
                <p className="font-medium text-muted-foreground">Questions:</p>
                <p className="text-foreground font-semibold">{examDetails.questions?.length || 0}</p>
            </div>
             <div>
                <p className="font-medium text-muted-foreground">Scheduled:</p>
                <p className="text-foreground font-semibold">{examTimeInfo}</p>
            </div>
          </div>

          <div className="text-sm space-y-2 text-muted-foreground">
            <p><strong>Instructions:</strong></p>
            <ul className="list-disc list-inside pl-4 space-y-1">
              <li>Ensure you are in a quiet environment with a stable internet connection.</li>
              <li>This exam is proctored within SEB. Activity is monitored as per SEB configuration.</li>
              <li>Do not attempt to exit SEB or switch applications unless instructed or the exam is finished.</li>
              <li>The timer will start once you click "Start Exam" after system checks.</li>
              <li>Read each question carefully before answering.</li>
              <li>Only A-Z keys, arrow keys, and mouse clicks are permitted for answering. Other shortcuts are disabled.</li>
            </ul>
          </div>

            {checkResultsLog.length > 0 && (
                <div className="mt-4 p-3 border rounded-md bg-slate-50 dark:bg-slate-700/50">
                    <p className="font-medium text-sm mb-1">System Check Results:</p>
                    <ul className="list-disc list-inside text-xs space-y-0.5">
                        {checkResultsLog.map((log, index) => (
                            <li key={index} className={log.includes("Failed") ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                                {log}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 p-6 border-t border-border/20">
          <Button variant="outline" onClick={handleExitSeb} className="btn-outline-subtle w-full sm:w-auto order-2 sm:order-1">
            <LogOut className="mr-2 h-4 w-4" /> Exit SEB
          </Button>
          <Button 
            onClick={performSystemChecks} 
            className="btn-primary-solid w-full sm:w-auto py-3 text-base order-1 sm:order-2"
            disabled={pageIsLoading || systemChecksPassed === false} // Disable if checks failed or currently loading
            >
            {pageIsLoading && systemChecksPassed === null ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <PlayCircle className="mr-2 h-5 w-5" />}
            {systemChecksPassed === false ? "Checks Failed - Cannot Start" : (systemChecksPassed === true ? "Checks Passed - Proceed" : "Start System Checks & Exam")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
