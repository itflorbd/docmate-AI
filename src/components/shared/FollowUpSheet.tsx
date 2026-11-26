'use client';

import React, { useEffect, useState } from 'react';
import { History, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { CarryItem, CarryKind } from '@/lib/follow-up';
import type { CarryPreview } from '@/lib/follow-up-server';

export const CARRY_ORDER: CarryKind[] = ['diagnosis', 'allergy', 'medication', 'lab', 'measurement', 'plan', 'open_item'];

export function formatVisitDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Label of a carried fact; measurement names are translated, recorded text is shown as written. */
export function useCarryLabel() {
  const t = useTranslations('followUp');
  return (item: CarryItem) => (item.kind === 'measurement' ? t(`vital.${item.id.replace('measurement:', '')}`) : item.label);
}

/** One carried fact with its visit date and where it was recorded. */
export function CarrySourceLine({ item }: { item: CarryItem }) {
  const t = useTranslations('followUp');
  const locale = useLocale();
  return (
    <span className="text-[11px] text-muted-foreground">
      {t('source', { date: formatVisitDate(item.source.visit_date, locale), code: item.source.patient_code, field: t(`field.${item.source.field}`) })}
      {item.source.doctor_name ? ` · ${item.source.doctor_name}` : ''}
    </span>
  );
}

/**
 * Preview of what an earlier visit can carry forward. Nothing is written until
 * the doctor creates the follow-up visit.
 */
export function FollowUpSheet({ priorCaseId, open, onOpenChange }: { priorCaseId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] overflow-y-auto" data-testid="follow-up-sheet">
        {/* Mounted per opening, so each opening gets a fresh preview and request key. */}
        {open && priorCaseId && <FollowUpSheetBody priorCaseId={priorCaseId} onDone={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  );
}

function FollowUpSheetBody({ priorCaseId, onDone }: { priorCaseId: string; onDone: () => void }) {
  const t = useTranslations('followUp');
  const locale = useLocale();
  const router = useRouter();
  const [preview, setPreview] = useState<CarryPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const label = useCarryLabel();
  // One key per opening of the sheet: a double click or retry returns the same visit.
  const [requestKey] = useState(() => crypto.randomUUID().replace(/-/g, ''));

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cases/${priorCaseId}/follow-up`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('loadFailed'));
        if (!cancelled) setPreview(data);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : t('loadFailed')));
    return () => {
      cancelled = true;
    };
  }, [priorCaseId, t]);

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/cases/${priorCaseId}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_key: requestKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('createFailed'));
      if (!data.created) toast.info(t('alreadyStarted'));
      onDone();
      router.push(`/${locale}/cases/${data.case_id}?tab=followup`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t('createFailed'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-4 h-4 text-primary" aria-hidden />
            {t('sheetTitle')}
          </SheetTitle>
          <SheetDescription>{t('sheetDescription')}</SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-4 text-sm">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {!preview && !error && <Skeleton className="h-40 w-full" />}
          {preview && (
            <>
              <div className="rounded-md bg-muted/50 p-2 text-xs" data-testid="follow-up-previous">
                <p className="font-semibold">
                  {t('previousVisit', { code: preview.previous.patient_code, date: formatVisitDate(preview.previous.visit_date, locale) })}
                </p>
                {preview.previous.doctor_name && <p className="text-muted-foreground">{preview.previous.doctor_name}</p>}
              </div>
              {preview.history_excluded && (
                <Alert>
                  <AlertDescription className="text-xs" data-testid="history-excluded">
                    {t('historyExcluded')}
                  </AlertDescription>
                </Alert>
              )}
              {preview.items.length === 0 && <p className="text-muted-foreground">{t('nothingToCarry')}</p>}
              {CARRY_ORDER.map((kind) => {
                const items = preview.items.filter((item) => item.kind === kind);
                if (items.length === 0) return null;
                return (
                  <section key={kind} className="space-y-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                      {t(`kind.${kind}`)}
                      {(kind === 'lab' || kind === 'measurement') && (
                        <Badge variant="outline" className="text-[10px] normal-case">
                          {t('historical')}
                        </Badge>
                      )}
                    </h3>
                    <ul className="space-y-1.5">
                      {items.map((item) => (
                        <li key={item.id} className="rounded-md border border-border p-2" data-testid="carry-item" data-kind={item.kind}>
                          <p className="font-medium">
                            {label(item)}
                            {item.value && <span className="font-normal text-muted-foreground"> · {item.value}</span>}
                          </p>
                          <CarrySourceLine item={item} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              <p className="text-xs text-muted-foreground">{t('nextStep')}</p>
            </>
          )}
        </div>

        <SheetFooter className="px-4">
          <Button className="min-h-11 w-full" disabled={!preview || creating} onClick={() => void create()} data-testid="create-follow-up">
            {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />}
            {t('create')}
          </Button>
        </SheetFooter>
    </>
  );
}
