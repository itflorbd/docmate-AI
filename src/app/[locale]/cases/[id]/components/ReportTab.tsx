'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CitationChip } from '@/components/shared/CitationChip';
import { PatientCase, StructuredPatientInput } from '@/types';
import { Printer, FileText, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { DraftCitation } from '@/lib/treatment-draft';

export interface TreatmentApproval {
  diagnosis: string;
  note: string | null;
  current: boolean;
  approved_at?: string;
  items: { drug_id: string; generic_name: string; dose_text: string; route: string; frequency: string; duration_days: number; citation: DraftCitation }[];
  overrides: { alert_id: string; title: string; reason: string }[];
  warnings: string[];
}

interface ReportTabProps {
  caseData: PatientCase;
  approval: TreatmentApproval | null;
  officialIssuance: boolean;
}

/** Report preview. A draft until an official prescription is issued under an approved release. */
export function ReportTab({ caseData, approval, officialIssuance }: ReportTabProps) {
  const t = useTranslations('report');
  const tCommon = useTranslations('common');
  const td = useTranslations('treatmentDraft');
  const format = useFormatter();
  const input = ((caseData.structured_input || (caseData as unknown as Record<string, unknown>).structuredInput) || {}) as unknown as StructuredPatientInput;
  const patientCode = caseData.patient_code || (caseData as unknown as Record<string, unknown>).patientCode as string;
  const vitals = input.vitals || {};
  const items = approval?.current ? approval.items : [];

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden space-y-2">
      {/* Top action bar (hidden on print) */}
      <div className="flex items-center justify-between no-print bg-card p-2 sm:p-2.5 rounded-lg border border-border/80 shadow-2xs shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {t('draftPreview')}
          </span>
        </div>
        <Button disabled={!officialIssuance} size="sm" className="gap-1.5 text-xs font-semibold min-h-9" title={officialIssuance ? undefined : td('officialOff')}>
          <Printer className="w-3.5 h-3.5" />
          {td('printPreview')}
        </Button>
      </div>
      {!officialIssuance && (
        <p className="text-xs text-muted-foreground px-1" data-testid="official-off">{td('officialOff')}</p>
      )}

      {/* Printable Report Document (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-2" tabIndex={0} aria-label={td('printPreview')}>
        <Card className="border border-border shadow-xs bg-white text-black p-5 sm:p-7 space-y-5" data-testid="report-preview">
        {!officialIssuance && (
          <p className="rounded-md border-2 border-dashed border-neutral-500 py-2 text-center text-sm font-bold uppercase tracking-wide text-neutral-700">
            {td('draftWatermark')}
          </p>
        )}
        {/* Header */}
        <div className="flex items-start justify-between border-b pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xl text-primary tracking-tight">DocMate AI</span>
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-widest font-semibold">
                Clinical Decision Support
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Internal Closed-Library Decision Support System &bull; Audit Trail ID: {caseData.id.slice(0, 8)}
            </p>
          </div>

          <div className="text-right text-xs space-y-0.5">
            <p className="font-semibold text-foreground">{t('caseDate')}: {caseData.created_at ? format.dateTime(new Date(caseData.created_at), { dateStyle: 'medium', timeZone: 'UTC' }) : '—'}</p>
            <p className="text-muted-foreground">Patient Code: <strong className="text-foreground">{patientCode}</strong></p>
            <Badge variant="outline" className="text-[10px] uppercase font-bold mt-1">
              {caseData.status}
            </Badge>
          </div>
        </div>

        {/* Persistent Legal Medical Disclaimer */}
        <div className="p-3 bg-muted/40 border border-border/70 rounded-md text-center space-y-0.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground/80">
            Clinical decision support only. Not a substitute for professional judgement.
          </p>
          <p className="font-medium text-muted-foreground">
            শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।
          </p>
        </div>

        {/* Patient Profile & Baseline Vitals */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            {t('patientDetails')}
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Age / Gender:</span>
              <span className="font-semibold capitalize">{input.age} yrs, {input.gender}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Weight:</span>
              <span className="font-semibold">{input.weight_kg ? `${input.weight_kg} kg` : tCommon('notRecorded')}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Blood Pressure:</span>
              <span className="font-semibold">
                {vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic
                  ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic} mmHg`
                  : tCommon('notRecorded')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Heart Rate / SpO2:</span>
              <span className="font-semibold">
                {vitals.heart_rate ? `${vitals.heart_rate} bpm` : tCommon('notRecorded')} &bull;{' '}
                {vitals.spo2_percent ? `${vitals.spo2_percent}%` : tCommon('notRecorded')}
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs space-y-1">
            <p>
              <strong className="text-muted-foreground font-semibold">Chief Complaint: </strong>
              <span className="font-medium">{input.chief_complaint}</span>
            </p>
            <p>
              <strong className="text-muted-foreground font-semibold">Known Allergies: </strong>
              <span className={input.allergies?.length ? 'font-bold text-rose-600' : 'italic text-muted-foreground'}>
                {input.allergies?.length ? input.allergies.join(', ') : t('noAllergiesRecorded')}
              </span>
            </p>
          </div>
        </div>

        <Separator />

        {/* Confirmed Diagnosis */}
        <div className="space-y-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            {t('workingDiagnosis')}
          </h4>
          <div className="flex items-center gap-2 pt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold text-sm text-foreground">
              {caseData.confirmed_diagnosis || '—'}
            </span>
          </div>
        </div>

        <Separator />

        {/* Approved plan */}
        <div className="space-y-3" data-testid="report-plan">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            {td('approvedPlan')} ({items.length})
          </h4>
          {approval && !approval.current && (
            <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" aria-hidden />
              {td('planOutdated')}
            </p>
          )}
          {items.length > 0 ? (
            <div className="space-y-3">
              {approval?.approved_at && (
                <p className="text-[11px] text-muted-foreground">
                  {td('approvedOn', { date: format.dateTime(new Date(approval.approved_at), { dateStyle: 'medium', timeStyle: 'short' }) })}
                </p>
              )}
              {items.map((drug, idx) => (
                <div key={drug.drug_id} className="p-3 rounded border border-border/80 bg-muted/10 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-sm text-foreground">
                      {idx + 1}. {drug.generic_name}
                    </span>
                    <span className="text-[11px] font-semibold text-primary uppercase">
                      {drug.route} &bull; {drug.frequency}
                    </span>
                  </div>
                  <p className="font-semibold text-foreground">
                    {td('dose')}: {drug.dose_text} · {td('duration', { days: drug.duration_days })}
                  </p>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <CitationChip claim={{ ...drug.citation, page: drug.citation.page ?? undefined, source_year: drug.citation.source_year ?? undefined }} />
                    <q className="italic">{drug.citation.quote}</q>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">{td('notApproved')}</p>
          )}
        </div>

        <Separator />

        {/* Safety review */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">
            {t('safetyReview')}
          </h4>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('safetyUnavailable')}</p>
          ) : approval && (approval.overrides.length > 0 || approval.warnings.length > 0) ? (
            <div className="p-3 rounded border border-amber-500/30 bg-amber-500/5 text-xs space-y-2">
              {approval.overrides.map((override) => (
                <p key={override.alert_id} className="flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" aria-hidden />
                  <span>
                    <strong>{override.title}</strong> — {td('overrideReason', { reason: override.reason })}
                  </span>
                </p>
              ))}
              {approval.warnings.map((warning) => (
                <p key={warning} className="text-muted-foreground">• {warning}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" aria-hidden />
              {td('safetyClear')}
            </p>
          )}
        </div>

        {approval?.current && approval.note && (
          <div className="space-y-1">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">{td('note')}</h4>
            <p className="text-xs text-foreground bg-muted/20 p-2.5 rounded border border-border/60">{approval.note}</p>
          </div>
        )}

        <Separator />

        <p className="text-xs text-muted-foreground">{t('unsignedDraft')}</p>
      </Card>
      </div>
    </div>
  );
}
