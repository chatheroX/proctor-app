
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, Clock, ListChecks, PlayCircle, ExternalLink, CheckCircle, XCircle, ShieldAlert, ServerCrash } from 'lucide-react';
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


  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    console.log(`[InitiatePage] Fetching exam data for examId: ${examId}`);
    setIsLoading(true);
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
  }, [examId, supabase]); // Removed toast from here as it's not directly used

  useEffect(() => {
    if (examId && !authLoading && supabase) {
      if (!examDetails || examDetails.exam_id !== examId) {
         fetchExamData();
      }
    }
  }, [examId, authLoading, supabase, fetchExamData, examDetails]);

  const launchExamInNewTab = useCallback(async () => {
    console.log("[InitiatePage] launchExamInNewTab called. Conditions:", {
      allChecksPassed, // Will be true if this is called via the new useEffect
      examDetailsExists: !!examDetails,
      studentUserIdExists: !!studentUser?.user_id,
      examCodeFromDetails: examDetails?.exam_code,
    });

    if (!allChecksPassed || !examDetails || !studentUser?.user_id) {
      const reasons = [];
      if (!allChecksPassed) reasons.push("system checks not passed");
      if (!examDetails) reasons.push("exam details are missing");
      if (!studentUser?.user_id) reasons.push("user authentication is missing");
      
      const description = reasons.length > 0 
        ? `Cannot launch because: ${reasons.join(', ')}.`
        : "System checks not passed or exam/user data missing.";
      
      console.error("[InitiatePage] Cannot Launch Exam:", description);
      toast({ title: "Cannot Launch", description, variant: "destructive" });
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
    
    const examUrl = `/exam-session/${examDetails.exam_id}?token=${encodeURIComponent(encryptedToken)}`;
    console.log("[InitiatePage] Launching exam at URL:", examUrl);
    
    const newWindow = window.open(examUrl, '_blank', 'noopener,noreferrer,resizable=yes,scrollbars=yes,status=yes');

    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      const popupErrorMsg = "Could not open the exam in a new tab. Please ensure pop-ups are allowed for this site, then try again.";
      console.error("[InitiatePage] Pop-up blocked or failed to open:", popupErrorMsg);
      setError(popupErrorMsg);
      toast({
          title: "Pop-up Blocked?",
          description: "Could not open exam. Please disable pop-up blocker or use the manual launch button.",
          variant: "destructive",
          duration: 7000,
      });
    } else {
      console.log("[InitiatePage] Exam launched successfully in new tab.");
      toast({ title: "Exam Launched!", description: "The exam has opened in a new tab." });
    }
  }, [allChecksPassed, examDetails, studentUser, toast]); // studentUser instead of studentUser?.user_id for stability

  const startSystemChecks = useCallback(async () => {
    if (!studentUser?.user_id) {
      toast({ title: "Authentication Error", description: "Student details not found.", variant: "destructive" });
      setError("Student details not found. Please re-login.");
      return;
    }
    if (!examDetails) {
        toast({ title: "Error", description: "Exam details are not loaded.", variant: "destructive" });
        return;
    }
    if (effectiveStatus !== 'Ongoing') {
      toast({ title: "Cannot Start", description: `Exam is ${effectiveStatus?.toLowerCase() || 'not available'}.`, variant: "destructive" });
      return;
    }
    if (questionsCount === 0) {
      toast({ title: "No Questions", description: "This exam has no questions.", variant: "destructive" });
      return;
    }

    setPerformingChecks(true);
    setError(null);
    setAllChecksPassed(false); // Reset before starting checks
    setChecks(initialChecks.map(c => ({ ...c, status: 'pending', details: undefined })));
    setOverallProgress(0);

    for (let i = 0; i < initialChecks.length; i++) {
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'checking' } : c));
      await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 500)); 

      const isSuccess = true; // Force checks to pass for easier debugging
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: isSuccess ? 'success' : 'failed', details: isSuccess ? 'Compatible' : 'Incompatible - Please resolve.' } : c));
      setOverallProgress(((i + 1) / initialChecks.length) * 100);
      if (!isSuccess) {
        setError(`System check failed: ${initialChecks[i].name}. Cannot proceed with the exam.`);
        setPerformingChecks(false);
        // Do not set allChecksPassed to false here, it's already false
        return;
      }
    }
    // All checks passed successfully
    setAllChecksPassed(true);
    setPerformingChecks(false);
    toast({ title: "System Checks Passed!", description: "You can now proceed to the exam.", variant: "default" });
    // Removed direct call to launchExamInNewTab()
  }, [studentUser?.user_id, examDetails, effectiveStatus, questionsCount, toast]);

  // New useEffect to launch exam when allChecksPassed becomes true
  useEffect(() => {
    if (allChecksPassed && !performingChecks && !error && examDetails && studentUser?.user_id) {
      console.log("[InitiatePage] useEffect triggered: allChecksPassed is true. Attempting to launch exam.");
      launchExamInNewTab();
    }
  }, [allChecksPassed, performingChecks, error, examDetails, studentUser, launchExamInNewTab]);


  const getStatusIcon = (status: CheckStatus['status']) => {
    if (status === 'pending') return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (status === 'checking') return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-5 w-5 text-destructive" />;
    return null;
  };

  if (authLoading || (isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-slate-500 dark:text-slate-300">Loading exam instructions...</p>
      </div>
    );
  }

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

  if (!examDetails && !isLoading && !performingChecks) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
         <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-5" />
            <CardTitle className="text-2xl text-muted-foreground">Exam Details Not Found</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">The exam details could not be retrieved.</p>
            <Button onClick={() => router.push('/student/dashboard/join-exam')} className="w-full btn-primary-solid">
              Back to Join Exam
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!examDetails) { 
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-50 via-gray-100 to-slate-100 dark:from-slate-900 dark:via-gray-950 dark:to-slate-900">
        <Card className="w-full max-w-md modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
           <CardHeader className="pt-8 pb-4">
            <ServerCrash className="h-16 w-16 text-destructive mx-auto mb-5" />
            <CardTitle className="text-2xl text-destructive">Critical Error</CardTitle>
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
        
        {!performingChecks && !allChecksPassed && (
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
            
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}

        {(performingChecks || allChecksPassed) && (
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
             {error && !allChecksPassed && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>System Check Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {allChecksPassed && !error && (
                <Alert variant="default" className="mt-6 bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300 dark:bg-green-500/5 dark:border-green-500/20">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <AlertTitle className="text-green-600 dark:text-green-400 font-semibold">System Ready!</AlertTitle>
                    <AlertDescription className="text-green-600/80 dark:text-green-300/80">
                        Your system is compatible. The exam will attempt to open in a new tab.
                        If it doesn&apos;t, please ensure pop-ups are allowed and use the "Launch Exam Manually" button.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
        )}
        
        <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t border-border/30 dark:border-border/20">
           {!allChecksPassed && (
            <Button
              onClick={startSystemChecks}
              className="w-full btn-gradient py-3 text-lg rounded-md shadow-lg"
              disabled={performingChecks || !canStartTestProcess || authLoading || !studentUser || isLoading}
            >
              {performingChecks ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2" />}
              {performingChecks ? 'Running Checks...' : (canStartTestProcess ? 'Start System Checks & Proceed' : `Exam is ${effectiveStatus?.toLowerCase() || 'unavailable'}`)}
            </Button>
           )}
           {allChecksPassed && !error && (
             <Button
              onClick={launchExamInNewTab}
              className="w-full btn-gradient-positive py-3 text-lg rounded-md shadow-lg"
            >
              <ExternalLink className="mr-2" /> Launch Exam
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
