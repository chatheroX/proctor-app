
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function JoinExamPage() {
  const [examCode, setExamCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examCode.trim()) {
      toast({ title: "Error", description: "Please enter an exam code.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const { data: exam, error } = await supabase
        .from('ExamX')
        .select('exam_id, status')
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

      // Check exam status - this is a placeholder for more robust status handling
      if (exam.status !== 'Published' && exam.status !== 'Ongoing') {
         toast({ title: "Exam Not Active", description: `This exam is currently ${exam.status.toLowerCase()} and cannot be joined.`, variant: "destructive" });
         setIsLoading(false);
         return;
      }
      
      // If code is valid and exam is joinable
      router.push(`/student/dashboard/exam/${exam.exam_id}/seb-redirect`);

    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unexpected error occurred.", variant: "destructive" });
      setIsLoading(false);
    }
    // setIsLoading(false); // Already handled in try/catch paths
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
              Ensure you are using Safe Exam Browser if required by the exam.
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
                Some exams may require <strong>Safe Exam Browser (SEB)</strong>.
                Attempting to join these via a regular browser will not work.
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
