
'use client';

import { ShieldCheck } from 'lucide-react'; // Or Webcam

export function ThreeScenePlaceholder() {
  return (
    <div
      className="relative w-full h-[400px] md:h-[500px] rounded-2xl shadow-2xl overflow-hidden border border-primary/10 group bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4 flex items-center justify-center"
      aria-label="Interactive proctoring feature highlight"
    >
      {/* Abstract background elements - retained for depth */}
      <div className="absolute inset-0">
        <div
          className="absolute -top-1/4 -left-1/4 w-3/4 h-3/4 bg-gradient-to-br from-primary/20 to-transparent rounded-full opacity-60 blur-3xl"
        ></div>
        <div
          className="absolute -bottom-1/4 -right-1/4 w-2/3 h-2/3 bg-gradient-to-tl from-accent/20 to-transparent rounded-full opacity-50 blur-3xl"
        ></div>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/2 h-1/2 transform"
        >
          <div className="w-full h-full rounded-xl bg-primary/5 border border-primary/20 shadow-xl opacity-70 blur-md"></div>
        </div>
        <div
          className="absolute top-0 left-0 w-full h-full transform -skew-y-12 "
        >
            <div className="h-1/2 w-full bg-gradient-to-r from-accent/10 via-transparent to-transparent opacity-30"></div>
        </div>
      </div>

      {/* Sleek Glassmorphism Card Content */}
      {/* TODO: Add Framer Motion wrapper here for entrance animation if desired */}
      <div className="relative z-10 w-full max-w-md md:max-w-lg transition-all duration-300 ease-in-out group-hover:scale-105">
        <div className="glass-card p-6 md:p-8 rounded-xl shadow-2xl border-white/10 hover:shadow-primary/20 transition-all duration-300 ease-in-out transform hover:-translate-y-1">
          <div className="flex flex-col items-center text-center">
            {/* Icon with "glow" effect */}
            <div className="p-3 mb-4 bg-primary/20 rounded-full shadow-lg relative">
              <ShieldCheck className="h-12 w-12 md:h-16 md:w-16 text-primary" />
              {/* Glow effect - subtle version */}
              <div className="absolute inset-0 rounded-full shadow-[0_0_20px_5px_hsl(var(--primary)/0.3)] opacity-75 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>

            <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-2 drop-shadow-md">
              AI-Powered Live Proctoring
            </h3>
            <p className="text-sm md:text-base text-muted-foreground max-w-xs md:max-w-sm drop-shadow-sm">
              Real-time monitoring with smart alerts and system checks.
            </p>
          </div>
        </div>
      </div>

      {/*
        <div className="absolute inset-0">
          // Your actual 3D scene component could go here
          // e.g., <MyCool3DScene />
        </div>
      */}
    </div>
  );
}
