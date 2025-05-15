// This page is now effectively replaced by the logic within initiate/page.tsx.
// Keeping it as a stub to prevent 404s if old links exist, but it should not be actively used.
'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';

export default function SebRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  useEffect(() => {
    // Redirect to the new initiate page if accessed directly.
    if (examId) {
      router.replace(`/student/dashboard/exam/${examId}/initiate`);
    } else {
      // If no examId, redirect to join exam page
      router.replace('/student/dashboard/join-exam');
    }
  }, [examId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <p className="text-lg text-muted-foreground">Redirecting to exam initiation...</p>
      <p className="text-sm text-muted-foreground mt-2">
        If redirection does not occur, please ensure you have entered a valid exam code.
      </p>
    </div>
  );
}
