
// src/app/seb/exam-view/page.tsx
'use client';

import React, { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation'; // Keep for parent
import { SebExamViewClient } from '@/components/seb/seb-exam-view-client'; // Assume this component will be created
import { Loader2 } from 'lucide-react';


// This is the Server Component part of the page
export default function SebExamViewPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-900 to-slate-950">
        <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
        <p className="text-lg text-slate-300">
          Loading SEB Exam View...
        </p>
      </div>
    }>
      <SebExamViewClient />
    </Suspense>
  );
}
