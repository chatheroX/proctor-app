
'use client';

import Image from 'next/image';

export function ThreeScenePlaceholder() {
  return (
    <div
      className="relative w-full h-[400px] md:h-[500px] bg-gradient-to-br from-primary/30 via-secondary/20 to-primary/30 rounded-xl shadow-2xl overflow-hidden border group"
      aria-label="Interactive 3D animation placeholder for ProctorPrep features"
    >
      <Image
        src="https://images.unsplash.com/photo-1665979738276-e41e815df1e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxOHx8cHJvY3RvciUyMGV4YW18ZW58MHx8fHwxNzQ3MzA2NzAwfDA&ixlib=rb-4.1.0&q=80&w=1080"
        alt="Secure online exam proctoring environment"
        fill
        className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
        priority // Important for LCP on landing page
        data-ai-hint="secure assessment" // Updated hint for AI image generation
      />
      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center p-4 md:p-8 text-center transition-opacity duration-300 group-hover:bg-black/50">
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 drop-shadow-md">
          Advanced Proctoring Technology
        </h3>
        <p className="text-base md:text-lg text-primary-foreground/90 max-w-md drop-shadow-sm">
          Visualizing a secure and intuitive platform for modern online assessments.
        </p>
      </div>
    </div>
  );
}
