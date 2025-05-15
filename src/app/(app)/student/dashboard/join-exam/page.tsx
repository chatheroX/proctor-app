
'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Exam } from '@/types/supabase';
import { getEffectiveExamStatus } from '@/app/(app)/teacher/dashboard/exams/[examId]/details/page';

export default function JoinExamPage() {
  const [examCode, setExamCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCode.trim()) {
      toast({ title: "Error", description: "Please enter an exam code.", variant: "destructive" });
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
         toast({ title: "Exam Not Active", description: `This exam is currently ${effectiveStatus.toLowerCase()} and cannot be joined. Please check the schedule.`, variant: "default", duration: 5000 });
         setIsLoading(false);
         return;
      }

      if (!exam.questions || exam.questions.length === 0) {
        toast({ title: "Exam Not Ready", description: "This exam currently has no questions. Please contact your teacher.", variant: "destructive" });
        setIsLoading(false);
        return;
      }
      
      // Redirect to the new initiate page, which will handle pre-exam checks and launching in a new tab.
      router.push(`/student/dashboard/exam/${exam.exam_id}/initiate`);

    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unexpected error occurred.", variant: "destructive" });
      setIsLoading(false);
    }
  }, [examCode, supabase, toast, router]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Join Exam</h1>
      <Card className="w-full max-w-lg mx-auto shadow-lg">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Enter Exam Code</CardTitle>
            <CardDescription>
              Please enter the unique code provided by your teacher to join the exam.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="examCode">Exam Code</Label>
              <Input
                id="examCode"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                placeholder="e.g., EXMCD1"
                required
                className="text-lg tracking-wider"
                autoComplete="off"
              />
            </div>
            <Alert variant="default" className="mt-4 bg-primary/10 border-primary/30">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Important Notice</AlertTitle>
              <AlertDescription className="text-primary/80">
                Ensure you are in a quiet environment and ready for the exam.
                The exam will open in a new tab after system checks.
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
                'Proceed to Exam Instructions'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
