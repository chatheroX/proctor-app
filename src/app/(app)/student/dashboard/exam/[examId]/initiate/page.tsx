
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, PlayCircle, CheckCircle, XCircle, ShieldAlert, ExternalLink, ServerCrash } from 'lucide-react';
import type { Exam } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { encryptData } from '@/lib/crypto-utils';
import { format } from 'date-fns';

interface CheckStatus {
  name: string;
  status: 'pending' | 'checking' | 'success' | 'failed';
  details?: string;
}

const initialChecks: CheckStatus[] = [
  { name: 'Browser Compatibility (SEB Simulated)', status: 'pending' },
  { name: 'Internet Connectivity', status: 'pending' },
  { name: 'Secure Session Readiness', status: 'pending' },
];

export default function InitiateExamPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  // Destructure authError from AuthContext
  const { user: studentUser, isLoading: authLoading, supabase, authError: contextAuthError } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Local loading state for this page
  const [error, setError] = useState<string | null>(null); // Local error state for this page
  const [effectiveStatus, setEffectiveStatus] = useState<string | null>(null);
  
  const [checks, setChecks] = useState<CheckStatus[]>(initialChecks);
  const [overallProgress, setOverallProgress] = useState(0);
  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [performingChecks, setPerformingChecks] = useState(false);
  const [hasSuccessfullyLaunched, setHasSuccessfullyLaunched] = useState(false);

  const fetchExamData = useCallback(async () => {
    console.log("[InitiatePage] fetchExamData called. examId:", examId);
    if (!examId) {
      setError("Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    if (!supabase) { 
      setError("Service connection error. Please try again later.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null); // Clear previous local errors before fetching
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, start_time, end_time, status, exam_code')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      const currentExam = data as Exam;
      setExamDetails(currentExam);
      setEffectiveStatus(getEffectiveExamStatus(currentExam));

    } catch (e: any) {
      console.error("[InitiatePage] Failed to load exam data:", e.message, e);
      setError(e.message || "Failed to load exam data.");
      setExamDetails(null);
    } finally {
      setIsLoading(false);
      console.log("[InitiatePage] fetchExamData finished.");
    }
  }, [examId, supabase, setError, setIsLoading, setExamDetails, setEffectiveStatus]); // Added setters to dep array

  useEffect(() => {
    const localSetError = (msg: string) => {
        if (error !== msg) setError(msg);
        if (isLoading) setIsLoading(false);
    };
    const localSetIsLoading = (val: boolean) => {
        if (isLoading !== val) setIsLoading(val);
    };
    
    console.log(`[InitiatePage] Effect triggered. examId: ${examId}, authLoading (context): ${authLoading}, supabase available (context): ${!!supabase}, contextAuthError: ${contextAuthError}, localError: ${error}, localIsLoading: ${isLoading}`);

    if (authLoading) {
        console.log("[InitiatePage] Waiting for auth context to complete...");
        if (!isLoading) localSetIsLoading(true);
        return;
    }

    // AuthContext has finished loading (authLoading is false)
    if (contextAuthError) {
        console.error("[InitiatePage] Error from AuthContext:", contextAuthError);
        localSetError(contextAuthError); // Use the error message from AuthContext
        return;
    }

    if (!supabase) {
        // This case should ideally be caught by contextAuthError if Supabase client init failed in AuthContext
        console.error("[InitiatePage] Supabase client from AuthContext is null, and no AuthContext error was reported. This is unexpected. Setting local error.");
        localSetError("Service connection error. Please ensure you are connected and try again.");
        return;
    }

    if (!examId) {
        console.error("[InitiatePage] Exam ID is missing. Setting local error.");
        localSetError("Exam ID is missing. Cannot load exam details.");
        return;
    }

    // If error is already set (e.g. by previous checks), don't proceed to fetch
    if (error) {
        console.log("[InitiatePage] Local error already set, not fetching exam data. Error:", error);
        if(isLoading) localSetIsLoading(false); // Ensure local loading is false if error is set
        return;
    }
    
    // All prerequisites met (auth loaded, no context error, supabase client available, examId available, no local error)
    // Proceed to fetch exam data if not already fetched or if examId changed
    if (!examDetails || examDetails.exam_id !== examId) {
        console.log("[InitiatePage] Conditions met to fetch exam data.");
        fetchExamData(); // This function handles its own local setIsLoading and setError
    } else if (examDetails && examDetails.exam_id === examId && isLoading) {
        // Exam details already loaded, but local isLoading might still be true from initial state
        console.log("[InitiatePage] Exam details already loaded, ensuring local isLoading is false.");
        localSetIsLoading(false);
    }
    // If !examDetails && !isLoading && !error, fetchExamData should have been called or will be if deps change.
    // The fetchExamData itself will set error if it fails to find exam.
  }, [
    examId,
    authLoading,
    supabase,
    contextAuthError,
    fetchExamData,
    examDetails,
    isLoading, // local isLoading
    error,     // local error
    setError,  // local setError
    setIsLoading // local setIsLoading
  ]);

  const performLaunch = useCallback(async () => {
    console.log("[InitiatePage] performLaunch called. Conditions:", { allChecksPassed, examDetailsExists: !!examDetails, studentUserExists: !!studentUser?.user_id, errorExists: !!error, hasSuccessfullyLaunched });
    
    if (hasSuccessfullyLaunched) {
        toast({ title: "Already Launched", description: "Exam session was already initiated.", variant: "default" });
        return;
    }

    if (!allChecksPassed || !examDetails || !studentUser?.user_id || error) {
      const reasons = [];
      if (!allChecksPassed) reasons.push("system checks not passed");
      if (!examDetails) reasons.push("exam details missing");
      if (!studentUser?.user_id) reasons.push("student authentication missing");
      if (error) reasons.push(`an existing error: ${error}`);
      
      const description = `Cannot launch exam: ${reasons.join(', ')}. Please resolve the issues and try again.`;
      console.error(`[InitiatePage] ${description}`);
      toast({ title: "Cannot Launch Exam", description, variant: "destructive", duration: 7000 });
      setError(description); // Set local error state
      return;
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
        return;
    }
    
    const examSessionUrl = `/exam-session/${examDetails.exam_id}?token=${encodeURIComponent(encryptedToken)}`;
    const absoluteExamSessionUrl = `${window.location.origin}${examSessionUrl}`;

    const newWindow = window.open(absoluteExamSessionUrl, '_blank', 'noopener,noreferrer');
    
    if (newWindow) {
      toast({ title: "Exam Launching", description: "Exam is opening in a new tab. Please switch to it.", duration: 7000});
      setHasSuccessfullyLaunched(true);
      setError(null); 
    } else {
      const popupErrorMsg = "Could not open the exam in a new tab. Please ensure pop-ups are allowed for this site, then try again using the 'Launch Exam' button if available.";
      console.error(`[InitiatePage] Pop-up blocked or failed to open: "${popupErrorMsg}"`);
      setError(popupErrorMsg);
      toast({ title: "Launch Failed", description: popupErrorMsg, variant: "destructive", duration: 10000 });
      setHasSuccessfullyLaunched(false);
    }
  }, [allChecksPassed, examDetails, studentUser, toast, error, hasSuccessfullyLaunched, setError, setHasSuccessfullyLaunched]); // Added setError & setHasSuccessfullyLaunched

  const startSystemChecksAndAttemptLaunch = useCallback(async () => {
    console.log("[InitiatePage] startSystemChecksAndAttemptLaunch called.");
    if (hasSuccessfullyLaunched) {
      toast({ title: "Already Launched", description: "Exam session was already launched. Check other tabs.", variant: "default" });
      return;
    }
    if (performingChecks) return;

    if (!studentUser?.user_id) {
      setError("Student details not found. Please re-login.");
      toast({ title: "Authentication Error", description: "Student details not found.", variant: "destructive" });
      return;
    }
    if (!examDetails) {
        setError("Exam details are not loaded. Please try refreshing or rejoining.");
        toast({ title: "Error", description: "Exam details are not loaded.", variant: "destructive" });
        return;
    }
     // Re-evaluate effective status right before starting checks
    const currentEffectiveStatus = getEffectiveExamStatus(examDetails);
    if (currentEffectiveStatus !== 'Ongoing') {
      const statusMsg = `Exam is ${currentEffectiveStatus?.toLowerCase() || 'not available'}.`;
      setError(statusMsg);
      toast({ title: "Cannot Start", description: statusMsg, variant: "destructive" });
      return;
    }
    if (!examDetails.questions || examDetails.questions.length === 0) {
      setError("This exam has no questions.");
      toast({ title: "No Questions", description: "This exam has no questions.", variant: "destructive" });
      return;
    }

    setPerformingChecks(true);
    setError(null); // Clear previous errors before starting checks
    setAllChecksPassed(false);
    setChecks(initialChecks.map(c => ({ ...c, status: 'pending', details: undefined })));
    setOverallProgress(0);

    let checksSuccessful = true;
    for (let i = 0; i < initialChecks.length; i++) {
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'checking' } : c));
      await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 300)); 

      // Simulate all checks passing for now. Replace with actual checks.
      const isSuccess = true; 
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: isSuccess ? 'success' : 'failed', details: isSuccess ? 'Compatible' : 'Check Failed' } : c));
      setOverallProgress(((i + 1) / initialChecks.length) * 100);
      if (!isSuccess) {
        const checkFailError = `System check failed: ${initialChecks[i].name}. Cannot proceed.`;
        setError(checkFailError); // Set local error
        checksSuccessful = false;
        break; 
      }
    }
    
    setPerformingChecks(false);

    if (checksSuccessful) {
      setAllChecksPassed(true); 
      toast({ title: "System Checks Passed!", description: "Attempting to launch exam...", variant: "default" });
      await performLaunch(); 
    } else {
      setAllChecksPassed(false);
      // Error state should already be set by the failed check
    }
  }, [
    studentUser?.user_id, examDetails, toast, performingChecks,
    performLaunch, setError, setPerformingChecks, setAllChecksPassed, setChecks, setOverallProgress, hasSuccessfullyLaunched
  ]);


  const getStatusIcon = (status: CheckStatus['status']) => {
    if (status === 'pending') return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (status === 'checking') return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-5 w-5 text-destructive" />;
    return null;
  };


  // Primary loading state for the page: considers AuthContext loading AND local data fetching loading
  if (authLoading || (isLoading && !examDetails && !error && !contextAuthError)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-slate-500 dark:text-slate-300">
          {authLoading ? "Verifying session..." : "Loading exam instructions..."}
        </p>
      </div>
    );
  }

  // If there's an error (either from context or local), and we are not actively performing checks or already launched
  if (error && !performingChecks && !hasSuccessfullyLaunched) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Error Loading Exam</CardTitle>
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
  
  // If no exam details after loading, and not in error state or performing checks/launched
  if (!examDetails && !isLoading && !performingChecks && !hasSuccessfullyLaunched) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
         <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-5" />
            <CardTitle className="text-2xl text-muted-foreground">Exam Details Not Found</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">The exam details could not be retrieved or the exam is unavailable.</p>
            <Button onClick={() => router.push('/student/dashboard/join-exam')} className="w-full btn-primary-solid">
              Back to Join Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Fallback critical error if examDetails is null when it shouldn't be
  if (!examDetails && !hasSuccessfullyLaunched) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Critical Display Error</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">Could not display exam information. Please try again.</p>
            <Button onClick={() => router.push('/student/dashboard/join-exam')} className="w-full btn-primary-solid">
              Back to Join Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canStartTestProcess = examDetails && effectiveStatus === 'Ongoing';
  const examTimeString = examDetails && examDetails.start_time && examDetails.end_time
    ? `${format(new Date(examDetails.start_time), "dd MMM yyyy, hh:mm a")} - ${format(new Date(examDetails.end_time), "hh:mm a")}`
    : "Timing not specified";

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900 p-4">
      <Card className="w-full max-w-3xl shadow-xl glass-card">
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold text-foreground text-center">{examDetails?.title || "Exam Title"}</CardTitle>
          {examDetails?.description && <CardDescription className="text-center text-muted-foreground mt-2">{examDetails.description}</CardDescription>}
        </CardHeader>
        
        {!hasSuccessfullyLaunched && !performingChecks && (
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center space-x-2 text-muted-foreground bg-background/30 dark:bg-slate-800/50 backdrop-blur-sm p-2 rounded-md text-sm">
              <PlayCircle size={18} /> 
              <span>Status: {effectiveStatus || "Loading..."}</span>
              <span className="mx-1">|</span>
              <PlayCircle size={18} />
              <span>{examTimeString}</span>
            </div>
            <Alert className="bg-primary/10 border-primary/30 text-primary-foreground dark:text-primary dark:bg-primary/5 dark:border-primary/20">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary font-semibold">Exam Launch Notice</AlertTitle>
              <AlertDescription className="text-primary/80 dark:text-primary/70">
                System checks will be performed. Clicking 'Proceed' will attempt to launch the exam in a new tab.
                This exam requires a secure environment.
              </AlertDescription>
            </Alert>
            {/* Display local error specific to this page's operations, if any, and not an auth context error */}
            {error && !contextAuthError && ( 
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}

        {performingChecks && (
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
            {/* Display error related to system checks if checks failed */}
            {error && !allChecksPassed && ( 
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>System Check Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
          </CardContent>
        )}
        
        {hasSuccessfullyLaunched && (
             <CardContent className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <p className="text-xl font-semibold text-foreground">Exam Launched!</p>
                <p className="text-muted-foreground mt-2">
                    The exam should have opened in a new tab. Please switch to it to begin.
                </p>
                <p className="text-muted-foreground mt-1">If the new tab did not open, please ensure pop-ups are allowed for this site and try the manual launch button if available, or contact support.</p>
                 {(error && !newWindow) && ( // newWindow not available here, so rely on error state for manual launch button
                    <Button variant="outline" onClick={performLaunch} className="mt-4 btn-outline-subtle">
                        <ExternalLink className="mr-2 h-4 w-4" /> Try Launching Again
                    </Button>
                 )}
             </CardContent>
        )}

        <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t border-border/30 dark:border-border/20">
          {!hasSuccessfullyLaunched && (
            <Button
              onClick={startSystemChecksAndAttemptLaunch}
              className="w-full btn-gradient py-3 text-lg rounded-md shadow-lg"
              disabled={performingChecks || !canStartTestProcess || authLoading || !studentUser || isLoading || (!!error && !contextAuthError && !allChecksPassed)}
            >
              {performingChecks ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2" />}
              {performingChecks ? 'Running Checks...' : (canStartTestProcess ? 'Start System Checks & Launch Exam' : `Exam is ${effectiveStatus?.toLowerCase() || 'unavailable'}`)}
            </Button>
           )}
           
           {allChecksPassed && !hasSuccessfullyLaunched && !performingChecks && (
             <Button variant="outline" onClick={performLaunch} className="w-full btn-primary-solid">
                <ExternalLink className="mr-2 h-4 w-4" /> Launch Exam Manually
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
      
    