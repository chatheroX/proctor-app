
// This page is now effectively replaced by the logic within initiate/page.tsx.
// It will redirect to initiate page or dashboard if accessed directly.
'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedSebRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.examId as string;

  useEffect(() => {
    // Redirect to the new initiate page if accessed directly with an examId.
    // Or to the student dashboard if no examId is present.
    console.warn(`[DeprecatedSebRedirectPage] Accessed. This page is deprecated. Redirecting...`);
    if (examId) {
      router.replace(`/student/dashboard/exam/${examId}/initiate`);
    } else {
      router.replace('/student/dashboard/join-exam');
    }
  }, [examId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <p className="text-lg text-muted-foreground">Redirecting to SEB initiation sequence...</p>
      <p className="text-sm text-muted-foreground mt-2">
        This page is for internal routing. You should be redirected shortly.
      </p>
    </div>
  );
}

    