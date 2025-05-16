
// src/app/seb/exam-view/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, PlayCircle, ShieldCheck, XCircle, Info, LogOut, ServerCrash } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam } from '@/types/supabase';
import { useToast } from '@/hooks/use-toast';
import { decryptData } from '@/lib/crypto-utils';
import { isSebEnvironment, isOnline, areDevToolsLikelyOpen, isWebDriverActive } from '@/lib/seb-utils';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext'; // For student details if needed for display

const TOKEN_VALIDITY_MINUTES_SEB = 10; // Token generated on initiate page is valid for this long for SEB launch

interface DecryptedTokenPayload {
  examId: string;
  studentId: string;
  timestamp: number;
  examCode: string;
}

export default function SebExamViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authLoading } = useAuth(); // Get student user for context

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [examIdFromToken, setExamIdFromToken] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isClientSide, setIsClientSide] = useState(false);

  useEffect(() => {
    setIsClientSide(true); // Indicate client-side rendering has occurred
  }, []);
  
  // Step 1: Check SEB environment and parse token from hash
  useEffect(() => {
    if (!isClientSide) return; // Only run on client

    console.log("[SebExamView] Checking SEB environment...");
    if (!isSebEnvironment()) {
      setError("This page can only be accessed within Safe Exam Browser. Redirecting...");
      toast({ title: "SEB Required", description: "Redirecting to unsupported browser page.", variant: "destructive" });
      setTimeout(() => router.replace('/unsupported-browser'), 3000);
      setIsLoading(false);
      return;
    }
    console.log("[SebExamView] SEB environment detected.");

    const hash = window.location.hash.substring(1); // Remove #
    const paramsFromHash = new URLSearchParams(hash);
    const examIdParam = paramsFromHash.get('examId');
    const tokenParam = paramsFromHash.get('token');

    if (!examIdParam || !tokenParam) {
      setError("Exam ID or session token missing from SEB launch link. Please re-initiate from dashboard.");
      toast({ title: "Launch Error", description: "Invalid SEB link.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    setExamIdFromToken(examIdParam);
    setToken(tokenParam);
    // Further processing (token decryption, data fetching) happens in the next effect
    // after studentUser is confirmed available
  }, [isClientSide, router, toast]);


  // Step 2: Decrypt token and fetch exam details (once studentUser is available)
  useEffect(() => {
    if (!isClientSide || !examIdFromToken || !token || authLoading) return;

    if (!studentUser || !studentUser.user_id) {
      setError("Student authentication details missing. Cannot validate exam session.");
      toast({ title: "Auth Error", description: "Student session invalid.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    console.log("[SebExamView] Decrypting token...");
    decryptData<DecryptedTokenPayload>(token)
      .then(payload => {
        if (!payload) throw new Error("Invalid or corrupt session token.");
        if (payload.examId !== examIdFromToken) throw new Error("Token-Exam ID mismatch.");
        if (payload.studentId !== studentUser.user_id) throw new Error("Token-Student ID mismatch.");
        
        const tokenAgeMinutes = (Date.now() - payload.timestamp) / (1000 * 60);
        if (tokenAgeMinutes > TOKEN_VALIDITY_MINUTES_SEB) {
          throw new Error(`SEB session link expired (valid for ${TOKEN_VALIDITY_MINUTES_SEB} min). Re-initiate.`);
        }
        console.log("[SebExamView] Token decrypted and validated. Payload:", payload);
        
        // Fetch Exam Details
        setIsLoading(true);
        supabase.from('ExamX')
          .select('*')
          .eq('exam_id', payload.examId)
          .single()
          .then(({ data, error: fetchError }) => {
            if (fetchError) throw fetchError;
            if (!data) throw new Error("Exam not found in database.");
            setExamDetails(data as Exam);
            console.log("[SebExamView] Exam details fetched:", data);
            setError(null);
          }).catch((e: any) => {
            setError(`Failed to load exam details: ${e.message}`);
            setExamDetails(null);
          }).finally(() => setIsLoading(false));
      })
      .catch((e: any) => {
        setError(`Session validation failed: ${e.message}. Please re-initiate.`);
        toast({ title: "Session Error", description: e.message, variant: "destructive" });
        setIsLoading(false);
      });
  }, [isClientSide, examIdFromToken, token, authLoading, studentUser, supabase, toast, router]);


  const performSystemChecksAndStartExam = useCallback(async () => {
    if (!examDetails || !examIdFromToken || !token) {
      setError("Cannot start: Missing exam details or session information.");
      return;
    }

    setError(null); // Clear previous errors
    console.log("[SebExamView] Performing system checks...");
    let allChecksPass = true;
    const checkResults: string[] = [];

    if (!isSebEnvironment()) { // Re-check, crucial
      checkResults.push("SEB Environment: Failed (Not in SEB).");
      allChecksPass = false;
    } else checkResults.push("SEB Environment: Passed.");

    if (!isOnline()) {
      checkResults.push("Internet Connectivity: Failed (Offline).");
      allChecksPass = false;
    } else checkResults.push("Internet Connectivity: Passed.");

    if (areDevToolsLikelyOpen()) {
      checkResults.push("Developer Tools: Detected (Potentially open).");
      // Depending on policy, this could be a warning or failure. For demo, let's make it a failure.
      // allChecksPass = false; 
    } else checkResults.push("Developer Tools: Not detected.");

    if (isWebDriverActive()) {
      checkResults.push("WebDriver Automation: Detected.");
      allChecksPass = false; // Usually a strict failure
    } else checkResults.push("WebDriver Automation: Not detected.");

    // Simulate keyboard/mouse check - SEB config primarily handles this.
    checkResults.push("Input Restrictions: Configured by SEB (simulated check passed).");

    console.log("[SebExamView] System Check Results:", checkResults.join('\n'));
    toast({
      title: "System Checks Summary",
      description: checkResults.join(' | '),
      duration: 6000
    });

    if (allChecksPass) {
      toast({ title: "Checks Passed!", description: "Redirecting to live exam...", variant: "default" });
      // Pass the original encrypted token to the live test page for re-validation if needed,
      // or live-test could re-encrypt its own minimal payload.
      // For simplicity, just passing examId. Live-test will perform its own SEB check.
      router.push(`/seb/live-test?examId=${examIdFromToken}&token=${encodeURIComponent(token)}`);
    } else {
      setError("One or more system checks failed. Cannot start exam. SEB will attempt to quit.");
      toast({ title: "System Checks Failed", description: "Cannot start exam. SEB will quit.", variant: "destructive", duration: 7000 });
      setTimeout(() => { window.location.href = "seb://quit"; }, 6000);
    }
  }, [examDetails, examIdFromToken, token, router, toast]);

  const handleExitSeb = () => {
    toast({ title: "Exiting SEB", description: "Safe Exam Browser will attempt to close.", duration: 3000 });
    window.location.href = "seb://quit";
  };
  
  if (!isClientSide || isLoading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-900 to-slate-950">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-slate-300">
          {authLoading ? "Authenticating student..." : 
           isLoading ? "Loading exam view..." : 
           "Initializing SEB session..."}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-red-700 to-red-900">
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
            <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Exam Not Found</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">The requested exam details could not be loaded.</p>
            <Button onClick={handleExitSeb} className="w-full btn-primary-solid">
              Exit SEB
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const examTimeInfo = examDetails.start_time && examDetails.end_time
    ? `${format(new Date(examDetails.start_time), "dd MMM yyyy, hh:mm a")} - ${format(new Date(examDetails.end_time), "hh:mm a")}`
    : "Timing not specified";

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-800 p-6">
      <Card className="w-full max-w-2xl modern-card shadow-2xl">
        <CardHeader className="text-center border-b border-border/20 pb-6">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-foreground">{examDetails.title}</CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Exam Instructions & System Check
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
              <li>This exam is proctored. Your activity will be monitored as per SEB configuration.</li>
              <li>Do not attempt to exit SEB or switch applications during the exam.</li>
              <li>The timer will start once you click "Start Exam" after system checks.</li>
              <li>Read each question carefully before answering.</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 p-6 border-t border-border/20">
          <Button variant="outline" onClick={handleExitSeb} className="btn-outline-subtle w-full sm:w-auto">
            <LogOut className="mr-2 h-4 w-4" /> Exit SEB
          </Button>
          <Button onClick={performSystemChecksAndStartExam} className="btn-primary-solid w-full sm:w-auto py-3 text-base">
            <PlayCircle className="mr-2 h-5 w-5" /> Perform System Checks & Start Exam
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
    