
// src/app/exam-session/[examId]/page.tsx
// This page is now largely superseded by the /seb/... flow for SEB-enabled exams.
// It can be kept as a fallback for non-SEB testing or if SEB detection on initiate page fails
// and redirects here. For now, it will show a message indicating SEB is preferred.
'use client';

import React, { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedExamSessionPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  useEffect(() => {
    console.warn(`[DeprecatedExamSessionPage] Accessed for examId: ${examId}. This page is deprecated for SEB flow. Redirecting to student join exam...`);
    // Consider redirecting to student dashboard or join exam page
    router.replace('/student/dashboard/join-exam'); 
  }, [examId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
      <Card className="w-full max-w-lg modern-card text-center shadow-xl">
        <CardHeader className="pt-8 pb-4">
          <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-5" />
          <CardTitle className="text-2xl text-primary">Redirecting...</CardTitle>
        </CardHeader>
        <CardContent className="pb-6 space-y-4">
          <p className="text-muted-foreground">
            This exam access method is deprecated. Exams are now launched directly into Safe Exam Browser.
          </p>
          <p className="text-sm text-muted-foreground">
            You will be redirected to the "Join Exam" page.
          </p>
          <Button asChild className="w-full btn-outline-subtle mt-4">
            <Link href="/student/dashboard/join-exam">
              Go to Join Exam Page Now
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
    
