
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, Check, XCircle, ThumbsUp } from 'lucide-react';
import { ExamTimerWarning } from '@/components/student/exam-timer-warning';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam } from '@/types/supabase';
import { cn } from '@/lib/utils';

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  isLoading: boolean; 
  error: string | null; 
  examStarted: boolean; 
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
  const router = useRouter();
  const { toast } = useToast();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [examFinished, setExamFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);
  const [internalError, setInternalError] = useState<string | null>(null);
  
  const onSubmitExamRef = useRef(onSubmitExam);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onSubmitExamRef.current = onSubmitExam;
  }, [onSubmitExam]);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  const allowBacktracking = useMemo(() => examDetails?.allow_backtracking === true, [examDetails?.allow_backtracking]);
  const currentQuestion = useMemo(() => (questions && questions.length > currentQuestionIndex) ? questions[currentQuestionIndex] : null, [questions, currentQuestionIndex]);
  
  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);
  const activityMonitorEnabled = useMemo(() => examStarted && !examFinished && !isDemoMode && !!currentQuestion, [examStarted, examFinished, isDemoMode, currentQuestion]);

  const handleFlagEvent = useCallback((event: FlaggedEvent) => {
    setFlaggedEvents((prev) => [...prev, event]);
    if (!isDemoMode) {
      toast({
        title: "Activity Alert",
        description: `Event: ${event.type}. This may be reported.`,
        variant: "destructive",
        duration: 5000,
      });
    } else {
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
        await onSubmitExamRef.current(answers, flaggedEvents);
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
        await onTimeUpRef.current(answers, flaggedEvents);
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
        {/* TODO: Add Framer Motion loader animation */}
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <p className="text-xl text-foreground font-medium">Loading exam interface...</p>
        <p className="text-sm text-muted-foreground">Please wait a moment.</p>
      </div>
    );
  }

  if (examLoadingError && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-destructive/10 via-background to-destructive/5 p-4 text-center">
        <ServerCrash className="h-20 w-20 text-destructive mb-6" />
        <h2 className="text-3xl font-bold text-destructive mb-3">Error Loading Exam</h2>
        <p className="text-lg text-muted-foreground mb-6 max-w-md">{examLoadingError}</p>
        <p className="text-sm text-muted-foreground">You may need to close this tab and try re-initiating the exam.</p>
      </div>
    );
  }
  
  if (!examDetails || !examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-destructive/10 via-background to-destructive/5 p-4 text-center">
        <AlertTriangle className="h-20 w-20 text-destructive mb-6" />
        <h2 className="text-3xl font-bold text-destructive mb-3">Exam Session Error</h2>
        <p className="text-lg text-muted-foreground mb-6 max-w-md">This exam session was not properly initiated or critical details are missing.</p>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-primary/10 via-background to-green-500/10 p-4 text-center">
        {/* TODO: Add Framer Motion for completion screen animation */}
        <Card className="w-full max-w-lg glass-card shadow-2xl p-6 md:p-8">
          <CardHeader className="pb-4">
            <ThumbsUp className="h-20 w-20 text-green-500 mx-auto mb-5" />
            <h2 className="text-3xl font-bold text-foreground">{isDemoMode ? "Demo " : ""}Exam {internalError ? "Submission Attempted" : "Submitted Successfully"}!</h2>
            <p className="text-muted-foreground mt-2 text-base">
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
                className={`mt-6 text-left ${isDemoMode ? 'bg-accent/10 border-accent/30' : 'bg-destructive/10 border-destructive/30'} rounded-lg`}
              >
                <Flag className={`h-5 w-5 ${isDemoMode ? 'text-accent' : 'text-destructive'}`} />
                <AlertTitle className={`font-semibold ${isDemoMode ? "text-accent-foreground" : "text-destructive-foreground"}`}>
                  {isDemoMode ? "Demo Activity Log" : "Activity Summary"}
                </AlertTitle>
                <AlertDescription className={isDemoMode ? "text-muted-foreground" : "text-destructive-foreground/80"}>
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
                if (!window.closed) { // Fallback if window.close() fails
                    if (!isDemoMode) {
                        router.push('/student/dashboard/exam-history');
                    } else if (isDemoMode && examDetails?.exam_id) {
                        router.push(`/teacher/dashboard/exams/${examDetails.exam_id}/details`);
                    }
                }
              }
            }} className="btn-gradient w-full py-3 text-lg rounded-lg">
              Close Tab / Return
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (questions.length === 0 && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-muted to-background p-4 text-center">
        <XCircle className="h-20 w-20 text-destructive mb-6" />
        <h2 className="text-3xl font-bold text-destructive mb-3">No Questions Available</h2>
        <p className="text-lg text-muted-foreground text-center">This exam currently has no questions. Please contact your instructor.</p>
      </div>
    );
  }
  
   if (!currentQuestion && questions.length > 0 && !parentIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background via-muted to-background p-4">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <p className="text-xl text-foreground font-medium">Loading question...</p>
      </div>
    );
  }
  
  const examDurationForTimer = examDetails.duration ?? 0;
  const examTitleForTimer = examDetails.title ?? "Exam";
  const questionProgress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;

  return (
    // TODO: Add Framer Motion page wrapper for overall exam entrance animation
    <div className="flex flex-col h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 dark:from-primary/10 dark:via-background dark:to-accent/10 text-foreground">
      {examDetails && examStarted && !examFinished && (
        <ExamTimerWarning
          key={`${examDetails.exam_id}-${examDurationForTimer}`} // Ensure key changes if duration or id changes
          totalDurationSeconds={examDurationForTimer * 60}
          onTimeUp={handleInternalTimeUp}
          examTitle={examTitleForTimer + (isDemoMode ? " (Demo)" : "")}
        />
      )}
      
      {/* TODO: Add Framer Motion for header reveal */}
      <header className="sticky top-0 left-0 right-0 z-40 bg-card/60 backdrop-blur-lg shadow-lg py-3 px-4 md:px-6 border-b border-border/30 mt-[3rem] md:mt-[2.5rem] rounded-b-xl">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-y-2 sm:gap-x-4">
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <h1 className="text-xl md:text-2xl font-semibold text-primary truncate flex items-center gap-2 justify-center sm:justify-start">
              <BookOpen className="h-6 w-6 shrink-0" /> 
              <span className="truncate" title={examDetails.title}>
                {examDetails.title}
              </span>
              {isDemoMode && <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 whitespace-nowrap">(DEMO)</span>}
            </h1>
            <div className="flex items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5 flex-wrap">
              {studentName && (
                <span className="flex items-center gap-1 whitespace-nowrap"><UserCircle className="h-3.5 w-3.5" /> {studentName}</span>
              )}
              {studentRollNumber && (
                <span className="flex items-center gap-1 whitespace-nowrap"><Hash className="h-3.5 w-3.5" /> {studentRollNumber}</span>
              )}
            </div>
          </div>
          <div className="text-sm font-medium text-muted-foreground w-full sm:w-auto text-center sm:text-right mt-1 sm:mt-0 whitespace-nowrap">
            Question {currentQuestionIndex + 1} of {questions.length || 0}
          </div>
        </div>
        {questions.length > 0 && <Progress value={questionProgress} className="mt-3 h-2 rounded-full bg-primary/20" />}
      </header>

      <div className="flex-grow flex overflow-hidden p-4 md:p-6 gap-4 md:gap-6">
        {/* Main Question Area */}
        {/* TODO: Add Framer Motion for question transition animation */}
        <main className="flex-grow flex flex-col items-center justify-center overflow-y-auto rounded-xl">
          <Card className="w-full max-w-4xl glass-card shadow-2xl flex flex-col flex-grow rounded-xl">
            <CardHeader className="p-5 md:p-6 border-b border-border/30">
              {currentQuestion && <h2 className="text-xl md:text-2xl font-semibold text-foreground leading-tight">{currentQuestion.text}</h2>}
              {!currentQuestion && questions.length > 0 && (
                  <h2 className="text-xl text-muted-foreground">Loading question text...</h2>
              )}
            </CardHeader>
            <CardContent className="p-5 md:p-6 space-y-4 flex-grow overflow-y-auto">
              {currentQuestion?.options ? (
                <RadioGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={memoizedOnRadioValueChange}
                  className="space-y-4"
                  disabled={isSubmitting}
                >
                  {currentQuestion.options.map((option) => (
                    // TODO: Add Framer Motion for option select animation
                    <div 
                      key={option.id} 
                      className={cn(
                        "flex items-center space-x-3.5 p-4 border border-border/50 rounded-xl transition-all duration-200 ease-in-out cursor-pointer",
                        "hover:bg-primary/10 hover:border-primary/50 dark:hover:bg-primary/20",
                        answers[currentQuestion.id] === option.id && "bg-primary/10 border-primary ring-2 ring-primary/80 shadow-md",
                        isSubmitting && "cursor-not-allowed opacity-70"
                      )}
                      onClick={() => !isSubmitting && memoizedOnRadioValueChange(option.id)}
                    >
                      <RadioGroupItem 
                        value={option.id} 
                        id={`${currentQuestion.id}-option-${option.id}`} 
                        className="h-5 w-5 border-muted-foreground text-primary focus:ring-primary disabled:opacity-50" 
                        disabled={isSubmitting}
                      />
                      <Label htmlFor={`${currentQuestion.id}-option-${option.id}`} className={cn("text-base md:text-lg flex-1 py-0.5 text-foreground", isSubmitting ? "cursor-not-allowed" : "cursor-pointer")}>{option.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                   <div className="text-center py-8">
                      <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto" />
                      <p className="text-muted-foreground mt-3">Loading options...</p>
                  </div>
              )}
              {internalError && (
                  <Alert variant="destructive" className="mt-6 rounded-lg">
                      <AlertTriangle className="h-5 w-5" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{internalError}</AlertDescription>
                  </Alert>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/30 p-4 md:p-5 bg-card/50 rounded-b-xl sticky bottom-0">
              {/* TODO: Add Framer Motion for button hover/tap effects */}
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0 || !allowBacktracking || !currentQuestion || isSubmitting}
                className="py-3 px-6 text-base rounded-lg shadow-md border-border hover:bg-muted/70"
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Previous
              </Button>
              {currentQuestionIndex < questions.length - 1 ? (
                <Button onClick={handleNextQuestion} disabled={!currentQuestion || isSubmitting} className="btn-gradient py-3 px-6 text-base rounded-lg">
                  Next <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              ) : (
                <Button onClick={handleInternalSubmitExam} disabled={isSubmitting || !currentQuestion} className="bg-green-600 hover:bg-green-700 text-white py-3 px-6 text-base rounded-lg shadow-md">
                  {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ListChecks className="mr-2 h-5 w-5" />}
                  Submit {isDemoMode ? "Demo " : ""}Exam
                </Button>
              )}
            </CardFooter>
          </Card>
        </main>
        
        {/* Question Navigation Panel */}
        <aside className="w-1/4 md:w-1/5 lg:w-[220px] glass-card p-4 shadow-lg flex flex-col rounded-xl">
          {/* TODO: Add Framer Motion for panel entrance */}
          <h3 className="text-lg font-semibold mb-4 text-foreground sticky top-0 bg-transparent py-2 z-10 border-b border-border/30 text-center">
            Questions
          </h3>
          <ScrollArea className="flex-grow pr-2 -mr-2">
            {/* TODO: Add Framer Motion list animation */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2.5">
              {questions.map((q, index) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = index === currentQuestionIndex;
                return (
                  // TODO: Add Framer Motion for tap/focus animation
                  <Button
                    key={q.id}
                    variant={isCurrent ? "default" : (isAnswered ? "secondary" : "outline")}
                    size="sm"
                    className={cn(
                      "aspect-square h-auto text-xs p-1 justify-center items-center font-medium rounded-lg shadow-sm transition-all duration-200",
                      "border-border/70 hover:border-primary/70 focus:ring-2 focus:ring-primary/50 focus:z-10",
                      isCurrent && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 shadow-lg bg-primary text-primary-foreground hover:bg-primary/90",
                      isAnswered && !isCurrent && "bg-green-500/20 dark:bg-green-500/30 border-green-500/50 text-green-700 dark:text-green-400 hover:bg-green-500/30",
                      !isAnswered && !isCurrent && "bg-background/50 hover:bg-muted/70 text-muted-foreground hover:text-foreground",
                      !allowBacktracking && index < currentQuestionIndex && "opacity-60 cursor-not-allowed hover:bg-muted/50"
                    )}
                    onClick={() => handleQuestionNavigation(index)}
                    disabled={(!allowBacktracking && index < currentQuestionIndex) || isSubmitting}
                  >
                    {index + 1}
                  </Button>
                );
              })}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}
