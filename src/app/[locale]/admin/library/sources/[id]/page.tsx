'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  PlusCircle,
  FileText,
  AlertTriangle,
  Ban,
  History,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface SourceDetail {
  id: string;
  title: string;
  authors?: string[];
  year: number;
  year_verified?: boolean;
  source_type: string;
  license: string;
  lifecycle: string;
  status: string;
  evidence_level?: string;
  doi?: string;
  canonical_url?: string;
  created_at: string;
}

interface VersionRecord {
  id: string;
  version_no: number;
  change_note?: string;
  extraction_quality?: number;
  page_count?: number;
  token_count?: number;
  original_name?: string;
  storage_key?: string;
  size?: number;
  mime?: string;
  created_at: string;
}

interface ChunkStats {
  total_chunks: number;
  active_chunks: number;
  retired_chunks: number;
  total_tokens: number;
  table_chunks: number;
  reference_chunks: number;
}

interface CitationStats {
  notes_citations: number;
  quiz_citations: number;
}

export default function SourceDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const sourceId = params.id as string;

  const tIngest = useTranslations('ingestion');
  const tCommon = useTranslations('common');

  const [source, setSource] = useState<SourceDetail | null>(null);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [chunkStats, setChunkStats] = useState<ChunkStats | null>(null);
  const [citations, setCitations] = useState<CitationStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Version upload dialog state
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [uploadingVersion, setUploadingVersion] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Retire / Retract dialog states
  const [retireDialogOpen, setRetireDialogOpen] = useState(false);
  const [retractDialogOpen, setRetractDialogOpen] = useState(false);
  const [retireReason, setRetireReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(() => {
    fetch(`/api/admin/library/sources/${sourceId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.source) {
          setSource(data.source);
          setVersions(data.versions || []);
          setChunkStats(data.chunkStats || null);
          setCitations(data.citations || null);
        }
      })
      .catch(() => toast.error('Failed to load source details'))
      .finally(() => setLoading(false));
  }, [sourceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle New Version Upload
  const handleUploadNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionFile) {
      toast.error(locale === 'bn' ? 'অনুগ্রহ করে ফাইল নির্বাচন করুন।' : 'Please select a file.');
      return;
    }

    setUploadingVersion(true);
    try {
      const formData = new FormData();
      formData.append('files', newVersionFile);
      formData.append('rightsConfirmed', 'true');
      formData.append(
        'prefilledMetadata',
        JSON.stringify({
          sourceId,
          changeNote: changeNote.trim() || undefined,
        })
      );

      const res = await fetch('/api/admin/library/ingest', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit new version');

      toast.success(
        locale === 'bn'
          ? 'নতুন সংস্করণ ইনজেশন কিউতে জমা দেওয়া হয়েছে।'
          : 'New version submitted to ingestion queue.'
      );
      setVersionDialogOpen(false);
      setNewVersionFile(null);
      setChangeNote('');
      router.push(`/${locale}/admin/library`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingVersion(false);
    }
  };

  // Handle Retire Source
  const handleRetire = async () => {
    if (!retireReason.trim()) {
      toast.error(locale === 'bn' ? 'অবসর করার কারণ আবশ্যক।' : 'Retirement reason is required.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/library/sources/${sourceId}/retire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: retireReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retire failed');

      toast.success(locale === 'bn' ? data.messageBn : data.message);
      setRetireDialogOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Retire failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Retract Source
  const handleRetract = async () => {
    if (!retireReason.trim()) {
      toast.error(locale === 'bn' ? 'প্রত্যাহারের কারণ বা নোটিশ লিঙ্ক আবশ্যক।' : 'Retraction reason or notice is required.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/library/sources/${sourceId}/retract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: retireReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Retract failed');

      toast.success(locale === 'bn' ? data.messageBn : data.message);
      setRetractDialogOpen(false);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Retraction failed');
    } finally {
      setActionLoading(false);
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

  const isPublished = source.lifecycle === 'published' || source.status === 'active';
  const isRetired = source.lifecycle === 'retired';
  const isRetracted = source.lifecycle === 'retracted';
  const isReview = source.lifecycle === 'in_review';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back and Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href={`/${locale}/admin/library`}
            className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-7 text-xs px-2 mb-1 -ml-2 text-muted-foreground' })}
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            {locale === 'bn' ? 'লাইব্রেরিতে ফিরুন' : 'Back to Library'}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {source.title}
            </h1>
            {isRetracted ? (
              <Badge variant="destructive" className="text-[10px]">Retracted</Badge>
            ) : isRetired ? (
              <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                Retired
              </Badge>
            ) : isReview ? (
              <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                In Review
              </Badge>
            ) : isPublished ? (
              <Badge variant="default" className="text-[10px] bg-emerald-700 text-white">
                Published
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>{source.source_type} • Year: {source.year}</span>
            {source.year_verified === false && (
              <Badge variant="outline" className="text-[10px] border-amber-500/60 text-amber-800 dark:text-amber-300" data-testid="source-year-unverified">
                {tIngest('yearUnverified')}
              </Badge>
            )}
            <span>• License: {source.license}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isReview && (
            <Link
              href={`/${locale}/admin/library/sources/${sourceId}/review`}
              className={buttonVariants({ size: 'sm', className: 'text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white' })}
            >
              {locale === 'bn' ? 'রিভিউ পেজ' : 'Review Source'}
            </Link>
          )}

          {!isRetired && !isRetracted && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVersionDialogOpen(true)}
                className="text-xs h-8"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                {tIngest('uploadNewVersion')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRetireReason('');
                  setRetireDialogOpen(true);
                }}
                className="text-xs h-8 text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {tIngest('retireSource')}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  setRetireReason('');
                  setRetractDialogOpen(true);
                }}
                className="text-xs h-8"
              >
                <Ban className="w-3.5 h-3.5 mr-1" />
                {tIngest('retractSource')}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border/80 shadow-sm p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'bn' ? 'সক্রিয় খণ্ডাংশ' : 'Active Chunks'}
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {chunkStats?.active_chunks || 0}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Total {chunkStats?.total_chunks || 0} chunks ({chunkStats?.retired_chunks || 0} retired)
          </p>
        </Card>

        <Card className="border border-border/80 shadow-sm p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'bn' ? 'মোট টোকেন' : 'Total Tokens'}
          </div>
          <div className="text-2xl font-bold text-primary mt-1">
            {(chunkStats?.total_tokens || 0).toLocaleString()}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Cached in Vector Embedding Storage
          </p>
        </Card>

        <Card className="border border-border/80 shadow-sm p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'bn' ? 'উদ্ধৃতি ও রেফারেন্স' : 'Clinical Citations'}
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {(citations?.notes_citations || 0) + (citations?.quiz_citations || 0)}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Used across patient cases & student study
          </p>
        </Card>

        <Card className="border border-border/80 shadow-sm p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {locale === 'bn' ? 'মোট সংস্করণ' : 'Versions'}
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">
            {versions.length}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Immutable version history
          </p>
        </Card>
      </div>

      {/* Version History Table */}
      <Card className="border border-border/80 shadow-sm">
        <CardHeader className="p-4 pb-2 border-b border-border/50">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            {tIngest('versionHistory')}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            {locale === 'bn'
              ? 'ডকুমেন্টের সংস্করণ লগ। নতুন সংস্করণ সক্রিয় হলে পূর্ববর্তী সংস্করণ স্বয়ংক্রিয়ভাবে অবসরপ্রাপ্ত হয়।'
              : 'Immutable source versions. Chunks from previous versions remain citable by past reports.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="text-xs">{locale === 'bn' ? 'সংস্করণ' : 'Version'}</TableHead>
                <TableHead className="text-xs">{tIngest('changeNote')}</TableHead>
                <TableHead className="text-xs">{tIngest('qualityScore')}</TableHead>
                <TableHead className="text-xs">{locale === 'bn' ? 'ফাইল' : 'Original File'}</TableHead>
                <TableHead className="text-xs">{locale === 'bn' ? 'তারিখ' : 'Date'}</TableHead>
                <TableHead className="text-xs text-right">{tCommon('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id} className="hover:bg-muted/20">
                  <TableCell className="font-semibold text-xs">
                    Version {v.version_no}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {v.change_note || 'Initial ingestion release'}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px]">
                      {v.extraction_quality || 85} / 100
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {v.original_name ? (
                      <span className="font-mono text-[11px]">{v.original_name}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {v.storage_key && (
                      <a
                        href={`/api/admin/library/files/${v.storage_key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {locale === 'bn' ? 'ফাইল দেখুন' : 'View File'}
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upload New Version Dialog */}
      <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">{tIngest('uploadNewVersion')}</DialogTitle>
            <DialogDescription className="text-xs">
              {locale === 'bn'
                ? 'ডকুমেন্টের একটি হালনাগাদ সংস্করণ আপলোড করুন। অপরিবর্তিত খণ্ডাংশসমূহ স্বয়ংক্রিয়ভাবে ক্যাশ থেকে পুনরায় ব্যবহৃত হবে।'
                : 'Upload an updated copy. Chunks with matching content hash will be reused without new embedding API cost.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadNewVersion} className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold">{locale === 'bn' ? 'ফাইল নির্বাচন' : 'Select File'}</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-lg p-6 text-center cursor-pointer bg-muted/10"
              >
                <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs font-medium text-foreground">
                  {newVersionFile ? newVersionFile.name : (locale === 'bn' ? 'ফাইল ব্রাউজ করুন' : 'Browse updated file')}
                </p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".pdf,.docx,.txt,.md,.html,.json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) setNewVersionFile(e.target.files[0]);
                  }}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold">{tIngest('changeNote')}</label>
              <Input
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="e.g. 2026 Treatment Guideline revision"
                className="text-xs h-8"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setVersionDialogOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={uploadingVersion || !newVersionFile}>
                {uploadingVersion ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                {locale === 'bn' ? 'সংস্করণ আপলোড করুন' : 'Submit Version'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Retire Dialog */}
      <Dialog open={retireDialogOpen} onOpenChange={setRetireDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {tIngest('retireSource')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {locale === 'bn'
                ? 'রিসোর্সটি অবসর (Retire) করলে এটি আর সক্রিয় অনুসন্ধানে পাওয়া যাবে না, তবে পুরোনো প্রেসক্রিপশন ও অডিটের জন্য সংরক্ষিত থাকবে।'
                : 'Retiring this source excludes all chunks from future clinical queries. Existing consultation citations remain verified.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold">{locale === 'bn' ? 'অবসর করার কারণ' : 'Retirement Reason'}</label>
            <Input
              value={retireReason}
              onChange={(e) => setRetireReason(e.target.value)}
              placeholder="e.g. Superseded by 2026 protocol"
              className="text-xs h-8"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRetireDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={actionLoading || !retireReason.trim()}
              onClick={handleRetire}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {tIngest('retireSource')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retract Dialog */}
      <Dialog open={retractDialogOpen} onOpenChange={setRetractDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <Ban className="w-4 h-4" />
              {tIngest('retractSource')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {locale === 'bn'
                ? 'মেডিকেল প্রকাশক কর্তৃক প্রত্যাহার অথবা জরুরি আইনি নির্দেশের কারণে অবিলম্বে অনুসন্ধান থেকে সরিয়ে ফেলুন।'
                : 'Publisher retraction or copyright takedown. Chunks are withdrawn from active retrieval immediately.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold">{locale === 'bn' ? 'প্রত্যাহারের কারণ বা লিংক' : 'Retraction Notice / Reason'}</label>
            <Input
              value={retireReason}
              onChange={(e) => setRetireReason(e.target.value)}
              placeholder="e.g. Retraction notice DOI or copyright takedown"
              className="text-xs h-8"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRetractDialogOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actionLoading || !retireReason.trim()}
              onClick={handleRetract}
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {tIngest('retractSource')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
