// src/components/seb/seb-entry-client.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, PlayCircle, ShieldCheck, XCircle, Info, LogOut, ServerCrash } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client'; // Direct import for this client-only component
import type { Exam, CustomUser } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import { format, isValid as isValidDate, parseISO, differenceInMinutes } from 'date-fns';
import { isSebEnvironment, isOnline, areDevToolsLikelyOpen, isWebDriverActive, isVMLikely } from '@/lib/seb-utils';
import { useAuth } from '@/contexts/AuthContext';

const TOKEN_VALIDITY_MINUTES_FROM_API_PERSPECTIVE = 10; // How long a token is valid after creation for API claim

interface ValidatedSessionData {
  student_user_id: string;
  exam_id: string;
}

export function SebEntryClient() {
  const router = useRouter();
  const { toast } = useToast();
  const { supabase: authSupabase, user: authContextUser, isLoading: authContextLoading } = useAuth(); // Use supabase from AuthContext if needed for consistency after validation

  // Local state for this component
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ValidatedSessionData | null>(null);
  const [performingChecks, setPerformingChecks] = useState(false);
  const [currentStatusMessage, setCurrentStatusMessage] = useState("Initializing secure session...");
  const [entryTokenFromHash, setEntryTokenFromHash] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient(); // Local instance for initial data fetching not reliant on AuthContext's client

  const handleExitSeb = useCallback(() => {
    toast({ title: "Exiting SEB", description: "Safe Exam Browser will attempt to close.", duration: 3000 });
    if (typeof window !== 'undefined') window.location.href = "seb://quit";
  }, [toast]);

  // Step 1: Extract token from hash on mount
  useEffect(() => {
    const effectId = `[SebEntryClient HashParseEffect ${Date.now().toString().slice(-4)}]`;
    console.log(`${effectId} Running. Current hash:`, window.location.hash);

    if (typeof window === 'undefined') {
      setError("CRITICAL: Window object not found. Cannot proceed."); setIsLoading(false); return;
    }

    if (!isSebEnvironment()) {
      setError("CRITICAL: This page must be accessed within Safe Exam Browser.");
      toast({ title: "SEB Required", description: "Redirecting to unsupported browser page...", variant: "destructive", duration: 5000 });
      setTimeout(() => router.replace('/unsupported-browser'), 4000);
      setIsLoading(false);
      return;
    }
    console.log(`${effectId} SEB Environment Confirmed.`);

    const hash = window.location.hash.substring(1); // Remove #
    const params = new URLSearchParams(hash);
    const token = params.get('entryToken');

    if (!token) {
      const errMsg = "Error: SEB entry token missing from URL hash. This usually means the exam-config.seb file's Start URL was not correctly processed by SEB, or your .seb file Start URL is misconfigured. Ensure the .seb file's Start URL is set to YOUR_APP_DOMAIN/seb/entry (without hash parameters). SEB should append the hash. SEB will quit.";
      console.error(`${effectId} ${errMsg}`);
      setError(errMsg);
      toast({ title: "SEB Configuration Error", description: "Exam entry token missing. Quitting SEB.", variant: "destructive", duration: 15000 });
      setTimeout(handleExitSeb, 14000);
      setIsLoading(false);
      return;
    }
    
    console.log(`${effectId} Entry token found in hash:`, token);
    setEntryTokenFromHash(token);
    setCurrentStatusMessage("Validating entry token...");
    // Token validation will proceed in the next effect triggered by entryTokenFromHash change
  }, [router, toast, handleExitSeb]);


  // Step 2: Validate token via API once extracted
  useEffect(() => {
    const effectId = `[SebEntryClient TokenValidationEffect ${Date.now().toString().slice(-4)}]`;

    if (!entryTokenFromHash) {
      if (!isLoading && !error) { // If previous effect finished without token and no error, it's an issue
         console.warn(`${effectId} Token extraction failed unexpectedly or effect ran too soon. Waiting for token.`);
      }
      return;
    }
    if (error) { setIsLoading(false); return; } // Stop if error from previous step

    console.log(`${effectId} Validating entry token via API:`, entryTokenFromHash);
    setCurrentStatusMessage("Validating entry token with server...");

    fetch('/api/seb/validate-entry-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: entryTokenFromHash }),
    })
    .then(async res => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to parse API error response.' }));
        throw new Error(errData.error || `Token validation API failed with status: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      console.log(`${effectId} Token validated by API. Session data:`, data);
      
      // Client-side check to ensure the token is for the student currently logged into the AuthContext.
      // This adds an extra layer, though the primary validation is on the API side.
      // AuthContext might still be loading, so we might defer this check or make it optional here.
      if (!authContextLoading && authContextUser && authContextUser.user_id !== data.student_user_id) {
        // This case is less likely now due to token binding, but good as a sanity check.
        throw new Error("Token-User Mismatch: The exam token is not for the currently signed-in ZenTest user. Please ensure you initiated the exam from your account.");
      }
      
      setSessionData({ student_user_id: data.student_user_id, exam_id: data.exam_id });
      setCurrentStatusMessage("Fetching exam and student details...");
      // Data fetching will proceed in the next effect triggered by sessionData change
    })
    .catch(e => {
      console.error(`${effectId} Entry token validation error:`, e.message, e);
      setError(`Entry token validation failed: ${e.message}. SEB will quit.`);
      toast({ title: "Invalid Session", description: `Token error: ${e.message}. Quitting SEB.`, variant: "destructive", duration: 10000 });
      setTimeout(handleExitSeb, 9000);
      setIsLoading(false);
    });
  }, [entryTokenFromHash, toast, handleExitSeb, authContextUser, authContextLoading, error, isLoading]); // Added isLoading to dependencies


  // Step 3: Fetch exam and student details once sessionData is available
  useEffect(() => {
    const effectId = `[SebEntryClient DataFetchEffect ${Date.now().toString().slice(-4)}]`;

    if (!sessionData?.exam_id || !sessionData?.student_user_id) {
      if (!isLoading && !error && entryTokenFromHash && !sessionData) {
         console.warn(`${effectId} Waiting for session data after token validation.`);
      }
      return;
    }
    if (error) { setIsLoading(false); return; }
    if (!supabase) {
      setError("CRITICAL: Supabase client not available for data fetching. SEB will quit.");
      toast({ title: "Internal Error", description: "Service connection failed. Quitting SEB.", variant: "destructive", duration: 8000 });
      setTimeout(handleExitSeb, 7000);
      setIsLoading(false);
      return;
    }

    console.log(`${effectId} Fetching exam details for exam_id: ${sessionData.exam_id} and student: ${sessionData.student_user_id}`);
    setCurrentStatusMessage("Fetching exam and student information...");

    Promise.all([
      supabase.from('ExamX').select('*').eq('exam_id', sessionData.exam_id).single(),
      supabase.from('proctorX').select('name, user_id').eq('user_id', sessionData.student_user_id).single()
    ])
    .then(([examRes, studentRes]) => {
      if (examRes.error || !examRes.data) {
        throw new Error(examRes.error?.message || `Exam with ID ${sessionData.exam_id} not found.`);
      }
      if (studentRes.error || !studentRes.data) {
        throw new Error(studentRes.error?.message || `Student profile for ID ${sessionData.student_user_id} not found.`);
      }
      
      setExamDetails(examRes.data as Exam);
      setStudentName(studentRes.data.name || "Student"); // Use fetched name
      console.log(`${effectId} Exam details fetched:`, examRes.data, "Student name:", studentRes.data.name);
      setCurrentStatusMessage("Exam details loaded. Ready for system checks.");
      setError(null); // Clear previous non-fatal errors
    })
    .catch(e => {
      console.error(`${effectId} Error fetching exam/student details:`, e);
      setError(`Failed to load exam information: ${e.message}. SEB will quit.`);
      toast({ title: "Exam Load Error", description: e.message, variant: "destructive", duration: 10000 });
      setTimeout(handleExitSeb, 9000);
    })
    .finally(() => setIsLoading(false));
  }, [sessionData, supabase, toast, handleExitSeb, error, isLoading]); // Added isLoading to dependencies


  const handleStartSystemChecksAndExam = useCallback(async () => {
    const operationId = `[SebEntryClient handleStartSystemChecksAndExam ${Date.now().toString().slice(-4)}]`;
    if (!examDetails || !sessionData?.student_user_id || !entryTokenFromHash) {
      setError("Cannot start: Missing essential exam/session information for checks.");
      return;
    }
    setPerformingChecks(true);
    setCurrentStatusMessage("Performing system checks...");
    setError(null); // Clear previous errors before new checks
    console.log(`${operationId} Performing system checks...`);

    const checks = [
      { label: "SEB Environment", pass: isSebEnvironment(), details: isSebEnvironment() ? "Confirmed" : "Critical: Not in SEB!" },
      { label: "Internet Connectivity", pass: isOnline(), details: isOnline() ? "Online" : "Warning: Offline!" },
      { label: "Developer Tools", pass: !areDevToolsLikelyOpen(), details: areDevToolsLikelyOpen() ? "Alert: Potentially Open" : "Not Detected" },
      { label: "WebDriver/Automation", pass: !isWebDriverActive(), details: isWebDriverActive() ? "Alert: Detected" : "Not Detected" },
      { label: "Virtual Machine", pass: !isVMLikely(), details: isVMLikely() ? "Info: Potentially Detected" : "Not Detected" },
    ];
    
    const failedChecks = checks.filter(check => !check.pass && (check.label === "SEB Environment" || check.label === "Developer Tools" || check.label === "WebDriver/Automation"));
    const allCriticalPass = failedChecks.length === 0;

    if (allCriticalPass) {
      toast({ title: "System Checks Passed!", description: "Proceeding to live exam environment.", duration: 3000 });
      console.log(`${operationId} System checks passed. Navigating to live test.`);
      // Pass examId and studentId to the live test page. Token is no longer needed here.
      router.push(`/seb/live-test?examId=${examDetails.exam_id}&studentId=${sessionData.student_user_id}`);
    } else {
      const errorMessages = failedChecks.map(fc => `${fc.label}: ${fc.details || 'Failed'}`).join('; ');
      setError(`Critical system integrity checks failed: ${errorMessages}. Cannot start exam. SEB will quit.`);
      toast({ title: "System Checks Failed", description: errorMessages + ". Quitting SEB.", variant: "destructive", duration: 15000 });
      setTimeout(handleExitSeb, 14000);
    }
    setPerformingChecks(false);
  }, [examDetails, sessionData, entryTokenFromHash, router, toast, handleExitSeb]);
  

  if (isLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center text-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 p-4">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <h2 className="text-xl font-medium text-slate-200 mb-2">
          {currentStatusMessage}
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-red-800 via-red-900 to-red-950 text-white p-4">
        <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-destructive">
          <CardHeader className="pt-8 pb-4">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Exam Access Error</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6 whitespace-pre-wrap">{error}</p>
            <Button onClick={handleExitSeb} className="w-full btn-gradient-destructive">
              Exit SEB
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!examDetails || !studentName || !sessionData) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 p-4">
        <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg">
          <CardHeader className="pt-8 pb-4">
            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-5" />
            <CardTitle className="text-2xl text-slate-300">{currentStatusMessage || "Loading exam information..."}</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground">Please wait while we finalize details for your exam. If this takes too long, there might be an issue with the exam setup or your connection. Check console for errors.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const effectiveStatus = getEffectiveExamStatus(examDetails);
  const canStartExam = effectiveStatus === 'Ongoing';
  const examEnded = effectiveStatus === 'Completed';
  const examNotReadyForStart = (!examDetails.questions || examDetails.questions.length === 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl modern-card shadow-2xl bg-card/90 backdrop-blur-xl border-border/30">
        <CardHeader className="text-center border-b border-border/20 pb-6">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-foreground">{examDetails.title}</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Student: {studentName} (ID: {sessionData.student_user_id})
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg bg-slate-800/40 text-slate-300 shadow-inner">
            <div><p className="font-medium text-slate-400">Duration:</p><p className="font-semibold">{examDetails.duration} minutes</p></div>
            <div><p className="font-medium text-slate-400">Questions:</p><p className="font-semibold">{examDetails.questions?.length || 0}</p></div>
            <div><p className="font-medium text-slate-400">Status:</p><p className="font-semibold">{effectiveStatus}</p></div>
            {examDetails.start_time && isValidDate(parseISO(examDetails.start_time)) && <div><p className="font-medium text-slate-400">Starts:</p><p className="font-semibold">{format(parseISO(examDetails.start_time), "dd MMM yyyy, hh:mm a")}</p></div>}
          </div>
          {performingChecks && (
              <div className="text-center p-4">
                  <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-2" />
                  <p className="text-slate-300">Performing system checks...</p>
              </div>
          )}
          {examNotReadyForStart && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Cannot Start Exam</AlertTitle>
                <AlertDescription>This exam currently has no questions. Please contact your instructor.</AlertDescription>
              </Alert>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 p-6 border-t border-border/20">
          <Button variant="outline" onClick={handleExitSeb} className="btn-outline-subtle text-slate-300 border-slate-600 hover:bg-slate-700/50 w-full sm:w-auto order-2 sm:order-1">
            <LogOut className="mr-2 h-4 w-4" /> Exit SEB
          </Button>
          {examEnded ? (
              <Badge variant="destructive" className="px-4 py-2 text-base bg-red-700 text-white order-1 sm:order-2">This Exam Has Ended</Badge>
          ) : (
            <Button 
              onClick={handleStartSystemChecksAndExam} 
              className="btn-gradient w-full sm:w-auto py-3 text-base order-1 sm:order-2"
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
    </div>
  );
}
// Helper function (can be moved to a utils file if used elsewhere)
// This is a simplified version, as the one in details/page.tsx might not be directly accessible here.
function getEffectiveExamStatus(exam: Exam | null | undefined, currentTime?: Date): Exam['status'] | 'Upcoming' {
  if (!exam) return 'Published'; // Default or handle as error

  const now = currentTime || new Date();

  if (exam.status === 'Completed') return 'Completed';

  if (exam.status === 'Published' || exam.status === 'Ongoing') {
    if (!exam.start_time || !exam.end_time) {
      return 'Published'; // Needs scheduling
    }
    const startTime = parseISO(exam.start_time);
    const endTime = parseISO(exam.end_time);

    if (!isValidDate(startTime) || !isValidDate(endTime)) {
      return 'Published'; // Invalid dates
    }

    if (now > endTime) return 'Completed';
    if (now >= startTime && now <= endTime) return 'Ongoing';
    if (now < startTime) return 'Upcoming'; // Custom status for UI
  }
  return exam.status as Exam['status'];
}
