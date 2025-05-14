
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, MoreHorizontal, Edit, Trash2, Share2, Eye, Copy, BookOpenCheck } from 'lucide-react';
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

interface Exam {
  id: string;
  title: string;
  status: 'Draft' | 'Published' | 'Ongoing' | 'Completed';
  questions: number;
  duration: number; // in minutes
  createdAt: string;
  examCode: string;
}

const initialExams: Exam[] = [
  { id: 'exam001', title: 'Calculus Midterm S1', status: 'Published', questions: 25, duration: 90, createdAt: '2024-07-01', examCode: 'CALC1MID' },
  { id: 'exam002', title: 'History 101 Final', status: 'Ongoing', questions: 50, duration: 120, createdAt: '2024-06-15', examCode: 'HIST1FNL' },
  { id: 'exam003', title: 'Intro to Programming Quiz', status: 'Completed', questions: 10, duration: 30, createdAt: '2024-05-20', examCode: 'CODEQUIZ1' },
  { id: 'exam004', title: 'Advanced Physics Concepts', status: 'Draft', questions: 0, duration: 60, createdAt: '2024-07-10', examCode: 'PHYADV004' },
];

export default function ManageExamsPage() {
  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const { toast } = useToast();

  const handleDeleteExam = () => {
    if (examToDelete) {
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
                        exam.status === 'Ongoing' ? 'destructive' : // Using destructive for ongoing for visibility
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
                    <TableCell>{exam.questions}</TableCell>
                    <TableCell>{exam.duration} min</TableCell>
                    <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => copyExamCode(exam.examCode)} className="p-1 h-auto">
                            {exam.examCode} <Copy className="ml-2 h-3 w-3" />
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
                          <DropdownMenuItem onClick={() => copyExamCode(exam.examCode)}>
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

// Removed metadata export as this is a Client Component
// export const metadata = {
//   title: 'Manage Exams | Teacher Dashboard | ProctorPrep',
// };
