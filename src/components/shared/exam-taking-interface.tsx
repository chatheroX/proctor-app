
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
  isLoading: boolean;
  error: string | null;
  examStarted: boolean;
  onStartExam: () => void;
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
  isLoading,
  error,
  examStarted,
  onStartExam,
  onAnswerChange,
  onSubmitExam,
  onTimeUp: parentOnTimeUpProp, // Renamed to avoid confusion with internal onTimeUp
  isDemoMode = false,
  userIdForActivityMonitor,
}: ExamTakingInterfaceProps) {
  // HOOKS MUST BE CALLED AT THE TOP LEVEL AND IN THE SAME ORDER
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {});
  const [examFinished, setExamFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flaggedEvents, setFlaggedEvents] = useState<FlaggedEvent[]>([]);

  // Store the latest version of parentOnTimeUpProp in a ref to avoid making it a dependency of handleInternalTimeUp's useCallback
  const parentOnTimeUpRef = useRef(parentOnTimeUpProp);
  useEffect(() => {
    parentOnTimeUpRef.current = parentOnTimeUpProp;
  }, [parentOnTimeUpProp]);

  // MEMOIZED VALUES (derived from props or state)
  const allowBacktracking = useMemo(() => examDetails?.allow_backtracking === true, [examDetails?.allow_backtracking]);
  const currentQuestion = useMemo(() => questions?.[currentQuestionIndex], [questions, currentQuestionIndex]);
  const examIdForMonitor = useMemo(() => examDetails?.exam_id || 'unknown_exam', [examDetails?.exam_id]);
  const activityMonitorEnabled = useMemo(() => examStarted && !examFinished, [examStarted, examFinished]);
  
  const cantStartReason = useMemo(() => {
    if (examDetails?.status !== 'Published' && examDetails?.status !== 'Ongoing' && !isDemoMode && examDetails !== null) {
      return `Exam is ${examDetails.status?.toLowerCase()}.`;
    }
    if (examDetails && !questions?.length && !isLoading) { // Check after isLoading is false
      return "This exam has no questions.";
    }
    return null;
  }, [examDetails, questions, isLoading, isDemoMode]);

  // CALLBACKS
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
  }, [isDemoMode, toast]); // setFlaggedEvents is stable

  const handleInternalAnswerChange = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    onAnswerChange(questionId, optionId);
  }, [onAnswerChange]); // setAnswers is stable

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < (questions?.length || 0) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  }, [currentQuestionIndex, questions]); // setCurrentQuestionIndex is stable

  const handlePreviousQuestion = useCallback(() => {
    if (allowBacktracking && currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    } else if (!allowBacktracking) {
      toast({ description: "Backtracking is not allowed for this exam.", variant: "default" });
    }
  }, [allowBacktracking, currentQuestionIndex, toast]); // setCurrentQuestionIndex is stable

  const handleInternalSubmitExam = useCallback(async () => {
    setIsSubmitting(true);
    await onSubmitExam(answers, flaggedEvents);
    setExamFinished(true);
  }, [onSubmitExam, answers, flaggedEvents]); // setIsSubmitting, setExamFinished are stable

  const handleInternalTimeUp = useCallback(async () => {
    if (!isDemoMode) {
        toast({ title: "Time's Up!", description: "Auto-submitting your exam.", variant: "destructive" });
    } else {
        toast({ title: "Demo Time's Up!", description: "The demo exam duration has ended." });
    }
    await parentOnTimeUpRef.current(answers, flaggedEvents); // Use the ref here
    setExamFinished(true);
  }, [answers, flaggedEvents, isDemoMode, toast]); // parentOnTimeUpRef is stable, setExamFinished stable

  const currentQuestionId = currentQuestion?.id;
  const memoizedOnRadioValueChange = useCallback((optionId: string) => {
    if (currentQuestionId) {
      handleInternalAnswerChange(currentQuestionId, optionId);
    }
  }, [currentQuestionId, handleInternalAnswerChange]);

  // CUSTOM HOOKS (must be called after all built-in hooks if they also use hooks)
  useActivityMonitor({ // This hook must call its internal hooks unconditionally
    studentId: userIdForActivityMonitor,
    examId: examIdForMonitor,
    enabled: activityMonitorEnabled,
    onFlagEvent: handleFlagEvent,
  });
  
  // Conditional rendering logic (early returns) starts below.
  // All hook calls must be above this line.

  if (isLoading && !examStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading exam...</p>
      </div>
    );
  }

  if (error && !examDetails && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-destructive text-center mb-2">Error Loading Exam</p>
        <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
        <Button onClick={() => window.history.back()} className="mt-4">
            Back
        </Button>
      </div>
    );
  }
  
  if (!examStarted) {
    const examNotReadyError = error && examDetails; // If there's an error and we have exam details, it means error during load
    const isUnpublishedDemo = isDemoMode && examDetails?.status !== 'Published' && examDetails?.status !== 'Ongoing';
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <Card className="w-full max-w-lg shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Ready to Start: {examDetails?.title || 'Exam'}</CardTitle>
            <CardDescription>
              Exam ID: {examDetails?.exam_id || 'N/A'} <br />
              Duration: {examDetails?.duration ? `${examDetails.duration} minutes` : 'N/A'} <br />
              {isDemoMode && <span className="text-primary font-semibold block mt-1">(DEMO MODE {isUnpublishedDemo ? `- ${examDetails?.status}` : ''})</span>}
              {examNotReadyError && <span className="text-destructive font-medium block mt-1">{error}</span>}
              {cantStartReason && <span className="text-destructive font-medium block mt-1">{cantStartReason}</span>}
              {!examNotReadyError && !cantStartReason && `Ensure you are in a quiet environment. ${!isDemoMode ? "Your Safe Exam Browser should be configured if required." : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="default" className="bg-primary/10 border-primary/30">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <AlertTitle className="text-primary font-semibold">Secure Environment {isDemoMode && "(Simulated)"}</AlertTitle>
              <AlertDescription className="text-primary/80">
                This exam {!isDemoMode ? "may be monitored" : "environment is simulated"}. Activity such as switching tabs or exiting fullscreen may be {!isDemoMode ? "flagged" : "noted for demo purposes"}.
                Please remain focused on the exam.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button
              onClick={onStartExam}
              className="w-full"
              size="lg"
              disabled={isLoading || !examDetails || !!examNotReadyError || !!cantStartReason } >
              {isLoading ? <Loader2 className="animate-spin mr-2" /> : null}
              Start {isDemoMode ? "Demo " : ""}Exam
            </Button>
          </CardFooter>
        </Card>
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
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Number of questions answered: {Object.keys(answers).length} / {questions?.length || 0}</p>
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
            <Button onClick={() => window.history.back()} className="w-full">
              Back
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (questions && questions.length === 0 && examStarted && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-muted-foreground">No questions found for this exam.</p>
        <p className="text-sm text-muted-foreground">Please contact your instructor.</p>
         <Button onClick={() => window.history.back()} className="mt-4">
            Back
        </Button>
      </div>
    );
  }

   if (!currentQuestion && examStarted && !isLoading && questions && questions.length > 0) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-muted">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-muted-foreground">Loading question...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-muted">
      {examDetails && examStarted && !examFinished && (
        <ExamTimerWarning
          key={examDetails?.exam_id || 'timer-' + Date.now()} // Added key to ensure re-mount if examId changes
          totalDurationSeconds={(examDetails.duration || 0) * 60}
          onTimeUp={handleInternalTimeUp}
          examTitle={examDetails.title + (isDemoMode ? " (Demo)" : "")}
        />
      )}
      <main className="flex-grow flex items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl md:text-2xl">{examDetails?.title || 'Exam'} {isDemoMode && "(Demo)"}</CardTitle>
              {questions && questions.length > 0 && <span className="text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</span>}
            </div>
            {currentQuestion && <CardDescription className="pt-2 text-lg">{currentQuestion.text}</CardDescription>}
            {!currentQuestion && examStarted && !isLoading && questions && questions.length > 0 && (
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
             {!currentQuestion && questions && questions.length > 0 && examStarted && !isLoading && (
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
              disabled={currentQuestionIndex === 0 || !allowBacktracking || !currentQuestion}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            {currentQuestionIndex < (questions?.length || 0) - 1 ? (
              <Button onClick={handleNextQuestion} disabled={!currentQuestion}>
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

  