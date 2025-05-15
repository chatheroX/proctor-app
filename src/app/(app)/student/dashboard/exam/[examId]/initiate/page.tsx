
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, Clock, HelpCircle, ListChecks, PlayCircle, ExternalLink, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam, Question } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { format } from 'date-fns';

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
  const [questionsCount, setQuestionsCount] = useState(0); // Only count, not full questions
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [effectiveStatus, setEffectiveStatus] = useState<string | null>(null);
  
  // State for system checks
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
      // Fetch only essential details for the instruction page
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, start_time, end_time, status')
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
  }, [examId, supabase]);

  useEffect(() => {
    if (examId && !authLoading && supabase) {
      if (!examDetails || examDetails.exam_id !== examId) {
         fetchExamData();
      }
    }
  }, [examId, authLoading, supabase, fetchExamData, examDetails]);

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
    setError(null); // Clear previous check errors
    setAllChecksPassed(false);
    setChecks(initialChecks.map(c => ({ ...c, status: 'pending', details: undefined })));
    setOverallProgress(0);

    for (let i = 0; i < initialChecks.length; i++) {
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'checking' } : c));
      await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 500)); // Simulate check

      const isSuccess = Math.random() > 0.05; // High success rate for demo
      setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: isSuccess ? 'success' : 'failed', details: isSuccess ? 'Compatible' : 'Incompatible - Please resolve.' } : c));
      setOverallProgress(((i + 1) / initialChecks.length) * 100);
      if (!isSuccess) {
        setError(`System check failed: ${initialChecks[i].name}. Cannot proceed with the exam.`);
        setPerformingChecks(false);
        return;
      }
    }
    setAllChecksPassed(true);
    setPerformingChecks(false);
    toast({ title: "System Checks Passed!", description: "You can now proceed to the exam.", variant: "default" });
  }, [studentUser?.user_id, examDetails, effectiveStatus, questionsCount, toast, examId]);


  const launchExamInNewTab = useCallback(() => {
    if (!allChecksPassed || !examDetails || !studentUser) {
      toast({ title: "Cannot Launch", description: "System checks not passed or exam/user data missing.", variant: "destructive" });
      return;
    }

    // For developer testing, we just open the /take page.
    // For actual SEB, this URL would be the SEB-specific link.
    // "Encrypted" URL simulation (basic base64 encoding for demo)
    // In a real scenario, this would involve more secure token generation and server-side validation.
    const payload = JSON.stringify({ examId: examDetails.exam_id, studentId: studentUser.user_id, timestamp: Date.now() });
    const token = typeof window !== 'undefined' ? btoa(payload) : ''; // Basic encoding, NOT encryption
    
    const examUrl = `/student/dashboard/exam/${examDetails.exam_id}/take?token=${encodeURIComponent(token)}`;
    
    // Attempt to open in a new tab.
    // The 'noopener,noreferrer,resizable=yes,scrollbars=yes,status=yes' options are good practice for new tabs.
    // For SEB, specific kiosk mode flags might be needed if SEB is launched via a custom protocol from this link.
    const newWindow = window.open(examUrl, '_blank', 'noopener,noreferrer,resizable=yes,scrollbars=yes,status=yes');

    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      setError("Could not open the exam in a new tab. Please ensure pop-ups are allowed for this site, then try again.");
      toast({
          title: "Pop-up Blocked?",
          description: "Could not open exam. Please disable pop-up blocker or use the manual launch button.",
          variant: "destructive",
          duration: 7000,
      });
    } else {
      // Optional: Redirect current tab to a "waiting" or "exam in progress" page
      // For simplicity, we can just inform the user.
      toast({ title: "Exam Launched!", description: "The exam has opened in a new tab." });
      // Maybe close this "initiate" tab after a delay, or redirect to exam history
      // router.push('/student/dashboard/exam-history');
    }
  }, [allChecksPassed, examDetails, studentUser, toast, router]);

  const getStatusIcon = (status: CheckStatus['status']) => {
    if (status === 'pending') return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (status === 'checking') return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-5 w-5 text-destructive" />;
    return null;
  };


  if (authLoading || (isLoading && !examDetails && !error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam instructions...</p>
      </div>
    );
  }

  if (error && !examDetails && !performingChecks) {
    // This error state is for when exam details themselves fail to load,
    // not for when a system check fails.
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Exam Information</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <Button onClick={() => router.push('/student/dashboard/join-exam')} className="mt-4">
          Back to Join Exam
        </Button>
      </div>
    );
  }

  if (!examDetails && !isLoading && !performingChecks) {
     // Handles case where exam details are null after loading attempt (e.g., not found but no specific error string)
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground text-center">Exam details not found.</p>
         <Button onClick={() => router.push('/student/dashboard/join-exam')} className="mt-4">
          Back to Join Exam
        </Button>
      </div>
    );
  }
  
  // If examDetails is null at this point (should be caught above, but defensive)
  if (!examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground text-center">Could not display exam information. Critical data missing.</p>
         <Button onClick={() => router.push('/student/dashboard/join-exam')} className="mt-4">
          Back to Join Exam
        </Button>
      </div>
    );
  }


  const canStartTestProcess = effectiveStatus === 'Ongoing';
  const examTimeInfo = examDetails.start_time && examDetails.end_time
    ? `${format(new Date(examDetails.start_time), "dd MMM yyyy, hh:mm a")} - ${format(new Date(examDetails.end_time), "hh:mm a")}`
    : "Timing not specified";

  // Main UI: Exam Instructions or System Checks
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl md:text-4xl font-bold text-gray-800 text-center">{examDetails.title}</CardTitle>
          {examDetails.description && <CardDescription className="text-center text-gray-600 mt-2">{examDetails.description}</CardDescription>}
        </CardHeader>
        
        {!performingChecks && !allChecksPassed && (
          <CardContent className="space-y-6">
            <div className="flex items-center justify-center space-x-2 text-gray-500 bg-gray-100 p-2 rounded-md text-sm">
              <Clock size={18} />
              <span>{examTimeInfo}</span>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
              <div className="text-center">
                <p className="text-xl font-semibold text-gray-700">{examDetails.duration}</p>
                <p className="text-xs text-gray-500">MINUTES</p>
                <p className="text-xs text-gray-500">Duration</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-gray-700">100</p> {/* Placeholder */}
                <p className="text-xs text-gray-500">MARKS</p>
                <p className="text-xs text-gray-500">Max Marks</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-semibold text-gray-700">{questionsCount}</p>
                <p className="text-xs text-gray-500">QUESTIONS</p>
                <p className="text-xs text-gray-500">Total Questions</p>
              </div>
            </div>
            
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Exam Integrity Notice</AlertTitle>
              <AlertDescription>
                This exam will be monitored. Ensure you adhere to all exam regulations.
                System compatibility checks will be performed before starting.
                For SEB compatibility, ensure you have SEB installed.
              </AlertDescription>
            </Alert>
            
            {error && ( // This error is for exam details loading issues, or system check failures shown before starting checks
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
            <h3 className="text-xl font-semibold text-center mb-4">System Compatibility Checks</h3>
            <Progress value={overallProgress} className="w-full mb-6 h-3" />
            <ul className="space-y-3">
              {checks.map((check) => (
                <li key={check.name} className="flex items-center justify-between p-3 bg-background rounded-md border">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(check.status)}
                    <span className="font-medium">{check.name}</span>
                  </div>
                  {check.details && <span className={`text-sm ${check.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{check.details}</span>}
                </li>
              ))}
            </ul>
             {error && !allChecksPassed && ( // Show check-specific errors if checks are running/failed
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>System Check Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {allChecksPassed && !error && (
                <Alert variant="default" className="mt-6 bg-green-500/10 border-green-500/30">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <AlertTitle className="text-green-700 font-semibold">System Ready!</AlertTitle>
                    <AlertDescription className="text-green-600/80">
                        Your system is compatible. The exam will open in a new tab.
                        If it doesn&apos;t, please ensure pop-ups are allowed and use the "Launch Exam Manually" button.
                    </AlertDescription>
                </Alert>
            )}
          </CardContent>
        )}
        
        <CardFooter className="flex flex-col items-center gap-3 pt-6 border-t">
           {!allChecksPassed && (
            <Button
              onClick={startSystemChecks}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg rounded-md shadow-md"
              disabled={performingChecks || !canStartTestProcess || authLoading || !studentUser || isLoading}
            >
              {performingChecks ? <Loader2 className="animate-spin mr-2"/> : <PlayCircle className="mr-2" />}
              {performingChecks ? 'Running Checks...' : (canStartTestProcess ? 'Start System Checks & Proceed' : `Exam is ${effectiveStatus?.toLowerCase() || 'unavailable'}`)}
            </Button>
           )}
           {allChecksPassed && !error && (
             <Button
              onClick={launchExamInNewTab}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg rounded-md shadow-md"
            >
              <ExternalLink className="mr-2" /> Launch Exam in New Tab
            </Button>
           )}
            <Button variant="outline" onClick={() => router.push('/student/dashboard/join-exam')} className="w-full">
              Cancel / Back to Join Exam
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
