import React from 'react';
import { redirect } from 'next/navigation';
import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  FileText,
  HelpCircle,
  PlusCircle,
  Stethoscope,
  Users,
} from 'lucide-react';
import { db } from '@/db';
import { cases, medicineNotices, patients, prescriptions } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { decryptPatientPii } from '@/lib/encryption';
import { genderLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { Link } from '@/i18n/routing';
import { AppShell } from '@/components/shared/AppShell';
import { GuidedTour, type TourStep } from '@/components/shared/GuidedTour';
import type { DangerAlertItem } from '@/components/shared/DoctorDangerAlerts';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const RUNNING = ['draft', 'analyzed', 'insufficient_evidence', 'red_flag'];
const SOLVED = ['confirmed', 'treated', 'closed'];

const TOUR: TourStep[] = [
  { target: 'nav-sidebar', key: 'sidebar' },
  { target: 'nav-search', key: 'search' },
  { target: 'dashboard-new-intake', key: 'newIntake' },
  { target: 'dashboard-stats', key: 'stats' },
  { target: 'dashboard-cases', key: 'cases' },
  { target: 'dashboard-quick', key: 'quick' },
  { target: 'dashboard-recent', key: 'recent' },
  { target: 'nav-language', key: 'language' },
  { target: 'voice-floating-btn', key: 'voice' },
];

/**
 * Doctor dashboard on one screen: today's numbers, the case list (running or
 * solved) with its own scroll, quick actions and recent patients. On small
 * screens the same blocks stack and the page scrolls.
 */
export default async function DashboardPage() {
  const locale = await getLocale();
  const format = await getFormatter();
  const t = await getTranslations('dashboard');
  const tCases = await getTranslations('cases');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login?logout=1`);
  const isPhysician = user.role === 'doctor' || user.role === 'super_admin';
  const own = user.role === 'super_admin' ? undefined : eq(cases.doctorId, user.id);
  const countCases = async (statuses: string[]) => {
    if (!isPhysician) return 0;
    const byStatus = inArray(cases.status, statuses);
    const [row] = await db.select({ value: count() }).from(cases).where(own ? and(own, byStatus) : byStatus);
    return row?.value ?? 0;
  };

  const [patientCount, prescriptionCount, urgentCount, runningCount, solvedCount, recentPatients, notices, recentCases] = await Promise.all([
    isPhysician ? db.$count(patients, eq(patients.doctorId, user.id)) : 0,
    isPhysician ? db.$count(prescriptions, eq(prescriptions.doctorId, user.id)) : 0,
    countCases(['red_flag']),
    countCases(RUNNING),
    countCases(SOLVED),
    isPhysician ? db.query.patients.findMany({ where: eq(patients.doctorId, user.id), orderBy: [desc(patients.updatedAt)], limit: 8 }) : [],
    db.select().from(medicineNotices).orderBy(desc(medicineNotices.publishedAt)).limit(3),
    isPhysician ? db.query.cases.findMany({ where: own, orderBy: [desc(cases.updatedAt)], limit: 40 }) : [],
  ]);

  // Urgent first, then most recently updated.
  const running = recentCases
    .filter((record) => RUNNING.includes(record.status))
    .sort((a, b) => Number(b.status === 'red_flag') - Number(a.status === 'red_flag'));
  const solved = recentCases.filter((record) => SOLVED.includes(record.status));
  const people = recentPatients.map((patient) => ({ ...patient, name: decryptPatientPii(patient.nameEncrypted) }));

  const tiles = [
    { key: 'needsAttention', value: urgentCount, icon: AlertTriangle, tone: urgentCount > 0 ? 'danger' : 'muted' },
    { key: 'runningCases', value: runningCount, icon: Activity, tone: 'primary' },
    { key: 'solvedCases', value: solvedCount, icon: CheckCircle2, tone: 'success' },
    { key: 'patients', value: patientCount, icon: Users, tone: 'muted' },
  ] as const;
  const toneClass = {
    danger: 'text-destructive',
    primary: 'text-primary',
    success: 'text-emerald-700 dark:text-emerald-400',
    muted: 'text-foreground',
  } as const;

  const statusLabel: Record<string, string> = {
    red_flag: tCases('statusRedFlag'),
    insufficient_evidence: tCases('statusInsufficient'),
    confirmed: tCases('statusConfirmed'),
    treated: tCases('statusTreated'),
    closed: tCases('statusClosed'),
    analyzed: tCases('statusAnalyzed'),
    draft: tCases('statusDraft'),
  };
  const statusBadge = (status: string) => {
    if (status === 'red_flag') {
      return (
        <Badge variant="destructive" className="gap-1 text-[10px] font-bold">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {statusLabel.red_flag}
        </Badge>
      );
    }
    if (status === 'insufficient_evidence') {
      return (
        <Badge variant="outline" className="gap-1 border-amber-500/50 text-[10px] text-amber-800 dark:text-amber-300">
          <HelpCircle className="h-3 w-3" aria-hidden />
          {statusLabel.insufficient_evidence}
        </Badge>
      );
    }
    if (SOLVED.includes(status)) {
      return (
        <Badge variant="outline" className="gap-1 border-emerald-500/40 text-[10px] text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          {statusLabel[status]}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-[10px]">
        {statusLabel[status] ?? statusLabel.draft}
      </Badge>
    );
  };

  const caseList = (list: typeof recentCases, emptyText: string, solvedList: boolean) =>
    list.length === 0 ? (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Stethoscope className="h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-semibold">{emptyText}</p>
        {!solvedList && (
          <Link href="/patients/new" className={buttonVariants({ size: 'sm', className: 'min-h-10' })}>
            <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden />
            {tCases('newIntake')}
          </Link>
        )}
      </div>
    ) : (
      <ul className="divide-y divide-border" data-testid={solvedList ? 'dashboard-solved-list' : 'dashboard-running-list'}>
        {list.map((record) => {
          const input = (record.structuredInput || {}) as Record<string, unknown>;
          const complaint = String(input.chief_complaint || t('noComplaint'));
          const detail = solvedList && record.confirmedDiagnosis ? record.confirmedDiagnosis : complaint;
          return (
            <li key={record.id}>
              <Link
                href={`/cases/${record.id}`}
                className={cn(
                  'grid grid-cols-[5.5rem_1fr_auto] items-center gap-x-3 px-3 py-2 transition-colors hover:bg-muted/50 sm:grid-cols-[7rem_minmax(0,1fr)_6.5rem_minmax(0,12rem)_1rem]',
                  record.status === 'red_flag' && 'bg-destructive/5',
                )}
              >
                <span className="truncate font-mono text-xs font-bold text-primary" title={record.patientCode}>
                  {record.patientCode}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium" title={detail}>
                    {detail}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {[typeof input.age === 'number' ? format.number(input.age) : null, input.gender ? genderLabel(input.gender, locale) : null].filter(Boolean).join(' · ')}
                    <span className="sm:hidden"> · {statusLabel[record.status] ?? statusLabel.draft}</span>
                  </span>
                </span>
                <span className="hidden text-[11px] text-muted-foreground sm:block">
                  {format.dateTime(new Date(record.updatedAt || record.createdAt), { dateStyle: 'medium' })}
                </span>
                <span className="hidden min-w-0 justify-self-end sm:block">{statusBadge(record.status)}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    );

  // Recalls and cases needing attention go to the alert icon in the header.
  const headerDangerItems: DangerAlertItem[] = [
    ...notices.map((notice) => ({
      id: `notice-${notice.id}`,
      severity: (notice.severity === 'critical_recall' ? 'critical' : 'warning') as DangerAlertItem['severity'],
      category: 'drug_notice' as const,
      title: notice.title,
      description: notice.body,
      // Doctors see recalls where they prescribe; the controller page is not theirs.
      href: '/prescriptions',
      actionLabelEn: 'Open prescriptions',
      actionLabelBn: 'প্রেসক্রিপশন খুলুন',
    })),
    ...running
      .filter((record) => record.status === 'red_flag' || record.status === 'insufficient_evidence')
      .map((record) => {
        const urgent = record.status === 'red_flag';
        const complaint = String(((record.structuredInput || {}) as Record<string, unknown>).chief_complaint || t('noComplaint'));
        return {
          id: `case-${record.id}`,
          severity: (urgent ? 'critical' : 'warning') as DangerAlertItem['severity'],
          category: (urgent ? 'red_flag_case' : 'missing_info_case') as DangerAlertItem['category'],
          title: `${record.patientCode}: ${complaint}`,
          description: urgent ? t('dangerUrgentCase') : t('dangerMissingInfo'),
          href: `/cases/${record.id}`,
          actionLabelEn: urgent ? 'Open case' : 'Add details',
          actionLabelBn: urgent ? 'কেস খুলুন' : 'তথ্য যোগ করুন',
        };
      }),
  ];

  const actions = [
    { href: '/patients/new', icon: PlusCircle, label: tCases('newIntake'), primary: true },
    { href: '/ask', icon: BookOpen, label: t('quickAsk'), primary: false },
    { href: '/patients', icon: Users, label: t('patientsLink'), primary: false },
    { href: '/prescriptions', icon: FileText, label: t('prescriptionsLink', { count: prescriptionCount }), primary: false },
  ];

  return (
    <AppShell fullHeight headerDangerItems={headerDangerItems}>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1 lg:overflow-hidden" data-testid="doctor-dashboard">
        {/* Greeting and main actions */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold" title={user.name}>
              {t('welcomeName', { name: user.name })}
            </h1>
            <p className="text-xs text-muted-foreground">{format.dateTime(new Date(), { dateStyle: 'full' })}</p>
          </div>
          <div className="flex items-center gap-2">
            <GuidedTour id="doctor-dashboard" steps={TOUR} />
            <Link href="/patients/new" data-tour="dashboard-new-intake" className={buttonVariants({ size: 'sm', className: 'h-8 gap-1.5 font-semibold' })}>
              <PlusCircle className="h-4 w-4" aria-hidden />
              {tCases('newIntake')}
            </Link>
          </div>
        </div>

        {/* Today's numbers */}
        <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-4" data-tour="dashboard-stats">
          {tiles.map((tile) => (
            <Link
              key={tile.key}
              href={tile.key === 'patients' ? '/patients' : '/cases'}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-xs transition-colors hover:bg-muted/40',
                tile.tone === 'danger' && 'border-destructive/50 bg-destructive/5',
              )}
              data-testid={`tile-${tile.key}`}
            >
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted', toneClass[tile.tone])}>
                <tile.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className={cn('block text-xl font-bold leading-tight', toneClass[tile.tone])}>{format.number(tile.value)}</span>
                <span className="block truncate text-xs text-muted-foreground" title={t(tile.key)}>
                  {t(tile.key)}
                </span>
              </span>
            </Link>
          ))}
        </div>

        {/* Cases, quick actions and recent patients */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-cols-12">
          <Card className="flex min-h-[22rem] flex-col gap-0 overflow-hidden py-0 lg:col-span-8 lg:min-h-0" data-tour="dashboard-cases">
            <Tabs defaultValue="running" className="flex min-h-0 flex-1 flex-col gap-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
                <TabsList className="flex-nowrap">
                  <TabsTrigger value="running" className="gap-1.5 whitespace-nowrap text-xs font-semibold">
                    {t('runningCases')}
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {format.number(runningCount)}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="solved" className="gap-1.5 whitespace-nowrap text-xs font-semibold">
                    {t('solvedCases')}
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {format.number(solvedCount)}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
                <Link href="/cases" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 gap-1 text-xs' })}>
                  {t('viewAllCases')}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              <TabsContent value="running" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                {caseList(running, t('emptyRunning'), false)}
              </TabsContent>
              <TabsContent value="solved" className="mt-0 min-h-0 flex-1 overflow-y-auto">
                {caseList(solved, t('emptySolved'), true)}
              </TabsContent>
            </Tabs>
          </Card>

          <div className="flex min-h-0 flex-col gap-2.5 lg:col-span-4">
            <Card className="shrink-0 gap-2 p-3" data-tour="dashboard-quick">
              <h2 className="text-sm font-bold">{t('quickActions')}</h2>
              <div className="grid grid-cols-2 gap-2">
                {actions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={buttonVariants({
                      variant: action.primary ? 'default' : 'outline',
                      className: 'h-auto min-h-11 justify-start gap-2 whitespace-normal px-2.5 py-2 text-left text-xs font-semibold',
                    })}
                  >
                    <action.icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>{action.label}</span>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="flex min-h-[14rem] flex-1 flex-col gap-0 overflow-hidden py-0 lg:min-h-0" data-tour="dashboard-recent">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <h2 className="text-sm font-bold">{t('recentPatients')}</h2>
                <Link href="/patients" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'h-8 gap-1 text-xs' })}>
                  {t('viewAll')}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
              {people.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">{t('noRecentPatients')}</p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                  {people.map((person) => (
                    <li key={person.id}>
                      <Link href={`/patients/${person.id}`} className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/50">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden>
                          {person.name.charAt(0)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium" title={person.name}>
                            {person.name}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">
                            {person.patientCode} · {format.number(person.age)} · {genderLabel(person.gender, locale)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
