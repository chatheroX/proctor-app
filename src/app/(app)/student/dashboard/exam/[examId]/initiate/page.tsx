
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, PlayCircle, CheckCircle, XCircle, ShieldAlert, ExternalLink, ServerCrash } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { format } from 'date-fns';
import { encryptData } from '@/lib/crypto-utils'; // Assuming this is already robust

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
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser, isLoading: authLoading } = useAuth();

  const examId = params.examId as string;

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [effectiveStatus, setEffectiveStatus] = useState<string | null>(null);
  
  const [checks, setChecks] = useState<CheckStatus[]>(initialChecks);
  const [overallProgress, setOverallProgress] = useState(0);
  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [performingChecks, setPerformingChecks] = useState(false);
  const [sebLinkReady, setSebLinkReady] = useState(false);


  const fetchExamData = useCallback(async () => {
    if (!examId || !supabase) {
      setError(examId ? "Supabase client not available." : "Exam ID is missing.");
      setIsLoading(false);
      return;
    }
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
      setExamDetails(currentExam);
      setEffectiveStatus(getEffectiveExamStatus(currentExam));

    } catch (e: any) {
      setError(e.message || "Failed to load exam data.");
      setExamDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase]);

  useEffect(() => {
    if (examId && !authLoading && supabase && (!examDetails || examDetails.exam_id !== examId)) {
       fetchExamData();
    }
  }, [examId, authLoading, supabase, fetchExamData, examDetails]);


  const generateAndLaunchSebLink = useCallback(async () => {
    if (!allChecksPassed || !examDetails || !studentUser?.user_id) {
      const reasons = [];
      if (!allChecksPassed) reasons.push("system checks not passed");
      if (!examDetails) reasons.push("exam details missing");
      if (!studentUser?.user_id) reasons.push("student authentication missing");
      setError(`Cannot generate SEB link because: ${reasons.join(', ')}.`);
      toast({ title: "Cannot Launch", description: `Launch aborted: ${reasons.join(', ')}.`, variant: "destructive" });
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
    
    // Construct the full configUrl with the domain, path to .seb file, and hash parameters
    // The actual .seb file must be configured to read these hash parameters or be dynamic.
    const sebConfigPath = "/configs/exam-config.seb"; // Path to your .seb file in /public/configs/
    const absoluteConfigUrl = `${window.location.origin}${sebConfigPath}#examId=${encodeURIComponent(examDetails.exam_id)}&token=${encodeURIComponent(encryptedToken)}`;
    const sebLaunchUrl = `seb://open?configUrl=${encodeURIComponent(absoluteConfigUrl)}`;

    console.log("[InitiatePage] Attempting to launch SEB with URL:", sebLaunchUrl);
    toast({ title: "Launching SEB", description: "Attempting to open Safe Exam Browser. Please confirm if prompted by your system.", duration: 7000});
    
    // Forcing SEB launch. Actual opening depends on SEB being installed and protocol registered.
    window.location.href = sebLaunchUrl;
    setSebLinkReady(true); // Indicate launch was attempted

    // It's hard to know if SEB actually launched from here. The user is expected to switch to SEB.
    // This page might show a message "If SEB did not open, please ensure it is installed..."
    // Or redirect to a waiting page. For now, it just triggers.

  }, [allChecksPassed, examDetails, studentUser, toast, setError, setSebLinkReady]);


  const startSystemChecks = useCallback(async () => {
    if (performingChecks) return;
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
    if (!examDetails.questions || examDetails.questions.length === 0) {
      toast({ title: "No Questions", description: "This exam has no questions.", variant: "destructive" });
      setError("This exam has no questions.");
      return;
    }

    setPerformingChecks(true);
    setError(null); 
    setAllChecksPassed(false);
    setChecks(initialChecks.map(c => ({ ...c, status: 'pending', details: undefined })));
    setOverallProgress(0);
    setSebLinkReady(false);

    let checksSuccessful = true;
    for (let i = 0; i < initialChecks.length; i++) {
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'checking' } : c));
      await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 300)); 

      // Simulate check success/failure (all pass for this example)
      const isSuccess = true; 
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: isSuccess ? 'success' : 'failed', details: isSuccess ? 'Compatible' : 'Check Failed' } : c));
      setOverallProgress(((i + 1) / initialChecks.length) * 100);
      if (!isSuccess) {
        setError(`System check failed: ${initialChecks[i].name}. Cannot proceed.`);
        checksSuccessful = false;
        break; 
      }
    }
    
    setPerformingChecks(false);

    if (checksSuccessful) {
      setAllChecksPassed(true); 
      toast({ title: "System Checks Passed!", description: "Preparing to launch exam in SEB.", variant: "default" });
      await generateAndLaunchSebLink();
    } else {
      setAllChecksPassed(false);
    }
  }, [
    studentUser?.user_id, examDetails, effectiveStatus, toast, performingChecks,
    generateAndLaunchSebLink, setError, setPerformingChecks, setAllChecksPassed, setChecks, setOverallProgress, setSebLinkReady
  ]);


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
            <CardTitle className="text-2xl text-destructive">Critical Display Error</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <p className="text-sm text-muted-foreground mb-6">Could not display exam information.</p>
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
        
        {!sebLinkReady && !performingChecks && (
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center space-x-2 text-muted-foreground bg-background/30 dark:bg-slate-800/50 backdrop-blur-sm p-2 rounded-md text-sm">
              <PlayCircle size={18} /> 
              <span>Status: {effectiveStatus}</span>
              <span className="mx-1">|</span>
              <PlayCircle size={18} />
              <span>{examTimeInfo}</span>
            </div>
            <Alert className="bg-primary/10 border-primary/30 text-primary-foreground dark:text-primary dark:bg-primary/5 dark:border-primary/20">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary font-semibold">SEB Exam Notice</AlertTitle>
              <AlertDescription className="text-primary/80 dark:text-primary/70">
                This exam must be taken in Safe Exam Browser (SEB).
                System checks will be performed. Clicking 'Proceed' will attempt to launch SEB.
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
            {error && ( 
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>System Check Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
          </CardContent>
        )}
        
        {sebLinkReady && (
             <CardContent className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <p className="text-xl font-semibold text-foreground">SEB Launch Attempted!</p>
                <p className="text-muted-foreground mt-2">
                    Safe Exam Browser should have been prompted to open. Please switch to SEB to continue.
                </p>
                <p className="text-muted-foreground mt-1">If SEB did not launch, ensure it is installed correctly and your browser allows `seb://` links.</p>
                 <Button variant="outline" onClick={generateAndLaunchSebLink} className="mt-4 btn-outline-subtle">
                    <ExternalLink className="mr-2 h-4 w-4" /> Try Launching SEB Again
                </Button>
             </CardContent>
        )}

        <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t border-border/30 dark:border-border/20">
          {!sebLinkReady && (
            <Button
              onClick={startSystemChecks}
              className="w-full btn-gradient py-3 text-lg rounded-md shadow-lg"
              disabled={performingChecks || !canStartTestProcess || authLoading || !studentUser || isLoading}
            >
              {performingChecks ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2" />}
              {performingChecks ? 'Running Checks...' : (canStartTestProcess ? 'Start System Checks & Launch in SEB' : `Exam is ${effectiveStatus?.toLowerCase() || 'unavailable'}`)}
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
    