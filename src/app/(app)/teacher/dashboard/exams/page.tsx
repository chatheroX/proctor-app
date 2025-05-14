
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, MoreHorizontal, Edit, Trash2, Share2, Eye, Copy, BookOpenCheck, Loader2 } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"
import type { Database } from '@/types/supabase'; // Assuming proctorX is defined in Database types

// Define the Exam type based on proctorX structure or a new exams table structure
// For now, let's assume a structure for an "exams" table if you create one.
// If you are managing exams based on 'proctorX' users (teachers), adjust accordingly.
export interface Exam {
  id: string; // This will be the actual exam ID from your DB
  title: string;
  status: 'Draft' | 'Published' | 'Ongoing' | 'Completed';
  questions_count: number; // Assuming a count of questions
  duration: number; // in minutes
  created_at: string; // ISO date string
  exam_code: string; // Auto-generated or teacher-defined
  // teacher_id?: string; // Foreign key to proctorX user_id if exams are linked to teachers
}


export default function ManageExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchExams = async () => {
      setIsLoading(true);
      // TODO: Replace with actual API call to fetch exams from your database
      // Example:
      // const { data, error } = await supabase.from('exams').select('*').eq('teacher_id', currentUser.user_id);
      // if (error) {
      //   toast({ title: "Error", description: "Failed to fetch exams.", variant: "destructive" });
      //   setExams([]);
      // } else {
      //   setExams(data as Exam[]);
      // }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      setExams([]); // Initialize with empty array
      setIsLoading(false);
    };
    fetchExams();
  }, [toast]);

  const handleDeleteExam = () => {
    if (examToDelete) {
      // TODO: Implement actual API call to delete the exam
      // Example: await supabase.from('exams').delete().eq('id', examToDelete.id);
      setExams(exams.filter(exam => exam.id !== examToDelete.id));
      toast({ title: "Exam Deleted", description: `Exam "${examToDelete.title}" has been deleted.` });
      setExamToDelete(null);
    }
    setShowDeleteDialog(false);
  };

  const openDeleteDialog = (exam: Exam) => {
    setExamToDelete(exam);
    setShowDeleteDialog(true);
  };

  const copyExamCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast({description: `Exam code "${code}" copied to clipboard!`});
    }).catch(err => {
      toast({description: "Failed to copy code.", variant: "destructive"});
    });
  };

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
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.title}</TableCell>
                    <TableCell>
                      <Badge variant={
                        exam.status === 'Published' ? 'default' :
                        exam.status === 'Ongoing' ? 'destructive' :
                        exam.status === 'Completed' ? 'outline' :
                        'secondary' // Draft
                      }
                      className={
                        exam.status === 'Published' ? 'bg-blue-500 text-white' :
                        exam.status === 'Ongoing' ? 'bg-yellow-500 text-white' : ''
                      }
                      >
                        {exam.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{exam.questions_count}</TableCell>
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
                            <Link href={`/teacher/dashboard/exams/${exam.id}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/teacher/dashboard/exams/${exam.id}/details`}><Eye className="mr-2 h-4 w-4" /> View Details</Link>
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
              "{examToDelete?.title}" and all its associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExamToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExam} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Yes, delete exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
