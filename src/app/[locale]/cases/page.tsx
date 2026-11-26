'use client';

import { ErrorState } from '@/components/shared/ErrorState';
import { genderLabel } from '@/lib/labels';
import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/EmptyState';
import { Link, useRouter } from '@/i18n/routing';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
  PlusCircle,
  Search,
  Filter,
  AlertTriangle,
  ArrowRight,
  Clock,
  Users,
  Loader2,
  CheckCircle2,
  Activity,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { PatientCase, StructuredPatientInput } from '@/types';

interface ExtendedCase extends PatientCase {
  is_running?: boolean;
  is_solved?: boolean;
}

export default function CasesPage() {
  const t = useTranslations('cases');
  const format = useFormatter();
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();

  const [casesList, setCasesList] = useState<ExtendedCase[]>([]);
  const [counts, setCounts] = useState<{ all: number; running: number; solved: number }>({
    all: 0,
    running: 0,
    solved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryTab, setCategoryTab] = useState<'all' | 'running' | 'solved'>('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [fetchVersion, setFetchVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const effectiveStatus = statusFilter !== 'all' ? statusFilter : categoryTab !== 'all' ? categoryTab : 'all';
        const response = await fetch(`/api/cases?status=${effectiveStatus}&search=${encodeURIComponent(search)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) {
          setCasesList(data.cases || []);
          if (data.counts) {
            setCounts(data.counts);
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(true);
          setCasesList([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [categoryTab, statusFilter, search, fetchVersion]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'red_flag':
        return (
          <Badge variant="destructive" className="text-[10px] uppercase font-bold gap-1">
            <AlertTriangle className="w-3 h-3" />
            {t('statusRedFlag')}
          </Badge>
        );
      case 'insufficient_evidence':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 gap-1">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            {t('statusInsufficient')}
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-teal-800 bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-600" />
            {t('statusConfirmed')}
          </Badge>
        );
      case 'treated':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-blue-800 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            {t('statusTreated')}
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            {t('statusClosed')}
          </Badge>
        );
      case 'analyzed':
        return (
          <Badge variant="secondary" className="text-[10px] font-medium">
            {t('statusAnalyzed')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {t('statusDraft')}
          </Badge>
        );
    }
  };

  const getEmptyMessage = () => {
    if (categoryTab === 'running') return t('emptyRunning');
    if (categoryTab === 'solved') return t('emptySolved');
    return t('emptyCases');
  };

  return (
    <AppShell fullHeight>
      <div className="flex flex-col flex-1 min-h-0 max-w-7xl w-full mx-auto gap-2.5 p-1 sm:p-2">
        {/* Compact Narrow Top Header + Controls */}
        <div className="shrink-0 space-y-2">
          <div className="flex items-center justify-between gap-3 pb-2 border-b border-border/60">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {t('title')}
            </h1>
            <Link href="/patients/new">
              <Button size="sm" className="gap-1.5 h-8 px-3 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-2xs">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{t('newIntake')}</span>
              </Button>
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
            <Tabs
              value={categoryTab}
              onValueChange={(val) => {
                setCategoryTab(val as 'all' | 'running' | 'solved');
                setStatusFilter('all');
              }}
              className="w-full lg:w-auto"
            >
              <TabsList className="bg-muted/60 p-0.5 h-9 border border-border/60 w-full lg:w-auto grid grid-cols-3 lg:inline-flex">
                <TabsTrigger value="all" className="gap-1.5 text-xs font-semibold h-8">
                  <span>{t('tabAll')}</span>
                  {counts.all > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4">
                      {format.number(counts.all)}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="running" className="gap-1.5 text-xs font-semibold h-8">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span>{t('tabRunning')}</span>
                  {counts.running > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4 bg-primary/10 text-primary">
                      {format.number(counts.running)}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="solved" className="gap-1.5 text-xs font-semibold h-8">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('tabSolved')}</span>
                  {counts.solved > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {format.number(counts.solved)}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                  className="pl-8 text-xs h-9 bg-card border-border"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-3.5 h-3.5 text-muted-foreground hidden sm:block" />
                <Select value={statusFilter} items={{ all: tCommon('all'), running: t('runningFilter'), solved: t('solvedFilter'), draft: t('statusDraft'), analyzed: t('statusAnalyzed'), insufficient_evidence: t('statusInsufficient'), red_flag: t('statusRedFlag'), confirmed: t('statusConfirmed'), treated: t('statusTreated'), closed: t('statusClosed') }} onValueChange={(val) => val && setStatusFilter(val)}>
                  <SelectTrigger aria-label={t('filterStatus')} className="w-36 sm:w-44 h-9 text-xs bg-card">
                    <SelectValue placeholder={tCommon('all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tCommon('all')}</SelectItem>
                    <SelectItem value="running">{t('runningFilter')}</SelectItem>
                    <SelectItem value="solved">{t('solvedFilter')}</SelectItem>
                    <SelectItem value="draft">{t('statusDraft')}</SelectItem>
                    <SelectItem value="analyzed">{t('statusAnalyzed')}</SelectItem>
                    <SelectItem value="insufficient_evidence">{t('statusInsufficient')}</SelectItem>
                    <SelectItem value="red_flag">{t('statusRedFlag')}</SelectItem>
                    <SelectItem value="confirmed">{t('statusConfirmed')}</SelectItem>
                    <SelectItem value="treated">{t('statusTreated')}</SelectItem>
                    <SelectItem value="closed">{t('statusClosed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Cases Table (Only rows scroll inside table) */}
        <Card className="border-border shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden">
          <CardContent className="p-0 flex-1 min-h-0 flex flex-col [&_[data-slot=table-container]]:h-full [&_[data-slot=table-container]]:overflow-y-auto">
            {loading ? (
              <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2 flex-1">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Loading patient cases...</span>
              </div>
            ) : loadError ? (
              <ErrorState message={t('loadError')} onRetry={() => setFetchVersion((version) => version + 1)} />
            ) : casesList.length === 0 ? (
              <EmptyState
                icon={Users}
                title={getEmptyMessage()}
                description={t('emptyDescription')}
                actionLabel={t('newIntake')}
                onAction={() => router.push('/patients/new')}
              />
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs shadow-[0_1px_0_0_hsl(var(--border))]">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-24 px-3 font-semibold whitespace-nowrap">{t('patientCode')}</TableHead>
                    <TableHead className="px-3 font-semibold">{t('chiefComplaint')}</TableHead>
                    <TableHead className="w-24 px-3 font-semibold hidden xl:table-cell whitespace-nowrap">{t('caseType')}</TableHead>
                    <TableHead className="w-24 px-3 font-semibold whitespace-nowrap">{t('ageGender')}</TableHead>
                    <TableHead className="w-36 px-3 font-semibold whitespace-nowrap">{tCommon('status')}</TableHead>
                    <TableHead className="w-28 px-3 font-semibold hidden lg:table-cell whitespace-nowrap">{tCommon('date')}</TableHead>
                    <TableHead className="w-24 px-3 text-right font-semibold whitespace-nowrap">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {casesList.map((c) => {
                    const input = ((c.structured_input || (c as unknown as Record<string, unknown>).structuredInput) || {}) as unknown as StructuredPatientInput;
                    const patientCode = c.patient_code || (c as unknown as Record<string, unknown>).patientCode as string;
                    const confirmedDx = c.confirmed_diagnosis || (c as unknown as Record<string, unknown>).confirmedDiagnosis as string;
                    const isSolved = ['confirmed', 'treated', 'closed'].includes(c.status);

                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => router.push(`/cases/${c.id}`)}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="px-3 py-2.5 font-mono font-bold text-xs text-primary whitespace-nowrap">
                          {patientCode}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 max-w-[260px] sm:max-w-sm lg:max-w-md whitespace-normal">
                          <div className="font-medium text-sm text-foreground leading-snug">
                            {String(input.chief_complaint || 'Clinical Case Intake')}
                          </div>
                          {confirmedDx && (
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 inline shrink-0" />
                              <span className="truncate">Dx: {confirmedDx}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 hidden xl:table-cell whitespace-nowrap">
                          {isSolved ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-semibold border-emerald-200">
                              {t('typeSolved')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 text-[10px] font-semibold border-sky-200">
                              {t('typeRunning')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {typeof input.age === 'number' ? format.number(input.age) : '—'}{' '}
                          {input.gender ? `(${genderLabel(input.gender, locale)})` : ''}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 whitespace-nowrap">{getStatusBadge(c.status)}</TableCell>
                        <TableCell className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 opacity-60" />
                            {format.dateTime(new Date(c.updated_at || c.created_at), { dateStyle: 'medium', timeZone: 'UTC' })}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-primary hover:text-primary gap-1 text-xs"
                          >
                            <span>{t('openWorkspace')}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
