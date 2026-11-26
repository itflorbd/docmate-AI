'use client';

import React, { useState } from 'react';
import { Check, HelpCircle, Scale, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CitationChip } from '@/components/shared/CitationChip';
import type { ConflictSide, FitItem, GuidelineConflict } from '@/lib/guideline-conflict';
import type { DraftCitation } from '@/lib/treatment-draft';
import type { ConflictReview } from '@/lib/treatment-draft-server';

export type ConflictDecision = ConflictReview['decision'];

interface Props {
  conflict: GuidelineConflict<DraftCitation>;
  review: ConflictReview | null;
  busy: boolean;
  readOnly: boolean;
  onReview: (input: { decision: ConflictDecision; reasoning: string; requested: string[] }) => void;
}

/**
 * Both sides of a guideline disagreement, side by side, each with its exact
 * quote and a citation that opens the full passage. The doctor decides.
 */
export function GuidelineConflictCard({ conflict, review, busy, readOnly, onReview }: Props) {
  const t = useTranslations('guidelineConflict');
  const [decision, setDecision] = useState<ConflictDecision | ''>('');
  const [reasoning, setReasoning] = useState('');
  const [requested, setRequested] = useState('');
  const requestedList = requested.split(/[,;\n]/).map((item) => item.trim()).filter((item) => item.length >= 2);
  const ready = decision !== '' && reasoning.trim().length >= 10 && (decision !== 'request_information' || requestedList.length > 0);
  const ordered = [...conflict.sides].sort((a, b) => Number(a.stance === 'advises_against') - Number(b.stance === 'advises_against'));

  return (
    <Card
      className={`p-3 space-y-3 border-2 ${conflict.blocking ? 'border-amber-500/60' : 'border-border'}`}
      data-testid="guideline-conflict"
      data-kind={conflict.kind}
      data-blocking={conflict.blocking}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="w-4 h-4 text-amber-700 dark:text-amber-400" aria-hidden />
        <h3 className="text-sm font-bold">{t('title', { name: conflict.generic_name })}</h3>
        <Badge variant="outline" className="text-[11px]">
          {t(`kind.${conflict.kind}`)}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{t(`explain.${conflict.kind}`)}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ordered.map((side) => (
          <SideCard key={`${side.citation.chunk_id}-${side.citation.quote}`} side={side} name={conflict.generic_name} />
        ))}
      </div>

      {conflict.needs.length > 0 && (
        <p className="text-xs" data-testid="conflict-needs">
          <span className="font-semibold">{t('stillNeeded')}</span> {conflict.needs.map((need) => t(`need.${need}`)).join(', ')}
        </p>
      )}

      {review && (
        <div className="rounded-md bg-muted/50 p-2 text-xs space-y-1" data-testid="conflict-review" data-decision={review.decision} data-current={review.current}>
          <p className="font-semibold">
            {t(`decision.${review.decision}`)} · {new Date(review.reviewed_at).toLocaleString()}
            {!review.current && <span className="ml-1 text-amber-700 dark:text-amber-400">{t('outdated')}</span>}
          </p>
          <p>{review.reasoning}</p>
          {review.requested_information.length > 0 && (
            <p>
              {t('requestedLabel')} {review.requested_information.join(', ')}
            </p>
          )}
        </div>
      )}

      {conflict.blocking && !readOnly && (
        <fieldset className="space-y-2" data-testid="conflict-review-form">
          <legend className="text-sm font-semibold">{t('reviewTitle')}</legend>
          {(['use_recommendation', 'do_not_use', 'request_information'] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm min-h-11">
              <input type="radio" name={`decision-${conflict.key}`} className="h-5 w-5" checked={decision === value} onChange={() => setDecision(value)} />
              {t(`decision.${value}`)}
            </label>
          ))}
          {decision === 'request_information' && (
            <div className="space-y-1">
              <Label htmlFor={`requested-${conflict.key}`}>{t('requestedLabel')}</Label>
              <Input id={`requested-${conflict.key}`} value={requested} placeholder={t('requestedPlaceholder')} onChange={(event) => setRequested(event.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor={`reasoning-${conflict.key}`}>{t('reasoning')}</Label>
            <Textarea id={`reasoning-${conflict.key}`} rows={2} value={reasoning} placeholder={t('reasoningPlaceholder')} onChange={(event) => setReasoning(event.target.value)} />
          </div>
          <Button
            className="min-h-11"
            disabled={!ready || busy}
            onClick={() => decision && onReview({ decision, reasoning: reasoning.trim(), requested: decision === 'request_information' ? requestedList : [] })}
          >
            {t('save')}
          </Button>
        </fieldset>
      )}
    </Card>
  );
}

function SideCard({ side, name }: { side: ConflictSide<DraftCitation>; name: string }) {
  const t = useTranslations('guidelineConflict');
  const who = [
    ...side.context.population.map((group) => t(`population.${group}`)),
    ...side.context.setting.map((value) => t(`setting.${value}`)),
    ...(side.context.severity ?? []).map((value) => t(`severity.${value}`)),
    ...(side.context.renal ?? []).map((value) => t(`renal.${value}`)),
    ...(side.context.region ?? []).map((region) => t('regionPrefix', { region })),
  ];
  const hasContext = who.length > 0;
  const meta = [
    side.citation.source_year ? t('year', { year: side.citation.source_year }) : null,
    side.citation.source_version ? t('version', { version: side.citation.source_version }) : null,
    side.citation.page ? t('page', { page: side.citation.page }) : null,
  ].filter(Boolean);
  return (
    <div className="rounded-md border border-border p-2 space-y-2 text-xs" data-testid="conflict-side" data-stance={side.stance} data-applies={side.fit.applies}>
      <p className="text-sm font-semibold">
        {side.stance === 'recommends' ? t('recommends', { name }) : t('advisesAgainst', { name })}
        {who.length > 0 && <span className="font-normal text-muted-foreground"> · {t('for', { who: who.join(', ') })}</span>}
      </p>
      <div className="bg-muted/40 rounded-md p-2 flex items-start gap-2">
        <CitationChip className="shrink-0 whitespace-nowrap" claim={{ ...side.citation, page: side.citation.page ?? undefined, source_year: side.citation.source_year ?? undefined }} />
        <q className="italic min-w-0">{side.citation.quote}</q>
      </div>
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground">{side.citation.source_title}</span>
        {meta.length > 0 && ` · ${meta.join(' · ')}`}
      </p>
      <ul className="space-y-0.5">
        {side.fit.matches.map((item) => (
          <li key={`m-${item.value}`} className="flex items-start gap-1">
            <Check className="w-3.5 h-3.5 mt-0.5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden />
            <span>
              <span className="sr-only">{t('matchesLabel')} </span>
              <FitText item={item} />
            </span>
          </li>
        ))}
        {side.fit.mismatches.map((item) => (
          <li key={`x-${item.value}`} className="flex items-start gap-1">
            <X className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
            <span>
              <span className="sr-only">{t('mismatchLabel')} </span>
              <FitText item={item} />
            </span>
          </li>
        ))}
        {side.fit.needs.map((need) => (
          <li key={`n-${need}`} className="flex items-start gap-1">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden />
            <span>{t('needsFact', { fact: t(`need.${need}`) })}</span>
          </li>
        ))}
        {!hasContext && <li className="text-muted-foreground">{t('noContext')}</li>}
      </ul>
    </div>
  );
}

function FitText({ item }: { item: FitItem }) {
  const t = useTranslations('guidelineConflict');
  const stated =
    item.dimension === 'population'
      ? t(`population.${item.value}`)
      : item.dimension === 'setting'
        ? t(`setting.${item.value}`)
        : item.dimension === 'severity'
          ? t(`severity.${item.value}`)
          : item.dimension === 'renal'
            ? t(`renal.${item.value}`)
            : t('regionPrefix', { region: item.value });
  const record = /^\d+$/.test(item.patient)
    ? t('patientAge', { age: item.patient })
    : item.patient.startsWith('egfr:')
      ? t('patientEgfr', { value: item.patient.slice(5) })
      : item.dimension === 'region'
        ? t('patientRegion', { region: item.patient })
        : t(`patient.${item.patient}`);
  return <>{t('fit', { stated, record })}</>;
}
