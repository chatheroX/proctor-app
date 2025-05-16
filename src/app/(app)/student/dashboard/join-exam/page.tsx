
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ExternalLink, ShieldAlert } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Exam, SebEntryTokenInsert } from '@/types/supabase';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';
import { useAuth } from '@/contexts/AuthContext';

// This should be the exact path to your .seb file within the /public directory
const SEB_CONFIG_FILE_RELATIVE_PATH = '/configs/exam-config.seb';
const TOKEN_EXPIRY_MINUTES = 5; // Short-lived token for SEB entry

export default function JoinExamPage() {
  const [examCode, setExamCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();
  const { user: studentUser, isLoading: authLoading, supabaseInitializationError } = useAuth();
  const router = useRouter();

  const generateRandomToken = (length = 64) => {
    const array = new Uint8Array(length / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[JoinExamPage] Handle submit initiated.");

    if (!examCode.trim()) {
      toast({ title: "Error", description: "Please enter an exam code.", variant: "destructive" });
      return;
    }
    if (authLoading || !studentUser?.user_id) {
      toast({ title: "Authentication Error", description: "Please wait for session to load or log in.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    if (supabaseInitializationError || !supabase) {
      toast({ title: "Connection Error", description: "Cannot connect to services. Please try again later.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      console.log(`[JoinExamPage] Fetching exam with code: ${examCode.trim().toUpperCase()}`);
      const { data: exam, error } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, status, teacher_id, start_time, end_time, exam_code')
        .eq('exam_code', examCode.trim().toUpperCase())
        .single();

      if (error || !exam) {
        toast({ title: "Invalid Code", description: error?.message || "Exam code not found or error fetching exam.", variant: "destructive" });
        setIsLoading(false);
        console.error("[JoinExamPage] Error fetching exam or exam not found:", error);
        return;
      }
      console.log("[JoinExamPage] Exam details fetched:", exam);

      const effectiveStatus = getEffectiveExamStatus(exam as Exam);
      if (effectiveStatus !== 'Ongoing') {
         toast({ title: "Exam Not Active", description: "This exam is currently " + effectiveStatus.toLowerCase() + ".", variant: "default", duration: 7000 });
         setIsLoading(false);
         return;
      }
      if (!exam.questions || exam.questions.length === 0) {
        toast({ title: "Exam Not Ready", description: "This exam has no questions. Contact your teacher.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      const sebEntryToken = generateRandomToken();
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();

      const tokenRecord: SebEntryTokenInsert = {
        token: sebEntryToken,
        student_user_id: studentUser.user_id,
        exam_id: exam.exam_id,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      };
      console.log("[JoinExamPage] Generated SEB entry token record:", tokenRecord);

      const { error: tokenInsertError } = await supabase.from('SebEntryTokens').insert(tokenRecord);

      if (tokenInsertError) {
        console.error("[JoinExamPage] Error inserting SEB entry token:", tokenInsertError);
        toast({ title: "Launch Error", description: "Could not create secure entry token. " + tokenInsertError.message, variant: "destructive" });
        setIsLoading(false);
        return;
      }
      console.log("[JoinExamPage] SEB entry token inserted successfully.");

      // The URL to the .seb file, including the app's origin and the hash parameters for SEB
      // SEB is expected to download this .seb file, parse it, and then use the Start URL
      // defined *inside* the .seb file, appending the hash parameters from this configUrl.
      // The Start URL inside your .seb file should be YOUR_APP_DOMAIN/seb/entry
      const appDomain = window.location.origin;
      const configUrlWithHash = `${appDomain}${SEB_CONFIG_FILE_RELATIVE_PATH}#entryToken=${encodeURIComponent(sebEntryToken)}`;
      console.log("[JoinExamPage] Generated configUrlWithHash (for SEB to download .seb file and get parameters):", configUrlWithHash);
      
      // Remove http(s):// prefix and prepend sebs://
      const domainAndPathForSeb = configUrlWithHash.replace(/^https?:\/\//, '');
      const sebLaunchUrl = `sebs://${domainAndPathForSeb}`;
      console.log("[JoinExamPage] Final SEB Launch URL:", sebLaunchUrl);
      
      toast({
        title: "Launching Exam in SEB",
        description: "Safe Exam Browser should start. Ensure SEB is installed. Your .seb configuration file must be correctly served by the website.",
        duration: 15000,
      });
      
      window.location.href = sebLaunchUrl;
      setTimeout(() => setIsLoading(false), 5000);

    } catch (e: any) {
      console.error("[JoinExamPage] Exception during handleSubmit:", e);
      toast({ title: "Error", description: e.message || "An unexpected error occurred.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [examCode, supabase, toast, studentUser, authLoading, supabaseInitializationError, router]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Join Exam</h1>
      <Card className="w-full max-w-lg mx-auto modern-card shadow-xl border-border/30">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-foreground">Enter Exam Code</CardTitle>
            <CardDescription className="text-muted-foreground">
              Please enter the unique code provided by your teacher to join the exam.
              This will attempt to launch the exam directly in Safe Exam Browser.
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
            <Alert variant="default" className="mt-6 bg-primary/10 border-primary/20 text-primary dark:text-primary/80 dark:bg-primary/15 dark:border-primary/40">
              <ShieldAlert className="h-5 w-5 text-primary" />
              <AlertTitle className="font-semibold text-primary">SEB Required</AlertTitle>
              <AlertDescription className="text-primary/90 dark:text-primary/80 text-sm">
                This exam will open in Safe Exam Browser (SEB). Ensure SEB is installed.
                The system will attempt to launch SEB automatically by pointing it to the exam configuration file.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full btn-gradient py-3 text-base rounded-md" disabled={isLoading || authLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing SEB Launch...
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
