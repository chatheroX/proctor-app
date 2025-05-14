
'use client';

import { useState, useEffect } from 'react'; // Added useEffect
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, Eye, Users, Percent, Loader2 } from 'lucide-react'; // Added Loader2

interface ExamResultSummary {
  id: string;
  title: string;
  dateCompleted: string;
  participants: number;
  averageScore: number | null; // in percentage
}

// No more mock data
// const examResults: ExamResultSummary[] = [ ... ];

export default function StudentResultsPage() {
  const [results, setResults] = useState<ExamResultSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchResultsSummary = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // const summary = await yourApi.getResultsSummary();
      // setResults(summary);
      // For now, setting to empty
      setResults([]);
      setIsLoading(false);
    };
    fetchResultsSummary();
  }, []);
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading student results...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Student Results</h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Past Exam Performance</CardTitle>
          <CardDescription>Review student performance across completed exams.</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length > 0 ? (
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
                {results.map((result) => (
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
