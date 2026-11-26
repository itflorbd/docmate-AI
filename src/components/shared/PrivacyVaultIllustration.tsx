'use client';

import React from 'react';

interface PrivacyVaultIllustrationProps {
  className?: string;
  locale?: string;
}

/**
 * Privacy Vault Artwork:
 * Represents the Zero-PHI Security Perimeter, cryptographic encryption shield,
 * and closed internal library boundary.
 */
export function PrivacyVaultIllustration({ className = '', locale = 'bn' }: PrivacyVaultIllustrationProps) {
  const isBn = locale === 'bn';

  return (
    <div className={`relative w-full max-w-md mx-auto aspect-[16/9] flex items-center justify-center select-none ${className}`}>
      <svg
        viewBox="0 0 360 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md"
        role="img"
        aria-label="DocMate AI Privacy & Data Protection Vault"
      >
        <defs>
          <radialGradient id="vaultGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#0d9488" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="shieldGrad" x1="180" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="50%" stopColor="#0d9488" />
            <stop offset="100%" stopColor="#042f2e" />
          </linearGradient>

          <linearGradient id="lockBody" x1="160" y1="80" x2="200" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>

          <linearGradient id="cyberLine" x1="0" y1="100" x2="360" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0" />
            <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Ambient Radial Mesh Glow */}
        <circle cx="180" cy="100" r="90" fill="url(#vaultGlow)" />

        {/* Outer Circular Security Boundary Grid */}
        <circle cx="180" cy="100" r="85" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
        <circle cx="180" cy="100" r="75" stroke="#10b981" strokeWidth="1" strokeDasharray="6 3" opacity="0.4" />

        {/* Horizontal Cyber Grid Lines */}
        <line x1="20" y1="100" x2="340" y2="100" stroke="url(#cyberLine)" strokeWidth="1" />
        <line x1="50" y1="130" x2="310" y2="130" stroke="url(#cyberLine)" strokeWidth="0.7" opacity="0.6" />
        <line x1="50" y1="70" x2="310" y2="70" stroke="url(#cyberLine)" strokeWidth="0.7" opacity="0.6" />

        {/* Central Cryptographic Shield */}
        <path
          d="M 180 25 L 235 45 C 235 110, 180 165, 180 165 C 180 165, 125 110, 125 45 Z"
          fill="url(#shieldGrad)"
          stroke="#14b8a6"
          strokeWidth="2.5"
        />

        {/* Inner Shield Contour */}
        <path
          d="M 180 37 L 223 53 C 223 104, 180 148, 180 148 C 180 148, 137 104, 137 53 Z"
          fill="none"
          stroke="#5eead4"
          strokeWidth="1"
          opacity="0.5"
        />

        {/* Vault Lock Shackle */}
        <path
          d="M 166 82 L 166 68 C 166 60, 194 60, 194 68 L 194 82"
          stroke="#e2e8f0"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Vault Lock Body */}
        <rect x="156" y="80" width="48" height="38" rx="8" fill="url(#lockBody)" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Keyhole */}
        <circle cx="180" cy="95" r="4" fill="#0f172a" />
        <polygon points="178,95 182,95 183,106 177,106" fill="#0f172a" />

        {/* Floating Security Badge 1: Zero PHI (Left) */}
        <g transform="translate(32, 50)">
          <rect width="90" height="26" rx="6" fill="#0f172a" stroke="#0ea5e9" strokeWidth="1" opacity="0.95" />
          <circle cx="12" cy="13" r="4" fill="#10b981" />
          <text x="22" y="16.5" fill="#f8fafc" fontSize="9" fontWeight="600" fontFamily="sans-serif">
            {isBn ? 'জিরো-পিএইচআই' : 'Zero-PHI Protected'}
          </text>
        </g>

        {/* Floating Security Badge 2: AES-256 (Right) */}
        <g transform="translate(238, 50)">
          <rect width="90" height="26" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="1" opacity="0.95" />
          <circle cx="12" cy="13" r="4" fill="#0ea5e9" />
          <text x="22" y="16.5" fill="#f8fafc" fontSize="9" fontWeight="600" fontFamily="sans-serif">
            {isBn ? 'সম্পূর্ণ এনক্রিপশন' : 'AES-256 / RBAC'}
          </text>
        </g>

        {/* Floating Security Badge 3: Closed Library Boundary (Bottom Center) */}
        <g transform="translate(115, 172)">
          <rect width="130" height="24" rx="12" fill="#0f172a" stroke="#0d9488" strokeWidth="1" opacity="0.95" />
          <circle cx="14" cy="12" r="3.5" fill="#14b8a6" />
          <text x="24" y="15.5" fill="#f8fafc" fontSize="9" fontWeight="600" fontFamily="sans-serif">
            {isBn ? 'অভ্যন্তরীণ লাইব্রেরি গ্যারান্টি' : 'Strict Closed Library'}
          </text>
        </g>
      </svg>
    </div>
  );
}
