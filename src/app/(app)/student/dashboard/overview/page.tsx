import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit3, History, UserCircle, ArrowRight, ShieldAlert } from "lucide-react";

export default function StudentOverviewPage() {
  return (
    // Add Framer Motion wrapper for staggered item reveal
    <div className="space-y-8 w-full">
      <div className="p-6 rounded-xl bg-gradient-to-r from-primary/80 to-accent/70 text-primary-foreground shadow-xl">
        <h1 className="text-4xl font-bold drop-shadow-md">Welcome, Student!</h1>
        <p className="text-lg opacity-90 mt-2 drop-shadow-sm">
          Manage your exams, view your history, and keep your profile up to date.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Add Framer Motion for hover scale/lift effects */}
        <Card className="glass-card hover:shadow-primary/20 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-xl font-semibold">
              <Edit3 className="h-7 w-7 text-primary" />
              Join an Exam
            </CardTitle>
            <CardDescription className="pt-1 text-sm">Ready for your next assessment? Enter an exam code to begin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full py-3 text-base shadow-md hover:shadow-lg transition-shadow">
              <Link href="/student/dashboard/join-exam">
                Go to Join Exam <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-primary/20 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-xl font-semibold">
              <History className="h-7 w-7 text-primary" />
              View Exam History
            </CardTitle>
            <CardDescription className="pt-1 text-sm">Review your past exam attempts and scores (Feature upcoming).</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full py-3 text-base" variant="secondary">
              <Link href="/student/dashboard/exam-history">
                Check History <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card hover:shadow-primary/20 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-3 text-xl font-semibold">
              <UserCircle className="h-7 w-7 text-primary" />
              Update Profile
            </CardTitle>
            <CardDescription className="pt-1 text-sm">Keep your personal information current.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full py-3 text-base" variant="secondary">
              <Link href="/student/dashboard/profile">
                Edit Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-primary/30">
        <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold">
                <ShieldAlert className="h-6 w-6 text-primary mr-2" />
                Important Notice
            </CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">
                All exams must be taken using the <strong>Safe Exam Browser (SEB)</strong> or as instructed by your teacher. Ensure you have any required software installed and configured correctly before attempting to join an exam.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Metadata should be handled by generateMetadata if dynamic or removed if static and 'use client'
// export const metadata = {
//   title: 'Student Dashboard | ProctorPrep',
// };
