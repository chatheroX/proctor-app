
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Eye, Loader2, AlertTriangle, UserCheck, HelpCircle, CheckSquare, Square, ShieldAlert, RefreshCw } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Exam, ExamSubmission, Question, FlaggedEvent } from '@/types/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getEffectiveExamStatus } from '../details/page';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface MonitoredStudent extends ExamSubmission {
  studentName?: string; // Denormalized from proctorX if joined
  parsedAnswers?: Record<string, string>; // Parsed from answers JSONB
  parsedFlaggedEvents?: FlaggedEvent[]; // Parsed from flagged_events JSONB
}

export default function MonitorExamPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const { toast } = useToast();
  const { user: teacherUser } = useAuth();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [submissions, setSubmissions] = useState<MonitoredStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const fetchExamAndSubmissions = useCallback(async (isManualRefresh = false) => {
    if (!examId || !teacherUser?.user_id) {
      setError("Exam ID or teacher authentication missing.");
      setIsLoading(false);
      return;
    }
    if(!isManualRefresh) setIsLoading(true); // Only show main loader on initial load or non-manual refresh
    setError(null);

    try {
      // Fetch exam details
      const { data: examData, error: examError } = await supabase
        .from('ExamX')
        .select('*')
        .eq('exam_id', examId)
        .eq('teacher_id', teacherUser.user_id) // Ensure teacher owns the exam
        .single();

      if (examError) throw examError;
      if (!examData) throw new Error("Exam not found or access denied.");
      setExam(examData);

      const effectiveStatus = getEffectiveExamStatus(examData);
      if (effectiveStatus !== 'Ongoing') {
        toast({ title: "Exam Not Ongoing", description: `This exam is currently ${effectiveStatus}. Monitoring is only for ongoing exams.`, variant: "default" });
        // Optionally redirect or show a message
      }

      // Fetch submissions for this exam, joining with proctorX to get student names
      // TODO: This is a placeholder. Real implementation needs to fetch from ExamSubmissionsX
      // and join with proctorX for student details.
      // For now, we'll simulate empty submissions.
      /*
      const { data: submissionData, error: submissionError } = await supabase
        .from('ExamSubmissionsX')
        .select(`
          *,
          proctorX (name)
        `)
        .eq('exam_id', examId);

      if (submissionError) throw submissionError;

      const monitoredStudents: MonitoredStudent[] = submissionData.map(sub => ({
        ...sub,
        studentName: sub.proctorX?.name || 'Unknown Student',
        parsedAnswers: typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers || {},
        parsedFlaggedEvents: typeof sub.flagged_events === 'string' ? JSON.parse(sub.flagged_events) : sub.flagged_events || [],
      }));
      setSubmissions(monitoredStudents);
      */
      setSubmissions([]); // Placeholder
      if (isManualRefresh) {
        toast({ description: "Data refreshed.", duration: 2000 });
      }

    } catch (e: any) {
      console.error("Error fetching exam monitoring data:", e);
      setError(e.message || "Failed to load monitoring data.");
      setSubmissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [examId, teacherUser?.user_id, supabase, toast]);

  useEffect(() => {
    fetchExamAndSubmissions();
    // Set up auto-refresh
    const intervalId = setInterval(() => {
        console.log("Auto-refreshing monitor data...");
        fetchExamAndSubmissions(true); // Pass true for silent refresh
    }, 30000); // Refresh every 30 seconds
    setAutoRefreshInterval(intervalId);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, teacherUser?.user_id]); // Initial fetch and interval setup

  const getQuestionText = (questionId: string): string => {
    return exam?.questions?.find(q => q.id === questionId)?.text || "Unknown Question";
  };

  const getSelectedOptionText = (questionId: string, optionId: string): string => {
    const question = exam?.questions?.find(q => q.id === questionId);
    return question?.options.find(opt => opt.id === optionId)?.text || "Unknown Option";
  };

  if (isLoading && submissions.length === 0) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading exam monitoring dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 text-center py-10">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold">Error Loading Monitoring Data</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => router.push(`/teacher/dashboard/exams/${examId}/details`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exam Details
        </Button>
      </div>
    );
  }

  if (!exam) {
     return (
      <div className="space-y-6 text-center py-10">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold">Exam Information Not Found</h1>
         <Button variant="outline" onClick={() => router.push(`/teacher/dashboard/exams`)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
        </Button>
      </div>
    );
  }

  const effectiveStatus = getEffectiveExamStatus(exam);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <Button variant="outline" onClick={() => router.push(`/teacher/dashboard/exams/${examId}/details`)} className="mb-4 mr-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exam Details
            </Button>
            <h1 className="text-3xl font-bold inline-block">Monitor Exam: {exam.title}</h1>
        </div>
        <Button onClick={() => fetchExamAndSubmissions(true)} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
        </Button>
      </div>
       <Card>
        <CardHeader>
          <CardTitle>Exam Status & Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-4">
          <div><Label>Exam Code:</Label> <Badge variant="secondary">{exam.exam_code}</Badge></div>
          <div><Label>Current Status:</Label> <Badge className={effectiveStatus === 'Ongoing' ? 'bg-yellow-500 text-black' : 'bg-gray-500'}>{effectiveStatus}</Badge></div>
          <div><Label>Participants:</Label> <span className="font-semibold">{submissions.length}</span> (Feature in progress)</div>
          <div><Label>Duration:</Label> <span className="font-semibold">{exam.duration} minutes</span></div>
          <div><Label>Start Time:</Label> <span className="font-semibold">{exam.start_time ? new Date(exam.start_time).toLocaleString() : 'N/A'}</span></div>
          <div><Label>End Time:</Label> <span className="font-semibold">{exam.end_time ? new Date(exam.end_time).toLocaleString() : 'N/A'}</span></div>
        </CardContent>
      </Card>

      {effectiveStatus !== 'Ongoing' && (
        <Alert variant="default" className="bg-blue-50 border-blue-300">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-700">Exam Not Actively Ongoing</AlertTitle>
            <AlertDescription className="text-blue-600">
                This exam is currently <strong>{effectiveStatus}</strong>. Live monitoring features are most relevant for 'Ongoing' exams. You might be viewing stale or historical data if the exam is not active.
            </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Student Activity (Placeholder)</CardTitle>
          <CardDescription>
            Live feed of student submissions and flagged events will appear here. This feature is under development.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="mx-auto h-12 w-12 mb-3" />
              No student submissions or activity detected yet.
            </div>
          )}
          {/* TODO: Implement detailed student activity display */}
          {/* This would involve mapping over `submissions` and rendering details for each student */}
          {submissions.map(sub => (
            <Card key={sub.submission_id} className="mb-4">
                <CardHeader>
                    <CardTitle className="text-lg">Student: {sub.studentName || sub.student_user_id}</CardTitle>
                    <CardDescription>Status: {sub.status} | Score: {sub.score ?? 'N/A'}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-2">
                        <h4 className="font-semibold">Answers:</h4>
                        {sub.parsedAnswers && Object.keys(sub.parsedAnswers).length > 0 ? (
                            <ul className="list-disc pl-5">
                                {Object.entries(sub.parsedAnswers).map(([qId, oId]) => (
                                    <li key={qId}>{getQuestionText(qId)}: {getSelectedOptionText(qId, oId)}</li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground">No answers recorded.</p>}
                    </div>
                     <div>
                        <h4 className="font-semibold">Flagged Events:</h4>
                        {sub.parsedFlaggedEvents && sub.parsedFlaggedEvents.length > 0 ? (
                            <ul className="list-disc pl-5">
                                {sub.parsedFlaggedEvents.map((event, idx) => (
                                   <li key={idx} className="text-destructive">
                                      <ShieldAlert className="inline h-4 w-4 mr-1"/> {event.type} at {new Date(event.timestamp).toLocaleTimeString()}
                                      {event.details && ` (${event.details})`}
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-sm text-muted-foreground">No flagged events.</p>}
                    </div>
                </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

    