
'use client';

import Image from 'next/image';

export function ThreeScenePlaceholder() {
  return (
    <div
      className="relative w-full h-[400px] md:h-[500px] bg-gradient-to-br from-primary/30 via-secondary/20 to-primary/30 rounded-xl shadow-2xl overflow-hidden border group"
      aria-label="Interactive 3D animation placeholder for ProctorPrep features"
    >
      <Image
        src="https://placehold.co/800x600.png" // A generic, good-looking placeholder size
        alt="Futuristic interface or abstract technology visualization"
        fill
        className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
        priority // Important for LCP on landing page
        data-ai-hint="futuristic interface" // Hint for AI image generation
      />
      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center p-4 md:p-8 text-center transition-opacity duration-300 group-hover:bg-black/60">
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 drop-shadow-md">
          Visualizing a New Era of Proctoring
        </h3>
        <p className="text-base md:text-lg text-primary-foreground/90 max-w-md drop-shadow-sm">
          Our interactive 3D animated experience is currently under development.
        </p>
      </div>
    </div>
  );
}
