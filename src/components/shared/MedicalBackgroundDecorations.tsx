'use client';

import React from 'react';

/**
 * Ambient background decorations for the Landing Page Hero section:
 * Includes soft glowing radial meshes, subtle animated ECG pulse wave,
 * floating medical cross patterns, and subtle DNA/molecular motifs.
 */
export function HeroAmbientBackground() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none select-none">
      {/* Radial Glow 1: Top Left Teal/Cyan */}
      <div
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/15 dark:bg-primary/20 blur-3xl opacity-70"
        aria-hidden="true"
      />

      {/* Radial Glow 2: Center Right Blue/Cyan */}
      <div
        className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full bg-cyan-500/10 dark:bg-cyan-500/15 blur-3xl opacity-60"
        aria-hidden="true"
      />

      {/* Radial Glow 3: Bottom Center Soft Glow */}
      <div
        className="absolute -bottom-24 left-1/3 w-[600px] h-[300px] rounded-full bg-primary/10 dark:bg-primary/15 blur-3xl opacity-50"
        aria-hidden="true"
      />

      {/* Micro Cross Pattern Overlay */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.06] dark:opacity-[0.08]"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id="medical-cross-pattern" width="48" height="48" patternUnits="userSpaceOnUse">
            {/* Medical Cross Symbol */}
            <path
              d="M 22 20 L 26 20 L 26 22 L 28 22 L 28 26 L 26 26 L 26 28 L 22 28 L 22 26 L 20 26 L 20 22 L 22 22 Z"
              fill="currentColor"
              className="text-primary"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#medical-cross-pattern)" />
      </svg>

      {/* ECG Heartbeat Waveform Line traversing subtly */}
      <svg
        className="absolute top-1/2 left-0 w-full h-24 -translate-y-1/2 opacity-25 dark:opacity-20"
        preserveAspectRatio="none"
        viewBox="0 0 1200 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ecgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
            <stop offset="20%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.8" />
            <stop offset="80%" stopColor="var(--primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M 0 50 L 150 50 L 170 50 L 180 35 L 190 65 L 200 15 L 215 85 L 225 50 L 240 50 L 260 45 L 275 55 L 285 50 L 450 50 L 470 50 L 480 35 L 490 65 L 500 15 L 515 85 L 525 50 L 540 50 L 560 45 L 575 55 L 585 50 L 750 50 L 770 50 L 780 35 L 790 65 L 800 15 L 815 85 L 825 50 L 840 50 L 860 45 L 875 55 L 885 50 L 1050 50 L 1070 50 L 1080 35 L 1090 65 L 1100 15 L 1115 85 L 1125 50 L 1200 50"
          stroke="url(#ecgGrad)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Glowing Pulse Node on ECG */}
        <circle cx="500" cy="15" r="3" fill="#0ea5e9" className="animate-ping opacity-75" />
        <circle cx="500" cy="15" r="2" fill="#0ea5e9" />
        <circle cx="800" cy="15" r="3" fill="#0ea5e9" className="animate-ping opacity-75" />
        <circle cx="800" cy="15" r="2" fill="#0ea5e9" />
      </svg>

      {/* Floating Decorative Medical Elements */}
      {/* Floating Element 1: DNA Helix Node (Top Left) */}
      <div className="absolute top-16 left-[8%] opacity-30 dark:opacity-25 hidden sm:block">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="10" cy="10" r="4" fill="var(--primary)" />
          <circle cx="30" cy="30" r="4" fill="#0ea5e9" />
          <path d="M 10 10 C 20 15, 20 25, 30 30" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="3 3" />
          <circle cx="10" cy="30" r="4" fill="#0ea5e9" />
          <circle cx="30" cy="10" r="4" fill="var(--primary)" />
          <path d="M 10 30 C 20 25, 20 15, 30 10" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="3 3" />
        </svg>
      </div>

      {/* Floating Element 2: Hexagonal Molecular Node (Bottom Left) */}
      <div className="absolute bottom-16 left-[5%] opacity-25 dark:opacity-20 hidden md:block">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <polygon
            points="30,5 52,17 52,43 30,55 8,43 8,17"
            stroke="var(--primary)"
            strokeWidth="1.5"
            fill="none"
          />
          <circle cx="30" cy="5" r="3" fill="var(--primary)" />
          <circle cx="52" cy="17" r="3" fill="#0ea5e9" />
          <circle cx="52" cy="43" r="3" fill="var(--primary)" />
          <circle cx="30" cy="55" r="3" fill="#0ea5e9" />
          <circle cx="8" cy="43" r="3" fill="var(--primary)" />
          <circle cx="8" cy="17" r="3" fill="#0ea5e9" />
        </svg>
      </div>

      {/* Floating Element 3: Shield Outline (Center Right) */}
      <div className="absolute top-20 right-[4%] opacity-25 dark:opacity-20 hidden lg:block">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path
            d="M 24 6 L 40 12 C 40 28, 24 40, 24 40 C 24 40, 8 28, 8 12 Z"
            stroke="#0ea5e9"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            fill="none"
          />
          <circle cx="24" cy="23" r="3" fill="var(--primary)" />
        </svg>
      </div>
    </div>
  );
}

/**
 * Section Background Pattern:
 * A subtle medical grid pattern for content sections to enhance depth.
 */
export function SectionMedicalPattern({ className = '' }: { className?: string }) {
  return (
    <div className={`absolute inset-0 -z-10 pointer-events-none opacity-20 dark:opacity-10 ${className}`}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="sec-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="1" fill="currentColor" className="text-muted-foreground" />
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/20" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#sec-grid)" />
      </svg>
    </div>
  );
}

/**
 * Curved Wave Divider between major sections for a smooth, modern flow:
 */
export function SectionWaveDivider({ flip = false, className = '' }: { flip?: boolean; className?: string }) {
  return (
    <div className={`w-full overflow-hidden leading-none -my-1 pointer-events-none select-none ${className}`}>
      <svg
        className={`w-full h-8 sm:h-12 ${flip ? 'rotate-180' : ''}`}
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 0,0 C 150,90 350,-40 500,45 C 650,130 900,10 1200,60 L 1200,120 L 0,120 Z"
          fill="currentColor"
          className="text-muted/30 dark:text-muted/15"
        />
      </svg>
    </div>
  );
}
