'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useRouter } from 'next/navigation';


export default function JoinExamPage() {
  const [examCode, setExamCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSebRedirect, setShowSebRedirect] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCode) return;
    setIsLoading(true);
    
    // Simulate fetching exam details and preparing SEB link
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    // Redirect to a dedicated page for SEB process or show modal
    router.push(`/student/dashboard/exam/${examCode}/seb-redirect`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Join Exam</h1>
      <Card className="w-full max-w-lg mx-auto shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Enter Exam Code</CardTitle>
            <CardDescription>
              Please enter the unique code provided by your teacher to join the exam. 
              Ensure you are using Safe Exam Browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="examCode">Exam Code</Label>
              <Input
                id="examCode"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                placeholder="e.g., MATH101FINAL"
                required
                className="text-lg tracking-wider"
              />
            </div>
            <Alert variant="default" className="mt-4 bg-primary/10 border-primary/30">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Important Notice</AlertTitle>
              <AlertDescription className="text-primary/80">
                All exams must be taken using <strong>Safe Exam Browser (SEB)</strong>.
                Attempting to join via a regular browser will not work.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying Code...
                </>
              ) : (
                'Proceed to Exam'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export const metadata = {
  title: 'Join Exam | Student Dashboard | ProctorPrep',
};
