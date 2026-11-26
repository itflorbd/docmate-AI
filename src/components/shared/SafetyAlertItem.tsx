'use client';

import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SafetyAlert } from '@/types';
import { AlertOctagon, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SafetyAlertItemProps {
  alert: SafetyAlert;
  onAcknowledge?: (alertId: string) => void;
  className?: string;
}

export function SafetyAlertItem({ alert, onAcknowledge, className }: SafetyAlertItemProps) {
  const isCritical = alert.severity === 'critical';
  const isWarning = alert.severity === 'warning';

  let alertStyle = 'bg-muted/50 border-border text-foreground';
  let Icon = Info;
  let severityLabel = 'CLINICAL NOTICE';

  if (isCritical) {
    alertStyle = 'bg-destructive/10 border-destructive text-destructive dark:bg-destructive/15';
    Icon = AlertOctagon;
    severityLabel = 'CRITICAL CLINICAL STOP';
  } else if (isWarning) {
    alertStyle = 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200';
    Icon = AlertTriangle;
    severityLabel = 'CAUTIONARY WARNING';
  }

  return (
    <Alert className={cn('relative p-4 rounded-lg border transition-all', alertStyle, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 shrink-0 mt-0.5', isCritical && 'text-destructive', isWarning && 'text-amber-600')} />
        <div className="flex-1 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-background/80 shadow-xs border">
                {severityLabel}
              </span>
              <AlertTitle className="text-sm font-bold m-0 leading-tight">
                {alert.title}
              </AlertTitle>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {alert.drug_name}
            </span>
          </div>

          <AlertDescription className="text-xs leading-relaxed opacity-95">
            {alert.description}
          </AlertDescription>

          {isCritical && !alert.acknowledged && onAcknowledge && (
            <div className="pt-2 flex items-center justify-between">
              <p className="text-[11px] font-medium text-destructive">
                Physician acknowledgement required to proceed to prescription.
              </p>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onAcknowledge(alert.id)}
                className="text-xs h-7 gap-1 font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Acknowledge Clinical Alert
              </Button>
            </div>
          )}

          {isCritical && alert.acknowledged && (
            <div className="pt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Acknowledged by prescribing physician</span>
            </div>
          )}
        </div>
      </div>
    </Alert>
  );
}
