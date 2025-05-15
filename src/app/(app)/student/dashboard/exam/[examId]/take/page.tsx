
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag, AlertTriangle } from 'lucide-react';
import { ExamTimerWarning } from '@/components/student/exam-timer-warning';
import { useActivityMonitor, FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Question, Exam } from '@/types/supabase'; // Using the specific types
import { useAuth } from '@/contexts/AuthContext';


export default function TakeExamPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const { user: studentUser } = useAuth(); // Get student from auth context

  const examId = params.examId as string;
  // studentId from SEB redirect is conceptual. For actual submission, use authenticated student ID.
  // const studentIdFromSeb = searchParams.get('studentId') || 'unknown_student'; 

  const [examDetails, setExamDetails] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // Store option ID as answer
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);

  useActivityMonitor({
    studentId: studentUser?.user_id || 'anonymous_student', // Use logged-in student's ID
    examId,
    enabled: examStarted && !examFinished,
    onFlagEvent: (event) => {
      setFlaggedEvents(prev => [...prev, event]);
      console.warn('Activity Flagged:', event);
      toast({
        title: "Activity Alert",
        description: `Event: ${event.type}. This may be reported.`,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  const fetchExamData = useCallback(async () => {
    if (!examId) {
      setError("Exam ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('ExamX')
        .select('exam_id, title, description, duration, questions, allow_backtracking, status')
        .eq('exam_id', examId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Exam not found.");

      // Check if exam can be taken
      if (data.status !== 'Published' && data.status !== 'Ongoing') {
         setError(`This exam is currently ${data.status.toLowerCase()} and cannot be taken.`);
         setExamDetails(data as Exam); // Still set details to show info
         setQuestions([]);
         setIsLoading(false);
         return;
      }
      
      setExamDetails(data as Exam);
      setQuestions(data.questions || []); // Questions are stored in JSONB
    } catch (e: any) {
      console.error("Failed to fetch exam data:", e);
      setError(e.message || "Failed to load exam data.");
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase]);

  useEffect(() => {
    fetchExamData();
  }, [fetchExamData]);

  const handleStartExam = () => {
    if (examDetails?.status !== 'Published' && examDetails?.status !== 'Ongoing') {
        toast({ title: "Cannot Start", description: `Exam is ${examDetails?.status.toLowerCase()}.`, variant: "destructive" });
        return;
    }
    if(questions.length === 0) {
        toast({ title: "No Questions", description: "This exam has no questions. Please contact your teacher.", variant: "destructive" });
        return;
    }
    setExamStarted(true);
  };

  const handleAnswerChange = (questionId: string, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
    // TODO: Implement local storage auto-save here
    console.log(`Answer for QID ${questionId} saved locally: OptionID ${optionId}`);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (examDetails?.allow_backtracking && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    } else if (!examDetails?.allow_backtracking) {
      toast({description: "Backtracking is not allowed for this exam.", variant: "default"})
    }
  };

  const handleSubmitExam = async () => {
    if (!studentUser) {
        toast({title: "Error", description: "Student not authenticated.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    console.log('Submitting answers:', answers);
    console.log('Flagged Events:', flaggedEvents);
    
    // TODO: Implement actual submission to a new 'ExamSubmissionsX' table
    // This would include student_id, exam_id, answers, score (if auto-graded), flagged_events, submission_time etc.
    // For now, simulate submission.
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    
    setIsLoading(false);
    setExamFinished(true);
    toast({ title: "Exam Submitted!", description: "Your responses have been recorded (simulation)." });
  };

  const handleTimeUp = () => {
    toast({ title: "Time's Up!", description: "Auto-submitting your exam.", variant: "destructive" });
    handleSubmitExam();
  };
  
  if (isLoading && !examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam: {examId}...</p>
      </div>
    );
  }
  
  if (error && !examDetails) { // Critical error, exam details couldn't be fetched
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error loading exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
         <Button onClick={() => router.push('/student/dashboard')} className="mt-4">
            Back to Dashboard
        </Button>
      </div>
    );
  }

  if (!examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Ready to Start: {examDetails?.title || 'Exam'}</CardTitle>
            <CardDescription>
              Exam ID: {examId} <br />
              Duration: {examDetails?.duration ? `${examDetails.duration} minutes` : 'N/A'} <br />
              {error && <span className="text-destructive">{error}</span>} 
              {!error && "Ensure you are in a quiet environment and your Safe Exam Browser is configured if required."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="default" className="bg-primary/10 border-primary/30">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Secure Environment</AlertTitle>
              <AlertDescription className="text-primary/80">
                This exam may be monitored. Activity such as switching tabs or exiting fullscreen may be flagged.
                Please remain focused on the exam.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button 
              onClick={handleStartExam} 
              className="w-full" 
              size="lg" 
              disabled={isLoading || questions.length === 0 || !!error || (examDetails?.status !== 'Published' && examDetails?.status !== 'Ongoing')}>
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
              Start Exam
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl text-center">
          <CardHeader>
            <ShieldCheck className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">Exam Submitted Successfully!</CardTitle>
            <CardDescription>Your responses for "{examDetails?.title || 'this exam'}" have been recorded (simulated). You may now close this window if SEB does not do so automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Number of questions answered: {Object.keys(answers).length} / {questions.length}</p>
            {flaggedEvents.length > 0 && (
              <Alert variant="destructive" className="mt-4 text-left">
                <Flag className="h-4 w-4" />
                <AlertTitle>Activity Summary</AlertTitle>
                <AlertDescription>
                  {flaggedEvents.length} event(s) were flagged during your session. These may be reviewed.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/student/dashboard')} className="w-full">
              Back to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (questions.length === 0 && !isLoading) { // After attempting to load
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-muted-foreground">No questions found for this exam.</p>
        <p className="text-sm text-muted-foreground">Please contact your instructor.</p>
        <Button onClick={() => router.push('/student/dashboard')} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) { // Should not happen if questions.length > 0, but as a safeguard
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading question...</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col min-h-screen bg-muted">
      {examDetails && (
        <ExamTimerWarning
          totalDurationSeconds={examDetails.duration * 60}
          onTimeUp={handleTimeUp}
          examTitle={examDetails.title}
        />
      )}
      <main className="flex-grow flex items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl md:text-2xl">{examDetails?.title || 'Exam'}</CardTitle>
              <span className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</span>
            </div>
            <CardDescription className="pt-2 text-lg">{currentQuestion.text}</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={answers[currentQuestion.id] || ''}
              onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
              className="space-y-3"
            >
              {currentQuestion.options.map((option, index) => (
                <div key={option.id || index} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-accent/50 transition-colors has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:border-primary">
                  <RadioGroupItem value={option.id} id={`${currentQuestion.id}-option-${option.id}`} />
                  <Label htmlFor={`${currentQuestion.id}-option-${option.id}`} className="text-base flex-1 cursor-pointer">{option.text}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0 || !examDetails?.allow_backtracking}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            {currentQuestionIndex < questions.length - 1 ? (
              <Button onClick={handleNextQuestion}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmitExam} disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
                Submit Exam
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
