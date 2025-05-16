
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation'; // Ensure this is imported
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, CheckCircle2, Save, Menu, X, ChevronLeft, ChevronRight, Clock, Bookmark, ListChecks, ShieldCheck, LogOut, HelpCircle, MessageSquare, Settings2Icon, GripVertical, Palette, Info, FileText, Check, Settings, Grid, Type } from 'lucide-react';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam, QuestionOption } from '@/types/supabase';
import { cn } from "@/lib/utils";
import logoAsset from '../../../logo.png'; // Import the logo

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  parentIsLoading: boolean;
  examLoadingError: string | null;
  persistentError: string | null; 
  cantStartReason: string | null;
  onAnswerChange: (questionId: string, optionId: string) => void;
  onSubmitExam: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => Promise<void>;
  onTimeUp: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => Promise<void>;
  isDemoMode?: boolean;
  userIdForActivityMonitor: string;
  studentName?: string | null;
  studentRollNumber?: string | null;
  studentAvatarUrl?: string | null;
  examStarted: boolean;
}

export function ExamTakingInterface({
  examDetails,
  questions,
  initialAnswers,
  parentIsLoading,
  examLoadingError,
  persistentError,
  cantStartReason,
  onAnswerChange,
  onSubmitExam: parentOnSubmitExam,
  onTimeUp: parentOnTimeUp,
  isDemoMode = false,
  userIdForActivityMonitor,
  studentName,
  studentRollNumber,
  studentAvatarUrl,
  examStarted,
}: ExamTakingInterfaceProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [examFinished, setExamFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(examDetails?.duration ? examDetails.duration * 60 : 0);
  
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
    try {
      await onTimeUpRef.current(answers, []); 
      setExamFinished(true);
    } catch (e: any) {
      toast({ title: "Auto-Submission Error", description: e.message || "Could not auto-submit exam.", variant: "destructive" });
    }
  }, [answers, isDemoMode, toast, examFinished]);


  useEffect(() => {
    if (examFinished || timeLeftSeconds <= 0 || !examDetails || !examStarted) {
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

  const [activityFlags, setActivityFlags] = useState<FlaggedEvent[]>([]);
  const handleFlagEvent = useCallback((event: FlaggedEvent) => {
    setActivityFlags((prev) => [...prev, event]);
  }, []);

  useActivityMonitor({
    studentId: userIdForActivityMonitor,
    examId: examIdForMonitor,
    enabled: activityMonitorEnabled,
    onFlagEvent: handleFlagEvent,
  });

  const handleInternalAnswerChange = useCallback((questionId: string, optionId: string) => {
    setAnswers((prevAnswers) => ({ ...prevAnswers, [questionId]: optionId }));
    if (onAnswerChange) { // Check if onAnswerChange is provided
        onAnswerChange(questionId, optionId);
    }
  }, [onAnswerChange]);

  const handleNextQuestion = useCallback(() => {
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  }, [currentQuestionIndex, questions]);

  const handlePreviousQuestion = useCallback(() => {
    if (allowBacktracking && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
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
    const confirmed = window.confirm("Are you sure you want to submit the exam? This action cannot be undone.");
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await onSubmitExamRef.current(answers, activityFlags); 
      setExamFinished(true);
    } catch (e: any) {
      toast({ title: "Submission Error", description: e.message || "Could not submit exam.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, activityFlags, examFinished, toast]);

  const currentQuestionId = useMemo(() => currentQuestion?.id, [currentQuestion?.id]);
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
  
  const totalQuestions = questions?.length || 0;

  // Loading states and error handling
  if (parentIsLoading) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
        <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
        <p className="text-xl text-slate-200 font-medium">Loading Exam Environment...</p>
      </div>
    );
  }
  
  if (examLoadingError) {
     return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-red-500/10 backdrop-blur-sm p-6 text-center">
        <ServerCrash className="h-20 w-20 text-red-500 mb-5" />
        <h2 className="text-2xl font-semibold text-red-700 dark:text-red-300 mb-3">Error Loading Exam</h2>
        <p className="text-md text-red-600 dark:text-red-400 mb-8 max-w-md">{examLoadingError}</p>
        <Button onClick={() => window.close()} className="btn-gradient-destructive px-8 py-3 text-base rounded-lg shadow-xl">Close Tab</Button>
      </div>
    );
  }

  if (!examDetails || !examStarted) {
     return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-amber-500/10 backdrop-blur-sm p-6 text-center">
        <AlertTriangle className="h-20 w-20 text-amber-500 mb-5" />
        <h2 className="text-2xl font-semibold text-amber-700 dark:text-amber-300 mb-3">Exam Session Not Properly Initiated</h2>
        <p className="text-md text-amber-600 dark:text-amber-400 mb-8 max-w-md">
          {cantStartReason || "The exam details could not be loaded or the session is invalid. Please close this tab and try re-initiating the exam."}
        </p>
        <Button onClick={() => window.close()} className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 text-base rounded-lg shadow-xl">Close Tab</Button>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-gradient-to-br from-green-500/10 via-emerald-500/10 to-teal-500/10 backdrop-blur-md p-6 text-center">
        <Card className="w-full max-w-lg modern-card shadow-2xl p-8 bg-card/90 dark:bg-card/80">
          <CardHeader className="pb-5">
            <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto mb-5" />
            <h2 className="text-2xl font-semibold text-foreground">{isDemoMode ? "Demo " : ""}Exam {persistentError ? "Submission Attempted" : "Submitted"}!</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {persistentError ? `There was an issue: ${persistentError}` : isDemoMode ? `The demo for "${examDetails.title}" has concluded.` : `Your responses for "${examDetails.title}" have been recorded.`}
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Answered: {Object.keys(answers).filter(key => !!answers[key]).length} / {totalQuestions || 0}</p>
            {activityFlags.length > 0 && !isDemoMode && (
              <Alert variant="destructive" className="mt-5 text-left bg-destructive/10 border-destructive/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-sm font-medium text-destructive">Activity Summary</AlertTitle>
                <AlertDescription className="text-xs text-destructive/80">{activityFlags.length} event(s) were flagged. These may be reviewed.</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="mt-6">
            <Button onClick={() => { if (typeof window !== 'undefined') { window.close(); } }} className="btn-gradient w-full py-3 text-base rounded-lg shadow-lg hover:shadow-primary/30">Close Tab</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if ((!questions || totalQuestions === 0) && !parentIsLoading) {
     return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-orange-500/10 backdrop-blur-sm p-6 text-center">
        <X className="h-20 w-20 text-orange-500 mb-5" />
        <h2 className="text-2xl font-semibold text-orange-700 dark:text-orange-300 mb-3">No Questions Available</h2>
        <p className="text-md text-orange-600 dark:text-orange-400 mb-8">This exam currently has no questions. Please contact your instructor.</p>
        <Button onClick={() => window.close()} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-base rounded-lg shadow-xl">Close Tab</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-100 dark:bg-slate-900 text-foreground">
      {/* Top Bar */}
      <header className="bg-white dark:bg-slate-800 shadow-md px-4 sm:px-6 py-2 flex justify-between items-center sticky top-0 z-40 border-b dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Image src={logoAsset} alt="ZenTest Logo" width={28} height={28} className="h-7 w-auto" />
          <span className="font-semibold text-lg text-slate-700 dark:text-slate-200">ZenTest</span>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={studentAvatarUrl || undefined} alt={studentName || 'Student'} />
            <AvatarFallback>{(studentName || "S").charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{studentName || "Test Student"}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{studentRollNumber || "S00000"}</p>
          </div>
        </div>
      </header>

      {/* Timer and Submit Bar */}
      <div className="bg-white dark:bg-slate-800/50 shadow px-4 sm:px-6 py-3 flex justify-between items-center border-b dark:border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Clock size={18} />
          <span className="font-medium text-sm">Time remaining:</span>
          <span className="font-semibold text-sm tabular-nums">{formatTime(timeLeftSeconds)}</span>
        </div>
        <Button
          onClick={handleInternalSubmitExam}
          disabled={isSubmitting}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 text-sm rounded-md"
        >
          {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Submit Exam
        </Button>
      </div>

      {/* Main Content Area - Full Screen */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-4xl bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6 sm:p-8"> {/* Increased max-width */}
          <div className="mb-6 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </p>
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-800 dark:text-slate-100">
              {currentQuestion?.text}
            </h2>
          </div>

          {currentQuestion && (
            <RadioGroup
              key={currentQuestion.id}
              value={answers[currentQuestion.id] || ''}
              onValueChange={memoizedOnRadioValueChange}
              className={cn(
                "grid gap-3 sm:gap-4",
                currentQuestion.options.length <= 2 ? "grid-cols-1" :
                currentQuestion.options.length <= 4 ? "grid-cols-1 sm:grid-cols-2" :
                "grid-cols-1 sm:grid-cols-2" 
              )}
              disabled={isSubmitting}
            >
              {currentQuestion.options.map((option) => (
                <Label
                  key={option.id}
                  htmlFor={`opt-${currentQuestion.id}-${option.id}`}
                  className={cn(
                    "flex items-center space-x-3 p-3.5 border rounded-lg transition-all duration-150 ease-in-out cursor-pointer",
                    "hover:shadow-md hover:border-primary/70 dark:hover:border-primary/60",
                    answers[currentQuestion.id] === option.id
                      ? "bg-primary/10 border-primary ring-2 ring-primary/80 dark:bg-primary/20 dark:border-primary"
                      : "bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/60",
                    isSubmitting && "cursor-not-allowed opacity-70"
                  )}
                >
                  <RadioGroupItem
                    value={option.id}
                    id={`opt-${currentQuestion.id}-${option.id}`}
                    className="h-4 w-4 border-slate-400 dark:border-slate-500 text-primary focus:ring-primary disabled:opacity-50 shrink-0"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 leading-snug">{option.text}</span>
                </Label>
              ))}
            </RadioGroup>
          )}
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <footer className="bg-white dark:bg-slate-800/80 backdrop-blur-sm shadow-top px-4 sm:px-6 py-3 flex justify-between items-center sticky bottom-0 z-40 border-t dark:border-slate-700">
        <Button
          variant="outline"
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0 || !allowBacktracking || isSubmitting}
          className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
        >
          <ChevronLeft className="mr-1.5 h-4 w-4" /> Prev
        </Button>

        <div className="flex items-center gap-1.5 overflow-x-auto px-2">
          {questions.map((q, index) => (
            <Button
              key={q.id}
              variant={currentQuestionIndex === index ? "default" : "outline"}
              size="icon"
              className={cn(
                "h-8 w-8 text-xs rounded-md shrink-0",
                currentQuestionIndex === index 
                  ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900" 
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50",
                answers[q.id] && currentQuestionIndex !== index ? "bg-green-100 dark:bg-green-700/30 border-green-400 dark:border-green-600 text-green-700 dark:text-green-300" : "",
                (!allowBacktracking && index < currentQuestionIndex) && "opacity-60 cursor-not-allowed"
              )}
              onClick={() => handleQuestionNavigation(index)}
              disabled={(!allowBacktracking && index < currentQuestionIndex) || isSubmitting}
            >
              {index + 1}
            </Button>
          ))}
        </div>

        <Button
          onClick={currentQuestionIndex < totalQuestions - 1 ? handleNextQuestion : handleInternalSubmitExam}
          disabled={isSubmitting}
          className={cn(
            currentQuestionIndex < totalQuestions - 1 
              ? "bg-slate-800 dark:bg-slate-200 hover:bg-slate-700 dark:hover:bg-slate-300 text-white dark:text-slate-900" 
              : "bg-red-600 hover:bg-red-700 text-white" 
          )}
        >
          {currentQuestionIndex < totalQuestions - 1 ? 'Next' : 'Submit Exam'}
          {currentQuestionIndex < totalQuestions - 1 && <ChevronRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </footer>
    </div>
  );
}

