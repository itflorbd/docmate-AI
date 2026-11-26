'use client';

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface SafetyNotice {
  id: string;
  title: string;
  body: string;
  severity: string;
}

/** Medicine recalls and warnings: the most urgent one shown, the rest one tap away. */
export function SafetyNoticesBanner({ notices, compact = false }: { notices: SafetyNotice[]; compact?: boolean }) {
  const t = useTranslations('notices');
  const [expanded, setExpanded] = useState(false);
  if (notices.length === 0) return null;
  const sorted = [...notices].sort((a, b) => Number(b.severity === 'critical_recall') - Number(a.severity === 'critical_recall'));
  const visible = expanded ? sorted : sorted.slice(0, 1);

  // One line with the most urgent notice; the rest open on demand.
  if (compact && !expanded) {
    const top = sorted[0];
    const recall = top.severity === 'critical_recall';
    return (
      <section
        aria-label={t('title')}
        data-testid="safety-notices"
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${recall ? 'border-destructive/50 bg-destructive/5' : 'border-amber-500/50 bg-amber-500/5'}`}
      >
        <AlertTriangle className={`h-4 w-4 shrink-0 ${recall ? 'text-destructive' : 'text-amber-600'}`} aria-hidden />
        <Badge variant={recall ? 'destructive' : 'outline'} className="shrink-0 text-[10px]">
          {recall ? t('recall') : t('warning')}
        </Badge>
        <p className="min-w-0 flex-1 truncate" title={`${top.title}. ${top.body}`}>
          <span className="font-semibold text-foreground">{top.title}</span>
          <span className="text-muted-foreground"> · {top.body}</span>
        </p>
        {sorted.length > 1 && (
          <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={() => setExpanded(true)} aria-expanded={false}>
            {t('more', { count: sorted.length - 1 })}
          </Button>
        )}
      </section>
    );
  }

  return (
    <section aria-label={t('title')} className="space-y-2" data-testid="safety-notices">
      {visible.map((notice) => {
        const recall = notice.severity === 'critical_recall';
        return (
          <div
            key={notice.id}
            className={`p-3 rounded-xl border flex items-start gap-3 text-sm ${
              recall ? 'border-destructive/50 bg-destructive/5' : 'border-amber-500/50 bg-amber-500/5'
            }`}
          >
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${recall ? 'text-destructive' : 'text-amber-600'}`} aria-hidden />
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">{notice.title}</span>
                <Badge variant={recall ? 'destructive' : 'outline'} className="text-[10px]">
                  {recall ? t('recall') : t('warning')}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">{notice.body}</p>
            </div>
          </div>
        );
      })}
      {sorted.length > 1 && (
        <Button variant="ghost" size="sm" className="min-h-11 text-xs" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? t('less') : t('more', { count: sorted.length - 1 })}
        </Button>
      )}
    </section>
  );
}
