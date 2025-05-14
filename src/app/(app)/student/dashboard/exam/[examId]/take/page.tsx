
'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label'; // Keep Label import
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag } from 'lucide-react';
import { ExamTimerWarning } from '@/components/student/exam-timer-warning';
import { useActivityMonitor, FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';


interface Question {
  id: string;
  text: string;
  options: string[]; // Assuming simple string options for now.
}

// Mock data structure for questions - this should come from your backend
const MOCK_EXAM_QUESTIONS: Question[] = []; // No more mock data

const MOCK_EXAM_TITLE = "Sample Proficiency Test"; // This should also come from backend
const MOCK_EXAM_DURATION_SECONDS = 10 * 60; // Example: 10 minutes

export default function TakeExamPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const examId = params.examId as string;
  const studentId = searchParams.get('studentId') || 'unknown_student'; 

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);
  const [examTitle, setExamTitle] = useState('');
  const [examDuration, setExamDuration] = useState(0);


  useActivityMonitor({
    studentId,
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

  useEffect(() => {
    setIsLoading(true);
    // Simulate fetching exam data (title, duration, questions)
    // In a real app, replace this with an API call to fetch exam details by examId
    const fetchExamData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      // Example: const examData = await yourApi.getExam(examId);
      // setQuestions(examData.questions || []);
      // setExamTitle(examData.title || MOCK_EXAM_TITLE);
      // setExamDuration(examData.durationSeconds || MOCK_EXAM_DURATION_SECONDS);
      setQuestions(MOCK_EXAM_QUESTIONS); // Use empty array if no actual fetch
      setExamTitle(MOCK_EXAM_TITLE);
      setExamDuration(MOCK_EXAM_DURATION_SECONDS);
      setIsLoading(false);
    };

    if (examId) {
      fetchExamData();
    } else {
      setIsLoading(false);
      // Handle case where examId is not present (e.g., show error, redirect)
      toast({title: "Error", description: "Exam ID is missing.", variant: "destructive"});
      router.push('/student/dashboard/join-exam');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const handleStartExam = () => {
    setExamStarted(true);
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    console.log(`Answer for ${questionId} saved locally: ${value}`);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleSubmitExam = () => {
    setIsLoading(true);
    console.log('Submitting answers:', answers);
    console.log('Flagged Events:', flaggedEvents);
    setTimeout(() => {
      setIsLoading(false);
      setExamFinished(true);
      toast({ title: "Exam Submitted!", description: "Your responses have been recorded."});
    }, 1500);
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
  
  if (!examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Ready to Start Exam: {examTitle}</CardTitle>
            <CardDescription>
              Exam ID: {examId} <br />
              Duration: {examDuration / 60} minutes <br />
              Ensure you are in a quiet environment and your Safe Exam Browser is configured.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="default" className="bg-primary/10 border-primary/30">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Secure Environment</AlertTitle>
              <AlertDescription className="text-primary/80">
                This exam will be monitored. Activity such as switching tabs or exiting fullscreen may be flagged.
                Please remain focused on the exam.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={handleStartExam} className="w-full" size="lg" disabled={isLoading || questions.length === 0}>
              {isLoading ? <Loader2 className="animate-spin mr-2"/> : null}
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
            <CardDescription>Your responses for "{examTitle}" have been recorded. You may now close this window if SEB does not do so automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Number of questions answered: {Object.keys(answers).length} / {questions.length}</p>
             {flaggedEvents.length > 0 && (
                <Alert variant="destructive" className="mt-4 text-left">
                    <Flag className="h-4 w-4" />
                    <AlertTitle>Activity Summary</AlertTitle>
                    <AlertDescription>
                        {flaggedEvents.length} event(s) were flagged during your session. These will be reviewed.
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
  
  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <ShieldCheck className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-muted-foreground">No questions found for this exam.</p>
        <p className="text-sm text-muted-foreground">Please contact your instructor.</p>
         <Button onClick={() => router.push('/student/dashboard')} className="mt-4">
            Back to Dashboard
        </Button>
      </div>
    );
  }


  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="flex flex-col min-h-screen bg-muted">
      <ExamTimerWarning
        totalDurationSeconds={examDuration}
        onTimeUp={handleTimeUp}
        examTitle={examTitle}
      />
      <main className="flex-grow flex items-center justify-center p-4 pt-20"> 
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle className="text-xl md:text-2xl">{examTitle}</CardTitle>
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
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-accent/50 transition-colors has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:border-primary">
                  <RadioGroupItem value={option} id={`${currentQuestion.id}-option-${index}`} />
                  <Label htmlFor={`${currentQuestion.id}-option-${index}`} className="text-base flex-1 cursor-pointer">{option}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
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
