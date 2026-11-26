'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Compass, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TourStep {
  /** Value of the data-tour attribute on the element to highlight. */
  target: string;
  /** Key under the "tour" namespace; reads `${key}.title` and `${key}.body`. */
  key: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const CARD_W = 320;
const SEEN_KEY = 'docmate.tour.seen';

function readSeen(id: string): boolean {
  try {
    return window.localStorage.getItem(`${SEEN_KEY}.${id}`) === '1';
  } catch {
    return true;
  }
}

function markSeen(id: string) {
  try {
    window.localStorage.setItem(`${SEEN_KEY}.${id}`, '1');
  } catch {
    // Private mode: the tour simply offers itself again.
  }
}

/** Steps whose target is on the page and visible right now. */
function visibleSteps(steps: TourStep[]) {
  return steps.filter((step) => {
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!element) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  });
}

/**
 * A small "Tour" button and the walkthrough it starts. Each step highlights one
 * part of the page and explains it in a short card. Keyboard: arrows to move,
 * Esc to close. A dot shows until the tour has been opened once on this device.
 */
export function GuidedTour({ id, steps, className }: { id: string; steps: TourStep[]; className?: string }) {
  const t = useTranslations('tour');
  const format = useFormatter();
  const [active, setActive] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [fresh, setFresh] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setFresh(!readSeen(id)), 0);
    return () => window.clearTimeout(timer);
  }, [id]);

  const close = useCallback(() => {
    setActive(null);
    setRect(null);
    buttonRef.current?.focus();
  }, []);

  const start = () => {
    const available = visibleSteps(steps);
    if (available.length === 0) return;
    markSeen(id);
    setFresh(false);
    setIndex(0);
    setActive(available);
  };

  const step = active?.[index] ?? null;

  // Measure the highlighted element; follow scrolling and resizing.
  useLayoutEffect(() => {
    if (!step) return;
    const element = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!element) return;
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const measure = () => {
      const box = element.getBoundingClientRect();
      setRect({ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  useEffect(() => {
    if (!active) return;
    cardRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') setIndex((value) => Math.min(value + 1, active.length - 1));
      if (event.key === 'ArrowLeft') setIndex((value) => Math.max(value - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close, index]);

  // Card below the target when there is room, otherwise above; kept on screen.
  const cardStyle = (): React.CSSProperties => {
    if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    const width = Math.min(CARD_W, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - width - 12);
    const below = rect.top + rect.height + 12;
    if (below + 180 < window.innerHeight) return { top: below, left, width };
    return { top: Math.max(12, rect.top - 12), left, width, transform: 'translateY(-100%)' };
  };

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="outline"
        size="sm"
        onClick={start}
        className={cn('relative h-8 gap-1.5 px-2.5 text-xs font-semibold', className)}
        aria-label={t('start')}
        data-testid="tour-button"
      >
        <Compass className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span>{t('button')}</span>
        {fresh && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" aria-hidden />}
      </Button>

      {active && step && (
        <div className="fixed inset-0 z-[100]" data-testid="tour-overlay">
          {/* Dimmed page with a cut-out around the highlighted element. */}
          <div className="absolute inset-0" onClick={close} aria-hidden />
          {rect && (
            <div
              className="pointer-events-none absolute rounded-lg ring-2 ring-primary shadow-[0_0_0_9999px_rgb(0_0_0/0.55)] transition-all duration-200"
              style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
              aria-hidden
            />
          )}
          <div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-title"
            aria-describedby="tour-body"
            tabIndex={-1}
            className="absolute rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg outline-none"
            style={cardStyle()}
            data-testid="tour-card"
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold text-muted-foreground">{t('progress', { current: format.number(index + 1), total: format.number(active.length) })}</p>
              <button type="button" onClick={close} className="-m-1 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={t('close')}>
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <h2 id="tour-title" className="text-sm font-bold">
              {t(`${step.key}.title`)}
            </h2>
            <p id="tour-body" className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t(`${step.key}.body`)}
            </p>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex gap-1" aria-hidden>
                {active.map((entry, dot) => (
                  <span key={entry.key} className={cn('h-1.5 w-1.5 rounded-full', dot === index ? 'bg-primary' : 'bg-muted-foreground/30')} />
                ))}
              </div>
              <div className="flex gap-2">
                {index > 0 && (
                  <Button size="sm" variant="ghost" className="h-9" onClick={() => setIndex(index - 1)}>
                    {t('back')}
                  </Button>
                )}
                {index < active.length - 1 ? (
                  <Button size="sm" className="h-9" onClick={() => setIndex(index + 1)}>
                    {t('next')}
                  </Button>
                ) : (
                  <Button size="sm" className="h-9" onClick={close}>
                    {t('done')}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
