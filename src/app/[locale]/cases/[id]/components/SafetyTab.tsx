'use client';

import React from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import type { DecisionAlert } from '@/lib/prescription-safety';
import type { TreatmentDraft } from '@/lib/treatment-draft';

interface SafetyTabProps {
  draft: TreatmentDraft | null;
  regimenAlerts: DecisionAlert[];
}

/** Read-only view of the server's medication safety results. It decides nothing itself. */
export function SafetyTab({ draft, regimenAlerts }: SafetyTabProps) {
  const t = useTranslations('treatmentDraft');
  if (!draft || draft.options.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <ShieldCheck className="w-6 h-6 text-primary" aria-hidden />
        {t('safetyEmpty')}
      </Card>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto space-y-3 pb-6" data-testid="safety-tab">
      <div>
        <h2 className="text-base font-bold">{t('safetyTitle')}</h2>
        <p className="text-xs text-muted-foreground">{t('safetyServer')}</p>
      </div>
      {draft.options.map((option) => (
        <Card key={option.drug_id} className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-sm">{option.generic_name}</span>
            <StatusLabel status={option.safety.status} />
          </div>
          {option.safety.alerts.length === 0 ? null : (
            <ul className="space-y-1.5">
              {option.safety.alerts.map((alert) => (
                <AlertRow key={alert.id} alert={alert} />
              ))}
            </ul>
          )}
        </Card>
      ))}
      {regimenAlerts.length > 0 && (
        <Card className="p-3 space-y-1.5 border-amber-500/60">
          <ul className="space-y-1.5">
            {regimenAlerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function StatusLabel({ status }: { status: 'clear' | 'needs_override' | 'blocked' }) {
  const t = useTranslations('treatmentDraft');
  if (status === 'blocked') return <span className="text-xs font-bold text-destructive">{t('safetyBlocked')}</span>;
  if (status === 'needs_override') return <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{t('safetyOverride')}</span>;
  return (
    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
      {t('safetyClear')}
    </span>
  );
}

function AlertRow({ alert }: { alert: DecisionAlert }) {
  const Icon = alert.stop === 'hard' ? AlertOctagon : alert.stop === 'override' ? AlertTriangle : Info;
  const tone = alert.stop === 'hard' ? 'text-destructive' : alert.stop === 'override' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground';
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${tone}`} aria-hidden />
      <span>
        <span className={`font-semibold ${alert.stop === 'hard' ? 'text-destructive' : 'text-foreground'}`}>{alert.title}</span>
        <span className="block text-muted-foreground">{alert.description}</span>
      </span>
    </li>
  );
}
