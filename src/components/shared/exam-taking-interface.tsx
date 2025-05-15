
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Added import
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, Check, X } from 'lucide-react';
import { ExamTimerWarning } from '@/components/student/exam-timer-warning';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam } from '@/types/supabase';
import { cn } from '@/lib/utils';

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  isLoading: boolean; // Represents loading of exam data for this interface
  error: string | null; // Represents error during exam data fetch
  examStarted: boolean; // Indicates if the exam is actively being taken (e.g., after a "Start" button)
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
  onTimeUp,
  isDemoMode = false,
  userIdForActivityMonitor,
  studentName,
  studentRollNumber,
}: ExamTakingInterfaceProps) {
  const router = useRouter(); // Initialize router
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [examFinished, setExamFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);
  const [internalError, setInternalError] = useState<string | null>(null);

  const parentOnTimeUpRef = useRef(onTimeUp);
  const parentOnSubmitExamRef = useRef(onSubmitExam);

  useEffect(() => {
    parentOnTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    parentOnSubmitExamRef.current = onSubmitExam;
  }, [onSubmitExam]);


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
    setAnswers((prevAnswers) => ({ ...prevAnswers, [questionId]: optionId }));
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

  const handleQuestionNavigation = useCallback((index: number) => {
    if (index >= 0 && questions && index < questions.length) {
      if (!allowBacktracking && index < currentQuestionIndex) {
        toast({ description: "Backtracking is not allowed for this exam.", variant: "default" });
        return;
      }
      setCurrentQuestionIndex(index);
    }
  }, [allowBacktracking, currentQuestionIndex, questions, toast]);


  const handleInternalSubmitExam = useCallback(async () => {
    if (examFinished) return;
    setIsSubmitting(true);
    setInternalError(null);
    try {
        await parentOnSubmitExamRef.current(answers, flaggedEvents);
        setExamFinished(true);
    } catch (e: any) {
        setInternalError(e.message || "Failed to submit exam.");
        toast({ title: "Submission Error", description: e.message || "Could not submit exam.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  }, [answers, flaggedEvents, examFinished, toast]);

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam interface...</p>
      </div>
    );
  }

  if (examLoadingError && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <ServerCrash className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Exam Data</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{examLoadingError}</p>
      </div>
    );
  }
  
  if (!examDetails || !examStarted) {
    console.error("[ExamTakingInterface] Critical error: examDetails is null or examStarted is false.", { examDetailsExists: !!examDetails, examStarted });
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive">Exam session not properly initiated.</p>
        <p className="text-sm text-muted-foreground">Required exam details are missing or the session was not started correctly.</p>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Card className="w-full max-w-md shadow-xl text-center">
          <CardHeader>
            <ShieldCheck className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold">{isDemoMode ? "Demo " : ""}Exam {internalError ? "Attempted Submission" : "Finished"}!</h2>
            <p className="text-muted-foreground">
              {internalError 
                ? `There was an issue: ${internalError}`
                : isDemoMode
                  ? `The demo for "${examDetails.title}" has concluded.`
                  : `Your responses for "${examDetails.title}" have been recorded.`
              }
            </p>
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
              if (typeof window !== 'undefined') {
                window.close();
                if (!isDemoMode && !window.closed) {
                   router.push('/student/dashboard/exam-history');
                } else if (isDemoMode && examDetails?.exam_id && !window.closed) {
                   router.push(`/teacher/dashboard/exams/${examDetails.exam_id}/details`);
                }
              }
            }} className="w-full">
              Close Tab / Return to Dashboard
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (questions.length === 0 && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-muted-foreground">No questions found for this exam.</p>
        <p className="text-sm text-muted-foreground">Please contact your instructor.</p>
      </div>
    );
  }
  
   if (!currentQuestion && questions.length > 0 && !parentIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading question...</p>
      </div>
    );
  }
  
  const examDurationForTimer = examDetails.duration ?? 0;
  const examTitleForTimer = examDetails.title ?? "Exam";
  const questionProgress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900">
      {examDetails && examStarted && !examFinished && (
        <ExamTimerWarning
          key={`${examDetails.exam_id}-${examDurationForTimer}`}
          totalDurationSeconds={examDurationForTimer * 60}
          onTimeUp={handleInternalTimeUp}
          examTitle={examTitleForTimer + (isDemoMode ? " (Demo)" : "")}
        />
      )}
      
      <header className="sticky top-[calc(3rem)] z-10 w-full bg-white dark:bg-slate-800 shadow-md py-3 px-4 md:px-6 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-2 md:gap-4">
          <div className="flex-grow">
            <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 truncate flex items-center">
              <BookOpen className="mr-2 h-5 w-5 text-primary" /> {examDetails.title} {isDemoMode && <span className="text-xs font-normal text-orange-500 ml-2">(DEMO MODE)</span>}
            </h1>
            <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
              {studentName && (
                <span className="flex items-center gap-1"><UserCircle className="h-3.5 w-3.5" /> {studentName}</span>
              )}
              {studentRollNumber && (
                <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> Roll: {studentRollNumber}</span>
              )}
            </div>
          </div>
          <div className="text-sm text-slate-600 dark:text-slate-300 w-full md:w-auto text-left md:text-right mt-2 md:mt-0">
            Question {currentQuestionIndex + 1} of {questions.length || 0}
          </div>
        </div>
        {questions.length > 0 && <Progress value={questionProgress} className="mt-2 h-2 rounded-full" />}
      </header>

      <div className="flex-grow flex overflow-hidden">
        <aside className="w-1/4 md:w-1/5 lg:w-1/6 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-3 shadow-sm">
          <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-200 sticky top-0 bg-slate-50 dark:bg-slate-800 py-2 z-10">Questions</h3>
          <ScrollArea className="h-[calc(100vh-10rem)] pr-2">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {questions.map((q, index) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = index === currentQuestionIndex;
                return (
                  <Button
                    key={q.id}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "aspect-square h-auto text-xs p-1 justify-center items-center",
                      "border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700",
                      isCurrent && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1 hover:bg-primary/90",
                      isAnswered && !isCurrent && "bg-green-100 dark:bg-green-800/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300",
                      !isAnswered && !isCurrent && "bg-white dark:bg-slate-700/50"
                    )}
                    onClick={() => handleQuestionNavigation(index)}
                    disabled={!allowBacktracking && index < currentQuestionIndex}
                  >
                    {index + 1}
                  </Button>
                );
              })}
            </div>
          <ScrollBar orientation="vertical" />
          </ScrollArea>
        </aside>

        <main className="flex-grow flex flex-col items-center justify-center p-4 md:p-6 overflow-y-auto bg-background">
          <Card className="w-full max-w-3xl shadow-xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
            <CardHeader className="p-5 md:p-6 border-b border-slate-200 dark:border-slate-700">
              {currentQuestion && <h2 className="text-lg md:text-xl font-semibold text-slate-800 dark:text-slate-100 leading-tight">{currentQuestion.text}</h2>}
              {!currentQuestion && questions.length > 0 && (
                  <h2 className="text-lg text-slate-500 dark:text-slate-400">Loading question text...</h2>
              )}
            </CardHeader>
            <CardContent className="p-5 md:p-6 space-y-4">
              {currentQuestion?.options ? (
                <RadioGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={memoizedOnRadioValueChange}
                  className="space-y-3"
                >
                  {currentQuestion.options.map((option) => (
                    <div 
                      key={option.id} 
                      className="flex items-center space-x-3 p-3.5 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-primary/5 dark:hover:bg-primary/10 transition-all duration-150 ease-in-out has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:border-primary dark:has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary/60"
                    >
                      <RadioGroupItem value={option.id} id={`${currentQuestion.id}-option-${option.id}`} className="h-5 w-5 border-slate-400 dark:border-slate-500 text-primary focus:ring-primary"/>
                      <Label htmlFor={`${currentQuestion.id}-option-${option.id}`} className="text-base md:text-lg flex-1 cursor-pointer py-1 text-slate-700 dark:text-slate-200">{option.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                   <div className="text-center py-4">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                      <p className="text-slate-500 dark:text-slate-400 mt-2">Loading options...</p>
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
            <CardFooter className="flex justify-between border-t border-slate-200 dark:border-slate-700 p-4 md:p-6 bg-slate-50 dark:bg-slate-800/30 rounded-b-xl">
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0 || !allowBacktracking || !currentQuestion || isSubmitting}
                className="py-2.5 px-5 text-base rounded-md shadow-sm border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Previous
              </Button>
              {currentQuestionIndex < questions.length - 1 ? (
                <Button onClick={handleNextQuestion} disabled={!currentQuestion || isSubmitting} className="py-2.5 px-5 text-base rounded-md shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground">
                  Next <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              ) : (
                <Button onClick={handleInternalSubmitExam} disabled={isSubmitting || !currentQuestion} className="bg-green-600 hover:bg-green-700 text-white py-2.5 px-5 text-base rounded-md shadow-sm">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-5 w-5" />}
                  Submit {isDemoMode ? "Demo " : ""}Exam
                </Button>
              )}
            </CardFooter>
          </Card>
        </main>
      </div>
    </div>
  );
}
