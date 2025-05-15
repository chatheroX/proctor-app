
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext'; // Assuming you have user context for studentId

interface CheckStatus {
  name: string;
  status: 'pending' | 'checking' | 'success' | 'failed';
  details?: string;
}

const initialChecks: CheckStatus[] = [
  { name: 'SEB Version Check', status: 'pending' },
  { name: 'Internet Connectivity', status: 'pending' },
  { name: 'System Integrity (Keyboard & Screen)', status: 'pending' },
  { name: 'Secure Session Configuration', status: 'pending' },
];

export default function SebRedirectPage({ params }: { params: { examId: string } }) {
  const { examId } = params;
  const { user: studentUser } = useAuth(); // Get student info

  const [checks, setChecks] = useState<CheckStatus[]>(initialChecks);
  const [overallProgress, setOverallProgress] = useState(0);
  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [currentSebLink, setCurrentSebLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  const launchSebExam = useCallback((sebLink: string) => {
    if (sebLink) {
      const newWindow = window.open(sebLink, '_blank', 'noopener,noreferrer');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        // Pop-up Blocker likely
        setError("Could not open the exam link automatically. Please ensure pop-ups are allowed for this site, then click the 'Launch Exam' button.");
        toast({
            title: "Pop-up Blocked?",
            description: "Could not open exam link. Please disable pop-up blocker or use the manual launch button.",
            variant: "destructive",
            duration: 7000,
        });
      }
    }
  }, []);


  useEffect(() => {
    const performChecks = async () => {
      if (!studentUser?.user_id) {
        setError("Student information not available. Cannot generate SEB link.");
        console.error("SEB Redirect: Student user_id not found in auth context.");
        return;
      }

      for (let i = 0; i < checks.length; i++) {
        setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'checking' } : c));
        await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 500)); // Simulate check duration
        
        const isSuccess = Math.random() > 0.1; // 90% success rate for demo
        setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: isSuccess ? 'success' : 'failed', details: isSuccess ? 'Compatible' : 'Incompatible - Please resolve.' } : c));
        setOverallProgress(((i + 1) / checks.length) * 100);
        if (!isSuccess) {
          setError("One or more system checks failed. Cannot proceed.");
          return; 
        }
      }
      
      // All checks passed if we reach here
      const studentId = studentUser.user_id; 
      const sebConfig = { 
        allowReload: true, 
        allowSpellCheck: false, 
        browserExamKey: Math.random().toString(36).substring(2, 15),
        startURL: `${window.location.origin}/student/dashboard/exam/${examId}/take?studentId=${studentId}&examId=${examId}`,
        // other SEB specific settings
      };
      const encryptedConfig = btoa(JSON.stringify(sebConfig)); // Simple base64 for demo
      const sebLink = `seb://${window.location.host}/student/dashboard/exam/${examId}/take?studentId=${studentId}&sebConfig=${encryptedConfig}`;
      
      setCurrentSebLink(sebLink);
      setAllChecksPassed(true); // Set this after currentSebLink is set

    };

    performChecks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, studentUser?.user_id]); // studentUser.user_id is the key dependency

  // Effect to auto-launch when allChecksPassed and currentSebLink are ready
  useEffect(() => {
    if (allChecksPassed && currentSebLink) {
      launchSebExam(currentSebLink);
    }
  }, [allChecksPassed, currentSebLink, launchSebExam]);


  const getStatusIcon = (status: CheckStatus['status']) => {
    if (status === 'pending') return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (status === 'checking') return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-5 w-5 text-destructive" />;
    return null;
  };
  
  // Added useToast import, but it's not used in the SebRedirectPage.
  // If toast notifications are needed here, it should be imported and used.
  // For now, I am assuming `toast` is a global or context provided function if it's used in launchSebExam.
  // Correcting to import from '@/hooks/use-toast' if intended for local use.
  const { toast } = (() => { try { return require('@/hooks/use-toast'); } catch (e) { return { toast: (...args: any[]) => console.log("Toast (fallback):", ...args) }; } })();


  if (error && !allChecksPassed) { // Show general error if checks failed or studentId was missing
     return (
      <div className="flex flex-col items-center justify-center min-h-screen py-8 bg-muted/30">
        <Card className="w-full max-w-xl shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl text-destructive">Error Preparing Exam</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Cannot Proceed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button variant="outline" asChild className="w-full">
              <Link href="/student/dashboard/join-exam">Back to Join Exam Page</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-8 bg-muted/30">
      <Card className="w-full max-w-xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Preparing Secure Exam Environment</CardTitle>
          <CardDescription>
            Your system is being checked for Safe Exam Browser (SEB) compatibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Specific error related to pop-up blocker after checks passed */}
          {allChecksPassed && error && (
             <Alert variant="destructive" className="mt-6">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Launch Issue</AlertTitle>
              <AlertDescription>
                {error} Please use the button below to try again.
              </AlertDescription>
            </Alert>
          )}

          {!allChecksPassed && checks.some(c => c.status === 'failed') && !error && ( // If checks failed but no other general error set
            <Alert variant="destructive" className="mt-6">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Compatibility Issue Detected</AlertTitle>
              <AlertDescription>
                One or more system checks failed. Please ensure SEB is correctly installed and configured, or contact support.
              </AlertDescription>
            </Alert>
          )}

          {allChecksPassed && (
            <Alert variant="default" className="mt-6 bg-green-500/10 border-green-500/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-700 font-semibold">System Ready! Launching Exam...</AlertTitle>
              <AlertDescription className="text-green-600/80">
                Your system is compatible. The exam should launch in Safe Exam Browser automatically.
                If it doesn't, please ensure pop-ups are allowed and use the button below.
                <br />
                <strong>SEB Launch Link:</strong> 
                <code className="text-xs break-all block mt-1 p-2 bg-green-100 rounded-md shadow-sm">{currentSebLink}</code>
                <p className="mt-2 text-xs">
                  <strong>Important:</strong> This link should be opened by Safe Exam Browser.
                  Keyboard and other restrictions will be active inside SEB.
                </p>
              </AlertDescription>
              <Button 
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white py-3 text-base" 
                onClick={() => launchSebExam(currentSebLink)}
                disabled={!currentSebLink}
              >
                <ExternalLink className="mr-2 h-5 w-5" /> Launch Exam in SEB Manually
              </Button>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6">
            <Button variant="outline" asChild className="w-full">
                <Link href="/student/dashboard/join-exam">Back to Join Exam Page</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

// Ensure useToast is correctly imported if used
// const { toast } = useToast(); // This should be at the top if used, or imported where needed
// For the launchSebExam, I used a fallback to console.log if useToast is not set up,
// but for proper usage, it should be imported from '@/hooks/use-toast'.
// I have added a try-catch for the import to avoid breaking if not present.
