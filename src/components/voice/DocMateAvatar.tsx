'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Image from 'next/image';
import { VoiceState } from '@/lib/voice/types';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Hand, HelpCircle, Loader2, Mic, Sparkles, Volume2 } from 'lucide-react';

export type DocMateReaction =
  | 'greeting'
  | 'listening'
  | 'understood'
  | 'thinking'
  | 'explaining'
  | 'concern'
  | 'apology'
  | 'happy'
  | 'task_done'
  | 'idle'
  | VoiceState;

export interface DocMateAvatarProps {
  state?: DocMateReaction;
  reaction?: DocMateReaction;
  amplitude?: number; // 0.0 to 1.0 (audio volume level for dynamic mouth aperture)
  size?: 'sm' | 'md' | 'lg';
  reducedMotion?: boolean;
  className?: string;
  onClick?: () => void;
  showBadge?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-10 h-10', // 40px
  md: 'w-20 h-20', // 80px
  lg: 'w-44 h-44 sm:w-52 sm:h-52', // ~180px - 210px
};

const STATE_ICONS: Record<string, React.ReactNode> = {
  greeting: <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />,
  listening: <Mic className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 animate-pulse" />,
  transcribing: <Loader2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 animate-spin" />,
  thinking: <Loader2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 animate-spin" />,
  speaking: <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-bounce" />,
  explaining: <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />,
  understood: <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />,
  apology: <Hand className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />,
  alert: <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
  concern: <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
  happy: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
  task_done: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
  confused: <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
};

export function DocMateAvatar({
  state: propState = 'idle',
  reaction,
  amplitude = 0,
  size = 'md',
  reducedMotion: propReducedMotion,
  className,
  onClick,
  showBadge = false,
}: DocMateAvatarProps) {
  const targetState = reaction || propState;
  const [displayedState, setDisplayedState] = useState<DocMateReaction>(targetState);
  const lastStateChangeRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [systemReducedMotion, setSystemReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  const [blink, setBlink] = useState(false);

  // Rate-limit expression changes: at most one change every 3 seconds (unless urgent alert or immediate speech)
  useEffect(() => {
    const isUrgentOrImmediate =
      targetState === 'alert' ||
      targetState === 'concern' ||
      targetState === 'listening' ||
      targetState === 'speaking' ||
      targetState === 'idle';

    const now = Date.now();
    const elapsed = now - lastStateChangeRef.current;

    if (isUrgentOrImmediate || elapsed >= 3000) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setDisplayedState(targetState);
      lastStateChangeRef.current = now;
    } else {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setDisplayedState(targetState);
        lastStateChangeRef.current = Date.now();
      }, 3000 - elapsed);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [targetState]);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setSystemReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isReducedMotion = propReducedMotion ?? systemReducedMotion;

  // Periodic blinking effect for natural life (every 3.8s, disabled in reduced motion)
  useEffect(() => {
    if (isReducedMotion || displayedState === 'speaking' || displayedState === 'alert' || displayedState === 'concern') {
      return;
    }
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 180);
    }, 3800);
    return () => clearInterval(interval);
  }, [isReducedMotion, displayedState]);

  // Asset path determination across all 9 persona reaction states
  const avatarSrc = useMemo(() => {
    switch (displayedState) {
      case 'greeting':
        return '/avatar/docmate-greeting.svg';
      case 'listening':
        return '/avatar/docmate-listening.svg';
      case 'understood':
        return '/avatar/docmate-understood.svg';
      case 'transcribing':
      case 'thinking':
        return '/avatar/docmate-thinking.svg';
      case 'speaking':
        return '/avatar/docmate-speaking.svg';
      case 'explaining':
        return '/avatar/docmate-explaining.svg';
      case 'alert':
      case 'concern':
      case 'error':
        return '/avatar/docmate-alert.svg';
      case 'apology':
        return '/avatar/docmate-apology.svg';
      case 'happy':
      case 'task_done':
        return '/avatar/docmate-happy.svg';
      case 'confused':
        return '/avatar/docmate-confused.svg';
      case 'idle':
      default:
        return '/avatar/docmate-idle.svg';
    }
  }, [displayedState]);

  // Compute dynamic mouth scale based on amplitude during speech
  const mouthScale = useMemo(() => {
    if (displayedState !== 'speaking' || isReducedMotion) return 1;
    // Map 0..1 to scale 1.0 to 1.7
    return 1 + Math.min(1.0, Math.max(0.0, amplitude)) * 0.7;
  }, [displayedState, amplitude, isReducedMotion]);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        'relative select-none flex items-center justify-center rounded-full transition-transform duration-200',
        onClick && 'cursor-pointer hover:scale-105 active:scale-95 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
        SIZE_CLASSES[size],
        className
      )}
      aria-label={`DocMate AI Avatar (${displayedState})`}
    >
      {/* Outer Pulse Ring for Listening State */}
      {displayedState === 'listening' && !isReducedMotion && (
        <span className="absolute inset-0 rounded-full animate-ping bg-teal-500/25 pointer-events-none" />
      )}

      {/* Speaking Sound Glow */}
      {displayedState === 'speaking' && !isReducedMotion && (
        <span
          className="absolute -inset-1.5 rounded-full bg-blue-500/20 blur-xs transition-opacity duration-150 pointer-events-none"
          style={{ opacity: 0.3 + Math.min(1, amplitude) * 0.7 }}
        />
      )}

      {/* Main Avatar Vector Image */}
      <div
        className={cn(
          'relative w-full h-full rounded-full overflow-hidden shadow-xs transition-transform duration-200',
          blink && !isReducedMotion && 'scale-y-95',
          displayedState === 'thinking' && !isReducedMotion && 'animate-pulse',
          (displayedState === 'alert' || displayedState === 'concern') && 'ring-2 ring-amber-500/80 shadow-amber-500/20'
        )}
        style={{
          transform: displayedState === 'speaking' && !isReducedMotion ? `scale(${mouthScale})` : undefined,
        }}
      >
        <Image
          src={avatarSrc}
          alt={`DocMate AI Assistant - ${displayedState}`}
          fill
          sizes="(max-width: 768px) 160px, 210px"
          priority
          className="object-contain"
        />
      </div>

      {/* State Badge Pill */}
      {showBadge && STATE_ICONS[displayedState] && (
        <div className="absolute -bottom-1 -right-1 p-1 bg-background/95 rounded-full border border-border shadow-xs flex items-center justify-center">
          {STATE_ICONS[displayedState]}
        </div>
      )}
    </div>
  );
}
