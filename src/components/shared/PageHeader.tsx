import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, badge, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-border/60 min-w-0 max-w-full overflow-hidden',
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-foreground break-words max-w-full">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {subtitle && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed break-words max-w-full">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 max-w-full flex-wrap items-center gap-2 sm:gap-3">
          {action}
        </div>
      )}
    </div>
  );
}
