'use client';

import React from 'react';

interface StepIllustrationProps {
  className?: string;
}

/**
 * Step 1: Patient Intake Illustration
 * Depicts a clinical clipboard, vitals waveform (ECG), stethoscope, and symptom checklist.
 */
export function Step1IntakeIllustration({ className = '' }: StepIllustrationProps) {
  return (
    <div className={`w-full aspect-[4/3] max-w-[240px] mx-auto flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
        role="img"
        aria-label="Patient Intake Illustration"
      >
        <defs>
          <linearGradient id="boardGrad" x1="40" y1="20" x2="160" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="boardGradDark" x1="40" y1="20" x2="160" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="clipGrad" x1="80" y1="10" x2="120" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#64748b" />
          </linearGradient>
          <linearGradient id="pulseGrad" x1="60" y1="75" x2="140" y2="75" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="50%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#0d9488" />
          </linearGradient>
        </defs>

        {/* Ambient soft glow */}
        <circle cx="100" cy="75" r="55" fill="var(--primary)" opacity="0.1" />

        {/* Clipboard Base */}
        <rect x="42" y="24" width="116" height="114" rx="10" fill="#cbd5e1" opacity="0.6" />
        <rect x="46" y="22" width="108" height="114" rx="8" fill="url(#boardGrad)" stroke="#cbd5e1" strokeWidth="1" />

        {/* Clipboard Top Clip */}
        <rect x="80" y="14" width="40" height="14" rx="4" fill="url(#clipGrad)" />
        <circle cx="100" cy="21" r="3" fill="#ffffff" opacity="0.8" />

        {/* Paper lines / Checklist rows */}
        <rect x="58" y="38" width="84" height="4" rx="2" fill="var(--primary)" opacity="0.8" />

        {/* Vitals Screen Display Mini-Box */}
        <rect x="56" y="48" width="88" height="36" rx="5" fill="#0f172a" />
        {/* ECG pulse waveform */}
        <path
          d="M 62 66 L 76 66 L 80 60 L 84 74 L 88 56 L 93 72 L 96 66 L 110 66 L 113 62 L 117 66 L 138 66"
          stroke="url(#pulseGrad)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Vitals text / indicators */}
        <circle cx="64" cy="54" r="2" fill="#10b981" />
        <rect x="70" y="52" width="22" height="3" rx="1.5" fill="#94a3b8" />
        <rect x="112" y="52" width="26" height="3" rx="1.5" fill="#38bdf8" />

        {/* Symptom Checklist Items */}
        <rect x="58" y="94" width="8" height="8" rx="2" fill="#0d9488" opacity="0.2" stroke="#0d9488" strokeWidth="1" />
        <path d="M 60 98 L 62.5 100 L 67 95" stroke="#0d9488" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="72" y="96" width="60" height="4" rx="2" fill="#94a3b8" opacity="0.5" />

        <rect x="58" y="108" width="8" height="8" rx="2" fill="#0d9488" opacity="0.2" stroke="#0d9488" strokeWidth="1" />
        <path d="M 60 112 L 62.5 114 L 67 109" stroke="#0d9488" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="72" y="110" width="48" height="4" rx="2" fill="#94a3b8" opacity="0.5" />

        <rect x="58" y="122" width="8" height="8" rx="2" fill="#0d9488" opacity="0.2" stroke="#0d9488" strokeWidth="1" />
        <path d="M 60 126 L 62.5 128 L 67 123" stroke="#0d9488" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="72" y="124" width="54" height="4" rx="2" fill="#94a3b8" opacity="0.5" />

        {/* Stethoscope Head Wrapping Around */}
        <path
          d="M 148 44 C 168 50, 168 110, 140 126 C 130 132, 120 135, 110 135"
          stroke="#0284c7"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Stethoscope Chestpiece */}
        <circle cx="148" cy="44" r="9" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
        <circle cx="148" cy="44" r="5" fill="#0284c7" />
      </svg>
    </div>
  );
}

/**
 * Step 2: Guideline Match Illustration
 * Depicts open clinical guideline textbooks, AI scanning beam, and WHO/NICE evidence citations.
 */
export function Step2GuidelineIllustration({ className = '' }: StepIllustrationProps) {
  return (
    <div className={`w-full aspect-[4/3] max-w-[240px] mx-auto flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
        role="img"
        aria-label="Guideline Match Illustration"
      >
        <defs>
          <linearGradient id="bookLeft" x1="40" y1="40" x2="100" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id="bookRight" x1="100" y1="40" x2="160" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="scannerBeam" x1="100" y1="20" x2="100" y2="105" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="aiLens" x1="85" y1="15" x2="115" y2="45" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>

        {/* Ambient glow */}
        <circle cx="100" cy="75" r="55" fill="#0ea5e9" opacity="0.1" />

        {/* Open Book Cover Backdrop */}
        <path
          d="M 36 102 C 55 96, 95 96, 100 102 C 105 96, 145 96, 164 102 L 168 112 C 145 106, 105 106, 100 112 C 95 106, 55 106, 32 112 Z"
          fill="#0f766e"
        />

        {/* Left Book Page */}
        <path
          d="M 38 48 C 60 44, 92 46, 98 52 L 98 106 C 92 100, 60 98, 38 102 Z"
          fill="url(#bookLeft)"
          stroke="#cbd5e1"
          strokeWidth="1"
        />
        {/* Right Book Page */}
        <path
          d="M 162 48 C 140 44, 108 46, 102 52 L 102 106 C 108 100, 140 98, 162 102 Z"
          fill="url(#bookRight)"
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* Spine shadow */}
        <path d="M 98 52 L 100 106 L 102 52 Z" fill="#94a3b8" opacity="0.5" />

        {/* Left Page Text Lines */}
        <rect x="46" y="58" width="38" height="3" rx="1.5" fill="#0d9488" opacity="0.7" />
        <rect x="46" y="66" width="42" height="2.5" rx="1.2" fill="#94a3b8" opacity="0.4" />
        <rect x="46" y="73" width="36" height="2.5" rx="1.2" fill="#94a3b8" opacity="0.4" />
        <rect x="46" y="80" width="40" height="2.5" rx="1.2" fill="#94a3b8" opacity="0.4" />
        <rect x="46" y="87" width="28" height="2.5" rx="1.2" fill="#94a3b8" opacity="0.4" />

        {/* Right Page Text Lines */}
        <rect x="112" y="58" width="36" height="3" rx="1.5" fill="#0284c7" opacity="0.7" />
        <rect x="112" y="66" width="40" height="2.5" rx="1.2" fill="#94a3b8" opacity="0.4" />
        <rect x="112" y="73" width="42" height="2.5" rx="1.2" fill="#94a3b8" opacity="0.4" />
        <rect x="112" y="80" width="34" height="2.5" rx="1.2" fill="#94a3b8" opacity="0.4" />
        <rect x="112" y="87" width="38" height="2.5" rx="1.2" fill="#94a3b8" opacity="0.4" />

        {/* AI Scanner Light Cone */}
        <polygon points="100,24 40,95 160,95" fill="url(#scannerBeam)" />

        {/* Scanning Beam Bar */}
        <line x1="42" y1="82" x2="158" y2="82" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="3 2" />
        <circle cx="100" cy="82" r="3" fill="#38bdf8" />

        {/* Floating AI Magnifier Lens */}
        <circle cx="100" cy="24" r="14" fill="url(#aiLens)" />
        <circle cx="100" cy="24" r="10" fill="#0c4a6e" />
        {/* Sparkle icon */}
        <path
          d="M 100 18 L 101.5 22.5 L 106 24 L 101.5 25.5 L 100 30 L 98.5 25.5 L 94 24 L 98.5 22.5 Z"
          fill="#38bdf8"
        />

        {/* Citation Chip Badge on Top Right */}
        <g transform="translate(130, 24)">
          <rect width="56" height="20" rx="10" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
          <circle cx="10" cy="10" r="3" fill="#10b981" />
          <text x="18" y="13" fill="#f8fafc" fontSize="8" fontWeight="600" fontFamily="sans-serif">
            NICE / WHO
          </text>
        </g>
      </svg>
    </div>
  );
}

/**
 * Step 3: Safety Engine Illustration
 * Depicts a dual-ring medical shield, capsule pills, and allergy / interaction checkmarks.
 */
export function Step3SafetyIllustration({ className = '' }: StepIllustrationProps) {
  return (
    <div className={`w-full aspect-[4/3] max-w-[240px] mx-auto flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
        role="img"
        aria-label="Safety Engine Screening Illustration"
      >
        <defs>
          <linearGradient id="shieldFill" x1="100" y1="20" x2="100" y2="135" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f0fdf4" />
            <stop offset="100%" stopColor="#dcfce7" />
          </linearGradient>
          <linearGradient id="shieldBorder" x1="70" y1="20" x2="130" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="pillGrad" x1="120" y1="40" x2="160" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>

        {/* Ambient glow */}
        <circle cx="100" cy="75" r="55" fill="#10b981" opacity="0.12" />

        {/* Molecular Outer Rings */}
        <circle cx="100" cy="75" r="58" stroke="var(--primary)" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
        <circle cx="100" cy="75" r="48" stroke="#10b981" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />

        {/* Orbiting Satellite Node 1 */}
        <circle cx="145" cy="45" r="4" fill="#0ea5e9" />
        {/* Orbiting Satellite Node 2 */}
        <circle cx="55" cy="105" r="4" fill="#10b981" />

        {/* Medical Shield Body */}
        <path
          d="M 100 24 L 140 38 C 140 85, 100 125, 100 125 C 100 125, 60 85, 60 38 Z"
          fill="url(#shieldFill)"
          stroke="url(#shieldBorder)"
          strokeWidth="3"
        />

        {/* Inner Shield Accent */}
        <path
          d="M 100 34 L 132 46 C 132 82, 100 114, 100 114 C 100 114, 68 82, 68 46 Z"
          fill="none"
          stroke="#10b981"
          strokeWidth="1.2"
          opacity="0.4"
        />

        {/* Large Central Green Checkmark */}
        <path
          d="M 85 74 L 96 85 L 116 63"
          stroke="#059669"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Floating Capsule Pill (Top Right) */}
        <g transform="translate(132, 26) rotate(35)">
          {/* Half colored */}
          <rect x="0" y="0" width="12" height="15" rx="6" fill="#0284c7" />
          {/* Half white */}
          <rect x="0" y="12" width="12" height="15" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
          <line x1="0" y1="13.5" x2="12" y2="13.5" stroke="#94a3b8" strokeWidth="1" />
        </g>

        {/* Floating Scored Round Tablet (Bottom Left) */}
        <g transform="translate(42, 48)">
          <circle cx="12" cy="12" r="10" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1.5" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#94a3b8" strokeWidth="1.2" />
        </g>

        {/* Zero-DDI Badge Pill */}
        <g transform="translate(68, 128)">
          <rect width="64" height="18" rx="9" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
          <circle cx="10" cy="9" r="3" fill="#10b981" />
          <text x="18" y="12.5" fill="#f8fafc" fontSize="8" fontWeight="600" fontFamily="sans-serif">
            Zero DDI ✓
          </text>
        </g>
      </svg>
    </div>
  );
}

/**
 * Step 4: Doctor Signs Illustration
 * Depicts a physician digital tablet with Rx seal, stylus signature, and verified clinical stamp.
 */
export function Step4DoctorSignsIllustration({ className = '' }: StepIllustrationProps) {
  return (
    <div className={`w-full aspect-[4/3] max-w-[240px] mx-auto flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 200 150"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
        role="img"
        aria-label="Doctor Confirmation & Signs Illustration"
      >
        <defs>
          <linearGradient id="tabletGrad" x1="40" y1="20" x2="160" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="screenPad" x1="50" y1="30" x2="150" y2="120" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>
          <linearGradient id="stylusGrad" x1="140" y1="20" x2="180" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>

        {/* Ambient glow */}
        <circle cx="100" cy="75" r="55" fill="var(--primary)" opacity="0.1" />

        {/* Tablet Bezel */}
        <rect x="44" y="18" width="112" height="114" rx="10" fill="url(#tabletGrad)" stroke="#475569" strokeWidth="1.5" />

        {/* Tablet Screen Area */}
        <rect x="52" y="26" width="96" height="98" rx="6" fill="url(#screenPad)" />

        {/* Header Bar */}
        <rect x="58" y="32" width="84" height="12" rx="3" fill="#e2e8f0" />
        <circle cx="66" cy="38" r="2.5" fill="#0d9488" />
        <rect x="74" y="36.5" width="40" height="3" rx="1.5" fill="#64748b" />

        {/* Prescription Rx Symbol Badge */}
        <g transform="translate(58, 50)">
          <rect width="22" height="22" rx="4" fill="#0d9488" opacity="0.15" />
          <text x="4" y="16" fill="#0d9488" fontSize="14" fontWeight="bold" fontFamily="serif">
            Rx
          </text>
        </g>

        {/* Care Plan item lines */}
        <rect x="86" y="52" width="56" height="3.5" rx="1.7" fill="#334155" />
        <rect x="86" y="60" width="46" height="3" rx="1.5" fill="#94a3b8" />
        <rect x="86" y="67" width="50" height="3" rx="1.5" fill="#94a3b8" />

        {/* Doctor Signature Line with cursive stroke */}
        <line x1="58" y1="92" x2="142" y2="92" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3 2" />
        {/* Stylized Doctor Signature */}
        <path
          d="M 64 88 C 70 82, 74 76, 78 86 C 82 92, 86 80, 92 84 C 98 88, 102 78, 110 86 L 126 86"
          stroke="#0284c7"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Physician Verified Stamp / Seal (Bottom Right of Tablet) */}
        <g transform="translate(108, 86)">
          <circle cx="16" cy="16" r="14" fill="#10b981" opacity="0.15" stroke="#10b981" strokeWidth="1.5" strokeDasharray="2 2" />
          <circle cx="16" cy="16" r="10" fill="#10b981" />
          <path d="M 12 16 L 15 19 L 20 13" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Digital Stylus Pen Hovering */}
        <g transform="translate(125, 20) rotate(40)">
          <rect x="0" y="0" width="8" height="42" rx="4" fill="url(#stylusGrad)" />
          {/* Stylus tip */}
          <polygon points="0,42 8,42 4,50" fill="#64748b" />
          {/* Metal band */}
          <rect x="0" y="10" width="8" height="3" fill="#cbd5e1" />
        </g>
      </svg>
    </div>
  );
}
