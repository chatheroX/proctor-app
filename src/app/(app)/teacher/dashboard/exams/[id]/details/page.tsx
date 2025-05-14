'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Share2, Trash2, Clock, CheckSquare, ListChecks, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
}
interface Exam {
  id: string;
  title: string;
  description: string;
  status: 'Draft' | 'Published' | 'Ongoing' | 'Completed';
  questions: Question[];
  duration: number; // in minutes
  createdAt: string;
  examCode: string;
  allowBacktracking: boolean;
}

// Mock data (can be expanded or fetched from a shared source with edit/list pages)
const mockFullExams: Exam[] = [
  { 
    id: 'exam001', 
    title: 'Calculus Midterm S1', 
    description: 'Covers chapters 1-5 of the Calculus textbook. Focus on differentiation and basic integration. Ensure SEB is used.',
    status: 'Published', 
    questions: [
      {id: 'q1', text: 'What is the derivative of x^2 with respect to x?', options: ['2x', 'x', 'x/2', '2'], correctAnswer: '2x'},
      {id: 'q2', text: 'What is the integral of 1/x dx?', options: ['ln|x| + C', 'x^2 + C', '-1/x^2 + C', '1 + C'], correctAnswer: 'ln|x| + C'},
      {id: 'q3', text: 'Solve lim (x->0) sin(x)/x.', options: ['1', '0', 'undefined', 'infinity'], correctAnswer: '1'},
    ], 
    duration: 90, 
    createdAt: '2024-07-01', 
    examCode: 'CALC1MID',
    allowBacktracking: true,
  },
  // ... other mock exams
];


export default function ExamDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const examId = params.id as string;
  const [exam, setExam] = useState<Exam | null | undefined>(undefined);

  useEffect(() => {
    const foundExam = mockFullExams.find(e => e.id === examId);
    setExam(foundExam || null);
  }, [examId]);

  if (exam === undefined) {
    return <div className="flex justify-center items-center h-full"><p>Loading exam details...</p></div>;
  }

  if (!exam) {
    notFound();
  }
  
  const copyExamCode = () => {
    navigator.clipboard.writeText(exam.examCode).then(() => {
      toast({description: `Exam code "${exam.examCode}" copied to clipboard!`});
    }).catch(err => {
      toast({description: "Failed to copy code.", variant: "destructive"});
    });
  };

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Exams List
      </Button>

      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-3xl">{exam.title}</CardTitle>
              <CardDescription className="mt-1">{exam.description}</CardDescription>
            </div>
            <Badge variant={
                exam.status === 'Published' ? 'default' :
                exam.status === 'Ongoing' ? 'destructive' :
                exam.status === 'Completed' ? 'outline' :
                'secondary'
              }
              className={
                `text-sm px-3 py-1 ${
                exam.status === 'Published' ? 'bg-blue-500 text-white' :
                exam.status === 'Ongoing' ? 'bg-yellow-500 text-white' : ''}`
              }
            >
              {exam.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Exam Code</Label>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-primary">{exam.examCode}</p>
                <Button variant="ghost" size="icon" onClick={copyExamCode} className="h-7 w-7">
                    <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Clock className="h-4 w-4"/> Duration</Label>
              <p className="text-lg font-semibold">{exam.duration} minutes</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><CheckSquare className="h-4 w-4"/> Backtracking</Label>
              <p className="text-lg font-semibold">{exam.allowBacktracking ? 'Allowed' : 'Not Allowed'}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary"/> Questions ({exam.questions.length})</h3>
            {exam.questions.length > 0 ? (
              <ul className="space-y-4">
                {exam.questions.map((q, index) => (
                  <li key={q.id} className="p-4 border rounded-md bg-background shadow-sm">
                    <p className="font-medium text-md mb-1">Q{index + 1}: {q.text}</p>
                    <ul className="list-disc list-inside text-sm space-y-1 pl-4">
                      {q.options.map((opt, i) => (
                        <li key={i} className={opt === q.correctAnswer ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                          {opt} {opt === q.correctAnswer && "(Correct)"}
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
        <CardFooter className="flex justify-end gap-2 border-t pt-6">
          <Button variant="outline" onClick={() => router.push(`/teacher/dashboard/exams/${exam.id}/edit`)}>
            <Edit className="mr-2 h-4 w-4" /> Edit Exam
          </Button>
           <Button variant="outline" onClick={copyExamCode}>
            <Share2 className="mr-2 h-4 w-4" /> Share Exam Code
          </Button>
          <Button variant="destructive" disabled> {/* Add delete confirmation later */}
            <Trash2 className="mr-2 h-4 w-4" /> Delete Exam
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


export async function generateMetadata({ params }: { params: { id: string } }) {
  const exam = mockFullExams.find(e => e.id === params.id);
  const examTitle = exam ? exam.title : "Exam Details";
  return {
    title: `${examTitle} | ProctorPrep`,
  };
}
