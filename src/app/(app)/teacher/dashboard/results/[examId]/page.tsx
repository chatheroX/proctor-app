'use client';

import { useParams, notFound, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, User, Hash, Percent, CalendarCheck2 } from 'lucide-react';

interface StudentScore {
  studentId: string;
  studentName: string;
  score: number; // percentage
  submissionDate: string;
}

interface ExamDetailedResult {
  examId: string;
  examTitle: string;
  overallAverage: number;
  totalParticipants: number;
  scores: StudentScore[];
}

// Mock data for detailed results
const mockDetailedResults: ExamDetailedResult[] = [
  {
    examId: 'exam001',
    examTitle: 'Calculus Midterm S1',
    overallAverage: 78,
    totalParticipants: 35,
    scores: [
      { studentId: 'S001', studentName: 'Alice Wonderland', score: 88, submissionDate: '2024-07-05 10:30 AM' },
      { studentId: 'S002', studentName: 'Bob The Builder', score: 72, submissionDate: '2024-07-05 10:32 AM' },
      { studentId: 'S003', studentName: 'Charlie Brown', score: 95, submissionDate: '2024-07-05 10:25 AM' },
      // ... more student scores
    ],
  },
   {
    examId: 'exam003',
    examTitle: 'Intro to Programming Quiz',
    overallAverage: 85,
    totalParticipants: 52,
    scores: [
      { studentId: 'S010', studentName: 'Diana Prince', score: 90, submissionDate: '2024-05-22 02:15 PM' },
      { studentId: 'S011', studentName: 'Clark Kent', score: 80, submissionDate: '2024-05-22 02:10 PM' },
    ],
  },
];

export default function ExamSpecificResultsPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.examId as string;
  const [resultData, setResultData] = useState<ExamDetailedResult | null | undefined>(undefined);

  useEffect(() => {
    const foundResult = mockDetailedResults.find(r => r.examId === examId);
    setResultData(foundResult || null);
  }, [examId]);

  if (resultData === undefined) {
    return <div className="flex justify-center items-center h-full"><p>Loading results...</p></div>;
  }

  if (!resultData) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Results
      </Button>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl">Results for: {resultData.examTitle}</CardTitle>
          <CardDescription>
            Detailed performance of students in this exam.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Hash className="h-4 w-4" /> Exam ID</Label>
              <p className="text-lg font-semibold">{resultData.examId}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Users className="h-4 w-4" /> Total Participants</Label>
              <p className="text-lg font-semibold">{resultData.totalParticipants}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Percent className="h-4 w-4" /> Overall Average</Label>
              <p className="text-lg font-semibold text-primary">{resultData.overallAverage}%</p>
            </div>
          </div>
          
          <h3 className="text-xl font-semibold">Individual Student Scores</h3>
          {resultData.scores.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="flex items-center gap-1"><User className="h-4 w-4" /> Student Name</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead className="text-center flex items-center gap-1 justify-center"><Percent className="h-4 w-4" /> Score</TableHead>
                    <TableHead className="flex items-center gap-1"><CalendarCheck2 className="h-4 w-4" /> Submission Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultData.scores.sort((a,b) => b.score - a.score).map((score) => ( // Sort by score desc
                    <TableRow key={score.studentId}>
                      <TableCell className="font-medium">{score.studentName}</TableCell>
                      <TableCell>{score.studentId}</TableCell>
                      <TableCell className="text-center font-semibold">{score.score}%</TableCell>
                      <TableCell>{score.submissionDate}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground">No student submissions found for this exam yet.</p>
          )}
        </CardContent>
        <CardFooter className="border-t pt-6">
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" /> Export Results (CSV) - Coming Soon
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { examId: string } }) {
  const result = mockDetailedResults.find(r => r.examId === params.examId);
  const examTitle = result ? result.examTitle : "Exam Results";
  return {
    title: `Results: ${examTitle} | ProctorPrep`,
  };
}
