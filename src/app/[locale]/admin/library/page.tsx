'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  BookOpen,
  PlusCircle,
  Clock,
  Settings,
  UploadCloud,
  Link2,
  FileCode,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RotateCcw,
  Ban,
  Check,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  FileText,
  Layers,
  CopyCheck,
  Sparkles,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface SourceRecord {
  id: string;
  title: string;
  type: string;
  year: number;
  license: string;
  url?: string | null;
  status: string;
  lifecycle?: string;
  chunkCount: number;
  createdAt: string;
}

interface IngestJobRecord {
  id: string;
  source_id: string | null;
  input_type: string;
  status: string;
  stage: string;
  progress: number;
  error: string | null;
  attempts: number;
  estimated_tokens: number;
  estimated_cost: string;
  tokens_used: number;
  created_at: string;
  metadata?: {
    fileStorageKey?: string;
    fileName?: string;
    isDuplicate?: boolean;
    duplicateReused?: boolean;
    duplicateLevel?: string;
    existingSourceId?: string;
    existingTitle?: string;
    existingVersionNo?: number;
    duplicateMessage?: string;
    extractedChars?: number;
    extractedPages?: number;
    chunksCount?: number;
    ocrStatus?: 'native' | 'ocr_applied' | 'not_needed' | 'failed_ocr';
    embeddingStatus?: string;
    logs?: Array<{
      timestamp: string;
      stage: string;
      message: string;
      level?: 'info' | 'warn' | 'error';
    }>;
    lastFailedStage?: string;
    failedStage?: string;
    chunkStats?: {
      totalChunks: number;
      totalTokens: number;
      totalCharacters: number;
      avgTokensPerChunk: number;
      entityCounts: Record<string, number>;
      languageDistribution: Record<string, number>;
    };
    [key: string]: unknown;
  };
}

export default function AdminLibraryPage() {
  const locale = useLocale();
  const tIngest = useTranslations('ingestion');
  const tCommon = useTranslations('common');

  const [activeTab, setActiveTab] = useState<string>('sources');
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [jobs, setJobs] = useState<IngestJobRecord[]>([]);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState<IngestJobRecord | null>(null);
  const [settings, setSettings] = useState<{
    dailyBudget: string;
    approvalThreshold: string;
    ocrEnabled: boolean;
  }>({
    dailyBudget: '10.00',
    approvalThreshold: '2.00',
    ocrEnabled: false,
  });

  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Add Resource
  const [addMethod, setAddMethod] = useState<'upload' | 'link' | 'json'>('upload');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [linkInput, setLinkInput] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [prefilledTitle, setPrefilledTitle] = useState('');
  const [prefilledAuthors, setPrefilledAuthors] = useState('');
  const [prefilledYear, setPrefilledYear] = useState<string>(new Date().getFullYear().toString());
  const [sourceType, setSourceType] = useState<string>('guideline');
  const [license, setLicense] = useState<string>('CC-BY-4.0');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [medicineErrorNotice, setMedicineErrorNotice] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load sources
  const loadSources = () => {
    fetch('/api/admin/library')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.sources) setSources(data.sources);
      })
      .catch(() => toast.error('Failed to load sources'))
      .finally(() => setLoadingSources(false));
  };

  // Load jobs queue
  const loadJobs = () => {
    fetch('/api/admin/library/queue')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.jobs) setJobs(data.jobs);
      })
      .catch(() => toast.error('Failed to load queue'))
      .finally(() => setLoadingJobs(false));
  };

  // Load settings
  const loadSettings = () => {
    fetch('/api/admin/library/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          setSettings({
            dailyBudget: data.settings['ingestion.daily_budget_usd'] || '10.00',
            approvalThreshold: data.settings['ingestion.approval_threshold_usd'] || '2.00',
            ocrEnabled: data.settings['ingest.ocr_enabled'] === 'true',
          });
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadSources();
      loadJobs();
      loadSettings();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Poll jobs queue periodically when on queue tab
  useEffect(() => {
    if (activeTab !== 'queue') return;
    const interval = setInterval(() => {
      fetch('/api/admin/library/queue')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.jobs) setJobs(data.jobs);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTab]);

  // Handle Ingestion Submit
  const handleIngestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMedicineErrorNotice(null);

    if (!rightsConfirmed) {
      toast.error(
        locale === 'bn'
          ? 'আইনি অধিকার বা উন্মুক্ত লাইসেন্স নিশ্চিত করা বাধ্যতামূলক।'
          : 'You must confirm legal rights before ingesting.'
      );
      return;
    }

    setSubmitting(true);

    const parseJsonResponse = async (res: Response) => {
      try {
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      } catch {
        return {};
      }
    };

    try {
      if (addMethod === 'upload') {
        if (selectedFiles.length === 0) {
          toast.error(locale === 'bn' ? 'অনুগ্রহ করে ফাইল নির্বাচন করুন।' : 'Please select at least one file.');
          setSubmitting(false);
          return;
        }

        const formData = new FormData();
        selectedFiles.forEach((file) => formData.append('files', file));
        formData.append('rightsConfirmed', 'true');

        const metadata = {
          title: prefilledTitle || undefined,
          authors: prefilledAuthors ? prefilledAuthors.split(',').map((a) => a.trim()) : undefined,
          year: prefilledYear ? parseInt(prefilledYear, 10) : undefined,
          sourceType,
          license,
        };
        formData.append('prefilledMetadata', JSON.stringify(metadata));

        const res = await fetch('/api/admin/library/ingest', {
          method: 'POST',
          body: formData,
        });

        const data = await parseJsonResponse(res);
        if (!res.ok) {
          if (data.error === 'medicine_data_rejected') {
            setMedicineErrorNotice(locale === 'bn' ? data.messageBn : data.message);
            return;
          }
          const fallbackMsg = locale === 'bn' ? `ফাইল আপলোড ব্যর্থ হয়েছে (HTTP ${res.status})` : `Failed to upload files (HTTP ${res.status})`;
          const errText = (locale === 'bn' ? (data.messageBn || data.message) : (data.message || data.error)) || fallbackMsg;
          throw new Error(errText);
        }

        toast.success(locale === 'bn' ? (data.messageBn || data.message) : data.message);
        setSelectedFiles([]);
        setActiveTab('queue');
        loadJobs();
      } else if (addMethod === 'link') {
        if (!linkInput.trim()) {
          toast.error(locale === 'bn' ? 'অনুগ্রহ করে URL বা DOI প্রদান করুন।' : 'Please enter URL or DOI.');
          setSubmitting(false);
          return;
        }

        let inputType: 'url' | 'doi' | 'pmid' = 'url';
        let cleaned = linkInput.trim();
        if (cleaned.startsWith('10.') || cleaned.includes('doi.org/10.')) {
          inputType = 'doi';
          if (cleaned.includes('doi.org/')) cleaned = cleaned.split('doi.org/')[1];
        } else if (cleaned.toLowerCase().startsWith('pmid:') || /^\d{7,9}$/.test(cleaned)) {
          inputType = 'pmid';
          cleaned = cleaned.replace(/pmid:/i, '').trim();
        }

        const res = await fetch('/api/admin/library/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputType,
            url: inputType === 'url' ? cleaned : undefined,
            doi: inputType === 'doi' ? cleaned : undefined,
            pmid: inputType === 'pmid' ? cleaned : undefined,
            rightsConfirmed: true,
            prefilledMetadata: {
              title: prefilledTitle || undefined,
              authors: prefilledAuthors ? prefilledAuthors.split(',').map((a) => a.trim()) : undefined,
              year: prefilledYear ? parseInt(prefilledYear, 10) : undefined,
              sourceType,
              license,
            },
          }),
        });

        const data = await parseJsonResponse(res);
        if (!res.ok) {
          const fallbackMsg = locale === 'bn' ? `লিংক সংযুক্ত করা যায়নি (HTTP ${res.status})` : `Failed to enqueue link (HTTP ${res.status})`;
          const errText = (locale === 'bn' ? (data.messageBn || data.message) : (data.message || data.error)) || fallbackMsg;
          throw new Error(errText);
        }

        toast.success(locale === 'bn' ? (data.messageBn || data.message) : data.message);
        setLinkInput('');
        setActiveTab('queue');
        loadJobs();
      } else if (addMethod === 'json') {
        if (!jsonInput.trim()) {
          toast.error(locale === 'bn' ? 'অনুগ্রহ করে JSON পে-লোড প্রদান করুন।' : 'Please provide JSON payload.');
          setSubmitting(false);
          return;
        }

        let parsedPayload: unknown;
        try {
          parsedPayload = JSON.parse(jsonInput);
        } catch {
          toast.error(locale === 'bn' ? 'ভুল JSON ফরম্যাট।' : 'Invalid JSON format.');
          setSubmitting(false);
          return;
        }

        const res = await fetch('/api/admin/library/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputType: 'json',
            jsonPayload: parsedPayload,
            rightsConfirmed: true,
            prefilledMetadata: {
              title: prefilledTitle || undefined,
              sourceType,
              license,
            },
          }),
        });

        const data = await parseJsonResponse(res);
        if (!res.ok) {
          if (data.error === 'medicine_data_rejected') {
            setMedicineErrorNotice(locale === 'bn' ? data.messageBn : data.message);
            return;
          }
          const fallbackMsg = locale === 'bn' ? `JSON পে-লোড যোগ করা যায়নি (HTTP ${res.status})` : `Failed to enqueue JSON payload (HTTP ${res.status})`;
          const errText = (locale === 'bn' ? (data.messageBn || data.message) : (data.message || data.error)) || fallbackMsg;
          throw new Error(errText);
        }

        toast.success(locale === 'bn' ? (data.messageBn || data.message) : data.message);
        setJsonInput('');
        setActiveTab('queue');
        loadJobs();
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Job Actions
  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/library/queue/${jobId}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed');
      toast.success(locale === 'bn' ? 'জবটি পুনরায় শুরু করা হয়েছে' : 'Job re-enqueued');
      loadJobs();
    } catch {
      toast.error('Failed to retry job');
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/library/queue/${jobId}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error('Cancel failed');
      toast.success(locale === 'bn' ? 'জবটি বাতিল করা হয়েছে' : 'Job cancelled');
      loadJobs();
    } catch {
      toast.error('Failed to cancel job');
    }
  };

  const handleApproveBudget = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/library/queue/${jobId}/approve-budget`, { method: 'POST' });
      if (!res.ok) throw new Error('Approval failed');
      toast.success(locale === 'bn' ? 'বাজেট অনুমোদিত হয়েছে' : 'Budget approved');
      loadJobs();
    } catch {
      toast.error('Failed to approve budget');
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      const res = await fetch('/api/admin/library/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            'ingestion.daily_budget_usd': settings.dailyBudget,
            'ingestion.approval_threshold_usd': settings.approvalThreshold,
            'ingest.ocr_enabled': settings.ocrEnabled ? 'true' : 'false',
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      toast.success(locale === 'bn' ? 'সেটিংস সফলভাবে সংরক্ষিত হয়েছে' : 'Settings saved successfully');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {tIngest('title')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {tIngest('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadSources();
              loadJobs();
            }}
            className="text-xs h-8"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            {tCommon('retry')}
          </Button>
          <Button
            size="sm"
            onClick={() => setActiveTab('add')}
            className="text-xs h-8"
          >
            <PlusCircle className="w-3.5 h-3.5 mr-1" />
            {tIngest('tabs.add')}
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto h-auto p-1 bg-muted/60">
          <TabsTrigger value="sources" className="text-xs py-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            {tIngest('tabs.sources')}
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
              {sources.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="add" className="text-xs py-2 flex items-center gap-1.5">
            <PlusCircle className="w-3.5 h-3.5" />
            {tIngest('tabs.add')}
          </TabsTrigger>
          <TabsTrigger value="queue" className="text-xs py-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {tIngest('tabs.queue')}
            {jobs.filter((j) => j.status === 'processing' || j.status === 'pending').length > 0 && (
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="text-xs py-2 flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5" />
            {tIngest('tabs.settings')}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Sources Table */}
        <TabsContent value="sources" className="mt-4 space-y-4">
          <Card className="border border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">{tIngest('tabs.sources')}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {locale === 'bn' ? 'প্রকাশিত ও পর্যালোচনাধীন উৎস' : 'Published and in-review sources'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSources ? (
                <div className="py-12 flex justify-center items-center text-muted-foreground text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {tCommon('loading')}
                </div>
              ) : sources.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  {locale === 'bn' ? 'কোনো রিসোর্স পাওয়া যায়নি।' : 'No library resources found.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-xs">{locale === 'bn' ? 'শিরোনাম ও লেখক' : 'Title & Metadata'}</TableHead>
                        <TableHead className="text-xs">{tIngest('sourceType')}</TableHead>
                        <TableHead className="text-xs">{locale === 'bn' ? 'বছর' : 'Year'}</TableHead>
                        <TableHead className="text-xs">{tIngest('license')}</TableHead>
                        <TableHead className="text-xs">{locale === 'bn' ? 'খণ্ডাংশ (Chunks)' : 'Chunks'}</TableHead>
                        <TableHead className="text-xs">{tCommon('status')}</TableHead>
                        <TableHead className="text-xs text-right">{tCommon('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sources.map((s) => {
                        const isPublished = s.lifecycle === 'published' || s.status === 'active';
                        const isRetired = s.lifecycle === 'retired';
                        const isRetracted = s.lifecycle === 'retracted';
                        const isReview = s.lifecycle === 'in_review';

                        return (
                          <TableRow key={s.id} className="hover:bg-muted/20">
                            <TableCell className="font-medium text-xs max-w-xs md:max-w-sm truncate">
                              <Link
                                href={`/${locale}/admin/library/sources/${s.id}`}
                                className="text-foreground hover:text-primary transition-colors hover:underline block truncate"
                              >
                                {s.title}
                              </Link>
                              {s.url && (
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-muted-foreground hover:underline inline-flex items-center gap-1 mt-0.5"
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  {s.url.slice(0, 40)}...
                                </a>
                              )}
                            </TableCell>
                            <TableCell className="text-xs capitalize">{s.type || 'Guideline'}</TableCell>
                            <TableCell className="text-xs">{s.year}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[10px]">
                                {s.license || 'Clinical Open'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <span className="font-semibold text-primary">{s.chunkCount}</span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {isRetracted ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  Retracted
                                </Badge>
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
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  {s.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-right space-x-1">
                              {isReview && (
                                <Link
                                  href={`/${locale}/admin/library/sources/${s.id}/review`}
                                  className={buttonVariants({
                                    size: 'sm',
                                    variant: 'default',
                                    className: 'h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700',
                                  })}
                                >
                                  {locale === 'bn' ? 'রিভিউ করুন' : 'Review'}
                                </Link>
                              )}
                              <Link
                                href={`/${locale}/admin/library/sources/${s.id}`}
                                className={buttonVariants({
                                  size: 'sm',
                                  variant: 'outline',
                                  className: 'h-7 text-xs px-2',
                                })}
                              >
                                {tCommon('viewDetails')}
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Add New Resource */}
        <TabsContent value="add" className="mt-4 space-y-4">
          {medicineErrorNotice && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">{tIngest('medicineWarning')}</h4>
                <p className="text-xs">{medicineErrorNotice}</p>
                <div className="pt-2">
                  <Link
                    href={`/${locale}/controller`}
                    className={buttonVariants({
                      size: 'sm',
                      variant: 'outline',
                      className: 'h-7 text-xs border-amber-500 text-amber-900 dark:text-amber-100',
                    })}
                  >
                    {tIngest('goToController')}
                  </Link>
                </div>
              </div>
            </div>
          )}

          <Card className="border border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">{tIngest('tabs.add')}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {locale === 'bn'
                  ? 'গাইডলাইন, জার্নাল আর্টিকেল বা পাঠ্যপুস্তক নিরাপদ ইনজেশন পাইপলাইনে পাঠান'
                  : 'Submit verified medical reference literature into the closed ingestion pipeline'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
              {/* Method Switcher */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-muted/40 rounded-lg max-w-md">
                <Button
                  type="button"
                  variant={addMethod === 'upload' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setAddMethod('upload')}
                  className="text-xs h-8 flex items-center justify-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {tIngest('uploadTab')}
                </Button>
                <Button
                  type="button"
                  variant={addMethod === 'link' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setAddMethod('link')}
                  className="text-xs h-8 flex items-center justify-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  {tIngest('linkTab')}
                </Button>
                <Button
                  type="button"
                  variant={addMethod === 'json' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setAddMethod('json')}
                  className="text-xs h-8 flex items-center justify-center gap-1.5"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  {tIngest('jsonTab')}
                </Button>
              </div>

              <form onSubmit={handleIngestSubmit} className="space-y-4">
                {/* File Upload Method */}
                {addMethod === 'upload' && (
                  <div className="space-y-3">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-muted/10 hover:bg-muted/20"
                    >
                      <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs font-semibold text-foreground">{tIngest('dragDrop')}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{tIngest('supportedFormats')}</p>
                      <input
                        type="file"
                        ref={fileInputRef}
                        multiple
                        accept=".pdf,.docx,.txt,.md,.html,.htm,.json,.zip"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            setSelectedFiles(Array.from(e.target.files));
                          }
                        }}
                      />
                    </div>

                    {selectedFiles.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {locale === 'bn' ? `নির্বাচিত ফাইলসমূহ (${selectedFiles.length} টি):` : `Selected files (${selectedFiles.length}):`}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {selectedFiles.map((file, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs py-1 px-2.5 flex items-center gap-1.5">
                              <span>{file.name}</span>
                              <span className="text-[10px] text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Link or DOI Method */}
                {addMethod === 'link' && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">{tIngest('urlOrDoiLabel')}</label>
                    <Input
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      placeholder={tIngest('urlPlaceholder')}
                      className="text-xs h-9"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      {locale === 'bn'
                        ? 'DOI (উদাঃ 10.1056/NEJMoa...), PubMed ID (PMID: 32000000), অথবা উন্মুক্ত আর্টিকেলের ওয়েব URL।'
                        : 'DOI (e.g. 10.1056/NEJMoa...), PubMed ID (PMID), or open access journal webpage.'}
                    </p>
                  </div>
                )}

                {/* JSON Literature Method */}
                {addMethod === 'json' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">{tIngest('jsonLabel')}</label>
                      <button
                        type="button"
                        onClick={() => {
                          const template = {
                            title: 'National Guideline for Management of Dengue Fever',
                            authors: ['DGHS Bangladesh', 'Clinical Committee'],
                            year: 2024,
                            sourceType: 'guideline',
                            license: 'Open Access / DGHS',
                            sections: [
                              {
                                heading: 'Fluid Management in Dengue',
                                page: 1,
                                text: 'Maintenance fluid is calculated based on Holliday-Segar formula. Avoid fluid overload.',
                              },
                            ],
                          };
                          const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = 'docmate-literature-template.json';
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        {tIngest('downloadTemplate')}
                      </button>
                    </div>
                    <textarea
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      rows={6}
                      placeholder='{ "title": "Clinical Guideline", "year": 2024, "sections": [...] }'
                      className="w-full text-xs font-mono p-3 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Optional Metadata Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{tIngest('prefilledTitle')}</label>
                    <Input
                      value={prefilledTitle}
                      onChange={(e) => setPrefilledTitle(e.target.value)}
                      placeholder="e.g. WHO Pneumonia Management Protocol"
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">{tIngest('prefilledAuthors')}</label>
                    <Input
                      value={prefilledAuthors}
                      onChange={(e) => setPrefilledAuthors(e.target.value)}
                      placeholder="e.g. World Health Organization"
                      className="text-xs h-8"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tIngest('prefilledYear')}</label>
                      <Input
                        type="number"
                        value={prefilledYear}
                        onChange={(e) => setPrefilledYear(e.target.value)}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tIngest('sourceType')}</label>
                      <select aria-label={tIngest('sourceType')}
                        value={sourceType}
                        onChange={(e) => setSourceType(e.target.value)}
                        className="w-full text-xs h-8 px-2 rounded-md border border-border bg-background text-foreground"
                      >
                        <option value="guideline">Guideline</option>
                        <option value="textbook">Textbook</option>
                        <option value="journal_article">Journal Article</option>
                        <option value="review">Review</option>
                        <option value="case_report">Case Report</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{tIngest('license')}</label>
                      <select aria-label={tIngest('license')}
                        value={license}
                        onChange={(e) => setLicense(e.target.value)}
                        className="w-full text-xs h-8 px-2 rounded-md border border-border bg-background text-foreground"
                      >
                        <option value="CC-BY-4.0">CC-BY-4.0</option>
                        <option value="Open Access / DGHS">Open Access / DGHS</option>
                        <option value="Public Domain">Public Domain</option>
                        <option value="Clinical Open">Clinical Open</option>
                        <option value="All Rights Reserved">All Rights Reserved</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Legal Rights Confirmation Checkbox (Mandatory) */}
                <div className="p-3.5 rounded-lg border border-primary/20 bg-primary/5 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="rightsCheck"
                    checked={rightsConfirmed}
                    onChange={(e) => setRightsConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="rightsCheck" className="text-xs text-foreground cursor-pointer font-medium leading-relaxed">
                    {tIngest('rightsConfirmation')}
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={submitting || !rightsConfirmed} className="text-xs h-9">
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                        {locale === 'bn' ? 'প্রক্রিয়াধীন...' : 'Submitting...'}
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5" />
                        {tIngest('startIngestion')}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Ingestion Queue Monitor & Processing Dashboard */}
        <TabsContent value="queue" className="mt-4 space-y-4">
          <Card className="border border-border/80 shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold">{tIngest('tabs.queue')}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {locale === 'bn'
                    ? 'রিসোর্স ইনজেশন, টেক্সট এক্সট্রাকশন, ওসিআর ও চাঙ্কিং পাইপলাইন রিয়েল-টাইম মনিটর'
                    : 'Resource ingestion, text extraction, OCR, and smart chunking pipeline real-time monitor'}
                </CardDescription>
              </div>
              <Button size="sm" variant="ghost" onClick={loadJobs} className="h-7 text-xs">
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                {tCommon('retry')}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loadingJobs ? (
                <div className="py-12 flex justify-center items-center text-muted-foreground text-xs">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  {tCommon('loading')}
                </div>
              ) : jobs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-xs">
                  {locale === 'bn' ? 'কোনো ইনজেশন জব কিউতে নেই।' : 'No active or recent ingestion jobs found.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-xs">ID</TableHead>
                        <TableHead className="text-xs">{locale === 'bn' ? 'ফাইল / ইনপুট' : 'Input / File'}</TableHead>
                        <TableHead className="text-xs">{tIngest('extractionStatus')}</TableHead>
                        <TableHead className="text-xs">{tIngest('ocrStatus')}</TableHead>
                        <TableHead className="text-xs">{tIngest('chunksCreated')}</TableHead>
                        <TableHead className="text-xs">{tIngest('embeddingStatus')}</TableHead>
                        <TableHead className="text-xs">{tIngest('duplicateStatus')}</TableHead>
                        <TableHead className="text-xs">{tIngest('stage')}</TableHead>
                        <TableHead className="text-xs">{tCommon('status')}</TableHead>
                        <TableHead className="text-xs text-right">{tCommon('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => {
                        const isPending = job.status === 'pending';
                        const isProcessing = job.status === 'processing';
                        const isCompleted = job.status === 'completed';
                        const isFailed = job.status === 'failed';
                        const isAwaiting = job.status === 'awaiting_approval';
                        const isDupReused = !!job.metadata?.duplicateReused;

                        return (
                          <TableRow key={job.id} className="hover:bg-muted/20">
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {job.id.slice(0, 8)}
                            </TableCell>

                            {/* Input / Filename */}
                            <TableCell className="text-xs font-medium max-w-[140px] truncate" title={job.metadata?.fileName || job.input_type}>
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate" title={String((job.metadata?.fileName || job.input_type) ?? '')}>{job.metadata?.fileName || job.input_type}</span>
                              </div>
                            </TableCell>

                            {/* Extraction Status & Chars */}
                            <TableCell className="text-xs">
                              {job.metadata?.extractedChars ? (
                                <div className="space-y-0.5">
                                  <span className="font-semibold">{job.metadata.extractedChars.toLocaleString()} chars</span>
                                  <div className="text-[10px] text-muted-foreground">{job.metadata.extractedPages || 1} {locale === 'bn' ? 'পৃষ্ঠা' : 'pages'}</div>
                                </div>
                              ) : isProcessing && ['receiving', 'extracting'].includes(job.stage) ? (
                                <span className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Extracting...
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>

                            {/* OCR Status */}
                            <TableCell className="text-xs">
                              {job.metadata?.ocrStatus === 'ocr_applied' ? (
                                <Badge className="text-[9px] bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1 w-fit">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  {tIngest('ocrApplied')}
                                </Badge>
                              ) : job.metadata?.ocrStatus === 'native' ? (
                                <Badge variant="outline" className="text-[9px] w-fit">
                                  {tIngest('nativeText')}
                                </Badge>
                              ) : job.metadata?.ocrStatus === 'not_needed' ? (
                                <span className="text-[10px] text-muted-foreground">{tIngest('notRequired')}</span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            {/* Chunks Created */}
                            <TableCell className="text-xs">
                              {job.metadata?.chunksCount !== undefined && job.metadata.chunksCount > 0 ? (
                                <Badge variant="secondary" className="text-[10px] font-mono">
                                  {job.metadata.chunksCount} {locale === 'bn' ? 'টি চাঙ্ক' : 'chunks'}
                                </Badge>
                              ) : isProcessing && job.stage === 'chunking' ? (
                                <span className="text-[10px] text-muted-foreground italic">Chunking...</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">-</span>
                              )}
                            </TableCell>

                            {/* Embedding Status */}
                            <TableCell className="text-xs">
                              {job.metadata?.embeddingStatus === 'completed' || isCompleted ? (
                                <Badge variant="outline" className="text-[9px] border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10">
                                  Embedded
                                </Badge>
                              ) : job.metadata?.embeddingStatus === 'reused' ? (
                                <Badge variant="outline" className="text-[9px] border-blue-500 text-blue-700 dark:text-blue-300 bg-blue-500/10">
                                  Reused
                                </Badge>
                              ) : isProcessing && job.stage === 'embedding' ? (
                                <span className="text-[10px] text-primary italic flex items-center gap-1">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" /> Vectorizing...
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Pending</span>
                              )}
                            </TableCell>

                            {/* Duplicate Status */}
                            <TableCell className="text-xs">
                              {isDupReused ? (
                                <Link
                                  href={`/${locale}/admin/library/sources/${job.metadata?.existingSourceId}`}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:underline"
                                  title={job.metadata?.duplicateMessage || 'Reused existing library source'}
                                >
                                  <CopyCheck className="w-3 h-3 text-blue-600 shrink-0" />
                                  <span className="truncate max-w-[110px]">
                                    {tIngest('reusedExisting')}
                                  </span>
                                </Link>
                              ) : isCompleted ? (
                                <Badge variant="outline" className="text-[9px] text-muted-foreground">
                                  {tIngest('uniqueFile')}
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            {/* Stage & Progress */}
                            <TableCell className="text-xs w-28">
                              <div className="space-y-1">
                                <Badge variant="outline" className="text-[9px] uppercase tracking-wider font-semibold">
                                  {job.stage}
                                </Badge>
                                <Progress value={job.progress} className="h-1.5" />
                              </div>
                            </TableCell>

                            {/* Overall Status */}
                            <TableCell className="text-xs">
                              {isCompleted ? (
                                <Badge variant="default" className="text-[10px] bg-emerald-700 text-white flex items-center gap-1 w-fit">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  Completed
                                </Badge>
                              ) : isProcessing ? (
                                <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 flex items-center gap-1 w-fit">
                                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  Processing
                                </Badge>
                              ) : isAwaiting ? (
                                <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 dark:text-amber-300 w-fit">
                                  Awaiting Budget
                                </Badge>
                              ) : isFailed ? (
                                <div className="space-y-1 max-w-[180px]">
                                  <Badge variant="destructive" className="text-[10px] flex items-center gap-1 w-fit">
                                    <XCircle className="w-2.5 h-2.5" />
                                    Failed ({job.metadata?.failedStage || job.stage})
                                  </Badge>
                                  {job.error && (
                                    <p className="text-[10px] text-destructive leading-tight line-clamp-2" title={job.error}>
                                      {job.error}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-[10px] w-fit">
                                  {job.status}
                                </Badge>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-xs text-right space-x-1 whitespace-nowrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedJobForDetails(job)}
                                className="h-6 text-[10px] px-2 border-border/80"
                                title="View processing logs and diagnostic stats"
                              >
                                <Info className="w-2.5 h-2.5 mr-1" />
                                {tIngest('viewLogs')}
                              </Button>

                              {isAwaiting && (
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveBudget(job.id)}
                                  className="h-6 text-[10px] px-2 bg-amber-600 hover:bg-amber-700 text-white"
                                >
                                  {tIngest('approveBudget')}
                                </Button>
                              )}
                              {isFailed && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRetryJob(job.id)}
                                  className="h-6 text-[10px] px-2 border-primary/50 text-primary hover:bg-primary/10"
                                >
                                  <RotateCcw className="w-2.5 h-2.5 mr-1" />
                                  {tIngest('retryJob')}
                                </Button>
                              )}
                              {(isPending || isProcessing) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancelJob(job.id)}
                                  className="h-6 text-[10px] px-2 text-red-700 dark:text-red-300 hover:bg-destructive/10"
                                >
                                  <Ban className="w-2.5 h-2.5 mr-1" />
                                  {tIngest('cancelJob')}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Processing Details & Diagnostic Logs Sheet */}
          <Sheet open={!!selectedJobForDetails} onOpenChange={(open) => !open && setSelectedJobForDetails(null)}>
            <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-6 space-y-5">
              <SheetHeader className="border-b border-border/60 pb-3">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-base font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    {tIngest('jobDetails')}
                  </SheetTitle>
                  {selectedJobForDetails && (
                    <Badge
                      variant={
                        selectedJobForDetails.status === 'completed'
                          ? 'default'
                          : selectedJobForDetails.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-xs"
                    >
                      {selectedJobForDetails.status.toUpperCase()}
                    </Badge>
                  )}
                </div>
                <SheetDescription className="text-xs text-muted-foreground">
                  Job ID: {selectedJobForDetails?.id} · Stage: {selectedJobForDetails?.stage} ({selectedJobForDetails?.progress}%)
                </SheetDescription>
              </SheetHeader>

              {selectedJobForDetails && (
                <div className="space-y-4">
                  {/* Duplicate Reused Notice */}
                  {selectedJobForDetails.metadata?.duplicateReused && (
                    <div className="p-3.5 rounded-lg border border-blue-500/40 bg-blue-500/10 text-blue-900 dark:text-blue-200 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-blue-800 dark:text-blue-300">
                        <CopyCheck className="w-4 h-4 text-blue-600" />
                        <span>Identical Resource Reused (Duplicate Level: {selectedJobForDetails.metadata.duplicateLevel})</span>
                      </div>
                      <p className="text-xs leading-relaxed">
                        {selectedJobForDetails.metadata.duplicateMessage ||
                          'An identical file or canonical identifier match was detected in the library. Rather than creating duplicate vector embeddings, this ingestion task safely reused the existing resource.'}
                      </p>
                      {selectedJobForDetails.metadata.existingSourceId && (
                        <div className="pt-1">
                          <Link
                            href={`/${locale}/admin/library/sources/${selectedJobForDetails.metadata.existingSourceId}`}
                            className={buttonVariants({
                              size: 'sm',
                              variant: 'outline',
                              className: 'h-7 text-xs border-blue-500 text-blue-800 dark:text-blue-200 bg-background',
                            })}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View Existing Source
                          </Link>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Processing Failure Alert */}
                  {selectedJobForDetails.status === 'failed' && (
                    <div className="p-3.5 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        <span>Failed at Stage [{selectedJobForDetails.metadata?.failedStage || selectedJobForDetails.stage}]</span>
                      </div>
                      <p className="text-xs leading-relaxed font-mono bg-background/50 p-2 rounded border border-destructive/20 break-words">
                        {selectedJobForDetails.error || 'Unknown pipeline failure'}
                      </p>
                      <div className="pt-1 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            handleRetryJob(selectedJobForDetails.id);
                            setSelectedJobForDetails(null);
                          }}
                          className="h-7 text-xs"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Retry From Cached Stage
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Diagnostics Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <Card className="p-3 border border-border/70 space-y-1">
                      <div className="text-[11px] font-medium text-muted-foreground">Extraction Output</div>
                      <div className="text-sm font-bold text-foreground">
                        {selectedJobForDetails.metadata?.extractedChars
                          ? `${selectedJobForDetails.metadata.extractedChars.toLocaleString()} chars`
                          : '-'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {selectedJobForDetails.metadata?.extractedPages || 0} pages extracted
                      </div>
                    </Card>

                    <Card className="p-3 border border-border/70 space-y-1">
                      <div className="text-[11px] font-medium text-muted-foreground">OCR Engine Status</div>
                      <div className="text-sm font-bold text-foreground capitalize">
                        {selectedJobForDetails.metadata?.ocrStatus === 'ocr_applied'
                          ? 'OCR Applied (bn+en)'
                          : selectedJobForDetails.metadata?.ocrStatus === 'native'
                          ? 'Native PDF Text'
                          : selectedJobForDetails.metadata?.ocrStatus === 'not_needed'
                          ? 'Not Required'
                          : 'None / Pending'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Tesseract Engine (Bengali + English)
                      </div>
                    </Card>

                    <Card className="p-3 border border-border/70 space-y-1">
                      <div className="text-[11px] font-medium text-muted-foreground">Smart Chunks Created</div>
                      <div className="text-sm font-bold text-foreground">
                        {selectedJobForDetails.metadata?.chunksCount ?? 0} Chunks
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {selectedJobForDetails.tokens_used > 0
                          ? `${selectedJobForDetails.tokens_used.toLocaleString()} tokens`
                          : `~${selectedJobForDetails.estimated_tokens.toLocaleString()} estimated tokens`}
                      </div>
                    </Card>

                    <Card className="p-3 border border-border/70 space-y-1">
                      <div className="text-[11px] font-medium text-muted-foreground">Embedding Cache</div>
                      <div className="text-sm font-bold text-foreground capitalize">
                        {selectedJobForDetails.metadata?.embeddingStatus || 'Pending'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        CachedEmbeddingService (OpenAI text-embedding-3-small)
                      </div>
                    </Card>
                  </div>

                  {/* Clinical Entities Breakdown */}
                  {selectedJobForDetails.metadata?.chunkStats?.entityCounts && (
                    <Card className="p-3.5 border border-border/70 space-y-2">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary" />
                        Clinical Entities Detected & Tagged
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(selectedJobForDetails.metadata.chunkStats.entityCounts).map(([entity, cnt]) => {
                          if (cnt === 0) return null;
                          return (
                            <Badge key={entity} variant="secondary" className="text-[10px] capitalize">
                              {entity.replace('_', ' ')}: <span className="font-bold ml-1">{cnt}</span>
                            </Badge>
                          );
                        })}
                      </div>
                    </Card>
                  )}

                  {/* Execution Logs Timeline */}
                  <Card className="p-3.5 border border-border/70 space-y-2">
                    <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                        {tIngest('executionLogs')}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {selectedJobForDetails.metadata?.logs?.length || 0} entries
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 font-mono text-[11px] p-2 bg-muted/30 rounded-md border border-border/50">
                      {selectedJobForDetails.metadata?.logs && selectedJobForDetails.metadata.logs.length > 0 ? (
                        selectedJobForDetails.metadata.logs.map((log, idx) => (
                          <div key={idx} className="flex items-start gap-2 leading-relaxed">
                            <span className="text-muted-foreground shrink-0 text-[10px]">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[9px] uppercase px-1 py-0 h-4 shrink-0 ${
                                log.level === 'error'
                                  ? 'border-destructive text-destructive'
                                  : log.level === 'warn'
                                  ? 'border-amber-500 text-amber-600'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {log.stage}
                            </Badge>
                            <span
                              className={`break-words ${
                                log.level === 'error'
                                  ? 'text-destructive font-semibold'
                                  : log.level === 'warn'
                                  ? 'text-amber-700 dark:text-amber-300'
                                  : 'text-foreground'
                              }`}
                            >
                              {log.message}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-muted-foreground italic text-center py-4">No detailed logs recorded for this job.</div>
                      )}
                    </div>
                  </Card>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </TabsContent>

        {/* Tab 4: System Settings */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          <Card className="border border-border/80 shadow-sm max-w-xl">
            <CardHeader className="p-4 pb-2 border-b border-border/50">
              <CardTitle className="text-sm font-semibold">{tIngest('tabs.settings')}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                {locale === 'bn' ? 'বাজেট সীমা, অনুমোদনের থ্রেশহোল্ড ও ওসিআর কনফিগারেশন' : 'Budget governance, threshold limits, and OCR configuration'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{tIngest('budgetLimit')}</label>
                <Input
                  type="number"
                  step="0.5"
                  value={settings.dailyBudget}
                  onChange={(e) => setSettings({ ...settings, dailyBudget: e.target.value })}
                  className="text-xs h-8"
                />
                <p className="text-[10px] text-muted-foreground">
                  {locale === 'bn' ? 'প্রতিদিন মোট অনুমোদিত সর্বোচ্চ এম্বেডিং খরচ।' : 'Maximum total embedding API spend allowed per day.'}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">{tIngest('thresholdLimit')}</label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.approvalThreshold}
                  onChange={(e) => setSettings({ ...settings, approvalThreshold: e.target.value })}
                  className="text-xs h-8"
                />
                <p className="text-[10px] text-muted-foreground">
                  {locale === 'bn' ? 'কোনো একক ডকুমেন্ট এই খরচের চেয়ে বেশি হলে অ্যাডমিন অনুমোদন চাইবে।' : 'If a single document cost exceeds this, the job will pause for admin confirmation.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div className="space-y-0.5">
                  <label className="text-xs font-semibold text-foreground">{tIngest('ocrToggle')}</label>
                  <p className="text-[10px] text-muted-foreground">
                    {locale === 'bn' ? 'স্ক্যান করা পিডিএফ-এর জন্য ben+eng ভাষার অপটিক্যাল ক্যারেক্টার রিকগনিশন।' : 'Run optical character recognition with ben+eng language models for scanned PDFs.'}
                  </p>
                </div>
                <Switch
                  checked={settings.ocrEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, ocrEnabled: checked })}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={handleSaveSettings} className="text-xs h-8">
                  {tIngest('saveSettings')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
