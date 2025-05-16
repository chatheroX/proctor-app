
// src/app/seb/exam-view/page.tsx
// This page is now effectively DEPRECATED and replaced by /seb/entry/[token]
// It will show a message and redirect.
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';


export default function DeprecatedSebExamViewPage() {
  const router = useRouter();

  useEffect(() => {
    console.warn(`[DeprecatedSebExamViewPage] Accessed. This page is deprecated for SEB flow. Redirecting...`);
    // This page runs INSIDE SEB. A generic redirect to / might not be helpful.
    // Ideally, it should quit SEB or show an error.
    // For now, it will show an error and provide a manual quit option if possible,
    // or try to redirect to a generic "unsupported" page if that makes sense in SEB context.
    // Let's assume this page might be hit if an old .seb config file is used.
  }, [router]);

  const handleExitSeb = useCallback(() => {
    if (typeof window !== 'undefined') window.location.href = "seb://quit";
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-800 to-slate-900">
      <Card className="w-full max-w-lg modern-card text-center shadow-xl bg-card/80 backdrop-blur-lg border-border/30">
        <CardHeader className="pt-8 pb-4">
          <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-5" />
          <CardTitle className="text-2xl text-orange-400">SEB Page Deprecated</CardTitle>
        </CardHeader>
        <CardContent className="pb-6 space-y-4">
          <p className="text-muted-foreground">
            This SEB exam view page is no longer in use.
            The exam flow now uses a new secure entry point.
          </p>
          <p className="text-sm text-muted-foreground">
            If you are seeing this, your SEB configuration might be outdated or you have followed an old link.
            Please re-initiate the exam from the ZenTest dashboard.
          </p>
           <Button onClick={handleExitSeb} className="w-full btn-gradient-destructive mt-4">
            Exit SEB
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// Added useCallback import
import { useCallback } from 'react';
