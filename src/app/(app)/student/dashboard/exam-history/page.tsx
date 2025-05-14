
'use client'; // This page now uses hooks, so it must be a client component

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext"; // Assuming you want to fetch history for the current user
import { useToast } from "@/hooks/use-toast";

interface ExamHistoryItem {
  id: string; // exam_submission_id or similar
  exam_name: string;
  submission_date: string;
  score: number | null;
  status: 'Completed' | 'In Progress' | 'Not Started'; // Status of the student's attempt
  // exam_id?: string; // Original exam_id
}

export default function ExamHistoryPage() {
  const [examHistory, setExamHistory] = useState<ExamHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      // TODO: Replace with actual API call to fetch student's exam history
      // Example:
      // const { data, error } = await supabase
      //   .from('exam_submissions') // Assuming a table like this
      //   .select(`
      //     id,
      //     status,
      //     score,
      //     submission_date:submitted_at,
      //     exams ( exam_name:title )
      //   `)
      //   .eq('student_id', user.user_id)
      //   .order('submitted_at', { ascending: false });
      // if (error) {
      //   toast({ title: "Error", description: "Failed to fetch exam history.", variant: "destructive" });
      //   setExamHistory([]);
      // } else {
      //   // Transform data if needed
      //   const formattedHistory = data.map(item => ({...item, exam_name: item.exams.exam_name, submission_date: item.submission_date ? new Date(item.submission_date).toLocaleDateString() : 'N/A' }));
      //   setExamHistory(formattedHistory as ExamHistoryItem[]);
      // }
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
      setExamHistory([]); // Initialize with empty array
      setIsLoading(false);
    };
    fetchHistory();
  }, [user, toast]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Loading exam history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Exam History</h1>
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Your Past Exams</CardTitle>
          <CardDescription>Review your performance in previous exams.</CardDescription>
        </CardHeader>
        <CardContent>
          {examHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Exam Name</TableHead>
                  <TableHead>Date Submitted</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examHistory.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.exam_name}</TableCell>
                    <TableCell>{exam.submission_date}</TableCell>
                    <TableCell>{exam.score !== null ? `${exam.score}%` : 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={
                          exam.status === 'Completed' ? 'default' :
                          exam.status === 'In Progress' ? 'secondary' :
                          'outline' // Not Started or other
                        }
                        className={
                          exam.status === 'Completed' ? 'bg-green-500/80 text-white' :
                          exam.status === 'In Progress' ? 'bg-yellow-500/80 text-white' : ''
                        }
                      >
                        {exam.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">You haven&apos;t completed any exams yet.</p>
              <p className="text-sm text-muted-foreground">Your completed exams will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Removed metadata export as this is a Client Component
// export const metadata = {
//   title: 'Exam History | Student Dashboard | ProctorPrep',
// };
