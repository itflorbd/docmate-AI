'use client';

import React from 'react';
import { useLocale } from 'next-intl';
import { useTextSize, TextScale } from '@/context/TextSizeContext';
import { Button } from '@/components/ui/button';
import { Type } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TextSizeControl() {
  const locale = useLocale();
  const isBn = locale === 'bn';
  const { textScale, setTextScale } = useTextSize();

  const scales: { value: TextScale; labelBn: string; labelEn: string; sizeHint: string }[] = [
    { value: '100', labelBn: '১০০%', labelEn: '100%', sizeHint: 'A' },
    { value: '115', labelBn: '১১৫%', labelEn: '115%', sizeHint: 'A+' },
    { value: '130', labelBn: '১৩০%', labelEn: '130%', sizeHint: 'A++' },
  ];

  return (
    <div
      role="group"
      aria-label={isBn ? 'লেখার আকার নির্বাচন' : 'Text size selector'}
      className="inline-flex items-center gap-1 bg-muted/80 p-1 rounded-lg border border-border/70 shadow-xs"
    >
      <div className="flex items-center gap-1 px-1.5 text-muted-foreground select-none">
        <Type className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
        <span className="text-[11px] font-semibold hidden xl:inline">
          {isBn ? 'লেখার আকার:' : 'Text:'}
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        {scales.map((s) => {
          const isActive = textScale === s.value;
          return (
            <Button
              key={s.value}
              type="button"
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTextScale(s.value)}
              className={cn(
                'h-7 px-2 text-xs font-semibold rounded transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
              )}
              aria-pressed={isActive}
              aria-label={
                isBn
                  ? `লেখার আকার ${s.labelBn} করুন`
                  : `Set text size to ${s.labelEn}`
              }
            >
              <span className="sr-only">{s.sizeHint}</span>
              {isBn ? s.labelBn : s.labelEn}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
