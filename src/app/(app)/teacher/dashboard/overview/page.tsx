
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpenCheck, Brain, BarChart3, UserCircle, ArrowRight, PlusCircle, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext"; // Import useAuth

export default function TeacherOverviewPage() {
  const { user } = useAuth(); // Get user from context

  return (
    // TODO: Add Framer Motion page wrapper for entrance animation
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="p-6 rounded-xl bg-gradient-to-r from-primary/80 to-accent/70 text-primary-foreground shadow-xl">
            {/* TODO: Add Framer Motion text animation */}
            <h1 className="text-3xl md:text-4xl font-bold drop-shadow-md">
                Welcome, {user?.name || 'Teacher'}!
            </h1>
            <p className="text-muted-foreground text-lg opacity-90 mt-2 drop-shadow-sm">
                Your central hub for managing exams, questions, and student performance.
            </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto py-3 text-base shadow-md hover:shadow-lg transition-shadow duration-300">
            <Link href="/teacher/dashboard/exams/create">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Exam
            </Link>
        </Button>
      </div>
      
      {/* Placeholder for future stats cards - Real data fetching needed */}
      {/* 
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Overview Stats Coming Soon!</AlertTitle>
        <AlertDescription>
          Real-time statistics for active exams, student counts, and pending gradings will be displayed here once data fetching is implemented.
        </AlertDescription>
      </Alert>
      */}

      <div className="grid gap-6 md:grid-cols-2">
        {/* TODO: Add Framer Motion card animations */}
        <Card className="glass-card hover:shadow-primary/20 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <BookOpenCheck className="h-6 w-6 text-primary" />
              Manage Exams
            </CardTitle>
            <CardDescription className="pt-1 text-sm">Create, update, and monitor your exams. Share unique codes with students.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full py-3 text-base shadow-md hover:shadow-lg transition-shadow">
              <Link href="/teacher/dashboard/exams">
                Go to Exams <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-primary/20 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <Brain className="h-6 w-6 text-primary" />
              AI Question Assistant
            </CardTitle>
            <CardDescription className="pt-1 text-sm">Generate diverse exam questions based on topics and difficulty.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full py-3 text-base" variant="outline">
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

// Removed static metadata as this is a client component.
// export const metadata = {
//   title: 'Teacher Dashboard | ProctorPrep',
// };
