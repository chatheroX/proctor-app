
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
        await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 500)); // Simulate check duration
        
        const isSuccess = Math.random() > 0.1; // 90% success rate for demo
        setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, status: isSuccess ? 'success' : 'failed', details: isSuccess ? 'Compatible' : 'Incompatible - Please resolve.' } : c));
        setOverallProgress(((i + 1) / checks.length) * 100);
        if (!isSuccess) {
          return; 
        }
      }
      setAllChecksPassed(true);
      
      const studentId = "student123"; // This would come from auth state
      // Example SEB config: allow refresh, disallow spell check, specific browser exam key
      const sebConfig = { 
        allowReload: true, 
        allowSpellCheck: false, 
        browserExamKey: Math.random().toString(36).substring(2, 15), // Unique key for this session
        startURL: `${window.location.origin}/student/dashboard/exam/${examId}/take?studentId=${studentId}&examId=${examId}`, // Points to the new exam page
        // ... other SEB specific settings
      };
      const encryptedConfig = btoa(JSON.stringify(sebConfig)); // Simple base64 for demo

      // Construct the SEB link to point to the internal Next.js page
      // The actual mechanism for SEB to open this specific URL within its secure environment
      // depends on SEB server configuration or .seb file settings.
      // This generated link is what a .seb file might typically launch.
      setCurrentSebLink(`seb://${window.location.host}/student/dashboard/exam/${examId}/take?studentId=${studentId}&sebConfig=${encryptedConfig}`);
      // For testing in a regular browser, you might use a direct link:
      // setCurrentSebLink(`/student/dashboard/exam/${examId}/take?studentId=${studentId}&sebConfig=${encryptedConfig}`);
    };

    performChecks();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]); 

  const getStatusIcon = (status: CheckStatus['status']) => {
    if (status === 'pending') return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />;
    if (status === 'checking') return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
    if (status === 'success') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'failed') return <XCircle className="h-5 w-5 text-destructive" />;
    return null;
  };

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

          {!allChecksPassed && checks.some(c => c.status === 'failed') && (
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
              <AlertTitle className="text-green-700 font-semibold">System Ready! Launch Exam.</AlertTitle>
              <AlertDescription className="text-green-600/80">
                Your system is compatible. Click below to launch the exam in Safe Exam Browser.
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
                onClick={() => {
                  // This action attempts to open the SEB link.
                  // In a real scenario, SEB would be registered to handle 'seb://' protocol.
                  // For browsers, this might not work directly without SEB installed and configured.
                  window.location.href = currentSebLink; 
                }}
              >
                <ExternalLink className="mr-2 h-5 w-5" /> Launch Exam in SEB
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

// Removed metadata export as this is a Client Component
// export const metadata = {
//   title: 'SEB Redirect & System Check | ProctorPrep',
// };
