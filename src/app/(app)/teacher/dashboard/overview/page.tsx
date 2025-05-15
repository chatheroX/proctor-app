
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpenCheck, Brain, BarChart3, UserCircle, ArrowRight, PlusCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Real data fetching for these stats will need to be implemented.
// For example, "Active Exams" would query ExamX based on status and time.
// "Total Students" might query proctorX for students linked to this teacher (if such linking exists) or all students.
// "Pending Gradings" would query ExamSubmissionsX.

export default function TeacherOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold">Welcome, Teacher!</h1>
            <p className="text-muted-foreground">
                Your central hub for managing exams, questions, and student performance.
            </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/teacher/dashboard/exams/create">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Exam
            </Link>
        </Button>
      </div>
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Overview Stats Coming Soon!</AlertTitle>
        <AlertDescription>
          Real-time statistics for active exams, student counts, and pending gradings will be displayed here once data fetching is implemented.
        </AlertDescription>
      </Alert>

      {/* Placeholder for future stats cards - kept structure for potential re-integration */}
      {/* 
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Exams</CardTitle>
                <BookOpenCheck className="h-8 w-8 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">N/A</div>
                <p className="text-xs text-muted-foreground">Currently ongoing</p>
            </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students (Placeholder)</CardTitle>
                 <UserCircle className="h-8 w-8 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">N/A</div>
                <p className="text-xs text-muted-foreground">Across all exams</p>
            </CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Gradings (Placeholder)</CardTitle>
                <BarChart3 className="h-8 w-8 text-primary" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">N/A</div>
                <p className="text-xs text-muted-foreground">Submissions needing review</p>
            </CardContent>
        </Card>
      </div>
      */}

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpenCheck className="h-6 w-6 text-primary" />
              Manage Exams
            </CardTitle>
            <CardDescription>Create, update, and monitor your exams. Share unique codes with students.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/teacher/dashboard/exams">
                Go to Exams <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              AI Question Assistant
            </CardTitle>
            <CardDescription>Generate diverse exam questions based on topics and difficulty.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/teacher/dashboard/ai-assistant">
                Use AI Assistant <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Teacher Dashboard | ProctorPrep',
};
