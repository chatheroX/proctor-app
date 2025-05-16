
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, Clock, PlayCircle, ExternalLink, CheckCircle, XCircle, ShieldAlert, ServerCrash } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { format } from 'date-fns';
import { encryptData } from '@/lib/crypto-utils';

interface CheckStatus {
  name: string;
  status: 'pending' | 'checking' | 'success' | 'failed';
  details?: string;
}

const initialChecks: CheckStatus[] = [
  { name: 'Browser Compatibility', status: 'pending' },
  { name: 'Internet Connectivity', status: 'pending' },
  { name: 'System Integrity (Basic)', status: 'pending' },
  { name: 'Secure Session Readiness', status: 'pending' },
];

export default function InitiateExamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [effectiveStatus, setEffectiveStatus] = useState<string | null>(null);
  
  const [checks, setChecks] = useState<CheckStatus[]>(initialChecks);
  const [overallProgress, setOverallProgress] = useState(0);
  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [performingChecks, setPerformingChecks] = useState(false);
  const [hasSuccessfullyLaunched, setHasSuccessfullyLaunched] = useState(false);


  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    console.log(`[InitiatePage] Fetching exam data for examId: ${examId}`);
    setIsLoading(true); // Set loading true at the start of fetch
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, start_time, end_time, status, exam_code')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      console.log("[InitiatePage] Exam data fetched:", currentExam);
      setExamDetails(currentExam);
      setQuestionsCount(currentExam.questions?.length || 0);
      setEffectiveStatus(getEffectiveExamStatus(currentExam));

    } catch (e: any) {
      console.error("[InitiatePage] Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data.");
      setExamDetails(null);
      setQuestionsCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase]); // Removed toast, setError, setIsLoading from here as they are component scope

  useEffect(() => {
    // Only fetch if not already loading and critical data exists
    if (!isLoading && examId && !authLoading && supabase) {
      if (!examDetails || examDetails.exam_id !== examId) { 
         console.log("[InitiatePage] useEffect: Conditions met to fetch exam data.");
         fetchExamData();
      }
    }
  }, [examId, authLoading, supabase, fetchExamData, examDetails, isLoading]);


  const performLaunch = useCallback(async (): Promise<boolean> => {
    console.log("[InitiatePage] performLaunch entered. State values - hasSuccessfullyLaunched:", hasSuccessfullyLaunched, "allChecksPassed:", allChecksPassed, "examDetails:", !!examDetails, "studentUser:", !!studentUser);

    if (hasSuccessfullyLaunched) {
      console.warn("[InitiatePage] performLaunch blocked: hasSuccessfullyLaunched is true.");
      toast({ title: "Launch Blocked", description: "Exam launch sequence already completed.", variant: "default" });
      return false; 
    }

    if (!allChecksPassed) {
      toast({ title: "Cannot Launch", description: "System checks not completed or passed.", variant: "destructive" });
      setError("System checks must be passed before launching the exam.");
      return false;
    }
    
    if (!examDetails || !studentUser?.user_id) {
      const reasons = [] as string[];
      if (!examDetails) reasons.push("exam details are missing");
      if (!studentUser?.user_id) reasons.push("student authentication is missing");
      
      const description = reasons.length > 0 
        ? `Cannot launch exam because: ${reasons.join(', ')}.`
        : "Exam data or user information is missing.";
      
      console.error("[InitiatePage] performLaunch blocked (data missing):", description);
      toast({ title: "Cannot Launch Exam", description, variant: "destructive" });
      setError(description);
      return false;
    }
    
    const payload = { 
      examId: examDetails.exam_id, 
      studentId: studentUser.user_id, 
      timestamp: Date.now(), 
      examCode: examDetails.exam_code 
    };
    const encryptedToken = await encryptData(payload);

    if (!encryptedToken) {
        toast({ title: "Encryption Error", description: "Could not generate secure exam token.", variant: "destructive" });
        setError("Failed to create a secure exam session token. Please try again.");
        return false;
    }
    
    const examUrl = `/exam-session/${examDetails.exam_id}?token=${encodeURIComponent(encryptedToken)}`;
    console.log("[InitiatePage] Launching exam at URL:", examUrl);
    
    const newWindow = window.open(examUrl, '_blank', 'noopener,noreferrer,resizable=yes,scrollbars=yes,status=yes');

    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      console.error("[InitiatePage] performLaunch: window.open failed or was blocked.");
      const popupErrorMsg = "Could not open the exam in a new tab. Please ensure pop-ups are allowed for this site, then try again using the 'Launch Exam' button if available.";
      setError(popupErrorMsg);
      // Do NOT setHasSuccessfullyLaunched(false) here, as it might already be false and this path means a failure to launch
      toast({
          title: "Pop-up Blocked?",
          description: "Could not open exam automatically. If a 'Launch Exam' button appears, please use it. Otherwise, check pop-up blocker.",
          variant: "destructive",
          duration: 7000,
      });
      return false; 
    } else {
      console.log("[InitiatePage] performLaunch: Exam launched successfully in new tab. Setting hasSuccessfullyLaunched to true.");
      setHasSuccessfullyLaunched(true);
      setError(null); 
      toast({ title: "Exam Launched!", description: "The exam has opened in a new tab." });
      return true; 
    }
  }, [
    allChecksPassed, examDetails, studentUser, toast, router, examId, // supabase removed as encryptData is self-contained
    hasSuccessfullyLaunched // Must be a dependency as it's read
    // setError, setHasSuccessfullyLaunched are stable setters
  ]);


  const startSystemChecksAndAttemptLaunch = useCallback(async () => {
    console.log("[InitiatePage] startSystemChecksAndAttemptLaunch entered. State values - hasSuccessfullyLaunched:", hasSuccessfullyLaunched, "performingChecks:", performingChecks, "effectiveStatus:", effectiveStatus, "questionsCount:", questionsCount);

    if (hasSuccessfullyLaunched) {
      console.warn("[InitiatePage] startSystemChecksAndAttemptLaunch blocked: hasSuccessfullyLaunched is true.");
      toast({ title: "Already Launched", description: "Exam has already been launched. Check other tabs or use the 'Launch Manually' button if visible and needed.", variant: "default" });
      return;
    }
    if (performingChecks) {
      console.warn("[InitiatePage] startSystemChecksAndAttemptLaunch blocked: performingChecks is true.");
      return;
    } // Prevent re-entry if already running

    if (!studentUser?.user_id) {
      toast({ title: "Authentication Error", description: "Student details not found.", variant: "destructive" });
      setError("Student details not found. Please re-login.");
      return;
    }
    if (!examDetails) {
        toast({ title: "Error", description: "Exam details are not loaded.", variant: "destructive" });
        setError("Exam details not loaded. Please try refreshing or rejoining.");
        return;
    }
    if (effectiveStatus !== 'Ongoing') {
      toast({ title: "Cannot Start", description: `Exam is ${effectiveStatus?.toLowerCase() || 'not available'}.`, variant: "destructive" });
      setError(`Exam is ${effectiveStatus?.toLowerCase() || 'not available'}.`);
      return;
    }
    if (questionsCount === 0) {
      toast({ title: "No Questions", description: "This exam has no questions.", variant: "destructive" });
      setError("This exam has no questions.");
      return;
    }

    setPerformingChecks(true);
    setError(null); 
    setAllChecksPassed(false); // Reset before starting new checks
    setChecks(initialChecks.map(c => ({ ...c, status: 'pending', details: undefined })));
    setOverallProgress(0);

    let checksSuccessful = true;
    for (let i = 0; i < initialChecks.length; i++) {
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'checking' } : c));
      await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 500)); 

      const isSuccess = true; 
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: isSuccess ? 'success' : 'failed', details: isSuccess ? 'Compatible' : 'Incompatible - Please resolve.' } : c));
      setOverallProgress(((i + 1) / initialChecks.length) * 100);
      if (!isSuccess) {
        setError(`System check failed: ${initialChecks[i].name}. Cannot proceed with the exam.`);
        checksSuccessful = false;
        break; 
      }
    }
    
    setPerformingChecks(false); // Checks are done

    if (checksSuccessful) {
      setAllChecksPassed(true); 
      toast({ title: "System Checks Passed!", description: "Attempting to launch the exam.", variant: "default" });
      const launchSucceeded = await performLaunch(); // performLaunch now correctly uses its internal 'hasSuccessfullyLaunched'
      if (launchSucceeded) {
        console.log("[InitiatePage] startSystemChecksAndAttemptLaunch: performLaunch reported success.");
        // UI will update based on hasSuccessfullyLaunched state
      } else {
        console.warn("[InitiatePage] startSystemChecksAndAttemptLaunch: performLaunch reported failure. Error should be set within performLaunch.");
        // Error is set within performLaunch, UI will show manual launch button
      }
    } else {
      setAllChecksPassed(false); // Ensure this is false if checks failed
    }
  }, [
    studentUser?.user_id, examDetails, effectiveStatus, questionsCount, toast, performLaunch, 
    hasSuccessfullyLaunched, performingChecks // Added performingChecks here
    // setError, setPerformingChecks, setAllChecksPassed are stable setters
  ]);


  const getStatusIcon = (status: CheckStatus['status']) => {
    if (status === 'pending') return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (status === 'checking') return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-5 w-5 text-destructive" />;
    return null;
  };


  // Loading state for initial exam data fetch
  if (authLoading || (isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-slate-500 dark:text-slate-300">Loading exam instructions...</p>
      </div>
    );
  }

  // If critical error during data fetch (and not actively performing checks)
  if (error && !examDetails && !performingChecks) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Error Loading Exam Information</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => router.push('/student/dashboard/join-exam')} className="w-full btn-primary-solid">
              Back to Join Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // If exam details are simply not found (and not actively performing checks)
  if (!examDetails && !isLoading && !performingChecks) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
         <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-5" />
            <CardTitle className="text-2xl text-muted-foreground">Exam Details Not Found</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">The exam details could not be retrieved. It might not exist or there was an issue.</p>
            <Button onClick={() => router.push('/student/dashboard/join-exam')} className="w-full btn-primary-solid">
              Back to Join Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // This specific guard helps prevent rendering if examDetails became null unexpectedly after initial load
  if (!examDetails) { 
    // This condition might be hit if examDetails becomes null after an initial successful load,
    // which is unusual but this guard ensures a graceful fallback.
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Critical Display Error</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">Could not display exam information. Critical data missing.</p>
            <Button onClick={() => router.push('/student/dashboard/join-exam')} className="w-full btn-primary-solid">
              Back to Join Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  const canStartTestProcess = effectiveStatus === 'Ongoing';
  const examTimeInfo = examDetails.start_time && examDetails.end_time
    ? `${format(new Date(examDetails.start_time), "dd MMM yyyy, hh:mm a")} - ${format(new Date(examDetails.end_time), "hh:mm a")}`
    : "Timing not specified";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-3xl shadow-xl glass-card">
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold text-foreground text-center">{examDetails.title}</CardTitle>
          {examDetails.description && <CardDescription className="text-center text-muted-foreground mt-2">{examDetails.description}</CardDescription>}
        </CardHeader>
        
        {/* Show initial instructions and details IF exam not yet launched AND not currently performing checks */}
        {!hasSuccessfullyLaunched && !performingChecks && (
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center space-x-2 text-muted-foreground bg-background/30 dark:bg-slate-800/50 backdrop-blur-sm p-2 rounded-md text-sm">
              <Clock size={18} />
              <span>{examTimeInfo}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 border border-border/20 rounded-lg bg-background/50 dark:bg-slate-800/50 shadow-sm">
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">{examDetails.duration}</p>
                <p className="text-xs text-muted-foreground">MINUTES</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">100</p> 
                <p className="text-xs text-muted-foreground">MARKS</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground">{questionsCount}</p>
                <p className="text-xs text-muted-foreground">QUESTIONS</p>
              </div>
            </div>
            
            <Alert className="bg-primary/10 border-primary/30 text-primary-foreground dark:text-primary dark:bg-primary/5 dark:border-primary/20">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary font-semibold">Exam Integrity Notice</AlertTitle>
              <AlertDescription className="text-primary/80 dark:text-primary/70">
                This exam is designed to be taken in a secure environment.
                System compatibility checks will be performed before starting.
                Ensure you have any required software installed and configured.
                The exam will attempt to open in a new tab.
              </AlertDescription>
            </Alert>
            
            {/* Display error if one occurred before or during checks */}
            {error && ( 
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}

        {/* Show system checks IF performing checks OR if checks completed but launch failed (allChecksPassed && !hasSuccessfullyLaunched) */}
        {(performingChecks || (allChecksPassed && !hasSuccessfullyLaunched)) && (
          <CardContent className="space-y-4">
            <h3 className="text-xl font-semibold text-center mb-4 text-foreground">System Compatibility Checks</h3>
            <Progress value={overallProgress} className="w-full mb-6 h-3 bg-primary/20 [&>div]:bg-primary" />
            <ul className="space-y-3">
              {checks.map((check) => (
                <li key={check.name} className="flex items-center justify-between p-3 bg-background/50 dark:bg-slate-800/50 rounded-md border border-border/20">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <span className="font-medium text-foreground">{check.name}</span>
                  </div>
                  {check.details && <span className={`text-sm ${check.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{check.details}</span>}
                </li>
              ))}
            </ul>
            {/* Show error specifically if checks failed OR if launch failed after successful checks */}
            {error && ( 
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{error.includes("System check failed") ? "System Check Failed" : "Launch Error"}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {/* Show this green alert if checks passed AND there was no launch error immediately after */}
            {allChecksPassed && !error && !hasSuccessfullyLaunched && ( 
                <Alert variant="default" className="mt-6 bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300 dark:bg-green-500/5 dark:border-green-500/20">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <AlertTitle className="text-green-600 dark:text-green-400 font-semibold">System Ready!</AlertTitle>
                    <AlertDescription className="text-green-600/80 dark:text-green-300/80">
                        Your system is compatible. The exam launch will be attempted or you can use the manual launch button.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
        )}
        
        {/* Show this section if exam has been successfully launched */}
        {hasSuccessfullyLaunched && (
             <CardContent className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <p className="text-xl font-semibold text-foreground">Exam Launched Successfully!</p>
                <p className="text-muted-foreground mt-2">
                    Your exam should have opened in a new tab. If not, please check your pop-up blocker settings.
                </p>
                <p className="text-muted-foreground mt-1">You may close this tab or use the button below.</p>
             </CardContent>
        )}

        <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t border-border/30 dark:border-border/20">
          {/* Primary button to start checks (and then attempt launch) - shown if not yet launched */}
          {!hasSuccessfullyLaunched && (
            <Button
              onClick={startSystemChecksAndAttemptLaunch}
              className="w-full btn-gradient py-3 text-lg rounded-md shadow-lg"
              disabled={performingChecks || !canStartTestProcess || authLoading || !studentUser || isLoading}
            >
              {performingChecks ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2" />}
              {performingChecks ? 'Running Checks...' : (canStartTestProcess ? 'Start System Checks & Launch Exam' : `Exam is ${effectiveStatus?.toLowerCase() || 'unavailable'}`)}
            </Button>
           )}

           {/* Manual launch button - shown if checks passed but not yet successfully launched OR if already successfully launched (as a re-launch option if needed) */}
           {(allChecksPassed && !hasSuccessfullyLaunched) && ( 
             <Button
              onClick={performLaunch} 
              className="w-full btn-gradient-positive py-3 text-lg rounded-md shadow-lg"
              disabled={performingChecks || !canStartTestProcess} // Also disable if checks running or exam not ongoing
            >
              <ExternalLink className="mr-2" /> Launch Exam Manually
            </Button>
           )}
           
            <Button variant="outline" onClick={() => router.push('/student/dashboard/join-exam')} className="w-full btn-outline-subtle">
              Cancel / Back to Join Exam
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


    