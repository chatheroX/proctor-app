
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Card used for individual question box
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea }
from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress'; // Progress for question navigation bar
import { Loader2, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, CheckCircle2, Save, Menu, X, ChevronLeft, ChevronRight, Clock, Bookmark, ListChecks, ShieldCheck, LogOut } from 'lucide-react';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam, QuestionOption } from '@/types/supabase';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ZenTestLogoText = () => (
  <span className="text-2xl font-bold text-primary">
    Zen<span className="text-accent">●</span>Test
  </span>
);

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  parentIsLoading: boolean;
  examLoadingError: string | null;
  examStarted: boolean; // This will always be true when this component is rendered by parent
  onAnswerChange: (questionId: string, optionId: string) => void;
  onSubmitExam: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => Promise<void>;
  onTimeUp: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => Promise<void>;
  isDemoMode?: boolean;
  userIdForActivityMonitor: string;
  studentName?: string | null;
  studentRollNumber?: string | null;
  studentAvatarUrl?: string | null;
}

export function ExamTakingInterface({
  examDetails,
  questions,
  initialAnswers,
  parentIsLoading,
  examLoadingError,
  examStarted, // Will be true
  onAnswerChange,
  onSubmitExam: parentOnSubmitExam,
  onTimeUp: parentOnTimeUp,
  isDemoMode = false,
  userIdForActivityMonitor,
  studentName,
  studentRollNumber,
  studentAvatarUrl,
}: ExamTakingInterfaceProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [examFinished, setExamFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [persistentError, setPersistentError] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(examDetails?.duration ? examDetails.duration * 60 : 0);
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);

  const onSubmitExamRef = useRef(parentOnSubmitExam);
  const onTimeUpRef = useRef(parentOnTimeUp);

  useEffect(() => { onSubmitExamRef.current = parentOnSubmitExam; }, [parentOnSubmitExam]);
  useEffect(() => { onTimeUpRef.current = parentOnTimeUp; }, [parentOnTimeUp]);

  useEffect(() => {
    if (examDetails?.duration) {
      setTimeLeftSeconds(examDetails.duration * 60);
    }
  }, [examDetails?.duration]);

  const currentQuestion = useMemo(() => (questions && questions.length > currentQuestionIndex) ? questions[currentQuestionIndex] : null, [questions, currentQuestionIndex]);
  const allowBacktracking = useMemo(() => examDetails?.allow_backtracking === true, [examDetails?.allow_backtracking]);

  const handleInternalTimeUp = useCallback(async () => {
    if (examFinished) return;
    toast({ title: isDemoMode ? "Demo Time's Up!" : "Time's Up!", description: isDemoMode ? "The demo exam duration has ended." : "Auto-submitting your exam.", variant: isDemoMode ? "default" : "destructive" });
    setIsSubmitting(true);
    setPersistentError(null);
    try {
      await onTimeUpRef.current(answers, flaggedEvents);
      setExamFinished(true);
    } catch (e: any) {
      setPersistentError(e.message || "Failed to auto-submit exam on time up.");
      toast({ title: "Auto-Submission Error", description: e.message || "Could not auto-submit exam.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, isDemoMode, toast, examFinished, flaggedEvents]);

  useEffect(() => {
    if (examFinished || timeLeftSeconds <= 0 || !examDetails || !examStarted) { // Added !examStarted
      if (timeLeftSeconds <= 0 && !examFinished && examDetails && examStarted) {
        handleInternalTimeUp();
      }
      return;
    }
    const intervalId = setInterval(() => {
      setTimeLeftSeconds(prevTime => {
        if (prevTime <= 1) {
          clearInterval(intervalId);
          if (!examFinished) handleInternalTimeUp();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [examFinished, timeLeftSeconds, handleInternalTimeUp, examDetails, examStarted]);

  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);
  const activityMonitorEnabled = useMemo(() => !examFinished && !isDemoMode && !!currentQuestion && examStarted, [examFinished, isDemoMode, currentQuestion, examStarted]);

  const handleFlagEvent = useCallback((event: FlaggedEvent) => {
    setFlaggedEvents((prev) => [...prev, event]);
    if (!isDemoMode) {
      // toast({ title: "Activity Alert", description: `Event: ${event.type}. This may be reported.`, variant: "destructive", duration: 5000 });
    } else {
      // toast({ title: "Demo: Activity Monitor", description: `Event: ${event.type} (Informational for demo)`, duration: 3000 });
    }
  }, [isDemoMode, setFlaggedEvents]);

  useActivityMonitor({
    studentId: userIdForActivityMonitor,
    examId: examIdForMonitor,
    enabled: activityMonitorEnabled,
    onFlagEvent: handleFlagEvent,
  });

  const handleInternalAnswerChange = useCallback((questionId: string, optionId: string) => {
    setAnswers((prevAnswers) => ({ ...prevAnswers, [questionId]: optionId }));
    onAnswerChange(questionId, optionId);
  }, [onAnswerChange, setAnswers]);

  const handleNextQuestion = useCallback(() => {
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }, [currentQuestionIndex, questions, setCurrentQuestionIndex]);

  const handlePreviousQuestion = useCallback(() => {
    if (allowBacktracking && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (!allowBacktracking) {
      toast({ description: "Backtracking is not allowed for this exam.", variant: "default" });
    }
  }, [allowBacktracking, currentQuestionIndex, toast, setCurrentQuestionIndex]);

  const handleQuestionNavigation = useCallback((index: number) => {
    if (index >= 0 && questions && index < questions.length) {
      if (!allowBacktracking && index < currentQuestionIndex) {
        toast({ description: "Backtracking is not allowed for this exam.", variant: "default" });
        return;
      }
      setCurrentQuestionIndex(index);
    }
  }, [allowBacktracking, currentQuestionIndex, questions, toast, setCurrentQuestionIndex]);

  const handleInternalSubmitExam = useCallback(async () => {
    if (examFinished) return;
    const confirmed = window.confirm("Are you sure you want to submit the exam? This action cannot be undone.");
    if (!confirmed) return;

    setIsSubmitting(true);
    setPersistentError(null);
    try {
      await onSubmitExamRef.current(answers, flaggedEvents);
      setExamFinished(true);
    } catch (e: any) {
      setPersistentError(e.message || "Failed to submit exam.");
      toast({ title: "Submission Error", description: e.message || "Could not submit exam.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, flaggedEvents, examFinished, toast, setIsSubmitting, setPersistentError, setExamFinished]);

  const currentQuestionId = currentQuestion?.id;
  const memoizedOnRadioValueChange = useCallback((optionId: string) => {
    if (currentQuestionId) {
      handleInternalAnswerChange(currentQuestionId, optionId);
    }
  }, [currentQuestionId, handleInternalAnswerChange]);

  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  if (parentIsLoading && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam content...</p>
      </div>
    );
  }
  
  if (examLoadingError) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4 text-center">
        <ServerCrash className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Exam</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">{examLoadingError}</p>
        <Button onClick={() => window.close()} className="mt-4 btn-gradient-destructive">Close Tab</Button>
      </div>
    );
  }

  if (!examDetails || !examStarted) {
    console.log("[ExamTakingInterface] Not properly initiated. ExamDetails:", !!examDetails, "ExamStarted:", examStarted);
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Exam Session Error</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">
          Exam session not properly initiated or critical details are missing.
        </p>
        <Button onClick={() => window.close()} className="mt-4 btn-gradient-destructive">Close Tab</Button>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-4 text-center">
        <Card className="w-full max-w-md modern-card shadow-2xl p-6 bg-card/90 dark:bg-card/80 backdrop-blur-md border-border/20">
          <CardHeader className="pb-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground">{isDemoMode ? "Demo " : ""}Exam {persistentError ? "Submission Attempted" : "Submitted"}!</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {persistentError ? `There was an issue: ${persistentError}` : isDemoMode ? `The demo for "${examDetails.title}" has concluded.` : `Your responses for "${examDetails.title}" have been recorded.`}
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Answered: {Object.keys(answers).length} / {questions.length || 0}</p>
            {flaggedEvents.length > 0 && !isDemoMode && (
              <Alert variant="destructive" className="mt-4 text-left bg-destructive/10 border-destructive/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-sm font-medium text-destructive">Activity Summary</AlertTitle>
                <AlertDescription className="text-xs text-destructive/80">{flaggedEvents.length} event(s) were flagged. These may be reviewed.</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardContent className="mt-4">
            <Button onClick={() => { if (typeof window !== 'undefined') { window.close(); } }} className="btn-gradient w-full py-2.5 text-sm rounded-md shadow-lg hover:shadow-primary/30">Close Tab</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((!questions || questions.length === 0) && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4 text-center">
        <X className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">No Questions Available</h2>
        <p className="text-md text-muted-foreground">This exam currently has no questions. Please contact your instructor or proctor.</p>
        <Button onClick={() => window.close()} className="mt-4 btn-gradient-destructive">Close Tab</Button>
      </div>
    );
  }

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).filter(key => !!answers[key]).length;


  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-gray-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar: Logo and User Info */}
      <header className="bg-white dark:bg-slate-800 shadow-md px-4 sm:px-6 py-3 flex justify-between items-center sticky top-0 z-20 h-16">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <ZenTestLogoText />
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-primary/30">
            <AvatarImage src={studentAvatarUrl || undefined} alt={studentName || 'Student'} />
            <AvatarFallback className="bg-muted text-muted-foreground font-semibold text-xs">
              {(studentName || 'S').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium truncate max-w-[150px]">{studentName || 'Student'}</p>
            {studentRollNumber && <p className="text-xs text-muted-foreground">ID: {studentRollNumber}</p>}
          </div>
        </div>
      </header>

      {/* Second Bar: Timer and Submit Button */}
      <div className="bg-slate-50 dark:bg-slate-700/50 px-4 sm:px-6 py-2 shadow sticky top-16 z-20 flex justify-between items-center h-14 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <span className="font-semibold text-lg tabular-nums">{formatTime(timeLeftSeconds)}</span>
          <span className="text-sm text-muted-foreground">Time Remaining</span>
        </div>
        <Button 
            onClick={handleInternalSubmitExam} 
            disabled={isSubmitting} 
            className="btn-gradient-destructive rounded-md px-4 py-2 text-sm font-medium shadow-sm"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          Submit Exam
        </Button>
      </div>

      {/* Main Content: Question and Options */}
      <main className="flex-1 container mx-auto py-6 px-4 sm:px-6 flex flex-col items-center justify-center">
        <Card className="w-full max-w-3xl modern-card shadow-xl bg-white dark:bg-slate-800/80">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 pb-3">
            <CardTitle className="text-lg font-semibold text-primary">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-6 px-6 space-y-6">
            {currentQuestion ? (
              <>
                <p className="text-lg md:text-xl font-medium leading-relaxed whitespace-pre-wrap">
                  {currentQuestion.text}
                </p>
                <RadioGroup
                  value={answers[currentQuestion.id] || ''}
                  onValueChange={memoizedOnRadioValueChange}
                  className="grid grid-cols-1 gap-3 sm:gap-4 pt-4"
                  disabled={isSubmitting}
                >
                  {currentQuestion.options.map((option) => (
                    <Label
                      key={option.id}
                      htmlFor={`opt-${currentQuestion.id}-${option.id}`}
                      className={cn(
                        "flex items-center space-x-3 p-3.5 border rounded-lg transition-all duration-150 ease-in-out cursor-pointer text-slate-700 dark:text-slate-200 shadow-sm",
                        "hover:shadow-md hover:border-primary/60 dark:hover:bg-primary/10",
                        answers[currentQuestion.id] === option.id 
                          ? "bg-primary/10 border-primary ring-2 ring-primary/70 dark:bg-primary/20 dark:border-primary" 
                          : "bg-slate-50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600/50",
                        isSubmitting && "cursor-not-allowed opacity-70"
                      )}
                    >
                      <RadioGroupItem 
                        value={option.id} 
                        id={`opt-${currentQuestion.id}-${option.id}`}
                        className="h-5 w-5 border-slate-400 dark:border-slate-500 text-primary focus:ring-primary disabled:opacity-50 shrink-0" 
                        disabled={isSubmitting}
                      />
                      <span className="text-sm md:text-base font-medium leading-snug">{option.text}</span>
                    </Label>
                  ))}
                </RadioGroup>
              </>
            ) : (
              <p className="text-center text-muted-foreground">Loading question...</p>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Bottom Navigation Bar: Prev/Next, Question Jump */}
      <footer className="bg-white dark:bg-slate-800 shadow-t-md px-4 sm:px-6 py-3 flex justify-between items-center sticky bottom-0 z-20 border-t border-slate-200 dark:border-slate-700 h-16">
        <Button
          variant="outline"
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0 || !allowBacktracking || isSubmitting}
          className="rounded-md px-4 py-2 text-sm shadow-sm btn-outline-subtle"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" /> Previous
        </Button>
        
        <ScrollArea className="max-w-[calc(100vw-220px)] sm:max-w-sm md:max-w-md lg:max-w-lg whitespace-nowrap">
          <div className="flex items-center justify-center gap-1.5 px-2">
            {questions.map((q, index) => (
              <Button
                key={q.id}
                variant={currentQuestionIndex === index ? 'default' : 'outline'}
                size="icon"
                className={cn(
                  "h-8 w-8 p-0 rounded-md text-xs font-medium transition-all duration-150 ease-in-out focus:ring-1 focus:ring-offset-1 focus:ring-primary focus:z-10 shadow-sm shrink-0",
                  currentQuestionIndex === index && "bg-primary text-primary-foreground scale-105",
                  answers[q.id] && currentQuestionIndex !== index && "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400 hover:bg-green-500/30",
                  !answers[q.id] && currentQuestionIndex !== index && "bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 hover:bg-slate-300 dark:hover:bg-slate-600",
                  (!allowBacktracking && index < currentQuestionIndex) && "opacity-60 cursor-not-allowed"
                )}
                onClick={() => handleQuestionNavigation(index)}
                disabled={(!allowBacktracking && index < currentQuestionIndex) || isSubmitting}
                title={`Question ${index + 1}`}
              >
                {index + 1}
              </Button>
            ))}
          </div>
        </ScrollArea>

        <Button
          onClick={currentQuestionIndex < totalQuestions - 1 ? handleNextQuestion : handleInternalSubmitExam}
          disabled={isSubmitting}
          className={cn(
            "rounded-md px-4 py-2 text-sm shadow-sm",
            currentQuestionIndex < totalQuestions - 1 ? "btn-gradient" : "btn-gradient-positive"
          )}
        >
          {currentQuestionIndex < totalQuestions - 1 ? 'Next' : 'Submit Exam'} 
          {currentQuestionIndex < totalQuestions - 1 && <ChevronRight className="ml-1.5 h-4 w-4" />}
          {currentQuestionIndex === totalQuestions - 1 && <CheckCircle2 className="ml-1.5 h-4 w-4" />}
        </Button>
      </footer>
    </div>
  );
}

