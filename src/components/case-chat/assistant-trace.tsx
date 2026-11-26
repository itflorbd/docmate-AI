'use client';

import { BookOpenIcon, BrainIcon, CheckIcon, PenLineIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Spinner } from '@/components/ui/spinner';
import { Trace, TraceDescription, TraceIcon, TraceLine, TraceTitle } from '@/components/ui/trace';
import type { TraceStep } from '@/lib/assistant/types';
import type { TraceState } from './use-case-chat';

const STEPS: Array<{ step: TraceStep; icon: typeof BrainIcon; title: 'traceUnderstand' | 'traceRetrieve' | 'traceGenerate' | 'traceVerify' }> = [
  { step: 'understand', icon: BrainIcon, title: 'traceUnderstand' },
  { step: 'retrieve', icon: BookOpenIcon, title: 'traceRetrieve' },
  { step: 'generate', icon: PenLineIcon, title: 'traceGenerate' },
  { step: 'verify', icon: ShieldCheckIcon, title: 'traceVerify' },
];

/** Live activity of the current assistant run, driven by server trace events. */
export function AssistantTrace({ trace }: { trace: TraceState }) {
  const t = useTranslations('chat');
  const visible = STEPS.filter(({ step }) => trace[step]);
  if (visible.length === 0) {
    return (
      <Trace>
        <TraceLine status="running">
          <TraceIcon>
            <Spinner />
          </TraceIcon>
          <TraceTitle>{t('traceUnderstand')}</TraceTitle>
        </TraceLine>
      </Trace>
    );
  }

  return (
    <Trace aria-live="polite">
      {visible.map(({ step, icon: Icon, title }) => {
        const state = trace[step]!;
        const description =
          state.status === 'done' && state.count !== undefined
            ? step === 'retrieve'
              ? t('traceRetrieveCount', { count: state.count })
              : step === 'verify'
                ? t('traceVerifyCount', { count: state.count })
                : null
            : null;
        return (
          <TraceLine key={step} status={state.status === 'done' ? undefined : state.status}>
            <TraceIcon>
              {state.status === 'running' ? <Spinner /> : state.status === 'error' ? <TriangleAlertIcon /> : <Icon />}
            </TraceIcon>
            <TraceTitle>{state.status === 'error' ? t('traceFailed') : t(title)}</TraceTitle>
            {description && <TraceDescription>{description}</TraceDescription>}
            {state.status === 'done' && !description && (
              <TraceIcon>
                <CheckIcon />
              </TraceIcon>
            )}
          </TraceLine>
        );
      })}
    </Trace>
  );
}
