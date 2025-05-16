
// src/app/seb/entry/[token]/page.tsx
// This page is now effectively DEPRECATED for the primary SEB flow.
// The /seb/entry page (without [token]) will handle reading token from hash.
// This page could be removed or redirect.
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedSebEntryTokenPage({ params }: { params: { token: string } }) {
  const router = useRouter();

  useEffect(() => {
    console.warn(`[DeprecatedSebEntryTokenPage] Accessed with token ${params.token}. This page is deprecated. Redirecting to /seb/entry (which reads from hash)...`);
    // Redirect to the new SEB entry page which reads token from hash.
    // If a token was in the path, it means the old .seb StartURL might have been used.
    // For robustness, try to pass it as a hash if needed, or just redirect.
    router.replace(`/seb/entry#entryToken=${encodeURIComponent(params.token)}`);
  }, [params.token, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-slate-900 to-slate-950">
      <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
      <p className="text-lg text-slate-300">This SEB entry URL format is deprecated.</p>
      <p className="text-sm text-muted-foreground mt-2">
        Redirecting to the new SEB entry flow...
      </p>
    </div>
  );
}

