
// src/app/seb/layout.tsx
import React from 'react';
import { Toaster } from "@/components/ui/toaster"; // Toasts might be useful for SEB pages too

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
        <Toaster /> {/* Toasts can provide feedback within SEB */}
      </body>
    </html>
  );
}
    
