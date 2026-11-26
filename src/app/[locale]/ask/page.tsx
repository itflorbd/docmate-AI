'use client';

import React, { useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CitationChip } from '@/components/shared/CitationChip';
import { LoadingState } from '@/components/shared/LoadingState';
import { useTranslations, useLocale } from 'next-intl';
import { Search, Sparkles, BookOpen, ShieldCheck, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { VerifiedClaim } from '@/types';

export default function AskLibraryPage() {
  const t = useTranslations('ask');
  const locale = useLocale();

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<VerifiedClaim[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleQuestions = [
    {
      en: 'What is the first-line empirical antibiotic for community-acquired pneumonia in adults?',
      bn: 'প্রাপ্তবয়স্কদের কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়ার প্রথম সারির অ্যান্টিবায়োটিক কী?',
    },
    {
      en: 'What are the clinical warning signs of severe dengue that mandate immediate hospitalization?',
      bn: 'ডেঙ্গু জ্বরে তাৎক্ষণিক হাসপাতালে ভর্তির প্রয়োজনীয় সতর্ক সংকেতসমূহ (Warning signs) কী কী?',
    },
    {
      en: 'Why are NSAIDs such as Ibuprofen strictly contraindicated in suspected dengue?',
      bn: 'সন্দেহভাজন ডেঙ্গু জ্বরে আইবুপ্রোফেন বা এনএসএআইডি কেন সম্পূর্ণ নিষিদ্ধ?',
    },
    {
      en: 'When are sublingual nitrates strictly contraindicated during acute chest pain triage?',
      bn: 'তীব্র বুকে ব্যথার প্রাথমিক চিকিৎসায় নাইট্রোগ্লিসারিন কখন সম্পূর্ণ নিষিদ্ধ?',
    },
  ];

  const handleAsk = async (queryText?: string) => {
    const q = (queryText || question).trim();
    if (!q) return;

    setQuestion(q);
    setLoading(true);
    setAnswer(null);
    setCitations([]);
    setNotFound(false);
    setError(null);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, locale }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to query medical library');
      }

      if (!data.found || !data.answer) {
        setNotFound(true);
      } else {
        setAnswer(data.answer);
        setCitations(data.citations || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error executing query');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          badge={
            <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>{locale === 'bn' ? 'শুধু লাইব্রেরি' : 'Library only'}</span>
            </span>
          }
        />

        {/* Search & Query Input Box */}
        <Card data-tour="ask-input" className="border-border shadow-xs bg-card">
          <CardContent className="p-4 sm:p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder={t('placeholder')}
                  className="pl-9 pr-10 h-11 text-sm bg-background border-border"
                  disabled={loading}
                />
                {question && !loading && (
                  <button
                    type="button"
                    onClick={() => setQuestion('')}
                    aria-label={locale === 'bn' ? 'মুছুন' : 'Clear'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || !question.trim()}
                className="h-11 px-6 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0 shadow-xs"
              >
                <Search className="w-4 h-4" />
                <span>{loading ? t('searching') : t('askButton')}</span>
              </Button>
            </form>

            {/* Quick Sample Questions */}
            <div className="mt-4 pt-3 border-t border-border/60">
              <span className="text-xs font-medium text-muted-foreground block mb-2">
                {locale === 'bn' ? 'নমুনা প্রশ্নসমূহ' : 'Sample Questions'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {sampleQuestions.map((sq, idx) => {
                  const promptStr = locale === 'bn' ? sq.bn : sq.en;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAsk(promptStr)}
                      className="text-xs text-left min-h-9 px-3 py-1.5 rounded-md border border-border/80 bg-muted/30 hover:bg-muted/80 hover:border-primary/40 text-foreground transition-all cursor-pointer leading-relaxed"
                    >
                      &ldquo;{promptStr}&rdquo;
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading && (
          <LoadingState
            type="analysis-steps"
            steps={[
              'Analyzing inquiry against closed clinical corpus',
              'Searching internal peer-reviewed guidelines with hybrid retrieval',
              'Verifying verbatim evidence citations',
              'Synthesizing evidence-backed answer',
            ]}
            message={t('searching')}
          />
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </Card>
        )}

        {/* Abstention State (NotFound) */}
        {notFound && (
          <Card className="border-amber-500/30 bg-amber-500/5 p-6 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>{t('notFound')}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              DocMate AI complies strictly with the Closed Library rule: whenever internal medical sources do not contain substantiated evidence, the system abstains from generating speculative or unverified statements.
            </p>
          </Card>
        )}

        {/* Verified Answer Presentation */}
        {answer && (
          <Card data-tour="ask-citations" className="border-primary/30 shadow-xs bg-card space-y-4">
            <CardHeader className="p-5 pb-2 border-b border-border/60 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>{t('answer')}</span>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verbatim Verified</span>
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-5 pt-3 space-y-6">
              {/* Answer prose with inline citations */}
              <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {answer}
                {citations.length > 0 && (
                  <span className="inline-block ml-1">
                    {citations.map((c, idx) => (
                      <CitationChip key={c.chunk_id || idx} index={idx + 1} claim={c} />
                    ))}
                  </span>
                )}
              </div>

              {/* Citations breakdown */}
              {citations.length > 0 && (
                <div className="p-4 rounded-lg border border-border/80 bg-muted/20 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span>{t('citations')} ({citations.length})</span>
                  </div>

                  <div className="space-y-2">
                    {citations.map((c, idx) => (
                      <div
                        key={c.chunk_id || idx}
                        className="text-xs p-3 rounded-md bg-card border border-border space-y-1"
                      >
                        <div className="flex items-center justify-between font-semibold text-foreground">
                          <span className="text-primary font-bold">[{idx + 1}] {c.source_title || 'Medical Guideline'}</span>
                          {c.page && <span className="text-[11px] text-muted-foreground">Page {c.page}</span>}
                        </div>
                        <blockquote className="italic text-muted-foreground pl-2 border-l-2 border-primary/40 text-[11px]">
                          &ldquo;{c.quote}&rdquo;
                        </blockquote>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom rule disclaimer */}
              <div className="pt-2 text-[11px] text-muted-foreground flex items-center gap-1.5 border-t border-border/60">
                <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{t('disclaimer')}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
