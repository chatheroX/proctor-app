import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

// Mock data for exam history
const examHistory = [
  { id: 'EXAM001', name: 'Introduction to Algebra Midterm', date: '2024-05-15', score: 85, status: 'Completed' },
  { id: 'EXAM002', name: 'Physics 101 Final', date: '2024-06-01', score: 92, status: 'Completed' },
  { id: 'EXAM003', name: 'History of Ancient Civilizations Quiz', date: '2024-06-10', score: 78, status: 'Completed' },
  { id: 'EXAM004', name: 'Calculus I Assessment', date: '2024-06-20', score: null, status: 'In Progress' },
];

export default function ExamHistoryPage() {
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
                      <Badge variant={exam.status === 'Completed' ? 'default' : 'secondary'}
                        className={exam.status === 'Completed' ? 'bg-green-500/80 text-white' : 'bg-yellow-500/80 text-white'}
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
