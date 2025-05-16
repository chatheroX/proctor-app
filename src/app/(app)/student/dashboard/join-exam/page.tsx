
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Exam } from '@/types/supabase';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { useAuth } from '@/contexts/AuthContext';
import { encryptData } from '@/lib/crypto-utils';

// The exam-config.seb file in public/configs/ should have its Start URL configured to:
// https://YOUR_APP_DOMAIN/seb/exam-view (without any query parameters)
// The examId and token will be passed as query params to this URL when launched by SEB from here.

export default function JoinExamPage() {
  const [examCode, setExamCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();
  const { user: studentUser, isLoading: authLoading } = useAuth();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCode.trim()) {
      toast({ title: "Error", description: "Please enter an exam code.", variant: "destructive" });
      return;
    }
    if (authLoading || !studentUser?.user_id) {
      toast({ title: "Authentication Error", description: "Please wait for session to load or log in.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const { data: exam, error } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, status, teacher_id, start_time, end_time, exam_code')
        .eq('exam_code', examCode.trim().toUpperCase())
        .single();

      if (error || !exam) {
        if (error && error.code === 'PGRST116') { // No rows found
          toast({ title: "Invalid Code", description: "Exam code not found. Please check and try again.", variant: "destructive" });
        } else {
          toast({ title: "Error", description: error?.message || "Could not verify exam code.", variant: "destructive" });
        }
        setIsLoading(false);
        return;
      }

      const effectiveStatus = getEffectiveExamStatus(exam as Exam);

      if (effectiveStatus !== 'Ongoing') {
         toast({ title: "Exam Not Active", description: "This exam is currently " + effectiveStatus.toLowerCase() + " and cannot be joined. Please check the schedule.", variant: "default", duration: 7000 });
         setIsLoading(false);
         return;
      }

      if (!exam.questions || exam.questions.length === 0) {
        toast({ title: "Exam Not Ready", description: "This exam currently has no questions. Please contact your teacher.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const payload = {
        examId: exam.exam_id,
        studentId: studentUser.user_id,
        timestamp: Date.now(),
        examCode: exam.exam_code 
      };
      const encryptedToken = await encryptData(payload);

      if (!encryptedToken) {
        toast({ title: "Encryption Error", description: "Could not generate secure exam token for SEB.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Construct the direct SEB Start URL with query parameters
      const examViewUrl = `${window.location.origin}/seb/exam-view?examId=${exam.exam_id}&token=${encodeURIComponent(encryptedToken)}`;
      
      // Remove http(s):// prefix and prepend sebs://
      const domainAndPathWithQuery = examViewUrl.replace(/^https?:\/\//, '');
      const sebLaunchUrl = `sebs://${domainAndPathWithQuery}`;

      console.log("[JoinExamPage] Attempting to launch SEB with direct URL:", sebLaunchUrl);
      toast({
        title: "Launching Exam in SEB",
        description: "Safe Exam Browser should start. If not, ensure it's installed and configured to handle sebs:// links.",
        duration: 10000,
      });
      
      // Attempt to launch SEB
      window.location.href = sebLaunchUrl;

      // Reset loading state after a delay, as direct navigation might make this less critical.
      setTimeout(() => setIsLoading(false), 5000);

    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unexpected error occurred.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [examCode, supabase, toast, studentUser, authLoading, router]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Join Exam</h1>
      <Card className="w-full max-w-lg mx-auto shadow-xl modern-card">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Enter Exam Code</CardTitle>
            <CardDescription className="text-muted-foreground">
              Please enter the unique code provided by your teacher to join the exam.
              This will attempt to launch the exam in Safe Exam Browser.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="examCode" className="text-sm font-medium text-foreground">Exam Code</Label>
              <Input
                id="examCode"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                placeholder="e.g., EXMCD1"
                required
                className="text-lg tracking-wider py-2.5 modern-input"
                autoComplete="off"
              />
            </div>
            <Alert variant="default" className="mt-6 bg-primary/10 border-primary/20 text-primary dark:text-blue-300 dark:bg-blue-500/10 dark:border-blue-500/30">
              <ExternalLink className="h-5 w-5 text-primary dark:text-blue-400" />
              <AlertTitle className="font-semibold text-primary dark:text-blue-300">SEB Required</AlertTitle>
              <AlertDescription className="text-primary/90 dark:text-blue-400/90 text-sm">
                This exam will open in Safe Exam Browser. Ensure SEB is installed and properly configured on your system to handle `sebs://` links.
                You will be redirected automatically. If SEB does not launch, please check your browser settings or SEB installation.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full btn-gradient py-3 text-base rounded-md" disabled={isLoading || authLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verifying & Launching SEB...
                </>
              ) : (
                'Proceed to SEB Launch'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
