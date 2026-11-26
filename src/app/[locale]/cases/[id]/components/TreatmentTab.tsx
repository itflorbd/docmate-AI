'use client';

import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, FileText, Info, Loader2, Pill, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CitationChip } from '@/components/shared/CitationChip';
import type { ConflictReview } from '@/lib/treatment-draft-server';
import { GuidelineConflictCard, type ConflictDecision } from './GuidelineConflictCard';
import { HistoryUsedList } from './CarryForwardPanel';
import type { HistoryUse } from '@/lib/follow-up';
import type { DecisionAlert } from '@/lib/prescription-safety';
import type { DraftOption, TreatmentDraft } from '@/lib/treatment-draft';

export interface SafetyInputsForm {
  noKnownAllergies: boolean;
  isPregnant: '' | 'yes' | 'no';
  weightKg: string;
  careSetting: '' | 'outpatient' | 'inpatient' | 'intensive_care';
}

interface TreatmentTabProps {
  confirmedDiagnosis?: string;
  draft: TreatmentDraft | null;
  syntheticOnly: boolean;
  loading: boolean;
  approving: boolean;
  approved: boolean;
  /** Combined-regimen safety alerts returned by the server when approval was refused. */
  regimenAlerts: DecisionAlert[];
  selected: Set<string>;
  overrideReasons: Record<string, string>;
  note: string;
  onBuild: () => void;
  onOpenConfirmDiag: () => void;
  onToggle: (drugId: string) => void;
  onReason: (alertId: string, reason: string) => void;
  onNote: (note: string) => void;
  onApprove: () => void;
  onRecordInputs: (inputs: SafetyInputsForm) => void;
  onOpenReport: () => void;
  conflictReviews: Record<string, ConflictReview>;
  /** Earlier-visit facts the doctor reconciled and this draft relies on. */
  historyUsed: HistoryUse[];
  reviewingConflict: boolean;
  onReviewConflict: (key: string, input: { decision: ConflictDecision; reasoning: string; requested: string[] }) => void;
}

const safetyTone = {
  clear: 'border-emerald-500/40 bg-emerald-500/5',
  needs_override: 'border-amber-500/60 bg-amber-500/5',
  blocked: 'border-destructive/70 bg-destructive/5',
} as const;

/**
 * Draft review: options with formulary dosing, a verified quote and the
 * server's safety result. The doctor selects, gives reasons and approves.
 */
export function TreatmentTab(props: TreatmentTabProps) {
  const t = useTranslations('treatmentDraft');
  const { draft } = props;

  if (!props.confirmedDiagnosis) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center gap-3">
        <Stethoscope className="w-6 h-6 text-primary" aria-hidden />
        <p className="text-sm font-semibold">{t('needDiagnosis')}</p>
        <Button onClick={props.onOpenConfirmDiag} className="min-h-11">
          {t('setDiagnosis')}
        </Button>
      </Card>
    );
  }

  const selectedOptions = draft?.options.filter((option) => props.selected.has(option.drug_id)) ?? [];
  const pending = uniqueAlerts([...selectedOptions.flatMap((option) => option.safety.alerts), ...props.regimenAlerts]).filter(
    (alert) => alert.stop === 'override' && !alert.override,
  );
  const blockedSelected = selectedOptions.some((option) => option.safety.status === 'blocked');
  // A disputed medicine can be chosen only after a current "use" decision.
  const cleared = (option: DraftOption) => {
    if (!option.dispute) return true;
    const review = props.conflictReviews[option.dispute.key];
    return Boolean(review?.current && review.decision === 'use_recommendation');
  };
  const unclearedSelected = selectedOptions.some((option) => !cleared(option));
  const reasonsDone = pending.every((alert) => (props.overrideReasons[alert.id] ?? '').trim().length >= 10);
  const canApprove = draft?.status === 'proposed' && selectedOptions.length > 0 && !blockedSelected && !unclearedSelected && reasonsDone && !props.approving;
  const needsCareSetting = (draft?.conflicts ?? []).some((conflict) => conflict.needs.includes('care_setting'));

  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-3 pb-6" data-testid="treatment-draft" data-status={draft?.status ?? 'none'}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">{t('title')}</h2>
          <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          {props.syntheticOnly && (
            <Badge variant="outline" className="mt-1 text-[11px]">
              {t('syntheticOnly')}
            </Badge>
          )}
        </div>
        <Button onClick={props.onBuild} disabled={props.loading} variant={draft ? 'outline' : 'default'} className="min-h-11">
          {props.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : <Pill className="w-4 h-4 mr-2" aria-hidden />}
          {props.loading ? t('building') : draft ? t('regenerate') : t('generate')}
        </Button>
      </div>

      {draft && <HistoryUsedList uses={props.historyUsed} />}

      {draft?.status === 'urgent_review_required' && (
        <Alert variant="destructive">
          <AlertOctagon className="w-4 h-4" />
          <AlertTitle>{t('urgentFirst')}</AlertTitle>
        </Alert>
      )}

      {draft && draft.status !== 'urgent_review_required' && draft.follow_up_questions.length > 0 && (
        <Alert className={draft.status === 'insufficient_evidence' ? 'border-primary/40 bg-primary/5' : ''} data-testid="draft-follow-up">
          <Info className="w-4 h-4" />
          <AlertTitle>{draft.status === 'insufficient_evidence' ? t('noEvidenceTitle') : t('questions')}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1 text-sm">
              {draft.follow_up_questions.map((question, idx) => (
                <li key={`${question.code}-${idx}`} data-code={question.code}>
                  {t(`followUpQuestion.${question.code}`, question.params)}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {draft && (needsCareSetting || draft.missing_information.some((key) => ['allergy_status', 'pregnancy_status', 'weight'].includes(key))) && (
        <SafetyInputs missing={[...draft.missing_information, ...(needsCareSetting ? ['care_setting'] : [])]} onSave={props.onRecordInputs} busy={props.loading} />
      )}

      {draft?.options.map((option) => (
        <OptionCard
          key={option.drug_id}
          option={option}
          checked={props.selected.has(option.drug_id)}
          disabled={draft.status !== 'proposed' || option.safety.status === 'blocked' || props.approved || !cleared(option)}
          onToggle={() => props.onToggle(option.drug_id)}
        />
      ))}

      {draft?.conflicts.map((conflict) => (
        <GuidelineConflictCard
          key={conflict.key}
          conflict={conflict}
          review={props.conflictReviews[conflict.key] ?? null}
          busy={props.reviewingConflict}
          readOnly={props.approved}
          onReview={(input) => props.onReviewConflict(conflict.key, input)}
        />
      ))}

      {draft && draft.excluded.length > 0 && (
        <details className="rounded-lg border border-border p-3 text-sm">
          <summary className="cursor-pointer font-semibold">
            {t('excludedTitle')} ({draft.excluded.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {draft.excluded.map((entry) => (
              <li key={entry.generic_name} data-reason-code={entry.reason.code}>
                <span className="font-semibold text-foreground">{entry.generic_name}</span> — {t(`excludedReason.${entry.reason.code}`, entry.reason.params)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {pending.length > 0 && !props.approved && (
        <Card className="p-3 space-y-3 border-amber-500/60" data-testid="override-reasons">
          {pending.map((alert) => (
            <div key={alert.id} className="space-y-1">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden />
                {alert.title}
              </p>
              <p className="text-xs text-muted-foreground">{alert.description}</p>
              <Textarea
                rows={2}
                aria-label={alert.title}
                placeholder={t('reasonPlaceholder')}
                value={props.overrideReasons[alert.id] ?? ''}
                onChange={(event) => props.onReason(alert.id, event.target.value)}
              />
            </div>
          ))}
        </Card>
      )}

      {draft?.status === 'proposed' && !props.approved && (
        <Card className="p-3 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="treatment-note">{t('note')}</Label>
            <Textarea id="treatment-note" rows={2} value={props.note} onChange={(event) => props.onNote(event.target.value)} />
          </div>
          {selectedOptions.length === 0 && <p className="text-xs text-muted-foreground">{t('needOne')}</p>}
          <Button onClick={props.onApprove} disabled={!canApprove} className="min-h-11 w-full sm:w-auto">
            {props.approving ? t('approving') : t('approve')}
          </Button>
        </Card>
      )}

      {props.approved && (
        <Alert className="border-emerald-500/50 bg-emerald-500/5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <AlertTitle>{t('approved')}</AlertTitle>
          <AlertDescription>
            <Button variant="outline" className="min-h-11 mt-2" onClick={props.onOpenReport}>
              <FileText className="w-4 h-4 mr-2" aria-hidden />
              {t('openReport')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function uniqueAlerts(alerts: DecisionAlert[]): DecisionAlert[] {
  return [...new Map(alerts.map((alert) => [alert.id, alert])).values()];
}

function OptionCard({ option, checked, disabled, onToggle }: { option: DraftOption; checked: boolean; disabled: boolean; onToggle: () => void }) {
  const t = useTranslations('treatmentDraft');
  const tc = useTranslations('guidelineConflict');
  const status = option.safety.status;
  return (
    <Card className={`p-3 space-y-2 border-2 ${safetyTone[status]}`} data-testid="draft-option" data-safety={status} data-disputed={Boolean(option.dispute)} data-drug={option.generic_name}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={`opt-${option.drug_id}`}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onToggle}
          aria-label={`${t('select')}: ${option.generic_name}`}
          className="mt-1 h-5 w-5"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <label htmlFor={`opt-${option.drug_id}`} className="flex flex-wrap items-center gap-2 cursor-pointer">
            <span className="font-bold text-sm">{option.generic_name}</span>
            <span className="text-xs text-muted-foreground">{option.drug_class}</span>
            {option.preferred && <Badge className="text-[10px]">{t('preferred')}</Badge>}
            {option.dispute && (
              <Badge variant="outline" className="text-[10px] border-amber-500/60" data-testid="option-disputed">
                {tc('disputedBadge')}
              </Badge>
            )}
          </label>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs">
            <div>
              <dt className="text-muted-foreground">{t('dose')}</dt>
              <dd className="font-medium">{option.dose_text}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('frequency')}</dt>
              <dd className="font-medium">
                {option.frequency} · {t('duration', { days: option.duration_days })}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('route')}</dt>
              <dd className="font-medium capitalize">{option.route}</dd>
            </div>
          </dl>
          {option.max_daily_dose && <p className="text-[11px] text-muted-foreground">{t('maxDaily', { dose: option.max_daily_dose })}</p>}
          {option.condition && <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t('condition', { condition: option.condition })}</p>}
          <div className="text-xs bg-muted/40 rounded-md p-2 flex items-start gap-2" data-testid="option-citation">
            <CitationChip claim={{ ...option.citation, page: option.citation.page ?? undefined, source_year: option.citation.source_year ?? undefined }} />
            <span className="min-w-0">
              <span className="block text-[11px] text-muted-foreground">{t('evidence')}</span>
              <q className="italic">{option.citation.quote}</q>
            </span>
          </div>
          <p
            className={`text-xs font-bold ${status === 'blocked' ? 'text-destructive' : status === 'needs_override' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}
            data-testid="option-safety"
          >
            {status === 'blocked' ? t('safetyBlocked') : status === 'needs_override' ? t('safetyOverride') : t('safetyClear')}
          </p>
          {option.safety.alerts.map((alert) => (
            <p key={alert.id} className={`text-xs ${alert.stop === 'hard' ? 'text-destructive font-semibold' : 'text-foreground/80'}`}>
              • {alert.title}
            </p>
          ))}
        </div>
      </div>
    </Card>
  );
}

function SafetyInputs({ missing, onSave, busy }: { missing: string[]; onSave: (inputs: SafetyInputsForm) => void; busy: boolean }) {
  const t = useTranslations('treatmentDraft');
  const tc = useTranslations('guidelineConflict');
  const [form, setForm] = useState<SafetyInputsForm>({ noKnownAllergies: false, isPregnant: '', weightKg: '', careSetting: '' });
  const has = (key: string) => missing.includes(key);
  const ready =
    (has('allergy_status') && form.noKnownAllergies) ||
    (has('pregnancy_status') && form.isPregnant !== '') ||
    (has('weight') && Number(form.weightKg) > 0) ||
    (has('care_setting') && form.careSetting !== '');
  return (
    <Card className="p-3 space-y-3" data-testid="safety-inputs">
      <p className="text-sm font-bold">{t('recordInputsTitle')}</p>
      {has('allergy_status') && (
        <Label className="flex items-center gap-2 min-h-11 font-normal">
          <Checkbox checked={form.noKnownAllergies} onCheckedChange={(value) => setForm({ ...form, noKnownAllergies: value === true })} className="h-5 w-5" />
          {t('noAllergies')}
        </Label>
      )}
      {has('pregnancy_status') && (
        <fieldset className="flex items-center gap-4 text-sm min-h-11">
          <legend className="sr-only">{t('pregnant')}</legend>
          <span aria-hidden>{t('pregnant')}</span>
          {(['yes', 'no'] as const).map((value) => (
            <label key={value} className="flex items-center gap-1.5">
              <input type="radio" name="draft-pregnant" className="h-5 w-5" checked={form.isPregnant === value} onChange={() => setForm({ ...form, isPregnant: value })} />
              {t(value)}
            </label>
          ))}
        </fieldset>
      )}
      {has('weight') && (
        <Label className="flex items-center gap-2 font-normal">
          {t('weight')}
          <Input type="number" inputMode="decimal" min={1} className="h-11 w-28" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} />
        </Label>
      )}
      {has('care_setting') && (
        <fieldset className="flex flex-wrap items-center gap-4 text-sm min-h-11" data-testid="care-setting">
          <legend className="sr-only">{t('careSetting')}</legend>
          <span aria-hidden>{t('careSetting')}</span>
          {(['outpatient', 'inpatient', 'intensive_care'] as const).map((value) => (
            <label key={value} className="flex items-center gap-1.5">
              <input type="radio" name="draft-care-setting" className="h-5 w-5" checked={form.careSetting === value} onChange={() => setForm({ ...form, careSetting: value })} />
              {tc(`setting.${value}`)}
            </label>
          ))}
        </fieldset>
      )}
      <Button className="min-h-11" disabled={busy || !ready} onClick={() => onSave(form)}>
        {t('saveInputs')}
      </Button>
    </Card>
  );
}
