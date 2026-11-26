'use client';

import React from 'react';

interface RoleIllustrationProps {
  className?: string;
}

/**
 * Doctor Role Badge Illustration
 */
export function DoctorRoleIllustration({ className = '' }: RoleIllustrationProps) {
  return (
    <div className={`w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center p-2 ${className}`}>
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Doctor Silhouette */}
        <circle cx="24" cy="14" r="7" fill="var(--primary)" opacity="0.9" />
        <path d="M 12 38 C 12 28, 20 26, 24 26 C 28 26, 36 28, 36 38 Z" fill="var(--primary)" opacity="0.8" />
        {/* Stethoscope */}
        <path d="M 19 25 C 19 32, 29 32, 29 25" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="24" cy="33" r="2.5" fill="#38bdf8" />
        {/* Medical Cross Accent */}
        <circle cx="36" cy="12" r="5" fill="#10b981" />
        <path d="M 36 9 L 36 15 M 33 12 L 39 12" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/**
 * Student Role Badge Illustration
 */
export function StudentRoleIllustration({ className = '' }: RoleIllustrationProps) {
  return (
    <div className={`w-14 h-14 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center p-2 ${className}`}>
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Graduation Cap */}
        <polygon points="24,8 40,16 24,24 8,16" fill="#0284c7" />
        <path d="M 16 21 L 16 30 C 16 34, 32 34, 32 30 L 32 21" stroke="#0369a1" strokeWidth="2" fill="none" />
        <line x1="38" y1="18" x2="38" y2="28" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <circle cx="38" cy="29" r="1.5" fill="#f59e0b" />
        {/* Open Book */}
        <path d="M 12 36 C 18 33, 23 35, 24 37 C 25 35, 30 33, 36 36 L 36 43 C 30 40, 25 42, 24 44 C 23 42, 18 40, 12 43 Z" fill="#38bdf8" opacity="0.9" />
      </svg>
    </div>
  );
}

/**
 * Researcher Role Badge Illustration
 */
export function ResearcherRoleIllustration({ className = '' }: RoleIllustrationProps) {
  return (
    <div className={`w-14 h-14 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center p-2 ${className}`}>
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Microscope Body */}
        <path d="M 22 10 L 28 10 L 28 22 L 22 22 Z" fill="#0d9488" />
        <circle cx="25" cy="8" r="3" fill="#14b8a6" />
        <path d="M 20 22 L 30 22 L 32 26 L 18 26 Z" fill="#0f766e" />
        <path d="M 16 28 C 16 36, 26 40, 26 40" stroke="#0d9488" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <rect x="12" y="40" width="24" height="4" rx="2" fill="#0f766e" />
        {/* DNA strand / molecule accent */}
        <circle cx="36" cy="14" r="3" fill="#38bdf8" />
        <circle cx="40" cy="22" r="2.5" fill="#10b981" />
        <line x1="36" y1="14" x2="40" y2="22" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="2 2" />
      </svg>
    </div>
  );
}

/**
 * Admin Role Badge Illustration
 */
export function AdminRoleIllustration({ className = '' }: RoleIllustrationProps) {
  return (
    <div className={`w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center p-2 ${className}`}>
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Hospital Shield */}
        <path d="M 24 6 L 38 12 C 38 28, 24 40, 24 40 C 24 40, 10 28, 10 12 Z" fill="#f59e0b" opacity="0.8" />
        {/* Inner Shield */}
        <path d="M 24 10 L 34 15 C 34 26, 24 35, 24 35 C 24 35, 14 26, 14 15 Z" fill="#0f172a" opacity="0.9" />
        {/* Keyhole / Checkmark */}
        <circle cx="24" cy="20" r="3" fill="#fbbf24" />
        <polygon points="23,20 25,20 26,27 22,27" fill="#fbbf24" />
        {/* Security Spark */}
        <circle cx="36" cy="34" r="4" fill="#10b981" />
        <path d="M 34 34 L 35.5 35.5 L 38.5 32.5" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
