
// src/app/exam-session/[examId]/page.tsx
// This page is now largely superseded by the /seb/... flow for SEB-enabled exams.
// It can be kept as a fallback for non-SEB testing or if SEB detection on initiate page fails
// and redirects here. For now, it will show a message indicating SEB is preferred.
'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedExamSessionPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  // This page is not intended for direct use in the SEB flow anymore.
  // It could be a target for developers to test ExamTakingInterface directly without SEB checks.
  // Or it could be a fallback if SEB is not detected.

  useEffect(() => {
    // If a developer wants to test this page directly, they can.
    // Otherwise, the initiate page should handle SEB launch.
    console.warn(`[ExamSessionPage] Accessed directly for examId: ${examId}. This page is generally for SEB flow. Consider using the SEB launch from 'initiate' page.`);
  }, [examId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
      <Card className="w-full max-w-lg modern-card text-center shadow-xl">
        <CardHeader className="pt-8 pb-4">
          <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-5" />
          <CardTitle className="text-2xl text-orange-600 dark:text-orange-400">Non-SEB Exam Access</CardTitle>
        </CardHeader>
        <CardContent className="pb-6 space-y-4">
          <p className="text-muted-foreground">
            You have reached the exam session page directly. For a secure testing experience,
            exams are intended to be taken within Safe Exam Browser (SEB).
          </p>
          <p className="text-sm text-muted-foreground">
            If you are a student, please go back and join the exam through the dashboard to initiate the SEB launch sequence.
          </p>
          <p className="text-sm text-muted-foreground">
            Developers: This page can be used to test the `ExamTakingInterface` component directly.
            Ensure you pass a valid `examId` and handle authentication.
          </p>
          <Button asChild className="w-full btn-outline-subtle mt-4">
            <Link href="/student/dashboard/join-exam">
              Back to Join Exam Page
            </Link>
          </Button>
          {/* 
            For developer testing, one might conditionally render ExamTakingInterface here based on a flag.
            Example:
            const [showTest, setShowTest] = useState(false);
            ...
            <Button onClick={() => setShowTest(true)}>Load Test Interface (Dev Only)</Button>
            {showTest && examId && <ExamTakingInterface examId={examId} ... />}
          */}
        </CardContent>
      </Card>
    </div>
  );
}
    