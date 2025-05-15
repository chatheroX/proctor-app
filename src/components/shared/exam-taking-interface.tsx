
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, ListChecks, Flag, AlertTriangle, PlayCircle, ServerCrash } from 'lucide-react';
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
  examStarted: boolean; // If true, shows questions. If false, shows start screen (or error).
  // onStartExam prop is removed; parent page now controls when this component is rendered in started state
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
  isLoading: parentIsLoading, // isLoading from the parent page (e.g. demo/page or take/page)
  error: examLoadingError, // error from the parent page's data fetching
  examStarted, // This prop dictates whether to show questions or the "start" screen.
  onAnswerChange,
  onSubmitExam,
  onTimeUp: parentOnTimeUpProp, // Renamed to avoid conflict
  isDemoMode = false,
  userIdForActivityMonitor,
}: ExamTakingInterfaceProps) {
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [examFinished, setExamFinished] = useState(false); // Indicates if exam was submitted or timed out
  const [isSubmitting, setIsSubmitting] = useState(false); // For submit/timeup process
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);
  
  // This state is for errors that occur within this component, distinct from parent loading errors
  const [internalError, setInternalError] = useState<string | null>(null);

  console.log('[ExamTakingInterface] Props received:', { examDetailsExists: !!examDetails, questionsLength: questions?.length, parentIsLoading, examLoadingError, examStarted, isDemoMode });

  const parentOnTimeUpRef = useRef(parentOnTimeUpProp);
  useEffect(() => {
    parentOnTimeUpRef.current = parentOnTimeUpProp;
  }, [parentOnTimeUpProp]);

  const allowBacktracking = useMemo(() => examDetails?.allow_backtracking === true, [examDetails?.allow_backtracking]);
  const currentQuestion = useMemo(() => (questions && questions.length > currentQuestionIndex) ? questions[currentQuestionIndex] : null, [questions, currentQuestionIndex]);
  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);
  
  // Activity monitor should be enabled only when the exam questions are actively being displayed
  const activityMonitorEnabled = useMemo(() => examStarted && !examFinished && !isDemoMode && !!currentQuestion, [examStarted, examFinished, isDemoMode, currentQuestion]);

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

  useActivityMonitor({
    studentId: userIdForActivityMonitor,
    examId: examIdForMonitor,
    enabled: activityMonitorEnabled,
    onFlagEvent: handleFlagEvent,
  });

  useEffect(() => {
    // This effect handles resetting answers if the underlying questions array changes
    // which could happen if examDetails is re-fetched and has different questions.
    // Or if initialAnswers prop changes after initial mount.
    if (initialAnswers) {
        setAnswers(initialAnswers);
    } else {
        setAnswers({}); // Reset if initialAnswers becomes null/undefined
    }
  }, [initialAnswers, questions]); // Also depend on questions to reset if questions change

  const handleInternalAnswerChange = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    onAnswerChange(questionId, optionId); // Propagate to parent for local storage or other side effects
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

  const handleInternalSubmitExam = useCallback(async () => {
    if (examFinished) return;
    setIsSubmitting(true);
    setInternalError(null);
    try {
        await onSubmitExam(answers, flaggedEvents);
        setExamFinished(true);
    } catch (e: any) {
        setInternalError(e.message || "Failed to submit exam.");
        toast({ title: "Submission Error", description: e.message || "Could not submit exam.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  }, [onSubmitExam, answers, flaggedEvents, examFinished, toast]);

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
        await parentOnTimeUpRef.current(answers, flaggedEvents);
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

  // ------- UI Rendering Logic Starts Here --------

  if (parentIsLoading && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam interface...</p>
      </div>
    );
  }

  if (examLoadingError && !examDetails) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <ServerCrash className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Exam Data</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{examLoadingError}</p>
        {isDemoMode && <Button onClick={() => window.location.reload()} variant="outline">Retry Demo</Button>}
      </div>
    );
  }
  
  // This condition handles cases where examDetails might be null even if parentIsLoading is false
  // or if examStarted is false (though it should usually be true if this component is rendered for actual exam taking)
  if (!examDetails || !examStarted) {
    console.error("[ExamTakingInterface] Critical error: examDetails is null or examStarted is false. This indicates a problem in the parent page's logic.", { examDetailsExists: !!examDetails, examStarted });
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive">Exam session not properly initiated.</p>
        <p className="text-sm text-muted-foreground">Required exam details are missing or the session was not started correctly.</p>
         {isDemoMode && <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Retry Demo</Button>}
      </div>
    );
  }

  if (examFinished) {
    // Exam submitted or timed out screen
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-md shadow-xl text-center">
          <CardHeader>
            <ShieldCheck className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <CardTitle className="text-2xl">{isDemoMode ? "Demo " : ""}Exam {internalError ? "Attempted Submission" : "Finished"}!</CardTitle>
            <CardDescription>
              {internalError 
                ? `There was an issue: ${internalError}`
                : isDemoMode
                  ? `The demo for "${examDetails.title}" has concluded.`
                  : `Your responses for "${examDetails.title}" have been recorded.`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Number of questions answered: {Object.keys(answers).length} / {questions.length || 0}</p>
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
              if (isDemoMode && examDetails.exam_id) {
                window.location.href = `/teacher/dashboard/exams/${examDetails.exam_id}/details`;
              } else if (!isDemoMode) {
                 window.location.href = `/student/dashboard/exam-history`;
              } else {
                window.close(); // Fallback for other cases or if redirection not applicable
              }
            }} className="w-full">
              {isDemoMode ? "Back to Exam Details" : "View Exam History"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // This case should ideally be caught by the parent, but added for robustness
  if (questions.length === 0 && !parentIsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-muted-foreground">No questions found for this exam.</p>
        <p className="text-sm text-muted-foreground">Please contact your instructor.</p>
      </div>
    );
  }

  // If currentQuestion is somehow null but questions array is not empty (e.g., index issue)
   if (!currentQuestion && questions.length > 0 && !parentIsLoading) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading question...</p>
      </div>
    );
  }
  
  // Exam is active and questions are available
  const examDurationForTimer = examDetails.duration ?? 0;
  const examTitleForTimer = examDetails.title ?? "Exam";

  return (
    <div className="flex flex-col min-h-screen bg-muted">
      {examDetails && examStarted && !examFinished && (
        <ExamTimerWarning
          key={`${examDetails.exam_id}-${examDurationForTimer}`}
          totalDurationSeconds={examDurationForTimer * 60}
          onTimeUp={handleInternalTimeUp}
          examTitle={examTitleForTimer + (isDemoMode ? " (Demo)" : "")}
        />
      )}
      <main className="flex-grow flex items-center justify-center p-4 pt-20"> {/* pt-20 for timer banner */}
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl md:text-2xl">{examDetails.title} {isDemoMode && "(Demo)"}</CardTitle>
              {questions.length > 0 && <span className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</span>}
            </div>
            {currentQuestion && <CardDescription className="pt-2 text-lg">{currentQuestion.text}</CardDescription>}
            {!currentQuestion && questions.length > 0 && (
                <CardDescription className="pt-2 text-lg text-muted-foreground">Loading question text...</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {currentQuestion?.options ? (
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
            ) : (
                 <div className="text-center py-4">
                    <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
                    <p className="text-muted-foreground mt-2">Loading options...</p>
                </div>
            )}
            {internalError && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{internalError}</AlertDescription>
                </Alert>
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
            {currentQuestionIndex < questions.length -1 ? (
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
