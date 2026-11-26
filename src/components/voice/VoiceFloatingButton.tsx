'use client';

import React from 'react';
import { useVoice } from '@/context/VoiceContext';
import { DocMateAvatar } from './DocMateAvatar';
import { useLocale } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import { Mic, Volume2 } from 'lucide-react';

export function VoiceFloatingButton() {
  const { isOpen, toggleVoicePanel, state, amplitude, avatarVisible } = useVoice();
  const locale = useLocale();
  const pathname = usePathname();

  const isCaseWorkspace = Boolean(
    pathname &&
    (/^\/cases\/[^/]+$/i.test(pathname) || /^\/[a-z]{2,5}\/cases\/[^/]+$/i.test(pathname)) &&
    !pathname.endsWith('/cases/new')
  );

  if (!isCaseWorkspace || isOpen) return null; // Only available inside specific case workspace; hidden while panel is open

  return (
    <div
      data-tour="voice-floating-btn"
      className="fixed bottom-12 right-4 sm:bottom-10 sm:right-6 z-40 flex items-center gap-2"
    >
      <button
        type="button"
        onClick={toggleVoicePanel}
        aria-label={locale === 'bn' ? 'ভয়েস সহকারী ডকমেট খুলুন' : 'Open DocMate Voice Assistant'}
        className="group relative flex items-center justify-center p-1.5 sm:p-2 rounded-full bg-card/90 backdrop-blur-md border-2 border-primary/40 shadow-xl hover:border-primary hover:shadow-primary/25 transition-all duration-300 active:scale-95"
      >
        {/* Subtle Pulse ring when in voice mode */}
        <span className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse pointer-events-none" />

        {avatarVisible ? (
          <DocMateAvatar
            state={state}
            amplitude={amplitude}
            size="sm"
            showBadge
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
            {state === 'speaking' ? <Volume2 className="w-5 h-5 animate-bounce" /> : <Mic className="w-5 h-5" />}
          </div>
        )}

        <span className="hidden md:inline-flex items-center text-xs font-semibold px-2 py-0.5 text-foreground group-hover:text-primary transition-colors">
          {locale === 'bn' ? 'ডকমেট ভয়েস' : 'DocMate Voice'}
        </span>
      </button>
    </div>
  );
}
