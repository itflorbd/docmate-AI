'use client';

import React from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Stethoscope,
  BookOpen,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Lock,
} from 'lucide-react';

interface LandingCtaBannerProps {
  locale: string;
}

export function LandingCtaBanner({ locale }: LandingCtaBannerProps) {
  const t = useTranslations('landing');
  const router = useRouter();

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-2xl sm:rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 dark:from-card dark:via-muted/20 dark:to-primary/10 p-8 sm:p-12 lg:p-16 overflow-hidden shadow-sm">
          {/* Ambient Mesh Background Glows */}
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/20 dark:bg-primary/25 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-cyan-500/15 dark:bg-cyan-500/20 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          {/* Background Decorative SVG Lines */}
          <div className="absolute inset-0 opacity-10 dark:opacity-15 pointer-events-none">
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="ctaGrid" width="36" height="36" patternUnits="userSpaceOnUse">
                  <path d="M 36 0 L 0 0 0 36" fill="none" stroke="currentColor" strokeWidth="0.6" className="text-primary" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#ctaGrid)" />
            </svg>
          </div>

          <div className="relative z-10 grid lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-8 space-y-4 text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t('ctaBadge')}</span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground leading-snug">
                {t('ctaTitle')}
              </h2>

              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl font-normal leading-relaxed">
                {t('ctaSubtitle')}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-3">
                <Button
                  size="default"
                  onClick={() => router.push('/cases/new')}
                  className="h-10 px-5 font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-2xs rounded-md text-xs sm:text-sm"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>{t('ctaStartNow')}</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                  size="default"
                  variant="outline"
                  onClick={() => router.push('/library')}
                  className="h-10 px-4 font-medium border-border gap-2 bg-background/80 hover:bg-muted rounded-md text-xs sm:text-sm"
                >
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>{t('ctaExploreLibrary')}</span>
                </Button>
              </div>

              {/* Assurance Trust Pills */}
              <div className="flex flex-wrap items-center gap-4 pt-4 text-xs text-muted-foreground border-t border-border/40">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{locale === 'bn' ? 'জিরো-হ্যালুসিনেশন গ্যারান্টি' : 'Zero Hallucination'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-primary" />
                  <span>{locale === 'bn' ? 'জিরো-পিএইচআই সুরক্ষা' : 'Zero-PHI Protected'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{t('ctaDoctorDecides')}</span>
                </div>
              </div>
            </div>

            {/* Right Vector Illustration Accent */}
            <div className="lg:col-span-4 hidden lg:flex items-center justify-center">
              <div className="relative w-52 h-52">
                <svg
                  viewBox="0 0 200 200"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full drop-shadow-lg"
                >
                  <defs>
                    <radialGradient id="ctaCircleGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                      <stop offset="70%" stopColor="#0ea5e9" stopOpacity="0.1" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
                    </radialGradient>
                    <linearGradient id="ctaStetho" x1="40" y1="40" x2="160" y2="160" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="50%" stopColor="#0ea5e9" />
                      <stop offset="100%" stopColor="#0d9488" />
                    </linearGradient>
                  </defs>

                  {/* Outer Orbit */}
                  <circle cx="100" cy="100" r="85" fill="url(#ctaCircleGlow)" />
                  <circle cx="100" cy="100" r="80" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.4" />
                  <circle cx="100" cy="100" r="65" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />

                  {/* Central Medical Shield */}
                  <path
                    d="M 100 40 L 140 55 C 140 100, 100 135, 100 135 C 100 135, 60 100, 60 55 Z"
                    fill="#0f172a"
                    stroke="#0284c7"
                    strokeWidth="2.5"
                  />

                  {/* Inner Glowing Cross */}
                  <path
                    d="M 94 72 L 106 72 L 106 82 L 116 82 L 116 94 L 106 94 L 106 104 L 94 104 L 94 94 L 84 94 L 84 82 L 94 82 Z"
                    fill="url(#ctaStetho)"
                  />

                  {/* Floating Pulsing Nodes */}
                  <circle cx="100" cy="20" r="4" fill="#0ea5e9" className="animate-ping opacity-75" />
                  <circle cx="100" cy="20" r="3" fill="#0ea5e9" />

                  <circle cx="170" cy="120" r="4" fill="#10b981" />
                  <circle cx="30" cy="120" r="4" fill="var(--primary)" />

                  {/* Stethoscope Loop */}
                  <path
                    d="M 68 140 C 70 170, 130 170, 132 140"
                    stroke="#0ea5e9"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <circle cx="100" cy="172" r="7" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
                  <circle cx="100" cy="172" r="3.5" fill="#0284c7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
