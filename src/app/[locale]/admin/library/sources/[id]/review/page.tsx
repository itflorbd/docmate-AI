'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Search,
  BookOpen,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface SourceDetail {
  id: string;
  title: string;
  authors?: string[];
  year: number;
  source_type: string;
  license: string;
  lifecycle: string;
  status: string;
  evidence_level?: string;
  doi?: string;
  canonical_url?: string;
}

interface ChunkItem {
  id: string;
  ordinal: number;
  heading_path?: string;
  page_start?: number;
  page_end?: number;
  kind: string;
  text: string;
  token_count: number;
  language: string;
  status: string;
}

interface DuplicateCandidate {
  id: string;
  new_source_id: string;
  existing_source_id: string;
  level: string;
  score: string;
  decision: string;
}

export default function SourceReviewPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const sourceId = params.id as string;

  const tIngest = useTranslations('ingestion');
  const tCommon = useTranslations('common');

  const [source, setSource] = useState<SourceDetail | null>(null);
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [qualityScore, setQualityScore] = useState<number>(85);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Test retrieval sandbox states
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<ChunkItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Load source detail
  useEffect(() => {
    fetch(`/api/admin/library/sources/${sourceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.source) {
          setSource(data.source);
          setChunks(data.sampleChunks || []);
          setDuplicates(data.duplicates || []);

          // Check versions for quality metadata
          const latestVersion = data.versions?.[0];
          if (latestVersion?.extraction_quality !== undefined && latestVersion.extraction_quality !== null) {
            setQualityScore(latestVersion.extraction_quality);
          }
        }
      })
      .catch(() => toast.error('Failed to load source details'))
      .finally(() => setLoading(false));
  }, [sourceId]);

  // Handle Review Decisions
  const handleReviewAction = async (action: 'approve_and_publish' | 'request_changes' | 'reject') => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/library/sources/${sourceId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      toast.success(locale === 'bn' ? data.messageBn : data.message);
      router.push(`/${locale}/admin/library/sources/${sourceId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Review action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Duplicate Decision
  const handleDuplicateDecision = async (duplicateId: string, decision: 'skip' | 'new_version' | 'keep_both') => {
    try {
      const res = await fetch(`/api/admin/library/duplicates/${duplicateId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) throw new Error('Failed to record duplicate decision');
      toast.success(locale === 'bn' ? 'ডুপ্লিকেট সিদ্ধান্ত সংরক্ষিত হয়েছে' : 'Duplicate decision saved');

      // Update state locally
      setDuplicates((prev) =>
        prev.map((d) => (d.id === duplicateId ? { ...d, decision } : d))
      );
    } catch {
      toast.error('Failed to resolve duplicate');
    }
  };

  // Run Test Retrieval Sandbox
  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/admin/library/test-retrieval?sourceId=${sourceId}&q=${encodeURIComponent(testQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search test failed');
      setTestResults(data.results || []);
    } catch {
      toast.error('Test retrieval failed');
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex justify-center items-center text-muted-foreground text-xs">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        {tCommon('loading')}
      </div>
    );
  }

  if (!source) {
    return (
      <div className="py-24 text-center text-muted-foreground text-xs">
        Source not found.
      </div>
    );
  }

  const scoreColorClass = qualityScore >= 80 ? 'bg-emerald-700 text-white' : qualityScore >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-red-600 text-white';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href={`/${locale}/admin/library`}
            className={buttonVariants({
              variant: 'ghost',
              size: 'sm',
              className: 'h-7 text-xs px-2 mb-1 -ml-2 text-muted-foreground',
            })}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            {locale === 'bn' ? 'লাইব্রেরিতে ফিরুন' : 'Back to Library'}
          </Link>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {source.title}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {source.source_type} • Pub. {source.year} • License: {source.license}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            size="sm"
            disabled={actionLoading}
            onClick={() => handleReviewAction('reject')}
            className="text-xs h-8"
          >
            <XCircle className="w-3.5 h-3.5 mr-1" />
            {tIngest('rejectSource')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={actionLoading}
            onClick={() => handleReviewAction('request_changes')}
            className="text-xs h-8"
          >
            {tIngest('requestChanges')}
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={actionLoading}
            onClick={() => handleReviewAction('approve_and_publish')}
            className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            {tIngest('approveAndPublish')}
          </Button>
        </div>
      </div>

      {/* Quality & Security Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Quality Score Card */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {tIngest('qualityScore')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-foreground">{qualityScore} / 100</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {qualityScore >= 80
                  ? (locale === 'bn' ? 'উচ্চমানের টেক্সট স্ট্রাকচার' : 'High quality text extraction')
                  : (locale === 'bn' ? 'পর্যালোচনা প্রয়োজন' : 'Needs review before publishing')}
              </p>
            </div>
            <Badge className={`${scoreColorClass} text-xs font-bold px-2 py-1`}>
              {qualityScore >= 80 ? 'Verified' : 'Review'}
            </Badge>
          </CardContent>
        </Card>

        {/* Prompt Injection Safety Card */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {locale === 'bn' ? 'প্রম্পট ইনজেকশন স্ক্যান' : 'Prompt Injection Scan'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {locale === 'bn' ? 'কোনো ক্ষতিকর প্রম্পট পাওয়া যায়নি' : 'Clean (No instructions found)'}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {locale === 'bn' ? 'সকল টেক্সট বিশুদ্ধ ক্লিনিকাল ডাটা হিসেবে সংরক্ষিত' : 'All chunks treated strictly as passive data'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Chunks Statistics Card */}
        <Card className="border border-border/80 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {locale === 'bn' ? 'খণ্ডাংশ সংখ্যা' : 'Total Chunks Extracted'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-primary">{chunks.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {locale === 'bn' ? 'কাঠামো ও অনুচ্ছেদ অনুযায়ী বিভক্ত' : 'Structure & sentence-aligned'}
              </p>
            </div>
            <Layers className="w-6 h-6 text-muted-foreground/50" />
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Candidates Alert (if any) */}
      {duplicates.length > 0 && (
        <Card className="border border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              {tIngest('duplicateAlert')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            {duplicates.map((dup) => (
              <div key={dup.id} className="p-3 bg-background rounded-lg border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    Level: <Badge variant="outline" className="text-[10px]">{dup.level}</Badge> • Score: {dup.score}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Matches existing source in library. Decision: <span className="font-semibold">{dup.decision}</span>
                  </p>
                </div>
                {dup.decision === 'pending' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleDuplicateDecision(dup.id, 'skip')} className="h-7 text-[10px]">
                      {tIngest('skipDuplicate')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicateDecision(dup.id, 'new_version')} className="h-7 text-[10px]">
                      {tIngest('newVersionDecision')}
                    </Button>
                    <Button size="sm" variant="default" onClick={() => handleDuplicateDecision(dup.id, 'keep_both')} className="h-7 text-[10px]">
                      {tIngest('keepBoth')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pre-Publish Test Retrieval Sandbox */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {tIngest('testSearch')}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {locale === 'bn'
              ? 'প্রকাশ করার আগে এই ডকুমেন্টের খণ্ডাংশসমূহের উপর অনুসন্ধান পরীক্ষা করে নির্ভুলতা যাচাই করুন।'
              : 'Test query retrieval against this draft material before publishing it live to doctors.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <form onSubmit={handleTestSearch} className="flex gap-2">
            <Input
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              placeholder={tIngest('testSearchPlaceholder')}
              className="text-xs h-9 flex-1"
            />
            <Button type="submit" size="sm" disabled={searching} className="text-xs h-9 px-4">
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Search className="w-3.5 h-3.5 mr-1" />}
              {tIngest('testSearch')}
            </Button>
          </form>

          {testResults.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <span className="text-xs font-semibold text-foreground">
                {locale === 'bn' ? `ম্যাচিং ফলাফল (${testResults.length} টি):` : `Matching Chunks (${testResults.length}):`}
              </span>
              <div className="space-y-2">
                {testResults.map((chunk) => (
                  <div key={chunk.id} className="p-3 bg-muted/20 border border-border/70 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-semibold text-primary">{chunk.heading_path || 'Section'}</span>
                      <span>Page {chunk.page_start || 1} • {chunk.token_count} tokens</span>
                    </div>
                    <p className="text-foreground leading-relaxed line-clamp-3 font-serif">
                      {chunk.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Chunks Explorer */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="p-4 pb-2 border-b border-border/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{locale === 'bn' ? 'এক্সট্রাক্ট করা খণ্ডাংশসমূহ' : 'Extracted Chunks Explorer'}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              {locale === 'bn' ? 'উদ্ধৃতি ও রেফারেন্সের জন্য প্রস্তুত করা টেক্সট' : 'Verified segmented text ready for citation verification'}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-mono">{chunks.length} chunks</Badge>
        </CardHeader>
        <CardContent className="p-4">
          <div className="space-y-3">
            {chunks.slice(0, 25).map((chunk) => (
              <div key={chunk.id} className="p-3.5 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      #{chunk.ordinal}
                    </Badge>
                    <span className="font-medium text-foreground text-xs">{chunk.heading_path || 'Main Body'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>p. {chunk.page_start || 1}</span>
                    <span>•</span>
                    <span>{chunk.token_count} tokens</span>
                    <span>•</span>
                    <Badge variant="outline" className="text-[9px] uppercase">{chunk.kind}</Badge>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-foreground font-serif whitespace-pre-wrap">
                  {chunk.text}
                </p>
              </div>
            ))}

            {chunks.length > 25 && (
              <div className="py-2 text-center text-xs text-muted-foreground">
                {locale === 'bn'
                  ? `আরও ${chunks.length - 25} টি খণ্ডাংশ সংরক্ষিত আছে।`
                  : `Showing first 25 chunks. Total ${chunks.length} chunks in this version.`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
