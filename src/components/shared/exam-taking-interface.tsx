
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'; // Keep Card for inner content if needed
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, Check, XCircle, ThumbsUp, Clock, LogOut, HelpCircle, MessageSquare, Menu, Bookmark, Palette, FileTextIcon, GripVertical, Type, UploadCloud, Minus, LayoutGrid, ChevronRight, Info, CheckCircle2, Save } from 'lucide-react';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam } from '@/types/supabase';
import { cn } from '@/lib/utils';

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  parentIsLoading: boolean;
  examLoadingError: string | null;
  examStarted: boolean; // This should be true when this component is rendered
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
  parentIsLoading,
  examLoadingError,
  examStarted, // Assume this is true when rendered
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
  const [persistentError, setPersistentError] = useState<string | null>(null); // For errors during submission/timeup
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(examDetails?.duration ? examDetails.duration * 60 : 0);

  const onSubmitExamRef = useRef(parentOnSubmitExam);
  const onTimeUpRef = useRef(parentOnTimeUp);

  useEffect(() => {
    onSubmitExamRef.current = parentOnSubmitExam;
  }, [parentOnSubmitExam]);

  useEffect(() => {
    onTimeUpRef.current = parentOnTimeUp;
  }, [parentOnTimeUp]);
  
  useEffect(() => {
    if (examDetails?.duration) {
      setTimeLeftSeconds(examDetails.duration * 60);
    }
  }, [examDetails?.duration]);

  const handleInternalTimeUp = useCallback(async () => {
    if (examFinished) return;
    if (!isDemoMode) {
      toast({ title: "Time's Up!", description: "Auto-submitting your exam.", variant: "destructive" });
    } else {
      toast({ title: "Demo Time's Up!", description: "The demo exam duration has ended." });
    }
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
  }, [answers, isDemoMode, toast, examFinished]); // Removed flaggedEvents from here for now

  useEffect(() => {
    if (!examStarted || examFinished || timeLeftSeconds <= 0 || parentIsLoading || examLoadingError) {
      if (timeLeftSeconds <= 0 && examStarted && !examFinished && !parentIsLoading && !examLoadingError) {
        handleInternalTimeUp();
      }
      return;
    }
    const intervalId = setInterval(() => {
      setTimeLeftSeconds(prevTime => {
        if (prevTime <= 1) {
          clearInterval(intervalId);
          if (!examFinished) handleInternalTimeUp(); // Ensure call if not already finished
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [examStarted, examFinished, timeLeftSeconds, handleInternalTimeUp, parentIsLoading, examLoadingError]);


  const currentQuestion = useMemo(() => (questions && questions.length > currentQuestionIndex) ? questions[currentQuestionIndex] : null, [questions, currentQuestionIndex]);
  const allowBacktracking = useMemo(() => examDetails?.allow_backtracking === true, [examDetails?.allow_backtracking]);
  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);
  const activityMonitorEnabled = useMemo(() => examStarted && !examFinished && !isDemoMode && !!currentQuestion, [examStarted, examFinished, isDemoMode, currentQuestion]);

  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);
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
  }, [answers, examFinished, toast]); // Removed flaggedEvents from here for now

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
  
  const answeredCount = Object.keys(answers).length;

  if (parentIsLoading) {
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
        <Button onClick={() => window.close()} className="mt-4 btn-primary-solid">Close Tab</Button>
      </div>
    );
  }
  
  if (!examDetails || !examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Exam Session Error</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">Exam session not properly initiated or critical details are missing.</p>
        <Button onClick={() => window.close()} className="mt-4 btn-primary-solid">Close Tab</Button>
      </div>
    );
  }

  if (examFinished) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 text-center">
        <Card className="w-full max-w-md modern-card shadow-2xl p-6 bg-card/90 dark:bg-card/70 backdrop-blur-md border-border/20">
          <CardHeader className="pb-4">
            <ThumbsUp className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground">{isDemoMode ? "Demo " : ""}Exam {persistentError ? "Submission Attempted" : "Submitted"}!</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {persistentError 
                ? `There was an issue: ${persistentError}`
                : isDemoMode
                  ? `The demo for "${examDetails.title}" has concluded.`
                  : `Your responses for "${examDetails.title}" have been recorded.`
              }
            </p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Answered: {answeredCount} / {questions.length || 0}</p>
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
                if (!window.closed && !isDemoMode && studentRollNumber) router.push('/student/dashboard/exam-history');
                else if (!window.closed && isDemoMode && examDetails?.exam_id) router.push(`/teacher/dashboard/exams/${examDetails.exam_id}/details`);
                else if (!window.closed) router.push('/'); 
              }
            }} className="btn-primary-solid w-full py-2.5 text-sm rounded-md shadow-lg hover:shadow-primary/30">
              Close Tab
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if ((!questions || questions.length === 0) && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4 text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">No Questions Available</h2>
        <p className="text-md text-muted-foreground">This exam currently has no questions. Please contact your instructor or proctor.</p>
        <Button onClick={() => window.close()} className="mt-4 btn-primary-solid">Close Tab</Button>
      </div>
    );
  }
  
  if (!currentQuestion && questions && questions.length > 0 && !parentIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading current question...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-800">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold text-slate-700 dark:text-slate-200">ProctorPrep</span>
        </div>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={isDemoMode ? undefined : studentRollNumber ? `https://api.dicebear.com/8.x/micah/svg?seed=${studentRollNumber}` : undefined} alt={studentName || 'User'} />
            <AvatarFallback className="text-xs">
              {studentName ? studentName.split(' ').map(n => n[0]).join('').toUpperCase() : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate max-w-[150px]">{studentName || (isDemoMode ? "Teacher Demo" : "Student")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{studentRollNumber || (isDemoMode ? "DEMO-ID" : "N/A")}</p>
          </div>
        </div>
      </div>

      {/* Timer and Submit Bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Clock className="h-5 w-5" />
          <span className="font-medium">Time remaining:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{formatTime(timeLeftSeconds)}</span>
        </div>
        <Button 
          variant="destructive" 
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md shadow"
          onClick={handleInternalSubmitExam}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
          Submit Exam
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow p-4 sm:p-6 md:p-8 overflow-y-auto">
        <Card className="w-full max-w-3xl mx-auto bg-white dark:bg-slate-900 shadow-xl rounded-lg">
          <CardHeader className="border-b border-slate-200 dark:border-slate-700 pb-4">
            <p className="text-sm font-medium text-primary mb-1">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
            <h2 className="text-xl md:text-lg font-semibold text-slate-800 dark:text-slate-100 leading-snug">
              {currentQuestion?.text}
            </h2>
          </CardHeader>
          
          <CardContent className="p-6">
            <RadioGroup
              value={answers[currentQuestion?.id || ''] || ''}
              onValueChange={memoizedOnRadioValueChange}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
              disabled={isSubmitting}
            >
              {currentQuestion?.options.map((option) => (
                <Label
                  key={option.id}
                  htmlFor={`opt-${currentQuestion.id}-${option.id}`}
                  className={cn(
                    "flex items-center space-x-3 p-4 border rounded-lg transition-all duration-150 ease-in-out cursor-pointer",
                    "hover:shadow-md hover:border-primary/70 dark:hover:bg-primary/5",
                    answers[currentQuestion.id || ''] === option.id 
                      ? "bg-primary/10 border-primary ring-2 ring-primary/80 dark:bg-primary/20 dark:border-primary" 
                      : "bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600",
                    isSubmitting && "cursor-not-allowed opacity-70"
                  )}
                >
                  <RadioGroupItem 
                    value={option.id} 
                    id={`opt-${currentQuestion.id}-${option.id}`}
                    className="h-5 w-5 border-slate-400 dark:border-slate-500 text-primary focus:ring-primary disabled:opacity-50 shrink-0" 
                    disabled={isSubmitting}
                  />
                  <span className="text-base text-slate-700 dark:text-slate-200">
                     {option.text}
                  </span>
                </Label>
              ))}
            </RadioGroup>
            
            {persistentError && (
                <Alert variant="destructive" className="mt-6 rounded-md">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Error</AlertTitle>
                    <AlertDescription className="text-xs">{persistentError}</AlertDescription>
                </Alert>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Bottom Navigation */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-700 shadow- ऊपर-md">
        <Button
          variant="outline"
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0 || !allowBacktracking || isSubmitting}
          className="px-5 py-2.5 text-sm rounded-md shadow-sm border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Prev
        </Button>
        
        <ScrollArea className="max-w-[calc(100%-280px)] whitespace-nowrap px-2">
           <div className="flex items-center gap-1.5 sm:gap-2">
              {questions.map((q, index) => (
                <Button
                  key={q.id}
                  variant={currentQuestionIndex === index ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-8 w-8 sm:h-9 sm:w-9 rounded-md text-xs font-medium flex items-center justify-center transition-all duration-150 ease-in-out focus:ring-1 focus:ring-offset-1 focus:ring-primary focus:z-10 shadow-sm",
                    currentQuestionIndex === index 
                      ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300" 
                      : "bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600",
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

        {currentQuestionIndex < questions.length - 1 ? (
          <Button 
            onClick={handleNextQuestion} 
            disabled={isSubmitting} 
            className="bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300 px-5 py-2.5 text-sm rounded-md shadow-sm"
          >
            Next <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
           <Button 
            onClick={handleInternalSubmitExam} 
            disabled={isSubmitting} 
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 text-sm rounded-md shadow-sm"
          >
            {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
            Finish Exam
          </Button>
        )}
      </div>
    </div>
  );
}

