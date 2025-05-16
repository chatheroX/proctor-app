
// src/app/seb/layout.tsx
import React from 'react';

// This layout is minimal, intended for pages that run inside SEB
// It should not include global navigation, sidebars, or footers from the main app.
export default function SebLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light"> {/* Ensure base HTML structure */}
      <body className="font-sans antialiased bg-slate-100 dark:bg-slate-900 min-h-screen flex flex-col">
        {/* The SEB pages will control their own full-screen content */}
        {children}
        {/* No Toaster here usually, as SEB might block pop-ups or it's not part of the exam UI */}
      </body>
    </html>
  );
}
    