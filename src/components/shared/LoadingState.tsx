import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  type?: 'skeleton' | 'analysis-steps';
  currentStepIndex?: number;
  steps?: string[];
  message?: string;
  className?: string;
}

const DEFAULT_ANALYSIS_STEPS = [
  'Reading patient details & vitals',
  'Searching internal medical library',
  'Verifying verbatim evidence citations',
  'Synthesizing evidence-based differentials',
];

export function LoadingState({
  type = 'skeleton',
  currentStepIndex = 1,
  steps = DEFAULT_ANALYSIS_STEPS,
  message,
  className,
}: LoadingStateProps) {
  if (type === 'analysis-steps') {
    const progressPercent = Math.min(100, Math.round(((currentStepIndex + 1) / steps.length) * 100));

    return (
      <div className={cn('p-6 sm:p-8 rounded-xl border border-primary/20 bg-card shadow-sm space-y-6', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
          <div>
            <h4 className="text-base font-semibold text-foreground">
              {message || 'Analyzing Clinical Evidence...'}
            </h4>
            <p className="text-xs text-muted-foreground">
              DocMate AI is consulting closed internal clinical libraries
            </p>
          </div>
        </div>

        <Progress value={progressPercent} className="h-2 bg-muted" />

        <div className="space-y-3 pt-2">
          {steps.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            return (
              <div
                key={step}
                className={cn(
                  'flex items-center gap-3 text-sm transition-colors',
                  isCompleted && 'text-muted-foreground',
                  isCurrent && 'text-primary font-medium',
                  !isCompleted && !isCurrent && 'text-muted-foreground/40'
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                )}
                <span>{step}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4 p-4', className)}>
      <Skeleton className="h-8 w-1/3 rounded-md" />
      <Skeleton className="h-4 w-2/3 rounded-md" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
