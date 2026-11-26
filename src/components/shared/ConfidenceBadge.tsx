import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, ShieldAlert, AlertTriangle, HelpCircle } from 'lucide-react';
import { ConfidenceScoreLabel } from '@/types';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ConfidenceBadgeProps {
  label: ConfidenceScoreLabel;
  score?: number;
  reasoning?: string;
  className?: string;
}

export function ConfidenceBadge({ label, score, reasoning, className }: ConfidenceBadgeProps) {
  let badgeColor = 'bg-muted text-muted-foreground border-border';
  let Icon = HelpCircle;
  let text = 'Insufficient';
  let defaultReason = 'Insufficient library evidence or missing critical clinical parameters.';

  switch (label) {
    case 'high':
      badgeColor = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      Icon = ShieldCheck;
      text = 'High Evidence Confidence';
      defaultReason = 'Supported by multiple verified clinical guidelines with strong concordance.';
      break;
    case 'moderate':
      badgeColor = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      Icon = ShieldCheck;
      text = 'Moderate Confidence';
      defaultReason = 'Sufficient evidence available, but supplementary lab values or imaging would solidify diagnosis.';
      break;
    case 'low':
      badgeColor = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      Icon = AlertTriangle;
      text = 'Low Confidence';
      defaultReason = 'Conflicting evidence or limited matches in current internal library.';
      break;
    case 'insufficient':
    default:
      badgeColor = 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30';
      Icon = ShieldAlert;
      text = 'Insufficient Evidence';
      defaultReason = 'Clinical parameters incomplete. Abstaining from definitive diagnosis without additional input.';
      break;
  }

  const badgeElement = (
    <Badge
      variant="outline"
      className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium cursor-help transition-all', badgeColor, className)}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{text}</span>
      {score !== undefined && <span className="text-[10px] opacity-70">({Math.round(score * 100)}%)</span>}
    </Badge>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={badgeElement} />
        <TooltipContent className="max-w-xs text-xs p-2 leading-relaxed">
          <p className="font-semibold mb-0.5">{text}</p>
          <p className="text-muted-foreground">{reasoning || defaultReason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
