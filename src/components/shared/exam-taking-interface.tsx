
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation'; // Added missing import
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'; // Added CardFooter
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, CheckCircle2, Save, Menu, X, ChevronLeft, ChevronRight, Clock, Bookmark, ListChecks } from 'lucide-react';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam, QuestionOption } from '@/types/supabase';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge'; // Added missing import
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added for section dropdown
// Placeholder ZenTest SVG Logo
const ZenTestLogoText = () => (
  <span className="text-xl font-bold text-primary">
    Zen<span className="text-accent">●</span>Test<span className="text-accent">●</span>
  </span>
);

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  parentIsLoading: boolean;
  examLoadingError: string | null;
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
  const [persistentError, setPersistentError] = useState<string | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(examDetails?.duration ? examDetails.duration * 60 : 0);
  
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // For mobile sidebar toggle

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

  useEffect(() => {
    if (currentQuestion?.id) {
      setVisitedQuestions(prev => ({ ...prev, [currentQuestion.id]: true }));
    }
  }, [currentQuestion?.id]);

  const handleInternalTimeUp = useCallback(async () => {
    if (examFinished) return;
    toast({ title: isDemoMode ? "Demo Time's Up!" : "Time's Up!", description: isDemoMode ? "The demo exam duration has ended." : "Auto-submitting your exam.", variant: isDemoMode ? "default" : "destructive" });
    setIsSubmitting(true);
    setPersistentError(null);
    try {
      await onTimeUpRef.current(answers, []); // Pass empty flaggedEvents for now
      setExamFinished(true);
    } catch (e: any) {
      setPersistentError(e.message || "Failed to auto-submit exam on time up.");
      toast({ title: "Auto-Submission Error", description: e.message || "Could not auto-submit exam.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, isDemoMode, toast, examFinished]);

  useEffect(() => {
    if (examFinished || timeLeftSeconds <= 0 || parentIsLoading || examLoadingError || !examDetails) {
      if (timeLeftSeconds <= 0 && !examFinished && !parentIsLoading && !examLoadingError && examDetails) {
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
  }, [examFinished, timeLeftSeconds, handleInternalTimeUp, parentIsLoading, examLoadingError, examDetails]);

  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);
  const activityMonitorEnabled = useMemo(() => !examFinished && !isDemoMode && !!currentQuestion, [examFinished, isDemoMode, currentQuestion]);

  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]); // Keep track of flagged events

  const handleFlagEvent = useCallback((event: FlaggedEvent) => {
    setFlaggedEvents((prev) => [...prev, event]);
    if (!isDemoMode) {
      toast({ title: "Activity Alert", description: `Event: ${event.type}. This may be reported.`, variant: "destructive", duration: 5000 });
    } else {
      toast({ title: "Demo: Activity Monitor", description: `Event: ${event.type} (Informational for demo)`, duration: 3000 });
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
    setIsSubmitting(true);
    setPersistentError(null);
    try {
      await onSubmitExamRef.current(answers, flaggedEvents); // Pass flaggedEvents
      setExamFinished(true);
    } catch (e: any) {
      setPersistentError(e.message || "Failed to submit exam.");
      toast({ title: "Submission Error", description: e.message || "Could not submit exam.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, flaggedEvents, examFinished, toast]);

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

  const toggleMarkForReview = useCallback(() => {
    if (currentQuestion?.id) {
      setMarkedForReview(prev => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }));
    }
  }, [currentQuestion?.id]);

  const getQuestionStatus = (question: Question, index: number): "current" | "answered" | "notAnswered" | "markedForReview" | "answeredAndMarked" | "notVisited" => {
    const qId = question.id;
    const isAnswered = !!answers[qId];
    const isMarked = !!markedForReview[qId];
    const isVisited = !!visitedQuestions[qId];

    if (index === currentQuestionIndex) return "current";
    if (isAnswered && isMarked) return "answeredAndMarked";
    if (isMarked) return "markedForReview";
    if (isAnswered) return "answered";
    if (isVisited) return "notAnswered"; // Visited but not answered
    return "notVisited";
  };


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
        <Button onClick={() => window.close()} className="mt-4 btn-gradient">Close Tab</Button>
      </div>
    );
  }

  if (!examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-slate-900 p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Exam Session Error</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">Exam session not properly initiated or critical details are missing.</p>
        <Button onClick={() => window.close()} className="mt-4 btn-gradient">Close Tab</Button>
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
            {flaggedEvents.length > 0 && (
              <Alert variant={isDemoMode ? "default" : "destructive"} className={`mt-4 text-left ${isDemoMode ? 'bg-accent/10 border-accent/20' : 'bg-destructive/10 border-destructive/20'} rounded-md`}>
                <AlertTriangle className={`h-4 w-4 ${isDemoMode ? 'text-accent' : 'text-destructive'}`} />
                <AlertTitle className={`text-sm font-medium ${isDemoMode ? "text-accent-foreground" : "text-destructive"}`}>{isDemoMode ? "Demo Activity Log" : "Activity Summary"}</AlertTitle>
                <AlertDescription className={`text-xs ${isDemoMode ? "text-muted-foreground" : "text-destructive/80"}`}>{flaggedEvents.length} event(s) were {isDemoMode ? "monitored" : "flagged"}. {!isDemoMode && "These may be reviewed."}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => { if (typeof window !== 'undefined') { window.close(); if (!window.closed && !isDemoMode && studentRollNumber) router.push('/student/dashboard/exam-history'); else if (!window.closed && isDemoMode && examDetails?.exam_id) router.push(`/teacher/dashboard/exams/${examDetails.exam_id}/details`); else if (!window.closed) router.push('/'); } }} className="btn-gradient w-full py-2.5 text-sm rounded-md shadow-lg hover:shadow-primary/30">Close Tab</Button>
          </CardFooter>
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
        <Button onClick={() => window.close()} className="mt-4 btn-gradient">Close Tab</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-gray-950">
      {/* Top Header Bar */}
      <header className="bg-white dark:bg-gray-900/80 shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden text-gray-600 dark:text-gray-300" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu className="h-6 w-6" />
            </Button>
            <ZenTestLogoText />
          </div>
          <div className="flex items-center gap-2">
             <Badge variant="outline" className="text-sm py-1 px-3 hidden sm:flex items-center gap-1.5 border-primary/50 text-primary/80 bg-primary/10">
                <Clock className="h-4 w-4"/>
                {formatTime(timeLeftSeconds)}
            </Badge>
             <Button onClick={handleInternalSubmitExam} disabled={isSubmitting} className="btn-gradient-destructive text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 h-auto">
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
              Submit Exam
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 container mx-auto py-4 sm:py-6 gap-6">
        {/* Left Sidebar - Question Navigation */}
        <aside className={cn(
            "fixed inset-y-0 left-0 z-30 md:sticky md:top-16 md:!h-[calc(100vh-4rem-3.5rem)] bg-white dark:bg-gray-900/70 backdrop-blur-md shadow-lg md:shadow-none md:backdrop-blur-none rounded-r-xl md:rounded-lg border-r md:border border-gray-200 dark:border-gray-700/50 w-64 md:w-72 transform transition-transform duration-300 ease-in-out md:translate-x-0 p-4 flex flex-col",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">All Questions</h2>
             <Button variant="ghost" size="icon" className="md:hidden text-gray-500" onClick={() => setIsSidebarOpen(false)}><X className="h-5 w-5"/></Button>
           </div>
           <div className="mb-4">
             <Select defaultValue="all">
                <SelectTrigger className="w-full bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200">
                    <SelectValue placeholder="All Sections" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Sections (Placeholder)</SelectItem>
                </SelectContent>
            </Select>
           </div>
            <ScrollArea className="flex-grow pr-1">
                <div className="grid grid-cols-4 gap-2">
                    {questions.map((q, index) => {
                        const status = getQuestionStatus(q, index);
                        return (
                            <Button
                                key={q.id}
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "h-9 w-9 p-0 rounded-md text-xs font-medium flex items-center justify-center transition-all duration-150 ease-in-out focus:ring-1 focus:ring-offset-1 focus:ring-primary focus:z-10 shadow",
                                    status === "current" && "bg-primary text-primary-foreground ring-2 ring-primary/70 scale-105",
                                    status === "answered" && "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-400 hover:bg-green-500/30",
                                    status === "notAnswered" && "bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/20",
                                    status === "markedForReview" && "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-400 hover:bg-purple-500/30",
                                    status === "answeredAndMarked" && "bg-purple-500/20 border-purple-500/50 text-purple-700 dark:text-purple-400 hover:bg-purple-500/30 relative after:content-[''] after:absolute after:h-1.5 after:w-1.5 after:bg-green-500 after:rounded-full after:-top-0.5 after:-right-0.5",
                                    status === "notVisited" && "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700",
                                    (!allowBacktracking && index < currentQuestionIndex) && "opacity-60 cursor-not-allowed"
                                )}
                                onClick={() => handleQuestionNavigation(index)}
                                disabled={(!allowBacktracking && index < currentQuestionIndex) || isSubmitting}
                                title={`Question ${index + 1}`}
                            >
                                {index + 1}
                            </Button>
                        );
                    })}
                </div>
            </ScrollArea>
            <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700/50 space-y-2 text-xs">
                <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-500/30 border border-green-500/50"></span> Answered</p>
                <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-red-500/20 border border-red-500/40"></span> Not Answered</p>
                <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600"></span> Not Visited</p>
                <p className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-purple-500/20 border border-purple-500/50"></span> Marked for Review</p>
            </div>
        </aside>

        {/* Main Content Area - Question and Options */}
        <main className="flex-1 bg-white dark:bg-gray-900/70 backdrop-blur-md shadow-xl rounded-lg p-6 md:p-8 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                    Q.{currentQuestionIndex + 1}:
                </h3>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 leading-tight flex-1">
                  {currentQuestion?.text}
                </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={toggleMarkForReview} className={cn("text-gray-400 hover:text-purple-500 dark:text-gray-500 dark:hover:text-purple-400", markedForReview[currentQuestion?.id || ''] && "text-purple-600 dark:text-purple-500")}>
              <Bookmark className={cn("h-5 w-5", markedForReview[currentQuestion?.id || ''] && "fill-purple-500/30")} />
            </Button>
          </div>
          
          {/* Placeholder for marks, to be replaced with real data if available */}
          {/* <Badge variant="secondary" className="mb-4 self-start">4 Mark</Badge>  */}

          <ScrollArea className="flex-grow my-6 pr-2">
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
                    "flex items-center space-x-3 p-4 border rounded-lg transition-all duration-150 ease-in-out cursor-pointer text-gray-700 dark:text-gray-200",
                    "hover:shadow-md hover:border-primary/70 dark:hover:bg-primary/5",
                    answers[currentQuestion.id || ''] === option.id 
                      ? "bg-primary/10 border-primary ring-2 ring-primary/80 dark:bg-primary/20 dark:border-primary" 
                      : "bg-gray-50 dark:bg-gray-800/60 border-gray-300 dark:border-gray-600",
                    isSubmitting && "cursor-not-allowed opacity-70"
                  )}
                >
                  <RadioGroupItem 
                    value={option.id} 
                    id={`opt-${currentQuestion.id}-${option.id}`}
                    className="h-5 w-5 border-slate-400 dark:border-slate-500 text-primary focus:ring-primary disabled:opacity-50 shrink-0" 
                    disabled={isSubmitting}
                  />
                  <span className="text-base">
                     {option.text}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </ScrollArea>
          
          {persistentError && (
              <Alert variant="destructive" className="mt-auto rounded-md">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Error</AlertTitle>
                  <AlertDescription className="text-xs">{persistentError}</AlertDescription>
              </Alert>
          )}

          <div className="mt-auto pt-6 border-t border-gray-200 dark:border-gray-700/50 flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0 || !allowBacktracking || isSubmitting}
              className="px-5 py-2.5 text-sm rounded-md shadow-sm border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 btn-outline-subtle"
            >
              <ChevronLeft className="mr-1.5 h-4 w-4" /> Prev
            </Button>
            <div className="text-sm text-gray-500 dark:text-gray-400">
                {Object.keys(answers).filter(key => !!answers[key]).length} / {questions.length} Answered
            </div>
            {currentQuestionIndex < questions.length - 1 ? (
              <Button 
                onClick={handleNextQuestion} 
                disabled={isSubmitting} 
                className="btn-gradient px-5 py-2.5 text-sm rounded-md shadow-sm"
              >
                Next <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            ) : (
               <Button 
                onClick={handleInternalSubmitExam} 
                disabled={isSubmitting} 
                className="btn-gradient-positive px-5 py-2.5 text-sm rounded-md shadow-sm"
              >
                {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Submit Exam
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
