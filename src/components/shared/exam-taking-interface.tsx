
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag, AlertTriangle, PlayCircle, ServerCrash, UserCircle, Hash, BookOpen } from 'lucide-react';
import { ExamTimerWarning } from '@/components/student/exam-timer-warning';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam } from '@/types/supabase';

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  isLoading: boolean;
  error: string | null;
  examStarted: boolean; // Should always be true when rendered by initiate/take pages
  onAnswerChange: (questionId: string, optionId: string) => void;
  onSubmitExam: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => Promise<void>;
  onTimeUp: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => Promise<void>;
  isDemoMode?: boolean;
  userIdForActivityMonitor: string;
  studentName?: string | null;
  studentRollNumber?: string | null;
}

export function ExamTakingInterface({
  examDetails,
  questions,
  initialAnswers,
  isLoading: parentIsLoading,
  error: examLoadingError,
  examStarted,
  onAnswerChange,
  onSubmitExam,
  onTimeUp: parentOnTimeUpProp,
  isDemoMode = false,
  userIdForActivityMonitor,
  studentName,
  studentRollNumber,
}: ExamTakingInterfaceProps) {
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [examFinished, setExamFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);
  const [internalError, setInternalError] = useState<string | null>(null);

  const parentOnTimeUpRef = useRef(parentOnTimeUpProp);
  useEffect(() => {
    parentOnTimeUpRef.current = parentOnTimeUpProp;
  }, [parentOnTimeUpProp]);

  const allowBacktracking = useMemo(() => examDetails?.allow_backtracking === true, [examDetails?.allow_backtracking]);
  const currentQuestion = useMemo(() => (questions && questions.length > currentQuestionIndex) ? questions[currentQuestionIndex] : null, [questions, currentQuestionIndex]);
  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);
  
  const activityMonitorEnabled = useMemo(() => examStarted && !examFinished && !isDemoMode && !!currentQuestion, [examStarted, examFinished, isDemoMode, currentQuestion]);

  const handleFlagEvent = useCallback((event: FlaggedEvent) => {
    setFlaggedEvents((prev) => [...prev, event]);
    if (!isDemoMode) {
      console.warn('Activity Flagged:', event);
      toast({
        title: "Activity Alert",
        description: `Event: ${event.type}. This may be reported.`,
        variant: "destructive",
        duration: 5000,
      });
    } else {
      console.log('Demo Mode - Activity Monitored (not flagged):', event);
       toast({
        title: "Demo: Activity Monitor",
        description: `Event: ${event.type} (Informational for demo)`,
        duration: 3000,
      });
    }
  }, [isDemoMode, toast]);

  useActivityMonitor({
    studentId: userIdForActivityMonitor,
    examId: examIdForMonitor,
    enabled: activityMonitorEnabled,
    onFlagEvent: handleFlagEvent,
  });

  const handleInternalAnswerChange = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    onAnswerChange(questionId, optionId);
  }, [onAnswerChange]);

  const handleNextQuestion = useCallback(() => {
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, questions]);

  const handlePreviousQuestion = useCallback(() => {
    if (allowBacktracking && currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    } else if (!allowBacktracking) {
      toast({ description: "Backtracking is not allowed for this exam.", variant: "default" });
    }
  }, [allowBacktracking, currentQuestionIndex, toast]);

  const handleInternalSubmitExam = useCallback(async () => {
    if (examFinished) return;
    setIsSubmitting(true);
    setInternalError(null);
    try {
        await onSubmitExam(answers, flaggedEvents);
        setExamFinished(true);
    } catch (e: any) {
        setInternalError(e.message || "Failed to submit exam.");
        toast({ title: "Submission Error", description: e.message || "Could not submit exam.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  }, [onSubmitExam, answers, flaggedEvents, examFinished, toast]);

  const handleInternalTimeUp = useCallback(async () => {
    if (examFinished) return;

    if (!isDemoMode) {
        toast({ title: "Time's Up!", description: "Auto-submitting your exam.", variant: "destructive" });
    } else {
        toast({ title: "Demo Time's Up!", description: "The demo exam duration has ended." });
    }
    setIsSubmitting(true);
    setInternalError(null);
    try {
        await parentOnTimeUpRef.current(answers, flaggedEvents);
        setExamFinished(true);
    } catch (e: any) {
        setInternalError(e.message || "Failed to auto-submit exam on time up.");
        toast({ title: "Auto-Submission Error", description: e.message || "Could not auto-submit exam.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  }, [answers, flaggedEvents, isDemoMode, toast, examFinished]);

  const currentQuestionId = currentQuestion?.id;
  const memoizedOnRadioValueChange = useCallback((optionId: string) => {
    if (currentQuestionId) {
      handleInternalAnswerChange(currentQuestionId, optionId);
    }
  }, [currentQuestionId, handleInternalAnswerChange]);

  if (parentIsLoading && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam interface...</p>
      </div>
    );
  }

  if (examLoadingError && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <ServerCrash className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Exam Data</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{examLoadingError}</p>
      </div>
    );
  }
  
  if (!examDetails || !examStarted) {
    console.error("[ExamTakingInterface] Critical error: examDetails is null or examStarted is false.", { examDetailsExists: !!examDetails, examStarted });
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive">Exam session not properly initiated.</p>
        <p className="text-sm text-muted-foreground">Required exam details are missing or the session was not started correctly.</p>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl text-center">
          <CardHeader>
            <ShieldCheck className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">{isDemoMode ? "Demo " : ""}Exam {internalError ? "Attempted Submission" : "Finished"}!</CardTitle>
            <CardDescription>
              {internalError 
                ? `There was an issue: ${internalError}`
                : isDemoMode
                  ? `The demo for "${examDetails.title}" has concluded.`
                  : `Your responses for "${examDetails.title}" have been recorded.`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Number of questions answered: {Object.keys(answers).length} / {questions.length || 0}</p>
            {flaggedEvents.length > 0 && (
              <Alert
                variant={isDemoMode ? "default" : "destructive"}
                className={`mt-4 text-left ${isDemoMode ? 'bg-blue-50 border-blue-200' : ''}`}
              >
                <Flag className={`h-4 w-4 ${isDemoMode ? 'text-blue-500' : ''}`} />
                <AlertTitle className={isDemoMode ? "text-blue-700" : ""}>
                  {isDemoMode ? "Demo Activity Log" : "Activity Summary"}
                </AlertTitle>
                <AlertDescription className={isDemoMode ? "text-blue-600" : ""}>
                  {flaggedEvents.length} event(s) were {isDemoMode ? "monitored" : "flagged"} during this {isDemoMode ? "demo" : "session"}.
                  {!isDemoMode && " These may be reviewed."}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => {
              if (isDemoMode && examDetails.exam_id) {
                window.location.href = `/teacher/dashboard/exams/${examDetails.exam_id}/details`;
              } else if (!isDemoMode) {
                 window.location.href = `/student/dashboard/exam-history`;
              } else {
                window.close(); 
              }
            }} className="w-full">
              {isDemoMode ? "Back to Exam Details" : "View Exam History / Close"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (questions.length === 0 && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-muted-foreground">No questions found for this exam.</p>
        <p className="text-sm text-muted-foreground">Please contact your instructor.</p>
      </div>
    );
  }
  
   if (!currentQuestion && questions.length > 0 && !parentIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading question...</p>
      </div>
    );
  }
  
  const examDurationForTimer = examDetails.duration ?? 0;
  const examTitleForTimer = examDetails.title ?? "Exam";
  const questionProgress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      {examDetails && examStarted && !examFinished && (
        <ExamTimerWarning
          key={`${examDetails.exam_id}-${examDurationForTimer}`}
          totalDurationSeconds={examDurationForTimer * 60}
          onTimeUp={handleInternalTimeUp}
          examTitle={examTitleForTimer + (isDemoMode ? " (Demo)" : "")}
        />
      )}
      
      {/* Header Section */}
      <header className="sticky top-[4rem] z-40 w-full bg-background shadow-sm py-3 px-4 md:px-6 border-b">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
          <div className="flex-grow">
            <h1 className="text-xl font-semibold text-primary truncate flex items-center">
              <BookOpen className="mr-2 h-5 w-5" /> {examDetails.title} {isDemoMode && <span className="text-sm font-normal text-orange-500 ml-2">(Demo Mode)</span>}
            </h1>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              {studentName && studentRollNumber && (
                <>
                  <span className="flex items-center gap-1"><UserCircle className="h-3 w-3" /> {studentName}</span>
                  <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {studentRollNumber}</span>
                </>
              )}
            </div>
          </div>
          <div className="text-sm text-muted-foreground w-full md:w-auto text-right">
            Question {currentQuestionIndex + 1} of {questions.length || 0}
          </div>
        </div>
        {questions.length > 0 && <Progress value={questionProgress} className="mt-2 h-1.5" />}
      </header>

      <main className="flex-grow flex items-center justify-center p-4 md:p-6">
        <Card className="w-full max-w-3xl shadow-2xl rounded-lg border">
          <CardHeader className="bg-card-foreground/5 p-4 md:p-6 rounded-t-lg">
            {currentQuestion && <CardDescription className="pt-2 text-lg md:text-xl font-medium text-card-foreground">{currentQuestion.text}</CardDescription>}
            {!currentQuestion && questions.length > 0 && (
                <CardDescription className="pt-2 text-lg text-muted-foreground">Loading question text...</CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-4">
            {currentQuestion?.options ? (
              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onValueChange={memoizedOnRadioValueChange}
                className="space-y-3"
              >
                {currentQuestion.options.map((option) => (
                  <div key={option.id} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-primary/5 transition-all duration-150 ease-in-out has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary/50">
                    <RadioGroupItem value={option.id} id={`${currentQuestion.id}-option-${option.id}`} className="h-5 w-5"/>
                    <Label htmlFor={`${currentQuestion.id}-option-${option.id}`} className="text-base md:text-lg flex-1 cursor-pointer py-1">{option.text}</Label>
                  </div>
                ))}
              </RadioGroup>
            ) : (
                 <div className="text-center py-4">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                    <p className="text-muted-foreground mt-2">Loading options...</p>
                </div>
            )}
            {internalError && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{internalError}</AlertDescription>
                </Alert>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t p-4 md:p-6 bg-muted/20 rounded-b-lg">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0 || !allowBacktracking || !currentQuestion || isSubmitting}
              className="py-2 px-4 text-base"
            >
              <ArrowLeft className="mr-2 h-5 w-5" /> Previous
            </Button>
            {currentQuestionIndex < questions.length -1 ? (
              <Button onClick={handleNextQuestion} disabled={!currentQuestion || isSubmitting} className="py-2 px-4 text-base bg-primary hover:bg-primary/90">
                Next <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            ) : (
              <Button onClick={handleInternalSubmitExam} disabled={isSubmitting || !currentQuestion} className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 text-base">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-5 w-5" />}
                Submit {isDemoMode ? "Demo " : ""}Exam
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

