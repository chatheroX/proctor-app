
// src/app/unsupported-browser/page.tsx
'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function UnsupportedBrowserPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 p-4">
      <Card className="w-full max-w-md modern-card text-center shadow-xl">
        <CardHeader className="pt-8 pb-4">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-5" />
          <CardTitle className="text-2xl text-destructive">Unsupported Browser or Environment</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <CardDescription className="text-muted-foreground mb-6">
            This exam must be taken using the Safe Exam Browser (SEB).
            Please launch the exam again using SEB. If you believe you are seeing this message in error
            within SEB, please contact your exam administrator.
          </CardDescription>
          <Link href="/" passHref>
            <Button className="w-full btn-primary-solid">
              Return to Homepage
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
    