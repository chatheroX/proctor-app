
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, MoreHorizontal, Edit, Trash2, Share2, Eye, Copy, BookOpenCheck, Loader2, Users2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Exam } from '@/types/supabase'; // Using the specific Exam type from supabase.ts

export default function ManageExamsPage() {
  const supabase = createSupabaseBrowserClient();
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const { toast } = useToast();

  const fetchExams = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      setExams([]);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ExamX')
        .select('*')
        .eq('teacher_id', user.user_id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      setExams(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to fetch exams: ${error.message}`, variant: "destructive" });
      setExams([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase, toast]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const handleDeleteExam = async () => {
    if (!examToDelete) return;
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('ExamX')
        .delete()
        .eq('exam_id', examToDelete.exam_id);

      if (error) {
        throw error;
      }
      toast({ title: "Exam Deleted", description: `Exam "${examToDelete.title}" has been deleted.` });
      setExams(prevExams => prevExams.filter(exam => exam.exam_id !== examToDelete.exam_id));
      setExamToDelete(null);
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete exam: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const openDeleteDialog = (exam: Exam) => {
    setExamToDelete(exam);
    setShowDeleteDialog(true);
  };

  const copyExamCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast({ description: `Exam code "${code}" copied to clipboard!` });
    }).catch(err => {
      toast({ description: "Failed to copy code.", variant: "destructive" });
    });
  };
  
  const getStatusBadgeVariant = (status: Exam['status']) => {
    switch (status) {
      case 'Published': return 'default'; // Blueish
      case 'Ongoing': return 'destructive'; // Redish
      case 'Completed': return 'outline'; // Greyish
      case 'Draft':
      default:
        return 'secondary'; // Lighter grey
    }
  };
  
  const getStatusBadgeClass = (status: Exam['status']) => {
     switch (status) {
      case 'Published': return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'Ongoing': return 'bg-yellow-500 hover:bg-yellow-600 text-black'; // Ongoing might be yellow
      case 'Completed': return 'bg-green-500 hover:bg-green-600 text-white'; // Completed is green
      default: return ''; // Draft and others use default secondary styling
    }
  }


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading exams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage Exams</h1>
        <Button asChild>
          <Link href="/teacher/dashboard/exams/create">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Exam
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your Exams</CardTitle>
          <CardDescription>View, edit, and manage all your created exams.</CardDescription>
        </CardHeader>
        <CardContent>
          {exams.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Exam Code</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.map((exam) => (
                  <TableRow key={exam.exam_id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>
                       <Badge 
                        variant={getStatusBadgeVariant(exam.status)}
                        className={getStatusBadgeClass(exam.status)}
                      >
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{exam.questions?.length || 0}</TableCell>
                    <TableCell>{exam.duration} min</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => copyExamCode(exam.exam_code)} className="p-1 h-auto">
                        {exam.exam_code} <Copy className="ml-2 h-3 w-3" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/dashboard/exams/${exam.exam_id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/dashboard/exams/${exam.exam_id}/details`}><Eye className="mr-2 h-4 w-4" /> View Details</Link>
                          </DropdownMenuItem>
                           <DropdownMenuItem asChild>
                            <Link href={`/teacher/dashboard/results/${exam.exam_id}`}><Users2 className="mr-2 h-4 w-4" /> View Results</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyExamCode(exam.exam_code)}>
                            <Share2 className="mr-2 h-4 w-4" /> Share Code
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openDeleteDialog(exam)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookOpenCheck className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No exams created yet.</p>
              <p className="text-sm text-muted-foreground">Click "Create New Exam" to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the exam
              "{examToDelete?.title}" and all its associated data (questions, submissions).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExamToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExam} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, delete exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
