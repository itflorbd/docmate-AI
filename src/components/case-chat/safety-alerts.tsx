'use client';

import { ShieldAlertIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SafetyAlert } from '@/types';

/**
 * Deterministic red-flag alerts. Critical alerts stay visible until the doctor
 * acknowledges them (AGENTS.md 2.3); they never use a toast.
 */
export function SafetyAlerts({
  alerts,
  acknowledged,
  onAcknowledge,
}: {
  alerts: SafetyAlert[];
  acknowledged: Set<string>;
  onAcknowledge?: (alertKey: string) => void;
}) {
  const t = useTranslations('chat');
  if (alerts.length === 0) return null;

  return (
    <div className="flex w-full flex-col gap-2">
      {alerts.map((alert) => {
        const key = alertKey(alert);
        const critical = alert.severity === 'critical';
        const isAcknowledged = acknowledged.has(key);
        return (
          <Alert key={alert.id} variant={critical ? 'destructive' : 'default'} role={critical ? 'alert' : 'status'}>
            {critical ? <ShieldAlertIcon /> : <TriangleAlertIcon />}
            <AlertTitle className="font-semibold">{alert.title}</AlertTitle>
            <AlertDescription>{alert.description}</AlertDescription>
            {critical && onAcknowledge && (
              <AlertAction>
                {isAcknowledged ? (
                  <Badge variant="secondary">{t('redFlagAcknowledged')}</Badge>
                ) : (
                  <Button size="sm" variant="destructive" onClick={() => onAcknowledge(key)}>
                    {t('redFlagAcknowledge')}
                  </Button>
                )}
              </AlertAction>
            )}
          </Alert>
        );
      })}
    </div>
  );
}

/** Stable key per rule, so the same red flag is acknowledged once per case. */
export function alertKey(alert: SafetyAlert): string {
  return alert.id.replace(/-\d{10,}$/, '');
}
