
// src/app/seb/exam-view/page.tsx
'use client'; // Keep 'use client' for top-level page due to direct hash access in client component

import React, { Suspense } from 'react';
import { SebExamViewClient } from '@/components/seb/seb-exam-view-client';
import { Loader2 } from 'lucide-react';


// This page structure allows SebExamViewClient to use useSearchParams (or window.location.hash)
// within a Suspense boundary if needed, although hash access is direct.
export default function SebExamViewPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-900 to-slate-950">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-slate-300">
          Initializing Secure Exam View...
        </p>
      </div>
    }>
      <SebExamViewClient />
    </Suspense>
  );
}

