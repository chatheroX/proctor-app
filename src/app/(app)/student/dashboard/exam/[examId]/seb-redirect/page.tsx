'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, ExternalLink, RefreshCw, ShieldAlert } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

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
  const [checks, setChecks] = useState<CheckStatus[]>(initialChecks);
  const [overallProgress, setOverallProgress] = useState(0);
  const [allChecksPassed, setAllChecksPassed] = useState(false);
  const [currentSebLink, setCurrentSebLink] = useState('');

  useEffect(() => {
    const performChecks = async () => {
      for (let i = 0; i < checks.length; i++) {
        setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'checking' } : c));
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000)); // Simulate check duration
        
        // Simulate success/failure for demo. In real app, these would be actual checks.
        const isSuccess = Math.random() > 0.1; // 90% success rate for demo
        setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: isSuccess ? 'success' : 'failed', details: isSuccess ? 'Compatible' : 'Incompatible - Please resolve issue.' } : c));
        setOverallProgress(((i + 1) / checks.length) * 100);
        if (!isSuccess) {
          return; // Stop if a check fails
        }
      }
      setAllChecksPassed(true);
      // Generate a unique, encrypted SEB link (mocked)
      const studentId = "student123"; // This would come from auth state
      const encryptedConfig = btoa(JSON.stringify({ keyboardLock: true, allowRefresh: true, examId, studentId, timestamp: Date.now() }));
      setCurrentSebLink(`seb://proctorprep.example.com/launch?exam=${examId}&student=${studentId}&config=${encryptedConfig}`);
    };

    performChecks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]); // examId dependency is appropriate here

  const getStatusIcon = (status: CheckStatus['status']) => {
    if (status === 'pending') return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (status === 'checking') return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-5 w-5 text-destructive" />;
    return null;
  };

  return (
    <div className="space-y-6 flex flex-col items-center justify-center min-h-full py-8">
      <h1 className="text-3xl font-bold mb-4">Preparing Secure Exam: {examId}</h1>
      
      <Card className="w-full max-w-xl shadow-xl">
        <CardHeader>
          <CardTitle>System Compatibility Check</CardTitle>
          <CardDescription>
            We are checking your system to ensure compatibility with Safe Exam Browser (SEB).
            This process is automatic.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={overallProgress} className="w-full mb-4" />
          <ul className="space-y-3">
            {checks.map((check) => (
              <li key={check.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-md">
                <div className="flex items-center gap-3">
                  {getStatusIcon(check.status)}
                  <span className="font-medium">{check.name}</span>
                </div>
                {check.details && <span className={`text-sm ${check.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'}`}>{check.details}</span>}
              </li>
            ))}
          </ul>

          {!allChecksPassed && checks.some(c => c.status === 'failed') && (
            <Alert variant="destructive" className="mt-4">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Compatibility Issue Detected</AlertTitle>
              <AlertDescription>
                One or more system checks failed. Please ensure your system meets the requirements or contact support.
                You may need to update SEB or adjust system settings.
              </AlertDescription>
            </Alert>
          )}

          {allChecksPassed && (
            <Alert variant="default" className="mt-6 bg-green-500/10 border-green-500/30">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <AlertTitle className="text-green-700 font-semibold">All Checks Passed! Ready for Exam.</AlertTitle>
              <AlertDescription className="text-green-600/80">
                Your system is compatible. Click the button below to launch the exam in Safe Exam Browser.
                <br />
                <strong>Link:</strong> <code className="text-xs break-all block mt-1 p-1 bg-green-100 rounded">{currentSebLink}</code>
                <p className="mt-2 text-xs">
                  <strong>Important:</strong> This link will only work if opened via Safe Exam Browser.
                  Keyboard restrictions (A-Z, arrow keys, mouse clicks only) will be enforced.
                  A <RefreshCw className="inline h-3 w-3" /> button will be available inside SEB for page refresh during network issues.
                  Exiting SEB during the exam will end your session.
                </p>
              </AlertDescription>
              <Button 
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white" 
                onClick={() => window.location.href = currentSebLink} // This is a mock action
              >
                <ExternalLink className="mr-2 h-4 w-4" /> Launch Exam in SEB
              </Button>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
            <Button variant="outline" asChild className="w-full">
                <Link href="/student/dashboard/join-exam">Back to Join Exam</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export const metadata = {
  title: 'SEB Redirect | ProctorPrep',
};
