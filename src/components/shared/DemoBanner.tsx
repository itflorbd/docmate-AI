'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { KeyRound, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface DemoBannerProps {
  variant?: 'inline' | 'header' | 'prominent';
  className?: string;
}

export function DemoBanner({ variant = 'header', className = '' }: DemoBannerProps) {
  const locale = useLocale();
  const isBn = locale === 'bn';

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || true; // Active in demo build

  if (!isDemo) return null;

  if (variant === 'prominent') {
    return (
      <div
        className={`bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 rounded-lg p-3 text-sm flex items-center justify-between gap-2 ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 font-medium">
          <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {isBn ? 'ডেমো মোড সক্রিয়: ওটিপি ' : 'Demo Mode Active: OTP '}
            <strong className="font-mono text-base bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-300">
              123456
            </strong>
          </span>
        </div>
        <Badge variant="outline" className="text-[11px] border-amber-500/40 text-amber-800 dark:text-amber-300">
          {isBn ? 'পরীক্ষামূলক' : 'Demo'}
        </Badge>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 ${className}`}
      role="status"
      title={isBn ? 'সকল মোবাইল নম্বরের জন্য ওটিপি ১২৩৪৫৬' : 'Universal OTP 123456 for all phones in demo mode'}
    >
      <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-pulse shrink-0" />
      <span>{isBn ? 'ডেমো মোড: ওটিপি ১২৩৪৫৬' : 'Demo Mode: OTP 123456'}</span>
    </div>
  );
}
