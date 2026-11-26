'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { CitationChip } from '@/components/shared/CitationChip';
import { AnalysisOutput, DifferentialDiagnosis } from '@/types';
import {
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface DifferentialsTabProps {
  analysis: AnalysisOutput | null;
  analyzing: boolean;
  onRunAnalysis: () => void;
  onSelectDiagnosis: (condition: string) => void;
  onGoToMissingInfo: () => void;
}

export function DifferentialsTab({
  analysis,
  analyzing,
  onRunAnalysis,
  onSelectDiagnosis,
  onGoToMissingInfo,
}: DifferentialsTabProps) {
  const locale = useLocale();
  const t = useTranslations('workspace');

  if (analyzing) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {t('analyzing')}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {locale === 'bn'
              ? 'অভ্যন্তরীণ লাইব্রেরি থেকে তথ্য সংগ্রহ ও প্রমাণ যাচাই করা হচ্ছে...'
              : 'Retrieving evidence and evaluating clinical differentials...'}
          </p>
        </div>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">
            {locale === 'bn' ? 'কোনো বিশ্লেষণ শুরু হয়নি' : 'No Clinical Analysis Yet'}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {locale === 'bn'
              ? 'মেডিকেল লাইব্রেরির তথ্যের ভিত্তিতে সম্ভাব্য রোগসমূহ দেখতে বিশ্লেষণ শুরু করুন।'
              : 'Run evidence-based reasoning against the library to evaluate differential diagnoses.'}
          </p>
        </div>
        <Button onClick={onRunAnalysis} size="sm" className="gap-2 text-xs font-semibold">
          <Stethoscope className="w-3.5 h-3.5" />
          {t('runAnalysis')}
        </Button>
      </Card>
    );
  }

  const getLikelihoodBadge = (label: 'high' | 'moderate' | 'low') => {
    switch (label) {
      case 'high':
        return (
          <Badge className="bg-emerald-700 text-white hover:bg-emerald-700 text-[11px] font-semibold">
            {locale === 'bn' ? 'উচ্চ সম্ভাবনা' : 'High Likelihood'}
          </Badge>
        );
      case 'moderate':
        return (
          <Badge variant="secondary" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 text-[11px] font-semibold">
            {locale === 'bn' ? 'মাঝারি সম্ভাবনা' : 'Moderate'}
          </Badge>
        );
      case 'low':
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-[11px]">
            {locale === 'bn' ? 'স্বল্প সম্ভাবনা' : 'Low'}
          </Badge>
        );
    }
  };

  const defaultAccordionValue = analysis.differentials[0]
    ? [analysis.differentials[0].condition]
    : [];

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden space-y-2">
      {/* Red Flag Emergency Banner */}
      {analysis.status === 'red_flag' && (
        <Alert variant="destructive" className="border shadow-xs shrink-0 py-2">
          <ShieldAlert className="w-4 h-4 text-destructive" />
          <AlertTitle className="text-xs font-bold">
            {t('redFlagBanner')}
          </AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-1">
            <p className="font-medium">
              {locale === 'bn' ? 'জরুরি ক্লিনিকাল ঝুঁকি সনাক্ত হয়েছে:' : 'Emergency safety criteria triggered:'}
            </p>
            {analysis.red_flags && analysis.red_flags.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 font-semibold text-destructive-foreground">
                {analysis.red_flags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Insufficient Evidence Alert */}
      {analysis.status === 'insufficient_evidence' && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 shrink-0 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <AlertTitle className="text-xs font-semibold">
              {t('insufficientTitle')}
            </AlertTitle>
            <AlertDescription className="text-xs mt-0.5 text-amber-800 dark:text-amber-300">
              {t('insufficientDesc')}
            </AlertDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onGoToMissingInfo}
            className="shrink-0 gap-1 border-amber-500/40 hover:bg-amber-500/20 text-xs font-semibold h-7"
          >
            <span>{locale === 'bn' ? 'প্রয়োজনীয় তথ্য দিন' : 'Review Missing Info'}</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Alert>
      )}

      {/* Confidence Header & Summary */}
      <Card className="p-2.5 sm:p-3 border-border/70 bg-card shadow-2xs shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('confidence')}:
              </span>
              <ConfidenceBadge
                label={analysis.confidence.label}
                score={analysis.confidence.score}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed truncate">
              {analysis.confidence.reasoning}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRunAnalysis}
            className="shrink-0 text-xs gap-1.5 h-7"
          >
            <Stethoscope className="w-3.5 h-3.5 text-primary" />
            <span>{t('reAnalyze')}</span>
          </Button>
        </div>
      </Card>

      {/* Differentials Accordion Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-1.5 pt-1">
        <div className="flex items-center justify-between px-1 shrink-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {locale === 'bn' ? 'সম্ভাব্য রোগের তালিকা' : 'Ranked Differential Diagnoses'} ({analysis.differentials.length})
          </h3>
          <span className="text-[11px] text-muted-foreground">
            {locale === 'bn' ? 'ক্লিক করে প্রমাণ দেখুন' : 'Click to inspect citations'}
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <Accordion
            defaultValue={defaultAccordionValue}
            className="space-y-2 pb-2"
          >
          {analysis.differentials.map((diff: DifferentialDiagnosis, idx: number) => {
            const verifiedCitationCount =
              (diff.supporting_claims?.filter((c) => c.verified !== false).length || 0) +
              (diff.opposing_claims?.filter((c) => c.verified !== false).length || 0);

            return (
              <AccordionItem
                key={diff.condition}
                value={diff.condition}
                className="border border-border/80 rounded-lg overflow-hidden bg-card shadow-2xs data-open:border-primary/50 transition-colors"
              >
                <AccordionTrigger className="px-3 sm:px-4 py-2.5 hover:no-underline hover:bg-muted/40">
                  <div className="flex flex-1 items-center justify-between gap-2 pr-2 text-left min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-xs sm:text-sm text-foreground truncate block" title={diff.condition_bn || diff.condition}>
                          {diff.condition_bn || diff.condition}
                        </span>
                        {diff.condition_bn && (
                          <span className="text-[11px] text-muted-foreground font-normal truncate block">
                            ({diff.condition})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                        <span className="font-semibold text-primary">{verifiedCitationCount}</span>
                        <span className="hidden sm:inline">citations</span>
                      </Badge>
                      {getLikelihoodBadge(diff.likelihood_label)}
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-3 sm:px-4 pb-3.5 pt-1 space-y-3 border-t border-border/40">
                  {/* Clinical Rationale */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      {locale === 'bn' ? 'ক্লিনিকাল কারণ ও যুক্তি:' : 'Clinical Rationale:'}
                    </span>
                    <p className="text-xs text-foreground leading-relaxed bg-muted/40 p-2.5 rounded-md border border-border/50">
                      {diff.clinical_rationale}
                    </p>
                  </div>

                  {/* Supporting Claims */}
                  {diff.supporting_claims && diff.supporting_claims.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{locale === 'bn' ? 'স্বপক্ষে প্রমাণ' : 'Supporting Evidence'} ({diff.supporting_claims.length})</span>
                      </span>
                      <div className="space-y-1.5">
                        {diff.supporting_claims.map((claim, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1"
                          >
                            <p className="text-foreground font-medium leading-snug">
                              {claim.text}
                            </p>
                            <div className="flex items-start justify-between gap-2 pt-1 border-t border-emerald-500/10">
                              <p className="italic text-[11px] text-muted-foreground line-clamp-2">
                                &ldquo;{claim.quote}&rdquo;
                              </p>
                              <CitationChip
                                index={cIdx + 1}
                                claim={claim}
                                className="shrink-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opposing Claims */}
                  {diff.opposing_claims && diff.opposing_claims.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{locale === 'bn' ? 'বিপক্ষে বা পার্থক্যকারী উপাদান' : 'Opposing Factors'} ({diff.opposing_claims.length})</span>
                      </span>
                      <div className="space-y-1.5">
                        {diff.opposing_claims.map((claim, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2 rounded-md bg-rose-500/5 border border-rose-500/20 text-xs space-y-1"
                          >
                            <p className="text-foreground font-medium leading-snug">
                              {claim.text}
                            </p>
                            <div className="flex items-start justify-between gap-2 pt-1 border-t border-rose-500/10">
                              <p className="italic text-[11px] text-muted-foreground line-clamp-2">
                                &ldquo;{claim.quote}&rdquo;
                              </p>
                              <CitationChip
                                index={cIdx + 1}
                                claim={claim}
                                className="shrink-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confirm Working Diagnosis CTA */}
                  <div className="pt-1 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => onSelectDiagnosis(diff.condition)}
                      className="gap-1.5 font-semibold text-xs h-8"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{t('confirmDiagnosisTitle')}</span>
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
        </div>
      </div>
    </div>
  );
}
