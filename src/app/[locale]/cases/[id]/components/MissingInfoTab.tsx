'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FollowUpQuestionCard } from '@/components/shared/FollowUpQuestionCard';
import { MissingInformation } from '@/types';
import {
  RefreshCw,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface MissingInfoTabProps {
  missingInfo: MissingInformation[];
  onAnswerSubmit: (questionId: string, answer: string, questionText: string) => void;
  onReAnalyze: () => void;
  reAnalyzing: boolean;
}

export function MissingInfoTab({
  missingInfo,
  onAnswerSubmit,
  onReAnalyze,
  reAnalyzing,
}: MissingInfoTabProps) {
  const locale = useLocale();
  const t = useTranslations('workspace');

  if (!missingInfo || missingInfo.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">
          {locale === 'bn' ? 'পর্যাপ্ত তথ্য সংগৃহীত হয়েছে' : 'Sufficient Information Collected'}
        </h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          {locale === 'bn'
            ? 'বর্তমান কেসের জন্য মেডিকেল লাইব্রেরি থেকে পর্যাপ্ত তথ্য ও প্রমাণ পাওয়া গেছে।'
            : 'The medical library has sufficient parameters and evidence for this case.'}
        </p>
      </Card>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden space-y-2">
      {/* Principle of Abstention Explanation */}
      <Alert className="border-primary/30 bg-primary/5 text-foreground py-2 shrink-0">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <div className="space-y-0.5">
          <AlertTitle className="text-xs font-semibold">
            {t('followUpTitle')} ({missingInfo.length})
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
            {locale === 'bn'
              ? 'অনুমান পরিহার করে নির্ভুল রোগ নির্ণয় করতে নিচের তথ্য বা পরীক্ষা ফলাফল প্রদান করুন।'
              : 'Additional clinical observations or test results needed to narrow differentials.'}
          </AlertDescription>
        </div>
      </Alert>

      {/* List of Questions (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 pb-1">
        {missingInfo.map((item) => (
          <FollowUpQuestionCard
            key={item.id}
            item={item}
            onAnswerSubmit={(qId, ans) => onAnswerSubmit(qId, ans, item.text)}
            disabled={reAnalyzing}
          />
        ))}
      </div>

      {/* Re-analyze CTA */}
      <Card className="p-2.5 sm:p-3 bg-muted/30 border-border/70 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
        <div className="space-y-0.5 text-center sm:text-left">
          <p className="text-xs font-semibold text-foreground">
            {locale === 'bn' ? 'উত্তরসহ পুনর্মূল্যায়ন করতে প্রস্তুত?' : 'Ready to re-evaluate with answers?'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {locale === 'bn'
              ? 'উত্তরসমূহ জমা দিলে সম্ভাব্য রোগের তালিকা আপডেট হবে।'
              : 'Submitting recorded findings updates differential ranking.'}
          </p>
        </div>

        <Button
          size="sm"
          onClick={onReAnalyze}
          disabled={reAnalyzing}
          className="gap-2 shrink-0 font-semibold text-xs h-8"
        >
          {reAnalyzing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{locale === 'bn' ? 'পুনর্মূল্যায়ন হচ্ছে...' : 'Re-evaluating...'}</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('submitAnswers')}</span>
            </>
          )}
        </Button>
      </Card>
    </div>
  );
}
