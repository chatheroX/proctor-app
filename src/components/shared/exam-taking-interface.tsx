
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image'; // Added import
import { useRouter } from 'next/navigation'; // Ensured useRouter is imported
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, CheckCircle2, Save, Menu, X, ChevronLeft, ChevronRight, Clock, Bookmark, ListChecks, ShieldCheck, LogOut, HelpCircle, MessageSquare, Settings2Icon, GripVertical } from 'lucide-react';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam, QuestionOption } from '@/types/supabase';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge"; // Ensured Badge is imported
import { Textarea } from "@/components/ui/textarea"; // Ensured Textarea is imported
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Updated ZenTestLogo component using Image
const ZenTestLogo = () => (
  <Image src="/logo.png" alt="ZenTest Logo" width={100} height={28} className="h-7 w-auto" />
);


interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  isLoading: boolean; // Renamed from parentIsLoading for clarity within this component
  examLoadingError: string | null;
  // examStarted prop is removed as this interface is now always active when rendered
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
  isLoading: examDataIsLoading, // Use destructured prop
  examLoadingError,
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
  
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true); // For mobile toggle

  const onSubmitExamRef = useRef(parentOnSubmitExam);
  const onTimeUpRef = useRef(parentOnTimeUp);

  useEffect(() => { onSubmitExamRef.current = parentOnSubmitExam; }, [parentOnSubmitExam]);
  useEffect(() => { onTimeUpRef.current = parentOnTimeUp; }, [parentOnTimeUp]);

  useEffect(() => {
    if (examDetails?.duration) {
      setTimeLeftSeconds(examDetails.duration * 60);
    }
  }, [examDetails?.duration]);

  useEffect(() => {
    if (questions && questions.length > 0 && currentQuestion) {
      setVisitedQuestions(prev => ({ ...prev, [currentQuestion.id]: true }));
    }
  }, [currentQuestionIndex, questions]);


  const currentQuestion = useMemo(() => (questions && questions.length > currentQuestionIndex) ? questions[currentQuestionIndex] : null, [questions, currentQuestionIndex]);
  const allowBacktracking = useMemo(() => examDetails?.allow_backtracking === true, [examDetails?.allow_backtracking]);

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
      // No need to set isSubmitting to false if exam is finished
    }
  }, [answers, isDemoMode, toast, examFinished]);


  useEffect(() => {
    if (examFinished || timeLeftSeconds <= 0 || !examDetails) {
      if (timeLeftSeconds <= 0 && !examFinished && examDetails) {
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
  }, [examFinished, timeLeftSeconds, handleInternalTimeUp, examDetails]);

  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);
  const activityMonitorEnabled = useMemo(() => !examFinished && !isDemoMode && !!currentQuestion, [examFinished, isDemoMode, currentQuestion]);

  // Placeholder for flagged events from activity monitor
  const [activityFlags, setActivityFlags] = useState<FlaggedEvent[]>([]);
  const handleFlagEvent = useCallback((event: FlaggedEvent) => {
    setActivityFlags((prev) => [...prev, event]);
    if (!isDemoMode) {
      // toast({ title: "Activity Alert", description: `Event: ${event.type}. This may be reported.`, variant: "destructive", duration: 5000 });
    } else {
      // toast({ title: "Demo: Activity Monitor", description: `Event: ${event.type} (Informational for demo)`, duration: 3000 });
    }
  }, [isDemoMode]);

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
    const confirmed = window.confirm("Are you sure you want to submit the exam? This action cannot be undone.");
    if (!confirmed) return;

    setIsSubmitting(true);
    setPersistentError(null);
    try {
      await onSubmitExamRef.current(answers, activityFlags); // Pass collected activityFlags
      setExamFinished(true);
    } catch (e: any) {
      setPersistentError(e.message || "Failed to submit exam.");
      toast({ title: "Submission Error", description: e.message || "Could not submit exam.", variant: "destructive" });
    } finally {
       // No need to set isSubmitting false if examFinished
    }
  }, [answers, activityFlags, examFinished, toast]);

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

  const handleToggleMarkForReview = useCallback(() => {
    if (currentQuestion) {
      setMarkedForReview(prev => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }));
    }
  }, [currentQuestion]);


  if (examDataIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-gray-950 p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam...</p>
      </div>
    );
  }
  
  if (examLoadingError) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-gray-950 p-4 text-center">
        <ServerCrash className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Exam</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">{examLoadingError}</p>
        <Button onClick={() => window.close()} className="mt-4 btn-gradient-destructive">Close Tab</Button>
      </div>
    );
  }

  if (!examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 dark:bg-gray-950 p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Exam Not Found</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">
          The details for this exam could not be loaded. Please close this tab and try again.
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
            {activityFlags.length > 0 && !isDemoMode && (
              <Alert variant="destructive" className="mt-4 text-left bg-destructive/10 border-destructive/20 rounded-md">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-sm font-medium text-destructive">Activity Summary</AlertTitle>
                <AlertDescription className="text-xs text-destructive/80">{activityFlags.length} event(s) were flagged. These may be reviewed.</AlertDescription>
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

  if ((!questions || questions.length === 0) && !examDataIsLoading) {
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

  const getQuestionStatus = (qId: string, index: number) => {
    if (currentQuestionIndex === index) return 'current';
    if (markedForReview[qId] && answers[qId]) return 'answeredAndReviewed';
    if (markedForReview[qId]) return 'reviewed';
    if (answers[qId]) return 'answered';
    if (visitedQuestions[qId]) return 'notAnswered';
    return 'notVisited';
  };


  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-800 dark:text-gray-100">
      {/* Top Header Bar - Timer and Test Info */}
       <div className="bg-white dark:bg-gray-800 shadow-md px-4 sm:px-6 py-2 flex justify-between items-center sticky top-0 z-30 h-14">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden text-gray-600 dark:text-gray-300" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-700 dark:text-gray-200 hidden sm:block">{examDetails.title}</h1>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-red-500">
                <Clock size={20} />
                <span className="font-semibold text-md tabular-nums">{formatTime(timeLeftSeconds)}</span>
            </div>
          <Button 
            onClick={handleInternalSubmitExam} 
            disabled={isSubmitting} 
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-sm rounded-md shadow-sm"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            End Test
          </Button>
        </div>
      </div>

      {/* Main Content - Sidebar and Question Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Question Navigation */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-20 flex-col w-64 bg-white dark:bg-gray-800 shadow-lg transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex border-r border-gray-200 dark:border-gray-700 pt-14", // pt-14 to offset top header
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-md font-semibold text-gray-700 dark:text-gray-200">All Questions</h2>
            {/* Placeholder for Section Select */}
             <Select disabled>
                <SelectTrigger className="mt-2 text-xs">
                    <SelectValue placeholder="Section A - Physics" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="physics">Section A - Physics</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, index) => {
                const status = getQuestionStatus(q.id, index);
                return (
                  <Button
                    key={q.id}
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-9 w-9 rounded-full text-xs font-medium border",
                      status === 'current' && 'bg-blue-500 text-white border-blue-600 ring-2 ring-blue-300',
                      status === 'answered' && 'bg-green-500 text-white border-green-600',
                      status === 'notAnswered' && 'bg-red-500 text-white border-red-600',
                      status === 'reviewed' && 'bg-purple-500 text-white border-purple-600',
                       status === 'answeredAndReviewed' && 'bg-purple-500 text-white border-purple-600 relative after:content-["•"] after:text-green-300 after:text-2xl after:absolute after:-top-1 after:-right-0.5',
                      status === 'notVisited' && 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600',
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
           <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs space-y-2">
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-green-500 mr-2"></span> Answered</div>
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-red-500 mr-2"></span> Not Answered</div>
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 mr-2"></span> Not Visited</div>
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-purple-500 mr-2"></span> Marked for Review</div>
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-purple-500 mr-1.5 relative after:content-['•'] after:text-green-300 after:text-2xl after:absolute after:-top-1.5 after:right-0"></span> Answered & Reviewed</div>
            </div>
        </aside>

        {/* Main Content Area - Question and Options */}
        <main className="flex-1 p-6 bg-gray-100 dark:bg-gray-900 overflow-y-auto lg:ml-0 transition-all duration-300 ease-in-out pt-20"> {/* pt-20 to offset top header */}
           {sidebarOpen && <div className="fixed inset-0 z-10 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
          
          <div className="max-w-4xl mx-auto">
             {/* Student Info / Question Header */}
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Student: <span className="font-medium text-gray-700 dark:text-gray-200">{studentName || 'N/A'}</span></p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Roll No: <span className="font-medium text-gray-700 dark:text-gray-200">{studentRollNumber || 'N/A'}</span></p>
                </div>
                <div className="mt-2 sm:mt-0 text-right">
                    <p className="text-md font-semibold text-gray-700 dark:text-gray-200">Question {currentQuestionIndex + 1}<span className="text-gray-500 dark:text-gray-400">/{totalQuestions}</span></p>
                </div>
            </div>

            {currentQuestion ? (
              <Card className="bg-white dark:bg-gray-800 shadow-xl rounded-lg">
                <CardHeader className="border-b border-gray-200 dark:border-gray-700 p-5 flex justify-between items-center">
                  <CardTitle className="text-lg font-semibold text-gray-800 dark:text-gray-100 flex-1">
                    {currentQuestion.text}
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={handleToggleMarkForReview} className={cn("ml-3 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400", markedForReview[currentQuestion.id] && "text-purple-600 dark:text-purple-400")}>
                    <Bookmark className={cn("h-5 w-5", markedForReview[currentQuestion.id] ? "fill-purple-500" : "")}/>
                  </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={memoizedOnRadioValueChange}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    disabled={isSubmitting}
                  >
                    {currentQuestion.options.map((option) => (
                      <Label
                        key={option.id}
                        htmlFor={`opt-${currentQuestion.id}-${option.id}`}
                        className={cn(
                          "flex items-center space-x-3 p-4 border rounded-lg transition-all duration-150 ease-in-out cursor-pointer",
                          "hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500",
                          answers[currentQuestion.id] === option.id 
                            ? "bg-blue-50 border-blue-500 ring-2 ring-blue-300 dark:bg-blue-500/20 dark:border-blue-500" 
                            : "bg-gray-50 dark:bg-gray-700/60 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700",
                          isSubmitting && "cursor-not-allowed opacity-70"
                        )}
                      >
                        <RadioGroupItem 
                          value={option.id} 
                          id={`opt-${currentQuestion.id}-${option.id}`}
                          className="h-5 w-5 border-gray-400 dark:border-gray-500 text-blue-600 focus:ring-blue-500 disabled:opacity-50 shrink-0" 
                          disabled={isSubmitting}
                        />
                        <span className="text-sm md:text-base font-medium text-gray-700 dark:text-gray-200 leading-snug">{option.text}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                </CardContent>
                 <CardFooter className="border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0 || !allowBacktracking || isSubmitting}
                      className="px-6 py-2 text-sm shadow-sm btn-outline-subtle rounded-md"
                    >
                      <ChevronLeft className="mr-1.5 h-4 w-4" /> Previous
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="text-gray-600 dark:text-gray-300" disabled>Clear Response</Button>
                        <Button variant="default" size="sm" className="bg-purple-500 hover:bg-purple-600 text-white" onClick={handleToggleMarkForReview}>
                            {markedForReview[currentQuestion.id] ? "Unmark" : "Mark for Review"}
                        </Button>
                    </div>
                    <Button
                      onClick={currentQuestionIndex < totalQuestions - 1 ? handleNextQuestion : handleInternalSubmitExam}
                      disabled={isSubmitting}
                      className={cn(
                        "px-6 py-2 text-sm shadow-sm rounded-md",
                         currentQuestionIndex < totalQuestions - 1 ? "bg-blue-500 hover:bg-blue-600 text-white" : "bg-green-500 hover:bg-green-600 text-white"
                      )}
                    >
                      {currentQuestionIndex < totalQuestions - 1 ? 'Save & Next' : 'Save & Submit'} 
                      {currentQuestionIndex < totalQuestions - 1 && <ChevronRight className="ml-1.5 h-4 w-4" />}
                      {currentQuestionIndex === totalQuestions - 1 && <CheckCircle2 className="ml-1.5 h-4 w-4" />}
                    </Button>
                </CardFooter>
              </Card>
            ) : (
              <p className="text-center text-muted-foreground py-10">Loading question...</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
