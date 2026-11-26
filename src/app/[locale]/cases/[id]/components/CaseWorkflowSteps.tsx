'use client';

import * as React from 'react';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CaseTurn, PatientCase } from '@/types';

export type WorkflowStep = 'details' | 'ask' | 'diagnosis' | 'treatment' | 'report';

interface CaseWorkflowStepsProps {
  caseData: PatientCase;
  turns: CaseTurn[];
  isFinalized: boolean;
  onGo: (step: WorkflowStep) => void;
}

const ORDER: WorkflowStep[] = ['details', 'ask', 'diagnosis', 'treatment', 'report'];

/** Which steps of the visit are complete, derived only from saved case data. */
export function workflowProgress(caseData: PatientCase, turns: CaseTurn[], isFinalized: boolean): Record<WorkflowStep, boolean> {
  const input = caseData.structured_input;
  const vitals = input?.vitals ?? {};
  const hasVitals = Boolean(vitals.blood_pressure_systolic || vitals.heart_rate || vitals.temperature_celsius || vitals.spo2_percent);
  const asked = turns.some((turn) => {
    const content = (turn.content ?? {}) as Record<string, unknown>;
    return (
      turn.role !== 'doctor' &&
      content.superseded !== true &&
      (content.status === 'answered' || content.status === 'excerpts') &&
      Array.isArray(content.claims) &&
      content.claims.length > 0
    );
  });
  const treated = isFinalized || caseData.status === 'treated' || caseData.status === 'closed';
  return {
    details: Boolean(input?.chief_complaint) && hasVitals,
    ask: asked,
    diagnosis: Boolean(caseData.confirmed_diagnosis),
    treatment: treated,
    report: caseData.status === 'closed' || isFinalized,
  };
}

/**
 * The visit as five steps: patient details → ask DocMate → working diagnosis →
 * treatment and safety → report. Shows what is done and the one next action.
 */
export function CaseWorkflowSteps({ caseData, turns, isFinalized, onGo }: CaseWorkflowStepsProps) {
  const t = useTranslations('workflow');
  const done = workflowProgress(caseData, turns, isFinalized);
  const next = ORDER.find((step) => !done[step]) ?? 'report';

  return (
    <nav
      aria-label={t('label')}
      className="flex shrink-0 flex-col gap-2 rounded-xl border bg-card px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between"
    >
      <ol className="flex min-w-0 items-center gap-1 overflow-x-auto">
        {ORDER.map((step, index) => {
          const isDone = done[step];
          const isNext = step === next;
          return (
            <li key={step} className="flex shrink-0 items-center gap-1">
              {index > 0 && <span aria-hidden className="h-px w-3 bg-border sm:w-5" />}
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant={isNext ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => onGo(step)}
                      aria-current={isNext ? 'step' : undefined}
                      className="gap-1.5"
                    />
                  }
                >
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full border text-xs font-semibold',
                      isDone && 'border-primary bg-primary text-primary-foreground',
                      isNext && !isDone && 'border-primary text-primary',
                    )}
                  >
                    {isDone ? <CheckIcon className="size-3" /> : index + 1}
                  </span>
                  <span className={cn('text-xs', !isNext && !isDone && 'text-muted-foreground')}>{t(`${step}.title`)}</span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">{t(`${step}.hint`)}</TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <Tooltip>
        <TooltipTrigger render={<Button size="sm" onClick={() => onGo(next)} className="shrink-0 self-start sm:self-auto" />}>
          <span className="text-primary-foreground">{t('next')}:</span>
          {t(`${next}.action`)}
          <ArrowRightIcon data-icon="inline-end" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{t(`${next}.hint`)}</TooltipContent>
      </Tooltip>
    </nav>
  );
}
