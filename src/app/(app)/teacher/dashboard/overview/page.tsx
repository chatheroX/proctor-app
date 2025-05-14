import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpenCheck, Brain, BarChart3, UserCircle, ArrowRight, PlusCircle } from "lucide-react";

// Mock data for teacher overview
const overviewStats = [
    { title: "Active Exams", value: "5", icon: <BookOpenCheck className="h-8 w-8 text-primary" /> },
    { title: "Total Students", value: "120", icon: <UserCircle className="h-8 w-8 text-primary" /> },
    { title: "Pending Gradings", value: "3", icon: <BarChart3 className="h-8 w-8 text-primary" /> },
];

export default function TeacherOverviewPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">Welcome, Teacher!</h1>
            <p className="text-muted-foreground">
                Your central hub for managing exams, questions, and student performance.
            </p>
        </div>
        <Button asChild size="lg">
            <Link href="/teacher/dashboard/exams/create">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Exam
            </Link>
        </Button>
      </div>
      

      <div className="grid gap-6 md:grid-cols-3">
        {overviewStats.map(stat => (
            <Card key={stat.title} className="shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    {stat.icon}
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">Current status</p>
                </CardContent>
            </Card>
        ))}
      </div>

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
