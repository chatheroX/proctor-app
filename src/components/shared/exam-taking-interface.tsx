
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag, AlertTriangle } from 'lucide-react';
import { ExamTimerWarning } from '@/components/student/exam-timer-warning';
import { useActivityMonitor, type FlaggedEvent } from '@/hooks/use-activity-monitor';
import { useToast } from '@/hooks/use-toast';
import type { Question, Exam } from '@/types/supabase';

interface ExamTakingInterfaceProps {
  examDetails: Exam | null;
  questions: Question[];
  initialAnswers?: Record<string, string>;
  isLoading: boolean; // True if parent page is still loading exam details.
  error: string | null; // Error from parent page's data fetching for the exam
  examStarted: boolean; // This should always be true if this component is rendered
  // onStartExam: () => void; // This logic is now handled by the new initiate page
  onAnswerChange: (questionId: string, optionId: string) => void;
  onSubmitExam: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => Promise<void>;
  onTimeUp: (answers: Record<string, string>, flaggedEvents: FlaggedEvent[]) => Promise<void>;
  isDemoMode?: boolean;
  userIdForActivityMonitor: string;
}

export function ExamTakingInterface({
  examDetails,
  questions,
  initialAnswers,
  isLoading: parentIsLoading,
  error: examDataError,
  examStarted, // This should be true when this component is rendered
  // onStartExam, // Removed
  onAnswerChange,
  onSubmitExam,
  onTimeUp: parentOnTimeUpProp,
  isDemoMode = false,
  userIdForActivityMonitor,
}: ExamTakingInterfaceProps) {
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [examFinished, setExamFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);

  const parentOnTimeUpRef = useRef(parentOnTimeUpProp);
  useEffect(() => {
    parentOnTimeUpRef.current = parentOnTimeUpProp;
  }, [parentOnTimeUpProp]);

  const allowBacktracking = useMemo(() => examDetails?.allow_backtracking === true, [examDetails?.allow_backtracking]);
  const currentQuestion = useMemo(() => (questions && questions.length > currentQuestionIndex) ? questions[currentQuestionIndex] : null, [questions, currentQuestionIndex]);
  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);

  const activityMonitorEnabled = useMemo(() => examStarted && !examFinished && !isDemoMode, [examStarted, examFinished, isDemoMode]);

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

  const handleInternalAnswerChange = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    onAnswerChange(questionId, optionId);
  }, [onAnswerChange]);

  const handleNextQuestion = useCallback(() => {
    if (questions && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, questions]);

  const handlePreviousQuestion = useCallback(() => {
    if (allowBacktracking && currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1); // Corrected to decrement
    } else if (!allowBacktracking) {
      toast({ description: "Backtracking is not allowed for this exam.", variant: "default" });
    }
  }, [allowBacktracking, currentQuestionIndex, toast]);

  const handleInternalSubmitExam = useCallback(async () => {
    setIsSubmitting(true);
    await onSubmitExam(answers, flaggedEvents);
    setExamFinished(true);
    setIsSubmitting(false);
  }, [onSubmitExam, answers, flaggedEvents]);

  const handleInternalTimeUp = useCallback(async () => {
    if (examFinished) return; 

    if (!isDemoMode) {
        toast({ title: "Time's Up!", description: "Auto-submitting your exam.", variant: "destructive" });
    } else {
        toast({ title: "Demo Time's Up!", description: "The demo exam duration has ended." });
    }
    setIsSubmitting(true); 
    await parentOnTimeUpRef.current(answers, flaggedEvents);
    setExamFinished(true);
    setIsSubmitting(false);
  }, [answers, flaggedEvents, isDemoMode, toast, examFinished]);

  const currentQuestionId = currentQuestion?.id;
  const memoizedOnRadioValueChange = useCallback((optionId: string) => {
    if (currentQuestionId) {
      handleInternalAnswerChange(currentQuestionId, optionId);
    }
  }, [currentQuestionId, handleInternalAnswerChange]);

  useActivityMonitor({
    studentId: userIdForActivityMonitor,
    examId: examIdForMonitor,
    enabled: activityMonitorEnabled,
    onFlagEvent: handleFlagEvent,
  });

  // The "Ready to Start" screen is removed from here.
  // This component now assumes the parent (`initiate/page.tsx`) handles the start logic.

  if (parentIsLoading && !examDetails) { // Still show loader if parent indicates data is loading
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam session...</p>
      </div>
    );
  }

  if (examDataError && !examDetails) { // If parent had an error fetching and no details are available
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Exam Session</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{examDataError}</p>
        {/* Back button might be tricky if this page opens in a new tab for SEB */}
      </div>
    );
  }

  if (!examDetails || !examStarted) { // Should not happen if parent logic is correct
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">Exam session not properly initiated.</p>
      </div>
    );
  }


  if (examFinished) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl text-center">
          <CardHeader>
            <ShieldCheck className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">{isDemoMode ? "Demo " : ""}Exam Submitted Successfully!</CardTitle>
            <CardDescription>
              {isDemoMode
                ? `The demo for "${examDetails?.title || 'this exam'}" has concluded.`
                : `Your responses for "${examDetails?.title || 'this exam'}" have been recorded.`}
                 {!isDemoMode && " (Submission to server is a TODO)"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Number of questions answered: {Object.keys(answers).length} / {(questions && questions.length) || 0}</p>
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
              // Attempt to close the window/tab. This might not work if not opened by script.
              // Then fall back to navigating to a safe page.
              window.close(); 
              // If window.close() didn't work, navigate.
              // For SEB, this might be less relevant as SEB controls exit.
              if (isDemoMode) {
                // Go back to the exam details page
                if(examDetails?.exam_id) window.location.href = `/teacher/dashboard/exams/${examDetails.exam_id}/details`;
                else window.location.href = `/teacher/dashboard/exams`;
              } else {
                 window.location.href = `/student/dashboard/exam-history`;
              }
            }} className="w-full">
              Close / Back to Dashboard Area
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (questions && questions.length === 0 && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-muted-foreground">No questions found for this exam.</p>
        <p className="text-sm text-muted-foreground">Please contact your instructor.</p>
      </div>
    );
  }

   if (!currentQuestion && !parentIsLoading && questions && questions.length > 0) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading question...</p>
      </div>
    );
  }

  const examDurationForTimer = examDetails?.duration ?? 0;
  const examTitleForTimer = examDetails?.title ?? "Exam";

  return (
    <div className="flex flex-col min-h-screen bg-muted">
      {examDetails && examStarted && !examFinished && (
        <ExamTimerWarning
          key={`${examDetails.exam_id}-${examDurationForTimer}`} // Ensure key updates if exam changes
          totalDurationSeconds={examDurationForTimer * 60}
          onTimeUp={handleInternalTimeUp}
          examTitle={examTitleForTimer + (isDemoMode ? " (Demo)" : "")}
        />
      )}
      <main className="flex-grow flex items-center justify-center p-4 pt-20"> {/* pt-20 for timer banner */}
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl md:text-2xl">{examDetails?.title || 'Exam'} {isDemoMode && "(Demo)"}</CardTitle>
              {questions && questions.length > 0 && <span className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</span>}
            </div>
            {currentQuestion && <CardDescription className="pt-2 text-lg">{currentQuestion.text}</CardDescription>}
            {!currentQuestion && !parentIsLoading && questions && questions.length > 0 && (
                <CardDescription className="pt-2 text-lg text-muted-foreground">Loading question text...</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {currentQuestion && currentQuestion.options && (
              <RadioGroup
                value={answers[currentQuestion.id] || ''}
                onValueChange={memoizedOnRadioValueChange}
                className="space-y-3"
              >
                {currentQuestion.options.map((option) => (
                  <div key={option.id} className="flex items-center space-x-3 p-3 border rounded-md hover:bg-accent/50 transition-colors has-[[data-state=checked]]:bg-primary/10 has-[[data-state=checked]]:border-primary">
                    <RadioGroupItem value={option.id} id={`${currentQuestion.id}-option-${option.id}`} />
                    <Label htmlFor={`${currentQuestion.id}-option-${option.id}`} className="text-base flex-1 cursor-pointer">{option.text}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}
             {!currentQuestion && questions && questions.length > 0 && !parentIsLoading && (
                <div className="text-center py-4">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                    <p className="text-muted-foreground mt-2">Loading options...</p>
                </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between border-t pt-6">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0 || !allowBacktracking || !currentQuestion || isSubmitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            {currentQuestionIndex < ( (questions && questions.length) ? questions.length -1 : 0) ? (
              <Button onClick={handleNextQuestion} disabled={!currentQuestion || isSubmitting}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleInternalSubmitExam} disabled={isSubmitting || !currentQuestion} className="bg-green-600 hover:bg-green-700 text-white">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ListChecks className="mr-2 h-4 w-4" />}
                Submit {isDemoMode ? "Demo " : ""}Exam
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

    