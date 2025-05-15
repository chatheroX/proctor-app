
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpenCheck, Brain, ArrowRight, PlusCircle, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext"; 
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function TeacherOverviewPage() {
  const { user } = useAuth(); 

  return (
    // TODO: Add Framer Motion page wrapper for entrance animation
    <div className="space-y-8 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* TODO: Add Framer Motion for entrance animation */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-primary/90 via-primary to-[hsl(var(--accent-gradient-end))] text-primary-foreground shadow-xl flex-1">
            <h1 className="text-3xl md:text-4xl font-bold drop-shadow-lg">
                Welcome, {user?.name || 'Teacher'}!
            </h1>
            <p className="text-lg opacity-90 mt-2 drop-shadow-sm">
                Your central hub for managing exams, questions, and student performance.
            </p>
        </div>
        {/* TODO: Add Framer Motion for button interaction */}
        <Button asChild size="lg" className="btn-gradient w-full sm:w-auto py-3 text-base rounded-lg">
            <Link href="/teacher/dashboard/exams/create">
                <PlusCircle className="mr-2 h-5 w-5" /> Create New Exam
            </Link>
        </Button>
      </div>
      
      <Alert className="glass-card border-primary/20">
        <Info className="h-5 w-5 text-primary" />
        <AlertTitle className="font-semibold text-foreground">Overview Stats</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Real-time statistics for active exams, student counts, and pending gradings will be displayed here once data fetching is implemented.
        </AlertDescription>
      </Alert>
      

      <div className="grid gap-6 md:grid-cols-2">
        {/* TODO: Add Framer Motion card animations (e.g., hover scale, entrance stagger) */}
        <Card className="glass-card hover:shadow-primary/20 transition-all duration-300 ease-in-out transform hover:-translate-y-1.5">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-semibold">
              <BookOpenCheck className="h-7 w-7 text-primary" />
              Manage Exams
            </CardTitle>
            <CardDescription className="pt-1 text-sm text-muted-foreground">Create, update, and monitor your exams. Share unique codes with students.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="btn-gradient w-full py-3 text-base rounded-lg">
              <Link href="/teacher/dashboard/exams">
                Go to Exams <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-primary/20 transition-all duration-300 ease-in-out transform hover:-translate-y-1.5">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-3 text-xl font-semibold">
              <Brain className="h-7 w-7 text-primary" />
              AI Question Assistant
            </CardTitle>
            <CardDescription className="pt-1 text-sm text-muted-foreground">Generate diverse exam questions based on topics and difficulty.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full py-3 text-base rounded-lg border-border hover:bg-accent/10" variant="outline">
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
