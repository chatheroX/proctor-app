'use client';

import Image from 'next/image';

export function ThreeScenePlaceholder() {
  return (
    <div 
      className="relative w-full h-[400px] md:h-[500px] bg-gradient-to-br from-primary/10 via-background to-secondary/20 rounded-xl shadow-xl overflow-hidden border flex items-center justify-center"
      aria-label="Placeholder for 3D animation"
    >
      <Image 
        src="https://placehold.co/800x500.png" 
        alt="Abstract 3D shapes" 
        layout="fill"
        objectFit="cover"
        className="opacity-50"
        data-ai-hint="abstract geometric"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/30">
        <h2 className="text-3xl font-bold text-primary-foreground mb-4">Interactive 3D Experience</h2>
        <p className="text-lg text-primary-foreground/80 max-w-md">
          Imagine a captivating 3D animation here, showcasing the future of secure proctoring.
          <br />
          <span className="text-sm mt-2 block">(Hint: Use Three.js for implementation)</span>
        </p>
      </div>
    </div>
  );
}
