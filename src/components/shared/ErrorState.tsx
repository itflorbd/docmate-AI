'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title,
  message,
  onRetry,
  className,
}: ErrorStateProps) {
  const t = useTranslations('common');
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 border rounded-xl border-destructive/20 bg-destructive/5 my-4',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title || t('errorTitle')}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2 border-destructive/30 hover:bg-destructive/10">
          <RefreshCw className="w-4 h-4" />
          <span>{t('retry')}</span>
        </Button>
      )}
    </div>
  );
}
