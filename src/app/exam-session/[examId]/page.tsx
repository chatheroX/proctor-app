
// src/app/exam-session/[examId]/page.tsx
// This page is now effectively DEPRECATED and replaced by /seb/entry/[token]
// It will show a message and redirect.
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function DeprecatedExamSessionPage() {
  const router = useRouter();

  useEffect(() => {
    console.warn(`[DeprecatedExamSessionPage] Accessed. This page is deprecated. Redirecting to student dashboard...`);
    router.replace('/student/dashboard/join-exam'); 
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
      <Card className="w-full max-w-lg modern-card text-center shadow-xl">
        <CardHeader className="pt-8 pb-4">
          <Loader2 className="h-16 w-16 text-primary animate-spin mx-auto mb-5" />
          <CardTitle className="text-2xl text-primary">Redirecting...</CardTitle>
        </CardHeader>
        <CardContent className="pb-6 space-y-4">
          <p className="text-muted-foreground">
            This exam access method is deprecated. Exams are launched directly into Safe Exam Browser via a new secure entry flow.
          </p>
          <p className="text-sm text-muted-foreground">
            You will be redirected.
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
