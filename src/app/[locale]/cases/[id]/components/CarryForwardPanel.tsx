'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, History, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CARRY_ORDER, CarrySourceLine, formatVisitDate, useCarryLabel } from '@/components/shared/FollowUpSheet';
import type { CarryItem, HistoryUse, Reconciliation } from '@/lib/follow-up';

export interface FollowUpRecord {
  status: 'pending' | 'reconciled';
  previous_case_id: string;
  carried: { previous: { patient_code: string; visit_date: string; doctor_name: string | null; working_diagnosis: string | null }; items: CarryItem[]; history_excluded: boolean };
  reconciliation: { working_diagnosis: string; history_used: HistoryUse[]; decisions: Reconciliation['decisions'] } | null;
}

type Action = Reconciliation['decisions'][number]['action'];
const ACTIONS: Partial<Record<CarryItem['kind'], Action[]>> = {
  allergy: ['confirm', 'remove'],
  medication: ['continue', 'changed', 'stopped'],
  plan: ['still_open', 'done', 'not_relevant'],
  open_item: ['still_open', 'done', 'not_relevant'],
};
const VITALS = [
  ['blood_pressure_systolic', 'mmHg'],
  ['blood_pressure_diastolic', 'mmHg'],
  ['heart_rate', 'bpm'],
  ['temperature_celsius', '°C'],
  ['spo2_percent', '%'],
] as const;

interface Props {
  record: FollowUpRecord;
  saving: boolean;
  onSubmit: (body: Reconciliation) => void;
  onOpenPrevious: () => void;
}

/**
 * Reconciles what an earlier visit carried forward. Allergies and medicines
 * need a decision; today's diagnosis needs explicit confirmation; old
 * measurements stay historical and today's start empty.
 */
export function CarryForwardPanel({ record, saving, onSubmit, onOpenPrevious }: Props) {
  const t = useTranslations('followUp');
  const locale = useLocale();
  const items = record.carried.items;
  const [decisions, setDecisions] = useState<Record<string, { action?: Action; value?: string }>>({});
  const [complaint, setComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState(record.carried.previous.working_diagnosis ?? '');
  const [diagnosisConfirmed, setDiagnosisConfirmed] = useState(false);
  const [vitals, setVitals] = useState<Record<string, string>>({});
  const [labs, setLabs] = useState<{ name: string; value: string; unit: string }[]>([]);
  const [newAllergy, setNewAllergy] = useState('');
  const label = useCarryLabel();

  const required = items.filter((item) => item.kind === 'allergy' || item.kind === 'medication');
  const undecided = required.filter((item) => !decisions[item.id]?.action || (decisions[item.id]?.action === 'changed' && !decisions[item.id]?.value?.trim()));
  const ready = undecided.length === 0 && complaint.trim().length >= 2 && diagnosis.trim().length >= 2 && diagnosisConfirmed;

  const body = useMemo((): Reconciliation => {
    const num = (value: string | undefined) => (value && Number.isFinite(Number(value)) && value.trim() !== '' ? Number(value) : undefined);
    return {
      decisions: Object.entries(decisions)
        .filter(([, decision]) => decision.action)
        .map(([id, decision]) => ({ id, action: decision.action!, ...(decision.value?.trim() ? { value: decision.value.trim() } : {}) })),
      added_allergies: newAllergy.trim().length >= 2 ? [newAllergy.trim()] : [],
      chief_complaint: complaint.trim(),
      working_diagnosis: diagnosis.trim(),
      diagnosis_confirmed: true,
      today: {
        vitals: Object.fromEntries(VITALS.map(([key]) => [key, num(vitals[key])]).filter(([, value]) => value !== undefined)),
        ...(num(vitals.weight_kg) ? { weight_kg: num(vitals.weight_kg) } : {}),
        labs: labs.filter((lab) => lab.name.trim() && num(lab.value) !== undefined && lab.unit.trim()).map((lab) => ({ name: lab.name.trim(), value: Number(lab.value), unit: lab.unit.trim() })),
      },
    };
  }, [decisions, newAllergy, complaint, diagnosis, vitals, labs]);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-base font-bold flex items-center gap-2">
          <History className="w-4 h-4 text-primary" aria-hidden />
          {t('panelTitle')}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t('previousVisit', { code: record.carried.previous.patient_code, date: formatVisitDate(record.carried.previous.visit_date, locale) })}
        </p>
      </div>
      <Button variant="outline" className="min-h-11" onClick={onOpenPrevious}>
        {t('openPrevious')}
      </Button>
    </div>
  );

  if (record.status === 'reconciled' && record.reconciliation) {
    return (
      <div className="h-full min-h-0 overflow-y-auto space-y-3 pb-6" data-testid="carry-forward" data-status="reconciled">
        {header}
        <Alert className="border-emerald-500/50 bg-emerald-500/5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <AlertTitle>{t('reconciledTitle', { diagnosis: record.reconciliation.working_diagnosis })}</AlertTitle>
        </Alert>
        <HistoryUsedList uses={record.reconciliation.history_used} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-3 pb-6" data-testid="carry-forward" data-status="pending">
      {header}
      <Alert className="border-primary/40 bg-primary/5">
        <AlertDescription className="text-xs">{t('reconcileIntro')}</AlertDescription>
      </Alert>
      {record.carried.history_excluded && (
        <p className="text-xs text-muted-foreground" data-testid="history-excluded">
          {t('historyExcluded')}
        </p>
      )}

      {CARRY_ORDER.map((kind) => {
        const group = items.filter((item) => item.kind === kind);
        if (group.length === 0) return null;
        const historical = kind === 'lab' || kind === 'measurement';
        return (
          <Card key={kind} className="p-3 space-y-2">
            <h3 className="text-sm font-bold flex items-center gap-2">
              {t(`kind.${kind}`)}
              {historical && (
                <Badge variant="outline" className="text-[10px]">
                  {t('historical')}
                </Badge>
              )}
            </h3>
            {historical && <p className="text-xs text-muted-foreground">{t('historicalNote')}</p>}
            {group.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-2 space-y-1.5" data-testid="reconcile-item" data-kind={item.kind} data-item={item.id}>
                <p className="text-sm font-medium">
                  {label(item)}
                  {item.value && <span className="font-normal text-muted-foreground"> · {item.value}</span>}
                </p>
                <CarrySourceLine item={item} />
                {ACTIONS[item.kind] && (
                  <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
                    <legend className="sr-only">{item.label}</legend>
                    {ACTIONS[item.kind]!.map((action) => (
                      <label key={action} className="flex items-center gap-1.5 text-sm min-h-11">
                        <input
                          type="radio"
                          className="h-5 w-5"
                          name={`decision-${item.id}`}
                          checked={decisions[item.id]?.action === action}
                          onChange={() => setDecisions((prev) => ({ ...prev, [item.id]: { ...prev[item.id], action } }))}
                        />
                        {t(`action.${action}`)}
                      </label>
                    ))}
                  </fieldset>
                )}
                {decisions[item.id]?.action === 'changed' && (
                  <Input
                    aria-label={t('changedTo')}
                    placeholder={t('changedTo')}
                    value={decisions[item.id]?.value ?? ''}
                    onChange={(event) => setDecisions((prev) => ({ ...prev, [item.id]: { ...prev[item.id], value: event.target.value } }))}
                  />
                )}
              </div>
            ))}
            {kind === 'allergy' && (
              <div className="space-y-1">
                <Label htmlFor="new-allergy">{t('addAllergy')}</Label>
                <Input id="new-allergy" value={newAllergy} onChange={(event) => setNewAllergy(event.target.value)} />
              </div>
            )}
          </Card>
        );
      })}

      <Card className="p-3 space-y-3" data-testid="today-measurements">
        <h3 className="text-sm font-bold">{t('todayTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('todayNote')}</p>
        <div className="space-y-1">
          <Label htmlFor="today-complaint">{t('complaint')}</Label>
          <Input id="today-complaint" value={complaint} onChange={(event) => setComplaint(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[...VITALS, ['weight_kg', 'kg'] as const].map(([key, unit]) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`today-${key}`} className="text-xs">
                {t(`vital.${key}`)} ({unit})
              </Label>
              <Input
                id={`today-${key}`}
                type="number"
                inputMode="decimal"
                className="h-11"
                value={vitals[key] ?? ''}
                onChange={(event) => setVitals((prev) => ({ ...prev, [key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
        {labs.map((lab, index) => (
          <div key={index} className="grid grid-cols-[1fr_6rem_5rem_auto] gap-2 items-end">
            <Input aria-label={t('labName')} placeholder={t('labName')} value={lab.name} onChange={(event) => setLabs((prev) => prev.map((entry, i) => (i === index ? { ...entry, name: event.target.value } : entry)))} />
            <Input aria-label={t('labValue')} placeholder={t('labValue')} type="number" inputMode="decimal" value={lab.value} onChange={(event) => setLabs((prev) => prev.map((entry, i) => (i === index ? { ...entry, value: event.target.value } : entry)))} />
            <Input aria-label={t('labUnit')} placeholder={t('labUnit')} value={lab.unit} onChange={(event) => setLabs((prev) => prev.map((entry, i) => (i === index ? { ...entry, unit: event.target.value } : entry)))} />
            <Button variant="ghost" size="icon" aria-label={t('removeLab')} className="h-11 w-11" onClick={() => setLabs((prev) => prev.filter((_, i) => i !== index))}>
              <Trash2 className="w-4 h-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button variant="outline" className="min-h-11" onClick={() => setLabs((prev) => [...prev, { name: '', value: '', unit: '' }])}>
          <Plus className="w-4 h-4 mr-1" aria-hidden />
          {t('addLab')}
        </Button>
      </Card>

      <Card className="p-3 space-y-2" data-testid="today-diagnosis">
        <h3 className="text-sm font-bold">{t('diagnosisTitle')}</h3>
        {record.carried.previous.working_diagnosis && (
          <p className="text-xs text-muted-foreground">{t('previousDiagnosis', { diagnosis: record.carried.previous.working_diagnosis })}</p>
        )}
        <Input aria-label={t('diagnosisTitle')} value={diagnosis} onChange={(event) => { setDiagnosis(event.target.value); setDiagnosisConfirmed(false); }} />
        <Label className="flex items-center gap-2 min-h-11 font-normal">
          <Checkbox checked={diagnosisConfirmed} onCheckedChange={(value) => setDiagnosisConfirmed(value === true)} className="h-5 w-5" />
          {t('confirmDiagnosis')}
        </Label>
      </Card>

      {undecided.length > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{t('stillToDecide', { count: undecided.length })}</p>}
      <Button className="min-h-11 w-full sm:w-auto" disabled={!ready || saving} onClick={() => onSubmit(body)} data-testid="save-reconciliation">
        {t('save')}
      </Button>
    </div>
  );
}

/** Earlier-visit facts the doctor reconciled and the new plan relies on. */
export function HistoryUsedList({ uses }: { uses: HistoryUse[] }) {
  const t = useTranslations('followUp');
  const locale = useLocale();
  if (uses.length === 0) return null;
  const applied = uses.filter((use) => use.used_for !== 'historical_context');
  const history = uses.filter((use) => use.used_for === 'historical_context');
  const name = (use: HistoryUse) => (use.kind === 'measurement' ? t(`vital.${use.item_id.replace('measurement:', '')}`) : use.label);
  const source = uses[0].source;
  return (
    <Card className="p-3 space-y-2" data-testid="history-used">
      <h3 className="text-sm font-bold">{t('historyUsedTitle')}</h3>
      <p className="text-xs text-muted-foreground">{t('fromVisit', { code: source.patient_code, date: formatVisitDate(source.visit_date, locale) })}</p>
      <ul className="space-y-1 text-xs">
        {applied.map((use) => (
          <li key={`${use.item_id}-${use.used_for}`} className="rounded-md bg-muted/40 px-2 py-1.5" data-used-for={use.used_for}>
            <span className="font-semibold">{use.label}</span> · {t(`decision.${use.decision}`)} · {t(`usedFor.${use.used_for}`)}
            {use.source.case_id !== source.case_id && <> · {t('fromVisit', { code: use.source.patient_code, date: formatVisitDate(use.source.visit_date, locale) })}</>}
          </li>
        ))}
      </ul>
      {history.length > 0 && (
        <p className="text-xs text-muted-foreground" data-used-for="historical_context">
          <span className="font-semibold text-foreground">{t('historyOnly')}</span> {history.map((use) => `${name(use)} ${use.value ?? ''}`.trim()).join(' · ')}
        </p>
      )}
    </Card>
  );
}
