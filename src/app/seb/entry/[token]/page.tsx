
// src/app/seb/entry/[token]/page.tsx
import React, { Suspense } from 'react';
import { SebEntryClient } from '@/components/seb/seb-entry-client'; // Adjusted path
import { Loader2, ShieldAlert } from 'lucide-react';

export default function SebEntryPage({ params }: { params: { token: string } }) {
  const entryTokenFromPath = params.token;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="h-16 w-16 text-primary animate-spin mb-6" />
          <h2 className="text-xl font-medium text-slate-200 mb-2">
            Initializing Secure Exam Session...
          </h2>
          <div className="flex items-center text-yellow-400">
            <ShieldAlert className="h-5 w-5 mr-2" />
            <p className="text-sm">Please wait, validating entry...</p>
          </div>
        </div>
      }>
        <SebEntryClient entryTokenFromPath={entryTokenFromPath} />
      </Suspense>
    </div>
  );
}
