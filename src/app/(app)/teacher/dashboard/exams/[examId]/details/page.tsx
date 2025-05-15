
'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Share2, Trash2, Clock, CheckSquare, ListChecks, Copy, Loader2, AlertTriangle, Users2, PlaySquare, CalendarClock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Exam, Question, ExamStatus } from '@/types/supabase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';
import { format, parseISO, isBefore, isAfter, isValid } from 'date-fns';

// Helper function to determine effective status
export const getEffectiveExamStatus = (exam: Exam): ExamStatus => {
  if (!exam || !exam.status) return 'Draft'; // Default if exam or status is undefined

  const now = new Date();
  const startTime = exam.start_time ? parseISO(exam.start_time) : null;
  const endTime = exam.end_time ? parseISO(exam.end_time) : null;

  if (exam.status === 'Draft') return 'Draft';
  if (exam.status === 'Completed') return 'Completed';

  if (exam.status === 'Published') {
    if (startTime && endTime && isValid(startTime) && isValid(endTime)) {
      if (isAfter(now, endTime)) return 'Completed';
      if (isAfter(now, startTime) && isBefore(now, endTime)) return 'Ongoing';
      if (isBefore(now, startTime)) return 'Published'; // Upcoming
    }
    return 'Published'; // If times are not set or invalid, but it's published.
  }
  
  if (exam.status === 'Ongoing') {
     if (endTime && isValid(endTime) && isAfter(now, endTime)) return 'Completed';
     return 'Ongoing';
  }

  return exam.status; // Fallback
};


export default function ExamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();
  const examId = params.examId as string;

  const [exam, setExam] = useState<Exam | null>(null);
  const [effectiveStatus, setEffectiveStatus] = useState<ExamStatus>('Draft');
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchExamDetails = useCallback(async () => {
    if (!examId) {
      setIsLoading(false);
      notFound();
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ExamX')
        .select('*')
        .eq('exam_id', examId)
        .single();

      if (error) throw error;
      setExam(data);
      if (data) {
        setEffectiveStatus(getEffectiveExamStatus(data));
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to fetch exam details: ${error.message}`, variant: "destructive" });
      setExam(null);
    } finally {
      setIsLoading(false);
    }
  }, [examId, supabase, toast]);

  useEffect(() => {
    fetchExamDetails();
  }, [fetchExamDetails]);

  const copyExamCode = () => {
    if (exam?.exam_code) {
      navigator.clipboard.writeText(exam.exam_code).then(() => {
        toast({ description: `Exam code "${exam.exam_code}" copied to clipboard!` });
      }).catch(err => {
        toast({ description: "Failed to copy code.", variant: "destructive" });
      });
    }
  };

  const handleDeleteExam = async () => {
    if (!exam) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('ExamX')
        .delete()
        .eq('exam_id', exam.exam_id);
      if (error) throw error;
      toast({ title: "Exam Deleted", description: `Exam "${exam.title}" has been deleted successfully.` });
      router.push('/teacher/dashboard/exams');
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete exam: ${error.message}`, variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };
  
  const getStatusBadgeVariant = (status: ExamStatus) => {
    switch (status) {
      case 'Published': return 'default'; // Blue
      case 'Ongoing': return 'destructive'; // Yellow/Orange - using destructive for now
      case 'Completed': return 'outline'; // Green
      case 'Draft':
      default:
        return 'secondary'; // Grey
    }
  };

  const getStatusBadgeClass = (status: ExamStatus) => {
     switch (status) {
      case 'Published': return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'Ongoing': return 'bg-yellow-500 hover:bg-yellow-600 text-black';
      case 'Completed': return 'bg-green-500 hover:bg-green-600 text-white';
      default: return '';
    }
  }

  const formatDateTime = (isoString: string | null | undefined) => {
    if (!isoString) return 'Not set';
    try {
      const date = parseISO(isoString);
      if (!isValid(date)) return 'Invalid Date';
      return format(date, "MMM d, yyyy, hh:mm a"); // e.g., Jun 1, 2024, 02:00 PM
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading exam details...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="space-y-6 text-center py-10">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h1 className="text-2xl font-semibold">Exam Not Found</h1>
        <p className="text-muted-foreground">The exam details could not be loaded. It might have been deleted or the ID is incorrect.</p>
        <Button variant="outline" onClick={() => router.push('/teacher/dashboard/exams')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
        </Button>
      </div>
    );
  }

  const questionsList = exam.questions || [];
  const isJoinable = effectiveStatus === 'Ongoing' || (effectiveStatus === 'Published' && exam.start_time && exam.end_time && isAfter(new Date(), parseISO(exam.start_time)) && isBefore(new Date(), parseISO(exam.end_time)));

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.push('/teacher/dashboard/exams')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
      </Button>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl">{exam.title}</CardTitle>
              <CardDescription className="mt-1">{exam.description || "No description provided."}</CardDescription>
            </div>
            <Badge
              variant={getStatusBadgeVariant(effectiveStatus)}
              className={`text-sm px-3 py-1 ${getStatusBadgeClass(effectiveStatus)}`}
            >
              {effectiveStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Exam Code</Label>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-primary">{exam.exam_code}</p>
                <Button variant="ghost" size="icon" onClick={copyExamCode} className="h-7 w-7">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4" /> Duration</Label>
              <p className="text-lg font-semibold">{exam.duration} minutes</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CheckSquare className="h-4 w-4" /> Backtracking</Label>
              <p className="text-lg font-semibold">{exam.allow_backtracking ? 'Allowed' : 'Not Allowed'}</p>
            </div>
             <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Start Time</Label>
              <p className="text-lg font-semibold">{formatDateTime(exam.start_time)}</p>
            </div>
             <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CalendarClock className="h-4 w-4" /> End Time</Label>
              <p className="text-lg font-semibold">{formatDateTime(exam.end_time)}</p>
            </div>
             <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><AlertCircle className="h-4 w-4" /> Database Status</Label>
                <p className="text-lg font-semibold">{exam.status}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Questions ({questionsList.length})</h3>
            {questionsList.length > 0 ? (
              <ul className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {questionsList.map((q: Question, index: number) => (
                  <li key={q.id || index} className="p-4 border rounded-md bg-background shadow-sm">
                    <p className="font-medium text-md mb-1">Q{index + 1}: {q.text}</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pl-4">
                      {q.options.map((opt, i) => (
                        <li key={opt.id || i} className={opt.id === q.correctOptionId ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                          {opt.text} {opt.id === q.correctOptionId && "(Correct)"}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No questions have been added to this exam yet.</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2 border-t pt-6 flex-wrap">
          <Button variant="outline" onClick={() => router.push(`/teacher/dashboard/exams/${exam.exam_id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" /> Edit Exam
          </Button>
           <Button variant="outline" asChild>
            <Link href={`/teacher/dashboard/exams/${exam.exam_id}/demo`}>
              <PlaySquare className="mr-2 h-4 w-4" /> Take Demo Test
            </Link>
          </Button>
          <Button variant="outline" disabled>
            <Users2 className="mr-2 h-4 w-4" /> View Results (Soon)
          </Button>
          <Button variant="outline" onClick={copyExamCode} disabled={!isJoinable && exam.status !== 'Published'}>
            <Share2 className="mr-2 h-4 w-4" /> Share Exam Code
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isDeleting}>
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Trash2 className="mr-2 h-4 w-4" /> Delete Exam
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the exam
              "{exam?.title}" and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExam} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, delete exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
