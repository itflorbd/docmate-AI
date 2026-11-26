'use client';

import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { RESOLUTION_BASES, type ResolutionBasis, type UrgentFinding } from '@/lib/case-urgency-shared';

interface Props {
  caseId: string;
  findings: UrgentFinding[];
  /** True when the latest analysis abstained; the banner says urgency still applies. */
  insufficientEvidence: boolean;
  onChange: (findings: UrgentFinding[]) => void;
}

/**
 * Persistent urgent warning. Not dismissable: it goes away only when the
 * doctor records a decision for each finding.
 */
export function UrgentFindingsBanner({ caseId, findings, insufficientEvidence, onChange }: Props) {
  const t = useTranslations('urgentFindings');
  const bn = useLocale() === 'bn';
  const [resolving, setResolving] = useState<UrgentFinding | null>(null);
  const active = findings.filter((finding) => finding.status === 'active');
  if (active.length === 0) return null;

  const sourceText = (finding: UrgentFinding) =>
    finding.source === 'prior_case_status' ? t('sourcePrior') : t('sourceRule', { rule: finding.source.replace(/^rule:/, '') });

  return (
    <section
      role="alert"
      aria-live="assertive"
      data-testid="urgent-findings"
      className="shrink-0 rounded-xl border-2 border-destructive bg-destructive/10 p-3 space-y-2"
    >
      <div className="flex items-center gap-2 text-destructive">
        <AlertOctagon className="w-5 h-5 shrink-0" aria-hidden />
        <h2 className="font-bold text-sm">{t('title')}</h2>
        <span className="text-xs font-semibold">· {t('oneOrMore', { count: active.length })}</span>
      </div>
      {insufficientEvidence && <p className="text-xs text-foreground">{t('noEvidenceNote')}</p>}
      <ul className="space-y-2">
        {active.map((finding) => (
          <li key={finding.id} className="rounded-lg bg-background/80 border border-destructive/40 p-2.5 flex flex-col sm:flex-row sm:items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm text-foreground">{bn ? finding.title_bn : finding.title_en}</p>
              <p className="text-xs text-foreground/80 leading-relaxed">{bn ? finding.description_bn : finding.description_en}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{t('source', { source: sourceText(finding) })}</p>
              {finding.reraised && <p className="text-[11px] font-semibold text-destructive mt-0.5">{t('reraised')}</p>}
            </div>
            <Button size="sm" variant="destructive" className="min-h-11 shrink-0" onClick={() => setResolving(finding)}>
              {t('resolve')}
            </Button>
          </li>
        ))}
      </ul>
      {resolving && (
        <ResolveDialog
          caseId={caseId}
          finding={resolving}
          onClose={() => setResolving(null)}
          onSaved={(updated) => {
            setResolving(null);
            onChange(updated);
          }}
        />
      )}
    </section>
  );
}

/** Short summary of resolved findings, for the patient detail and report views. */
export function ResolvedFindingsList({ findings }: { findings: UrgentFinding[] }) {
  const t = useTranslations('urgentFindings');
  const bn = useLocale() === 'bn';
  const resolved = findings.filter((finding) => finding.status === 'resolved' && finding.resolution);
  if (resolved.length === 0) return null;
  return (
    <ul className="space-y-1">
      {resolved.map((finding) => (
        <li key={finding.id} className="text-xs text-muted-foreground flex items-start gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" aria-hidden />
          <span>
            {bn ? finding.title_bn : finding.title_en} — {t('resolvedBy', { basis: t(`basis.${finding.resolution!.basis}`) })}: {finding.resolution!.rationale}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ResolveDialog({
  caseId,
  finding,
  onClose,
  onSaved,
}: {
  caseId: string;
  finding: UrgentFinding;
  onClose: () => void;
  onSaved: (findings: UrgentFinding[]) => void;
}) {
  const t = useTranslations('urgentFindings');
  const bn = useLocale() === 'bn';
  const [basis, setBasis] = useState<ResolutionBasis | ''>('');
  const [rationale, setRationale] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = basis !== '' && rationale.trim().length >= 15;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/urgent-findings/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finding_id: finding.id, basis, rationale: rationale.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(t('saved'));
      onSaved(data.urgent_findings);
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : t('failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">{bn ? finding.title_bn : finding.title_en}</span>
            <br />
            {t('dialogDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('basisLabel')}</Label>
            <RadioGroup value={basis} onValueChange={(value) => setBasis(value as ResolutionBasis)}>
              {RESOLUTION_BASES.map((value) => (
                <Label key={value} className="flex items-center gap-2 min-h-11 font-normal cursor-pointer">
                  <RadioGroupItem value={value} />
                  {t(`basis.${value}`)}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="urgent-rationale">{t('rationaleLabel')}</Label>
            <Textarea
              id="urgent-rationale"
              rows={3}
              value={rationale}
              placeholder={t('rationalePlaceholder')}
              onChange={(event) => setRationale(event.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">{t('rationaleHint')}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button className="min-h-11" disabled={!valid || saving} onClick={save}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
