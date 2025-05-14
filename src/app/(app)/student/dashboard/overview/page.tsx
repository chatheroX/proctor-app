import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Edit3, History, UserCircle, ArrowRight } from "lucide-react";

export default function StudentOverviewPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, Student!</h1>
      <p className="text-muted-foreground">
        Manage your exams, view your history, and keep your profile up to date.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit3 className="h-6 w-6 text-primary" />
              Join an Exam
            </CardTitle>
            <CardDescription>Ready for your next assessment? Enter an exam code to begin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/student/dashboard/join-exam">
                Go to Join Exam <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              View Exam History
            </CardTitle>
            <CardDescription>Review your past exam attempts and scores.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/student/dashboard/exam-history">
                Check History <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-6 w-6 text-primary" />
              Update Profile
            </CardTitle>
            <CardDescription>Keep your personal information current.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/student/dashboard/profile">
                Edit Profile <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
            <CardTitle>Important Notice</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">
                All exams must be taken using the <strong>Safe Exam Browser (SEB)</strong>. Ensure you have it installed and configured correctly before attempting to join an exam.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

export const metadata = {
  title: 'Student Dashboard | ProctorPrep',
};
