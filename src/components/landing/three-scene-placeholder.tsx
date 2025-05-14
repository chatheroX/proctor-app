
'use client';

import Image from 'next/image';

export function ThreeScenePlaceholder() {
  return (
    <div
      className="relative w-full h-[400px] md:h-[500px] bg-gradient-to-br from-primary/10 via-background to-secondary/20 rounded-xl shadow-xl overflow-hidden border flex items-center justify-center"
      aria-label="Visual representation of secure proctoring technology"
    >
      <Image
        src="https://placehold.co/800x500.png"
        alt="Abstract representation of secure technology"
        fill
        className="object-cover"
        data-ai-hint="abstract technology" // Updated hint
        priority
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-8 text-center bg-black/40"> {/* Slightly increased overlay darkness for contrast */}
        <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-3 md:mb-4">
          Advanced Proctoring Technology
        </h2>
        <p className="text-md md:text-lg text-primary-foreground/80 max-w-md">
          Visualizing a secure and intuitive platform for modern online assessments.
        </p>
      </div>
    </div>
  );
}
