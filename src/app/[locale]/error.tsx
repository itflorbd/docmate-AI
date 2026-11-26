'use client';

import React, { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = useLocale();
  const isBn = locale === 'bn';

  useEffect(() => {
    console.error('App Route Error caught by error boundary:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="max-w-md w-full border border-border bg-card p-6 text-center space-y-4 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-foreground">
            {isBn ? 'পৃষ্ঠাটি লোড হতে সমস্যা হয়েছে' : 'Unable to load page'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isBn
              ? 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে। দয়া করে পুনরায় চেষ্টা করুন।'
              : 'An unexpected error occurred. Please try reloading.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => reset()}
            className="text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isBn ? 'পুনরায় চেষ্টা করুন' : 'Try Again'}</span>
          </Button>
          <Link
            href="/dashboard"
            className={buttonVariants({
              variant: 'outline',
              size: 'sm',
              className: 'text-xs flex items-center gap-1.5',
            })}
          >
            <Home className="w-3.5 h-3.5" />
            <span>{isBn ? 'হোমে ফিরুন' : 'Go Home'}</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
