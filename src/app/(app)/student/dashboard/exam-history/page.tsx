
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2 } from "lucide-react"; // Added Loader2
import { useState, useEffect } from "react"; // Added hooks

interface ExamHistoryItem {
  id: string;
  name: string;
  date: string;
  score: number | null;
  status: 'Completed' | 'In Progress' | 'Not Started';
}

// No more mock data
// const examHistory: ExamHistoryItem[] = [ ... ];

export default function ExamHistoryPage() {
  const [examHistory, setExamHistory] = useState<ExamHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // const history = await yourApi.getStudentExamHistory();
      // setExamHistory(history);
      // For now, setting to empty
      setExamHistory([]);
      setIsLoading(false);
    };
    fetchHistory();
  }, []);

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
                  <TableHead>Exam ID</TableHead>
                  <TableHead>Exam Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {examHistory.map((exam) => (
                  <TableRow key={exam.id}>
                    <TableCell className="font-medium">{exam.id}</TableCell>
                    <TableCell>{exam.name}</TableCell>
                    <TableCell>{exam.date}</TableCell>
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

export const metadata = {
  title: 'Exam History | Student Dashboard | ProctorPrep',
};
