'use client';

import React, { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  Pill,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DangerAlertItem {
  id: string;
  severity: 'critical' | 'warning';
  category: 'drug_notice' | 'red_flag_case' | 'missing_info_case';
  title: string;
  description: string;
  href: string;
  actionLabelEn: string;
  actionLabelBn: string;
}

interface DoctorDangerAlertsProps {
  initialItems?: DangerAlertItem[];
  enabled?: boolean;
}

export function DoctorDangerAlerts({ initialItems, enabled = true }: DoctorDangerAlertsProps) {
  const locale = useLocale();
  const router = useRouter();
  const isBn = locale === 'bn';

  const [open, setOpen] = useState(false);
  const [fetchedItems, setFetchedItems] = useState<DangerAlertItem[]>([]);
  const items = initialItems ?? fetchedItems;

  useEffect(() => {
    if (!enabled || initialItems) return;

    let cancelled = false;

    async function loadAlerts() {
      try {
        const [noticesRes, casesRes] = await Promise.all([
          fetch('/api/medicines/notices/active', { cache: 'no-store' }),
          fetch('/api/cases?status=running', { cache: 'no-store' }),
        ]);

        const collected: DangerAlertItem[] = [];

        if (noticesRes.ok) {
          const noticeData = await noticesRes.json();
          const notices = Array.isArray(noticeData.notices) ? noticeData.notices : [];
          for (const n of notices.slice(0, 5)) {
            collected.push({
              id: `notice-${n.id}`,
              severity: n.severity === 'critical_recall' ? 'critical' : 'warning',
              category: 'drug_notice',
              title: n.title,
              description: n.body,
              // Doctors see recalls where they prescribe; /controller is not open to them.
              href: '/prescriptions',
              actionLabelEn: 'Open prescriptions',
              actionLabelBn: 'প্রেসক্রিপশন খুলুন',
            });
          }
        }

        if (casesRes.ok) {
          const caseData = await casesRes.json();
          const casesList = Array.isArray(caseData.cases) ? caseData.cases : [];
          for (const c of casesList) {
            const complaint = String(c.structured_input?.chief_complaint || c.structuredInput?.chief_complaint || 'Clinical Case');
            if (c.status === 'red_flag') {
              collected.push({
                id: `case-${c.id}`,
                severity: 'critical',
                category: 'red_flag_case',
                title: `${c.patient_code || c.patientCode}: ${complaint}`,
                description: isBn
                  ? 'জরুরি সতর্কতা (Red Flag) চিহ্নিত হয়েছে — দ্রুত পর্যালোচনা প্রয়োজন।'
                  : 'Urgent Red Flag detected — immediate physician review needed.',
                href: `/cases/${c.id}`,
                actionLabelEn: 'Open Case',
                actionLabelBn: 'কেস খুলুন',
              });
            } else if (c.status === 'insufficient_evidence') {
              collected.push({
                id: `case-${c.id}`,
                severity: 'warning',
                category: 'missing_info_case',
                title: `${c.patient_code || c.patientCode}: ${complaint}`,
                description: isBn
                  ? 'মূল্যায়নের জন্য রোগীর অতিরিক্ত তথ্য বা ভাইটালস প্রয়োজন।'
                  : 'Missing vitals or clinical details needed for assessment.',
                href: `/cases/${c.id}`,
                actionLabelEn: 'Complete Info',
                actionLabelBn: 'তথ্য যোগ করুন',
              });
            }
          }
        }

        if (!cancelled) {
          setFetchedItems(collected);
        }
      } catch {
        // Ignore background fetch errors
      }
    }

    loadAlerts();
    return () => {
      cancelled = true;
    };
  }, [enabled, initialItems, isBn]);

  if (!enabled || items.length === 0) {
    return null;
  }

  const criticalCount = items.filter((i) => i.severity === 'critical').length;
  const hasCritical = criticalCount > 0;

  const handleNavigate = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <DialogTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="doctor-danger-alerts-trigger"
                  aria-label={
                    isBn
                      ? `সতর্কতা ও জরুরি বার্তা (${items.length}টি)`
                      : `Danger and warning alerts (${items.length})`
                  }
                  className={cn(
                    'relative h-8 sm:h-9 px-2.5 gap-1.5 font-semibold text-xs shrink-0 transition-all',
                    hasCritical
                      ? 'border-destructive/50 bg-destructive/10 text-red-700 dark:text-red-300 hover:bg-destructive/20'
                      : 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                  )}
                >
                  <span className="relative flex items-center justify-center">
                    <span
                      className={cn(
                        'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
                        hasCritical ? 'bg-destructive' : 'bg-amber-500'
                      )}
                    />
                    <AlertTriangle className="relative w-4 h-4 animate-pulse" />
                  </span>
                  <span className="tabular-nums font-bold">{items.length}</span>
                </Button>
              }
            />
          }
        />
        <TooltipContent side="bottom">
          {isBn
            ? `${items.length}টি সতর্কতা ও জরুরি বার্তা দেখুন`
            : `View ${items.length} warning & danger alert(s)`}
        </TooltipContent>
      </Tooltip>

      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldAlert
              className={cn(
                'w-5 h-5 shrink-0',
                hasCritical ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'
              )}
            />
            <span>
              {isBn ? 'সতর্কতা ও জরুরি বার্তা' : 'Doctor Warnings & Danger Alerts'}
            </span>
            <Badge
              variant={hasCritical ? 'destructive' : 'outline'}
              className="text-[10px] ml-1 tabular-nums"
            >
              {items.length}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {isBn
              ? 'যেকোনো বার্তায় ক্লিক করে সরাসরি সেই কেস বা পেজে যান।'
              : 'Click any alert below to jump directly to that case or issue page.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 overflow-y-auto pr-1 py-2">
          {items.map((item) => {
            const isCritical = item.severity === 'critical';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.href)}
                className={cn(
                  'w-full text-left p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 group cursor-pointer',
                  isCritical
                    ? 'border-destructive/40 bg-destructive/5 hover:bg-destructive/10 hover:border-destructive'
                    : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60'
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                      isCritical
                        ? 'bg-destructive/15 text-destructive'
                        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                    )}
                  >
                    {item.category === 'drug_notice' ? (
                      <Pill className="w-4 h-4" />
                    ) : item.category === 'missing_info_case' ? (
                      <HelpCircle className="w-4 h-4" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={isCritical ? 'destructive' : 'outline'}
                        className={cn(
                          'text-[10px] px-1.5 py-0',
                          !isCritical && 'border-amber-500/50 text-amber-800 dark:text-amber-300'
                        )}
                      >
                        {isCritical
                          ? isBn ? 'জরুরি (Danger)' : 'Danger'
                          : isBn ? 'সতর্কতা (Warning)' : 'Warning'}
                      </Badge>
                      <span className="font-semibold text-sm text-foreground break-words">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed break-words">
                      {item.description}
                    </p>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-semibold pt-0.5',
                        isCritical ? 'text-destructive' : 'text-amber-700 dark:text-amber-300'
                      )}
                    >
                      <span>{isBn ? item.actionLabelBn : item.actionLabelEn}</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
