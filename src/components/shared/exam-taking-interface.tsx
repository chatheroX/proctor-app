
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, CheckCircle2, Save, Menu, X, ChevronLeft, ChevronRight, Clock, Bookmark, ListChecks, ShieldCheck, LogOut, HelpCircle, MessageSquare, Settings2Icon, GripVertical, Palette, Info } from 'lucide-react';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam, QuestionOption } from '@/types/supabase';
import { cn } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ZenTestLogo = () => (
  // Assuming logo.png is in the public folder
  <Image src="/logo.png" alt="ZenTest Logo" width={100} height={28} className="h-7 w-auto" />
);

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  isLoading: boolean; 
  examLoadingError: string | null;
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
  isLoading: examDataIsLoading,
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
  const [sidebarOpen, setSidebarOpen] = useState(true); // For mobile toggle - might remove for new UI

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
      await onTimeUpRef.current(answers, []); 
      setExamFinished(true);
    } catch (e: any) {
      setPersistentError(e.message || "Failed to auto-submit exam on time up.");
      toast({ title: "Auto-Submission Error", description: e.message || "Could not auto-submit exam.", variant: "destructive" });
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
      await onSubmitExamRef.current(answers, activityFlags); 
      setExamFinished(true);
    } catch (e: any) {
      setPersistentError(e.message || "Failed to submit exam.");
      toast({ title: "Submission Error", description: e.message || "Could not submit exam.", variant: "destructive" });
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

  if (!examDetails) {
    return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-amber-500/10 backdrop-blur-sm p-6 text-center">
        <AlertTriangle className="h-20 w-20 text-amber-500 mb-5" />
        <h2 className="text-2xl font-semibold text-amber-700 dark:text-amber-300 mb-3">Exam Not Found</h2>
        <p className="text-md text-amber-600 dark:text-amber-400 mb-8 max-w-md">
          The details for this exam could not be loaded. Please close this tab and try re-initiating the exam.
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
            <p className="text-sm text-muted-foreground">Answered: {Object.keys(answers).filter(key => !!answers[key]).length} / {questions.length || 0}</p>
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

  if ((!questions || questions.length === 0) && !examDataIsLoading) {
     return (
      <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-orange-500/10 backdrop-blur-sm p-6 text-center">
        <X className="h-20 w-20 text-orange-500 mb-5" />
        <h2 className="text-2xl font-semibold text-orange-700 dark:text-orange-300 mb-3">No Questions Available</h2>
        <p className="text-md text-orange-600 dark:text-orange-400 mb-8">This exam currently has no questions. Please contact your instructor.</p>
        <Button onClick={() => window.close()} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 text-base rounded-lg shadow-xl">Close Tab</Button>
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
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-slate-900 text-foreground transition-colors duration-300">
      {/* Top Header Bar */}
      <div className="bg-card/80 dark:bg-slate-800/80 backdrop-blur-md shadow-lg px-4 sm:px-6 py-2.5 flex justify-between items-center sticky top-0 z-40 h-16 border-b border-border/30">
        <div className="flex items-center gap-3">
          {/* Hamburger Menu Icon - Non-functional Placeholder */}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
          <div className="flex items-center gap-2">
            <ZenTestLogo />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-destructive font-semibold">
            <Clock size={20} />
            <span className="text-md tabular-nums">{formatTime(timeLeftSeconds)}</span>
          </div>
          <Button 
            onClick={handleInternalSubmitExam} 
            disabled={isSubmitting} 
            className="btn-gradient-destructive px-4 py-2 text-sm rounded-md shadow-md hover:shadow-lg transition-all duration-200"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-1.5 h-4 w-4" />}
            Submit Exam
          </Button>
        </div>
      </div>

      {/* Main Content - Sidebar and Question Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Question Navigation */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col w-64 bg-card/70 dark:bg-slate-800/70 backdrop-blur-lg shadow-xl transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 border-r border-border/30 pt-16", 
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-4 border-b border-border/30">
            <h2 className="text-lg font-semibold text-foreground">All Questions</h2>
             <Select disabled>
                <SelectTrigger className="mt-2 text-xs bg-background/50 dark:bg-slate-700/50 border-border/50 rounded-md">
                    <SelectValue placeholder="Section A - General" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="general">Section A - General</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-5 gap-2.5">
              {questions.map((q, index) => {
                const status = getQuestionStatus(q.id, index);
                let statusClasses = "bg-muted/50 dark:bg-slate-700/40 border-border/50 text-muted-foreground hover:bg-accent/10 dark:hover:bg-slate-600/50";
                if (status === 'current') statusClasses = 'bg-primary text-primary-foreground border-primary/70 ring-2 ring-primary/50 shadow-lg';
                else if (status === 'answered') statusClasses = 'bg-green-500/80 text-white border-green-600/70';
                else if (status === 'notAnswered') statusClasses = 'bg-red-500/80 text-white border-red-600/70';
                else if (status === 'reviewed') statusClasses = 'bg-purple-500/80 text-white border-purple-600/70';
                else if (status === 'answeredAndReviewed') statusClasses = 'bg-purple-500/80 text-white border-purple-600/70 relative after:content-[\"•\"] after:text-green-300 after:text-2xl after:absolute after:-top-1.5 after:-right-1';
                
                return (
                  <Button
                    key={q.id}
                    variant="outline"
                    size="icon"
                    className={cn(
                      "h-9 w-9 rounded-full text-xs font-medium border transition-all duration-150 ease-in-out",
                      statusClasses,
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
           <div className="p-3 border-t border-border/30 text-xs space-y-1.5 text-muted-foreground">
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-green-500/80 mr-2 border border-green-700/50"></span> Answered</div>
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-red-500/80 mr-2 border border-red-700/50"></span> Not Answered</div>
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-muted/50 dark:bg-slate-700/40 border border-border mr-2"></span> Not Visited</div>
                <div className="flex items-center"><span className="h-3 w-3 rounded-full bg-purple-500/80 mr-2 border border-purple-700/50"></span> Marked for Review</div>
            </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 bg-background/70 dark:bg-slate-800/40 overflow-y-auto lg:ml-0 transition-all duration-300 ease-in-out pt-20">
           {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
          
          <div className="max-w-4xl mx-auto">
            <Card className="bg-card/90 dark:bg-slate-800/90 backdrop-blur-md shadow-xl rounded-xl border-border/40">
                <CardHeader className="border-b border-border/30 p-5 flex justify-between items-center">
                    <div className="flex items-baseline gap-2">
                        <CardTitle className="text-xl font-semibold text-foreground">
                        Q.{currentQuestionIndex + 1}:
                        </CardTitle>
                        <p className="text-lg text-foreground flex-1">{currentQuestion?.text}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={handleToggleMarkForReview} className={cn("ml-3 text-muted-foreground hover:text-purple-500 dark:hover:text-purple-400", markedForReview[currentQuestion?.id || ''] && "text-purple-500 dark:text-purple-400")}>
                        <Bookmark className={cn("h-5 w-5", markedForReview[currentQuestion?.id || ''] ? "fill-purple-500" : "")}/>
                    </Button>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  {currentQuestion ? (
                    <RadioGroup
                        key={currentQuestion.id} // Add key here to force re-render of RadioGroup on question change
                        value={answers[currentQuestion.id] || ''}
                        onValueChange={memoizedOnRadioValueChange}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        disabled={isSubmitting}
                    >
                        {currentQuestion.options.map((option) => (
                        <Label
                            key={option.id}
                            htmlFor={`opt-${currentQuestion.id}-${option.id}`}
                            className={cn(
                            "flex items-center space-x-3 p-4 border rounded-lg transition-all duration-150 ease-in-out cursor-pointer modern-card",
                            "hover:shadow-lg hover:border-primary/60 dark:hover:border-primary/50",
                            answers[currentQuestion.id] === option.id 
                                ? "bg-primary/10 border-primary ring-2 ring-primary/70 dark:bg-primary/20 dark:border-primary/80" 
                                : "bg-background/50 dark:bg-slate-700/50 border-border/50 hover:bg-accent/5 dark:hover:bg-slate-700/80",
                            isSubmitting && "cursor-not-allowed opacity-70"
                            )}
                        >
                            <RadioGroupItem 
                            value={option.id} 
                            id={`opt-${currentQuestion.id}-${option.id}`}
                            className="h-5 w-5 border-muted-foreground/50 dark:border-slate-500 text-primary focus:ring-primary disabled:opacity-50 shrink-0" 
                            disabled={isSubmitting}
                            />
                            <span className="text-sm md:text-base font-medium text-foreground leading-snug">{option.text}</span>
                        </Label>
                        ))}
                    </RadioGroup>
                  ) : (
                     <p className="text-center text-muted-foreground py-10">Loading question...</p>
                  )}
                </CardContent>
                 <CardFooter className="border-t border-border/30 p-4 flex justify-between items-center bg-muted/30 dark:bg-slate-800/50 rounded-b-xl">
                    <Button
                      variant="outline"
                      onClick={handlePreviousQuestion}
                      disabled={currentQuestionIndex === 0 || !allowBacktracking || isSubmitting}
                      className="px-6 py-2.5 text-sm shadow-sm btn-outline-subtle rounded-md"
                    >
                      <ChevronLeft className="mr-1.5 h-4 w-4" /> Previous
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground border-border/50" disabled>Clear Response</Button>
                        <Button variant="default" size="sm" className={cn("text-white", markedForReview[currentQuestion?.id || ''] ? "bg-purple-600 hover:bg-purple-700" : "bg-purple-500 hover:bg-purple-600")} onClick={handleToggleMarkForReview}>
                            {markedForReview[currentQuestion?.id || ''] ? "Unmark Review" : "Mark for Review"}
                        </Button>
                    </div>
                    <Button
                      onClick={currentQuestionIndex < totalQuestions - 1 ? handleNextQuestion : handleInternalSubmitExam}
                      disabled={isSubmitting}
                      className={cn(
                        "px-6 py-2.5 text-sm shadow-sm rounded-md",
                         currentQuestionIndex < totalQuestions - 1 ? "btn-primary-solid" : "btn-gradient-positive"
                      )}
                    >
                      {currentQuestionIndex < totalQuestions - 1 ? 'Save & Next' : 'Save & Submit Exam'} 
                      {currentQuestionIndex < totalQuestions - 1 && <ChevronRight className="ml-1.5 h-4 w-4" />}
                      {currentQuestionIndex === totalQuestions - 1 && <CheckCircle2 className="ml-1.5 h-4 w-4" />}
                    </Button>
                </CardFooter>
              </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
