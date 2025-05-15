
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Added missing import
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
  examStarted, // This prop determines if the exam taking UI or pre-start screen is shown
  onAnswerChange,
  onSubmitExam: parentOnSubmitExam,
  onTimeUp: parentOnTimeUp,
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

  const onSubmitExamRef = useRef(parentOnSubmitExam);
  const onTimeUpRef = useRef(parentOnTimeUp);

  useEffect(() => {
    onSubmitExamRef.current = parentOnSubmitExam;
  }, [parentOnSubmitExam]);

  useEffect(() => {
    onTimeUpRef.current = parentOnTimeUp;
  }, [parentOnTimeUp]);
  
  // This useEffect was removed because useState(initialAnswers || {}) handles initial state.
  // Re-syncing based on initialAnswers prop changes can be complex and lead to loops.
  // If dynamic reset is needed, parent should control examStarted or provide a key to ExamTakingInterface.
  // useEffect(() => {
  //   console.log("[ExamTakingInterface] initialAnswers prop changed:", initialAnswers);
  //   setAnswers(initialAnswers || {});
  // }, [initialAnswers]);


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

  const currentQuestionId = useMemo(() => currentQuestion?.id, [currentQuestion?.id]);
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <ServerCrash className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Exam</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">{examLoadingError}</p>
        <p className="text-xs text-muted-foreground">You may need to close this tab and try re-initiating the exam.</p>
      </div>
    );
  }
  
  if (!examDetails || !examStarted) {
     console.log("[ExamTakingInterface] Not properly initiated. examDetails:", !!examDetails, "examStarted:", examStarted);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Exam Session Error</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">Exam session not properly initiated or critical details are missing.</p>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <Card className="w-full max-w-md modern-card shadow-lg p-6">
          <CardHeader className="pb-4">
            <ThumbsUp className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground">{isDemoMode ? "Demo " : ""}Exam {internalError ? "Submission Attempted" : "Submitted"}!</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {internalError 
                ? `There was an issue: ${internalError}`
                : isDemoMode
                  ? `The demo for "${examDetails.title}" has concluded.`
                  : `Your responses for "${examDetails.title}" have been recorded.`
              }
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Answered: {Object.keys(answers).length} / {questions.length || 0}</p>
            {flaggedEvents.length > 0 && (
              <Alert
                variant={isDemoMode ? "default" : "destructive"}
                className={`mt-4 text-left ${isDemoMode ? 'bg-accent/10 border-accent/20' : 'bg-destructive/10 border-destructive/20'} rounded-md`}
              >
                <Flag className={`h-4 w-4 ${isDemoMode ? 'text-accent' : 'text-destructive'}`} />
                <AlertTitle className={`text-sm font-medium ${isDemoMode ? "text-accent-foreground" : "text-destructive"}`}>
                  {isDemoMode ? "Demo Activity Log" : "Activity Summary"}
                </AlertTitle>
                <AlertDescription className={`text-xs ${isDemoMode ? "text-muted-foreground" : "text-destructive/80"}`}>
                  {flaggedEvents.length} event(s) were {isDemoMode ? "monitored" : "flagged"}.
                  {!isDemoMode && " These may be reviewed."}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
             <Button onClick={() => {
              if (typeof window !== 'undefined') {
                window.close(); 
                if (!window.closed) {
                    if (!isDemoMode) router.push('/student/dashboard/exam-history');
                    else if (isDemoMode && examDetails?.exam_id) router.push(`/teacher/dashboard/exams/${examDetails.exam_id}/details`);
                }
              }
            }} className="btn-primary-solid w-full py-2 text-sm rounded-md">
              Close Tab
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!questions || questions.length === 0 && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">No Questions Available</h2>
        <p className="text-md text-muted-foreground">This exam has no questions. Please contact your instructor.</p>
      </div>
    );
  }
  
   if (!currentQuestion && questions && questions.length > 0 && !parentIsLoading) {
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
    <div className="flex flex-col h-screen bg-muted/30 text-foreground">
      {examDetails && examStarted && !examFinished && (
        <ExamTimerWarning
          key={`${examDetails.exam_id}-${examDetails.duration}`}
          totalDurationSeconds={examDurationForTimer * 60}
          onTimeUp={handleInternalTimeUp}
          examTitle={examTitleForTimer + (isDemoMode ? " (Demo)" : "")}
        />
      )}
      
      {/* Header Section */}
      <header className="sticky top-0 left-0 right-0 z-40 bg-card shadow-sm py-3 px-4 md:px-6 border-b border-border mt-[2.5rem] md:mt-[2.5rem]"> {/* Adjusted margin-top for timer */}
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-y-2 md:gap-x-4">
          <div className="flex-1 min-w-0 text-center md:text-left">
            <h1 className="text-lg md:text-xl font-semibold text-foreground truncate flex items-center gap-2 justify-center md:justify-start">
              <BookOpen className="h-5 w-5 shrink-0 text-primary" /> 
              <span className="truncate" title={examDetails.title}>
                {examDetails.title}
              </span>
              {isDemoMode && <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300 whitespace-nowrap">(DEMO)</span>}
            </h1>
            <div className="flex items-center justify-center md:justify-start gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1 flex-wrap">
              {studentName && (
                <span className="flex items-center gap-1 whitespace-nowrap"><UserCircle className="h-3 w-3" /> {studentName}</span>
              )}
              {studentRollNumber && (
                <span className="flex items-center gap-1 whitespace-nowrap"><Hash className="h-3 w-3" /> ID: {studentRollNumber}</span>
              )}
            </div>
          </div>
          <div className="text-xs font-medium text-muted-foreground w-full md:w-auto text-center md:text-right mt-1 md:mt-0 whitespace-nowrap">
            Question {currentQuestionIndex + 1} of {questions.length || 0}
          </div>
        </div>
        {questions.length > 0 && <Progress value={questionProgress} className="mt-2 h-1.5 rounded-full bg-primary/20" />}
      </header>

      {/* Main Exam Area */}
      <div className="flex-grow flex overflow-hidden p-4 md:p-6 gap-4 md:gap-6">
        {/* Question Navigation Panel (Right Side) */}
        <aside className="w-1/4 md:w-1/5 lg:w-[200px] modern-card p-3 shadow-md flex flex-col rounded-md bg-card border-border">
          <h3 className="text-sm font-semibold mb-3 text-foreground border-b border-border pb-2 text-center">
            Questions
          </h3>
          <ScrollArea className="flex-grow pr-1 -mr-1">
            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 gap-1.5">
              {questions.map((q, index) => {
                const isAnswered = !!answers[q.id];
                const isCurrent = index === currentQuestionIndex;
                return (
                  <Button
                    key={q.id || index} // Fallback to index if q.id is somehow undefined
                    variant={isCurrent ? "default" : (isAnswered ? "secondary" : "outline")}
                    size="sm"
                    className={cn(
                      "aspect-square h-auto text-xs p-0 justify-center items-center font-medium rounded-md shadow-xs transition-all duration-150",
                      "border-border/70 hover:border-primary focus:ring-1 focus:ring-primary focus:z-10",
                      isCurrent && "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary ring-offset-1 ring-offset-background scale-105",
                      isAnswered && !isCurrent && "bg-green-100 dark:bg-green-700/30 border-green-300 dark:border-green-600 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-700/40",
                      !isAnswered && !isCurrent && "bg-card hover:bg-muted/70 text-muted-foreground hover:text-foreground",
                      (!allowBacktracking && index < currentQuestionIndex) && "opacity-60 cursor-not-allowed hover:bg-inherit"
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

        {/* Main Question Content Area (Left Side) */}
        <main className="flex-grow flex flex-col items-center justify-center overflow-y-auto rounded-md">
          <Card className="w-full modern-card shadow-md flex flex-col flex-grow rounded-md bg-card border-border">
            <CardHeader className="p-4 md:p-5 border-b border-border">
              {currentQuestion && <h2 className="text-md md:text-lg font-medium text-foreground leading-snug">{currentQuestion.text}</h2>}
              {!currentQuestion && questions.length > 0 && (
                  <h2 className="text-md text-muted-foreground">Loading question text...</h2>
              )}
            </CardHeader>
            <CardContent className="p-4 md:p-5 space-y-3 flex-grow overflow-y-auto">
              {currentQuestion?.options ? (
                <RadioGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={memoizedOnRadioValueChange}
                  className="space-y-3"
                  disabled={isSubmitting}
                >
                  {currentQuestion.options.map((option, optIndex) => (
                    <div 
                      key={option.id || optIndex} // Fallback to index if option.id undefined
                      className={cn(
                        "flex items-center space-x-3 p-3 border rounded-md transition-all duration-150 ease-in-out cursor-pointer",
                        "hover:bg-primary/5 hover:border-primary/50 dark:hover:bg-primary/10",
                        answers[currentQuestion.id] === option.id && "bg-primary/10 border-primary ring-1 ring-primary/70 shadow-sm",
                        isSubmitting && "cursor-not-allowed opacity-70"
                      )}
                      onClick={() => !isSubmitting && memoizedOnRadioValueChange(option.id)}
                    >
                      <RadioGroupItem 
                        value={option.id} 
                        id={`${currentQuestion.id}-option-${option.id}`} 
                        className="h-4 w-4 border-muted-foreground text-primary focus:ring-primary disabled:opacity-50" 
                        disabled={isSubmitting}
                      />
                      <Label htmlFor={`${currentQuestion.id}-option-${option.id}`} className={cn("text-sm md:text-base flex-1 py-0.5 text-foreground", isSubmitting ? "cursor-not-allowed" : "cursor-pointer")}>{option.text}</Label>
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                   <div className="text-center py-6">
                      <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                      <p className="text-muted-foreground mt-2 text-sm">Loading options...</p>
                  </div>
              )}
              {internalError && (
                  <Alert variant="destructive" className="mt-4 rounded-md">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-sm">Error</AlertTitle>
                      <AlertDescription className="text-xs">{internalError}</AlertDescription>
                  </Alert>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border p-3 md:p-4 bg-muted/50 rounded-b-md sticky bottom-0">
              <Button
                variant="outline"
                onClick={handlePreviousQuestion}
                disabled={currentQuestionIndex === 0 || !allowBacktracking || !currentQuestion || isSubmitting}
                className="py-2 px-4 text-sm rounded-md shadow-sm border-border hover:bg-accent/20"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Previous
              </Button>
              {currentQuestionIndex < questions.length - 1 ? (
                <Button onClick={handleNextQuestion} disabled={!currentQuestion || isSubmitting} className="btn-primary-solid py-2 px-4 text-sm rounded-md">
                  Next <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleInternalSubmitExam} disabled={isSubmitting || !currentQuestion} className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 text-sm rounded-md shadow-sm">
                  {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ListChecks className="mr-1.5 h-4 w-4" />}
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
