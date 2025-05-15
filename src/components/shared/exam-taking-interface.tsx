
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge"; // Added this import
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag, AlertTriangle, ServerCrash, UserCircle, Hash, BookOpen, Check, XCircle, ThumbsUp, ClockIcon, LogOut, HelpCircle, MessageSquare, Menu, Bookmark, Palette, FileTextIcon, GripVertical, Type, UploadCloud, Minus } from 'lucide-react';
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
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});

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
  
  // Mark current question as visited
  useEffect(() => {
    if (questions && questions.length > 0 && questions[currentQuestionIndex]) {
      setVisitedQuestions(prev => ({ ...prev, [questions[currentQuestionIndex].id]: true }));
    }
  }, [currentQuestionIndex, questions]);

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

  const toggleMarkForReview = useCallback(() => {
    if (currentQuestion) {
      setMarkedForReview(prev => ({ ...prev, [currentQuestion.id]: !prev[currentQuestion.id] }));
    }
  }, [currentQuestion]);

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

  const getQuestionStatusClass = useCallback((qId: string, index: number) => {
    const isCurrent = index === currentQuestionIndex;
    const isAns = !!answers[qId];
    const isMarked = !!markedForReview[qId];
    const isVis = !!visitedQuestions[qId];

    if (isCurrent) return "bg-primary text-primary-foreground ring-2 ring-primary-foreground/50";
    if (isAns && isMarked) return "bg-purple-500 text-white relative after:content-[''] after:absolute after:top-1 after:right-1 after:w-2 after:h-2 after:bg-green-400 after:rounded-full";
    if (isMarked) return "bg-purple-500 text-white";
    if (isAns) return "bg-green-500 text-white";
    if (!isAns && isVis) return "bg-red-500 text-white";
    return "bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300";
  }, [currentQuestionIndex, answers, markedForReview, visitedQuestions]);


  if (parentIsLoading && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-800 p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam interface...</p>
      </div>
    );
  }

  if (examLoadingError && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-800 p-4 text-center">
        <ServerCrash className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Error Loading Exam</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">{examLoadingError}</p>
        <p className="text-xs text-muted-foreground">You may need to close this tab and try re-initiating the exam.</p>
      </div>
    );
  }
  
  if (!examDetails || !examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-800 p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">Exam Session Error</h2>
        <p className="text-md text-muted-foreground mb-6 max-w-md">Exam session not properly initiated or critical details are missing. ExamDetails: {examDetails ? 'Exists' : 'Missing'}, ExamStarted: {examStarted ? 'True' : 'False'}</p>
         <Button onClick={() => window.close()} className="mt-4 btn-primary-solid">Close Tab</Button>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-800 p-4 text-center">
        <Card className="w-full max-w-md modern-card shadow-lg p-6 bg-card">
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
                if (!window.closed && !isDemoMode) router.push('/student/dashboard/exam-history');
                else if (!window.closed && isDemoMode && examDetails?.exam_id) router.push(`/teacher/dashboard/exams/${examDetails.exam_id}/details`);
                else if (!window.closed) router.push('/'); 
              }
            }} className="btn-primary-solid w-full py-2 text-sm rounded-md">
              Close Tab
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if ((!questions || questions.length === 0) && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-800 p-4 text-center">
        <XCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive mb-2">No Questions Available</h2>
        <p className="text-md text-muted-foreground">This exam has no questions. Please contact your instructor.</p>
      </div>
    );
  }
  
   if (!currentQuestion && questions && questions.length > 0 && !parentIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-800 p-4">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading question...</p>
      </div>
    );
  }
  
  const examDurationForTimer = examDetails.duration ?? 0;
  const examTitleForTimer = examDetails.title ?? "Exam";

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950 text-foreground overflow-hidden">
      {examDetails && examStarted && !examFinished && (
        <ExamTimerWarning
          key={`${examDetails.exam_id}-${examDetails.duration}`}
          totalDurationSeconds={examDurationForTimer * 60}
          onTimeUp={handleInternalTimeUp}
          examTitle={examTitleForTimer + (isDemoMode ? " (Demo)" : "")}
        />
      )}

      {/* Top Header Bar */}
      <header className="h-16 bg-white dark:bg-gray-900 shadow-md flex items-center justify-between px-4 md:px-6 shrink-0 sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 mt-[52px]"> {/* Adjusted for timer warning */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden"> {/* Placeholder for mobile panel toggle */}
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white truncate">
            All Questions
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Select defaultValue="section-a">
            <SelectTrigger className="w-auto h-9 text-sm focus:ring-primary dark:bg-gray-800 dark:border-gray-700">
              <SelectValue placeholder="Section A - Physics" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="section-a">Section A - Physics</SelectItem>
              <SelectItem value="section-b">Section B - Chemistry</SelectItem>
            </SelectContent>
          </Select>
          {/* Timer and End Test button are part of ExamTimerWarning or main page logic */}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Question Navigation */}
        <aside className="w-72 bg-white dark:bg-gray-900/80 border-r border-gray-200 dark:border-gray-700 flex flex-col p-4 space-y-4 shadow-lg">
          <div className="text-center py-2 border-b dark:border-gray-700">
            <h2 className="text-md font-semibold text-gray-700 dark:text-gray-200">
                {studentName || 'Student'}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">ID: {studentRollNumber || 'N/A'}</p>
          </div>
          
          <ScrollArea className="flex-grow">
            <div className="grid grid-cols-5 gap-2 p-1">
              {questions.map((q, index) => (
                <Button
                  key={q.id}
                  variant="outline"
                  className={cn(
                    "h-9 w-9 rounded-full text-xs font-medium flex items-center justify-center transition-all duration-150 ease-in-out focus:ring-2 focus:ring-offset-1 focus:ring-primary focus:z-10 shadow-sm",
                    getQuestionStatusClass(q.id, index),
                    (!allowBacktracking && index < currentQuestionIndex) && "opacity-60 cursor-not-allowed"
                  )}
                  onClick={() => handleQuestionNavigation(index)}
                  disabled={(!allowBacktracking && index < currentQuestionIndex) || isSubmitting}
                >
                  {index + 1}
                </Button>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> Answered</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Not Answered (Visited)</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-gray-200 border border-gray-400"></span> Not Visited</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-purple-500"></span> Marked for Review</div>
            <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500 relative after:content-[''] after:absolute after:top-px after:right-px after:w-1.5 after:h-1.5 after:bg-green-400 after:rounded-full"></span> Answered & Marked
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-primary cursor-pointer">
            <UserCircle className="w-5 h-5" />
            <span>Profile</span>
          </div>
           <div className="flex justify-around pt-2">
                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-primary"><GripVertical className="h-5 w-5"/></Button>
                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-primary"><Palette className="h-5 w-5"/></Button>
                <Button variant="ghost" size="icon" className="text-gray-500 hover:text-primary"><Type className="h-5 w-5"/></Button>
           </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8 overflow-y-auto bg-slate-50 dark:bg-gray-800">
          {currentQuestion ? (
            <>
              <div className="mb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Q.{currentQuestionIndex + 1}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600">Subjective question</Badge>
                    <Badge variant="outline" className="text-xs bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600">4 Mark</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={toggleMarkForReview} title="Mark for Review" className="text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary">
                  <Bookmark className={cn("h-5 w-5", markedForReview[currentQuestion.id] && "fill-primary text-primary")} />
                </Button>
              </div>

              <Card className="flex-grow mb-6 bg-white dark:bg-gray-900/70 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg">
                <CardContent className="p-6 space-y-4">
                  <p className="text-md md:text-lg text-gray-700 dark:text-gray-200 leading-relaxed">{currentQuestion.text}</p>
                  
                  <div className="my-4 p-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-center text-gray-400 dark:text-gray-500">
                    <FileTextIcon className="mx-auto h-10 w-10 mb-2" />
                    <p className="text-sm">Question image would appear here if available.</p>
                  </div>

                  <RadioGroup
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={memoizedOnRadioValueChange}
                    className="space-y-3"
                    disabled={isSubmitting}
                  >
                    {currentQuestion.options.map((option) => (
                      <Label
                        key={option.id}
                        htmlFor={option.id}
                        className={cn(
                          "flex items-center space-x-3 p-3.5 border rounded-lg transition-all duration-150 ease-in-out cursor-pointer",
                          "hover:shadow-md hover:border-primary/60 dark:hover:bg-primary/10 dark:border-gray-700",
                          "bg-white dark:bg-gray-800",
                          answers[currentQuestion.id] === option.id ? "bg-primary/10 border-primary ring-2 ring-primary/80 shadow-lg dark:bg-primary/20" : "border-gray-200 dark:border-gray-600",
                          isSubmitting && "cursor-not-allowed opacity-70"
                        )}
                      >
                        <RadioGroupItem 
                          value={option.id} 
                          id={option.id} 
                          className="h-4 w-4 border-gray-400 text-primary focus:ring-primary disabled:opacity-50 shrink-0" 
                          disabled={isSubmitting}
                        />
                        <span className={cn("text-sm md:text-base flex-1 text-gray-700 dark:text-gray-200", isSubmitting ? "cursor-not-allowed" : "cursor-pointer")}>{option.text}</span>
                      </Label>
                    ))}
                  </RadioGroup>
                  <div className="mt-6 p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Answer (Subjective - Placeholder)</Label>
                    <Textarea placeholder="Write your answer here..." className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600" rows={4} />
                    <div className="p-6 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-lg text-center space-y-2 bg-purple-50 dark:bg-purple-900/30">
                        <UploadCloud className="mx-auto h-8 w-8 text-purple-500 dark:text-purple-400"/>
                        <p className="text-sm text-purple-700 dark:text-purple-300">Max file size 10MB</p>
                        <Button variant="link" className="text-sm text-purple-600 dark:text-purple-400 p-0 h-auto">Upload your solution</Button>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Upload Solution (Optional)</p>
                    </div>
                  </div>


                  {internalError && (
                      <Alert variant="destructive" className="mt-4 rounded-md">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle className="text-sm">Error</AlertTitle>
                          <AlertDescription className="text-xs">{internalError}</AlertDescription>
                      </Alert>
                  )}
                </CardContent>
              </Card>
              
              <div className="mt-auto pt-4 flex justify-between items-center sticky bottom-0 bg-slate-50 dark:bg-gray-800 pb-4 px-1 z-10 border-t border-gray-200 dark:border-gray-700">
                 <div className="flex items-center gap-2">
                    <Button variant="outline" className="text-gray-500 hover:text-primary"><Minus className="h-4 w-4"/></Button>
                    <Button variant="outline" className="text-gray-500 hover:text-primary"><HelpCircle className="h-4 w-4"/></Button>
                    <Button variant="outline" className="text-gray-500 hover:text-primary"><MessageSquare className="h-4 w-4"/></Button>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={handlePreviousQuestion}
                    disabled={currentQuestionIndex === 0 || !allowBacktracking || isSubmitting}
                    className="py-2 px-5 text-sm rounded-md shadow-sm border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> Previous
                  </Button>
                  {currentQuestionIndex < questions.length - 1 ? (
                    <Button onClick={handleNextQuestion} disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-5 text-sm rounded-md shadow-sm">
                      Next <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={handleInternalSubmitExam} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white py-2 px-5 text-sm rounded-md shadow-sm">
                      {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ListChecks className="mr-1.5 h-4 w-4" />}
                      Submit Exam
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
             <div className="flex-grow flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
             </div>
          )}
        </main>
      </div>
    </div>
  );
}

