'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Eye, Users, Percent } from 'lucide-react';

interface ExamResultSummary {
  id: string;
  title: string;
  dateCompleted: string;
  participants: number;
  averageScore: number | null; // in percentage
}

// Mock data for exam result summaries
const examResults: ExamResultSummary[] = [
  { id: 'exam001', title: 'Calculus Midterm S1', dateCompleted: '2024-07-05', participants: 35, averageScore: 78 },
  { id: 'exam003', title: 'Intro to Programming Quiz', dateCompleted: '2024-05-22', participants: 52, averageScore: 85 },
  // { id: 'exam002', title: 'History 101 Final', dateCompleted: 'N/A (Ongoing)', participants: 40, averageScore: null },
];

export default function StudentResultsPage() {
  // In a real app, you'd fetch these results.
  // Clicking an exam would navigate to a detailed results page: /teacher/dashboard/results/[examId]

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Student Results</h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Past Exam Performance</CardTitle>
          <CardDescription>Review student performance across completed exams.</CardDescription>
        </CardHeader>
        <CardContent>
          {examResults.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Title</TableHead>
                  <TableHead className="text-center flex items-center gap-1 justify-center"><Users className="h-4 w-4"/> Participants</TableHead>
                  <TableHead className="text-center flex items-center gap-1 justify-center"><Percent className="h-4 w-4"/> Average Score</TableHead>
                  <TableHead>Date Completed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examResults.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="font-medium">{result.title}</TableCell>
                    <TableCell className="text-center">{result.participants}</TableCell>
                    <TableCell className="text-center">
                      {result.averageScore !== null ? `${result.averageScore}%` : 'N/A'}
                    </TableCell>
                    <TableCell>{result.dateCompleted}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/teacher/dashboard/results/${result.id}`}>
                          <Eye className="mr-2 h-4 w-4" /> View Detailed Results
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg text-muted-foreground">No exam results available yet.</p>
                <p className="text-sm text-muted-foreground">Results for completed exams will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: 'Student Results | Teacher Dashboard | ProctorPrep',
};
