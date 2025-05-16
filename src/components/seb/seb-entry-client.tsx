
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
import { useAuth } from '@/contexts/AuthContext'; // For student name after validation

interface ValidatedSessionData {
  student_user_id: string;
  exam_id: string;
  student_name?: string;
}

export function SebEntryClient() {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: authContextUser, isLoading: authContextLoading } = useAuth(); // To get current student if needed for comparison, though API provides ID

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

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setCurrentStatusMessage("Verifying SEB environment and entry token...");
    console.log("[SebEntryClient] Current URL:", window.location.href);
    console.log("[SebEntryClient] Current Hash:", window.location.hash);

    if (typeof window === 'undefined') {
      setError("CRITICAL: Window object not found."); setIsLoading(false); return;
    }

    if (!isSebEnvironment()) {
      setError("CRITICAL: This page must be accessed within Safe Exam Browser.");
      toast({ title: "SEB Required", description: "Redirecting to unsupported browser page...", variant: "destructive", duration: 5000 });
      setTimeout(() => router.replace('/unsupported-browser'), 4000);
      setIsLoading(false);
      return;
    }
    console.log("[SebEntryClient] SEB Environment Confirmed.");

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('entryToken');

    if (!token) {
      const errMsg = "Error: SEB did not load the correct exam entry page with parameters (entryToken missing from URL hash). This usually means the exam-config.seb file was not processed correctly by SEB, or the Start URL inside it is misconfigured. Please check server configuration for .seb files and SEB config. SEB will quit.";
      console.error("[SebEntryClient] Error:", errMsg);
      setError(errMsg);
      toast({ title: "SEB Configuration Error", description: "Exam entry token missing. Quitting SEB.", variant: "destructive", duration: 10000 });
      setTimeout(handleExitSeb, 9000);
      setIsLoading(false);
      return;
    }
    
    console.log("[SebEntryClient] Entry token found in hash:", token);
    setEntryTokenFromHash(token);
    // Token validation will proceed in the next effect
  }, [router, toast, handleExitSeb]);


  useEffect(() => {
    if (!entryTokenFromHash) {
      if (!isLoading && !error) { // If previous effect finished without token and no error, it's an issue
         setError("Error: Token extraction failed unexpectedly. SEB will quit.");
         setTimeout(handleExitSeb, 7000);
      }
      return;
    }
    if (error) { setIsLoading(false); return; } // Stop if error from previous step

    setCurrentStatusMessage("Validating entry token via API...");
    console.log("[SebEntryClient] Validating entry token from hash via API:", entryTokenFromHash);

    fetch('/api/seb/validate-entry-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: entryTokenFromHash }),
    })
    .then(async res => {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to parse error response.' }));
        throw new Error(errData.error || `Token validation API failed: ${res.status}`);
      }
      return res.json();
    })
    .then(data => {
      if (data.error) throw new Error(data.error);
      console.log("[SebEntryClient] Token validated by API. Session data:", data);
      
      // Verify student_user_id from token matches currently logged-in user in AuthContext (if available and loaded)
      // This adds a layer of security, though the token itself is already tied to a student.
      if (!authContextLoading && authContextUser && authContextUser.user_id !== data.student_user_id) {
        throw new Error("Token-User Mismatch: The exam token is not for the currently signed-in user. Please re-initiate the exam.");
      }
      
      setSessionData({ student_user_id: data.student_user_id, exam_id: data.exam_id });
      setCurrentStatusMessage("Fetching exam and student details...");
    })
    .catch(e => {
      console.error("[SebEntryClient] Entry token validation error:", e);
      setError(`Entry token validation failed: ${e.message}. SEB will quit.`);
      toast({ title: "Invalid Session", description: `Token error: ${e.message}. Quitting SEB.`, variant: "destructive", duration: 8000 });
      setTimeout(handleExitSeb, 7000);
      setIsLoading(false);
    });
  }, [entryTokenFromHash, toast, handleExitSeb, authContextUser, authContextLoading, error, isLoading]);


  useEffect(() => {
    if (!sessionData?.exam_id || !sessionData?.student_user_id) {
        if (!isLoading && !error && entryTokenFromHash && !sessionData) {
             // This implies API validation might have failed without setting error explicitly or still in progress
        }
      return;
    }
    if (error) { setIsLoading(false); return; }

    console.log("[SebEntryClient] Fetching exam details for exam_id:", sessionData.exam_id);
    setCurrentStatusMessage("Fetching exam details...");

    Promise.all([
      supabase.from('ExamX').select('*').eq('exam_id', sessionData.exam_id).single(),
      supabase.from('proctorX').select('name').eq('user_id', sessionData.student_user_id).single() // Fetch student name
    ])
    .then(([examRes, studentRes]) => {
      if (examRes.error || !examRes.data) {
        throw new Error(examRes.error?.message || "Exam not found.");
      }
      let studentName = "Student";
      if (studentRes.error || !studentRes.data) {
        console.warn("[SebEntryClient] Student name not found for ID:", sessionData.student_user_id, studentRes.error?.message);
      } else {
        studentName = studentRes.data.name || "Student";
      }
      
      setExamDetails(examRes.data as Exam);
      setSessionData(prev => prev ? ({ ...prev, student_name: studentName }) : null); // Update session data with name
      console.log("[SebEntryClient] Exam details fetched:", examRes.data, "Student name:", studentName);
      setCurrentStatusMessage("Exam details loaded. Ready for system checks.");
      setError(null);
    })
    .catch(e => {
      console.error("[SebEntryClient] Error fetching exam/student details:", e);
      setError(`Failed to load exam information: ${e.message}. SEB will quit.`);
      toast({ title: "Exam Load Error", description: e.message, variant: "destructive", duration: 8000 });
      setTimeout(handleExitSeb, 7000);
    })
    .finally(() => setIsLoading(false));
  }, [sessionData?.exam_id, sessionData?.student_user_id, supabase, toast, handleExitSeb, error, isLoading, entryTokenFromHash]);


  const handleStartSystemChecksAndExam = useCallback(async () => {
    if (!examDetails || !sessionData?.student_user_id || !entryTokenFromHash) {
      setError("Cannot start: Missing essential exam/session information.");
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
      // Pass examId and studentId to the live test page. Token is no longer needed here.
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
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-5" />
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
  
  if (examLocallyStarted && examDetails) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-800 via-emerald-900 to-teal-900 text-slate-100 p-4">
         <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-green-500">
            <CardHeader className="pt-8 pb-4">
                <ShieldCheck className="h-16 w-16 text-green-400 mx-auto mb-5" />
                <CardTitle className="text-2xl text-green-300">Exam Session Concluded</CardTitle>
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
      </div>
    );
  }

  if (!examDetails || !sessionData?.student_name) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 p-4">
        <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg">
          <CardHeader className="pt-8 pb-4">
            <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-5" />
            <CardTitle className="text-2xl text-slate-300">{currentStatusMessage || "Loading exam information..."}</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground">Please wait while we finalize details for your exam. If this takes too long, there might be an issue with the exam setup or your connection.</p>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm p-4 border rounded-lg bg-slate-800/40 text-slate-300 shadow-inner">
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
