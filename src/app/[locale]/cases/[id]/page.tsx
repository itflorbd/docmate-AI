'use client';

import React, { useEffect, useState, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/shared/LoadingState';
import { ErrorState } from '@/components/shared/ErrorState';
import { PatientDetailSheet } from './components/PatientDetailSheet';
import { CaseConversationTab } from './components/CaseConversationTab';
import { DifferentialsTab } from './components/DifferentialsTab';
import { MissingInfoTab } from './components/MissingInfoTab';
import { TreatmentTab } from './components/TreatmentTab';
import { CarryForwardPanel, type FollowUpRecord } from './components/CarryForwardPanel';
import { FollowUpSheet } from '@/components/shared/FollowUpSheet';
import type { HistoryUse, Reconciliation } from '@/lib/follow-up';
import { SafetyTab } from './components/SafetyTab';
import { ReportTab, type TreatmentApproval } from './components/ReportTab';
import { ConfirmDiagnosisDialog } from './components/ConfirmDiagnosisDialog';
import { UrgentFindingsBanner } from './components/UrgentFindingsBanner';
import type { UrgentFinding } from '@/lib/case-urgency-shared';
import type { DecisionAlert } from '@/lib/prescription-safety';
import type { TreatmentDraft } from '@/lib/treatment-draft';
import type { SafetyInputsForm } from './components/TreatmentTab';
import type { ConflictDecision } from './components/GuidelineConflictCard';
import type { ConflictReview } from '@/lib/treatment-draft-server';
import {
  PatientCase,
  CaseTurn,
  AnalysisOutput,
  StructuredPatientInput,
} from '@/types';
import {
  Stethoscope,
  HelpCircle,
  Pill,
  ShieldCheck,
  FileText,
  ArrowLeft,
  MessagesSquare,
  User,
  CheckCircle2,
  History,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { toast } from 'sonner';

interface CaseWorkspacePageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

function CaseWorkspaceContent({ params }: CaseWorkspacePageProps) {
  const resolvedParams = use(params);
  const caseId = resolvedParams.id;

  const router = useRouter();
  const locale = useLocale();
  const tAnalysisGuard = useTranslations('analysisGuard');
  const searchParams = useSearchParams();
  const t = useTranslations('workspace');

  // Active tab state (synced with ?tab=, defaults to conversation)
  const currentTab = searchParams.get('tab') || 'conversation';
  const [activeTab, setActiveTab] = useState<string>(currentTab);

  // Overlay states: Sheet & Drawer
  const [patientDetailOpen, setPatientDetailOpen] = useState(false);

  // Case & Clinical State
  const [caseData, setCaseData] = useState<PatientCase | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisOutput | null>(null);
  const [urgentFindings, setUrgentFindings] = useState<UrgentFinding[]>([]);
  const [turns, setTurns] = useState<CaseTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Analysis execution state
  const [analyzing, setAnalyzing] = useState(false);

  // Treatment draft state. The server builds the draft and decides safety;
  // the page only holds the doctor's selection and reasons.
  const tDraft = useTranslations('treatmentDraft');
  const tConflict = useTranslations('guidelineConflict');
  const [draft, setDraft] = useState<TreatmentDraft | null>(null);
  const [draftCaseVersion, setDraftCaseVersion] = useState('');
  const [syntheticOnly, setSyntheticOnly] = useState(true);
  const [treatmentLoading, setTreatmentLoading] = useState(false);
  const [selectedDrugIds, setSelectedDrugIds] = useState<Set<string>>(new Set());
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [regimenAlerts, setRegimenAlerts] = useState<DecisionAlert[]>([]);
  const [treatmentNote, setTreatmentNote] = useState('');
  const [approving, setApproving] = useState(false);
  const [approval, setApproval] = useState<TreatmentApproval | null>(null);
  const [officialIssuance, setOfficialIssuance] = useState(false);
  const [conflictReviews, setConflictReviews] = useState<Record<string, ConflictReview>>({});
  const [reviewingConflict, setReviewingConflict] = useState(false);
  const tFollowUp = useTranslations('followUp');
  const [followUp, setFollowUp] = useState<FollowUpRecord | null>(null);
  const [followUpSheetOpen, setFollowUpSheetOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [historyUsed, setHistoryUsed] = useState<HistoryUse[]>([]);

  // Dialogs state
  const [confirmDiagOpen, setConfirmDiagOpen] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState('');

  // Update tab in URL when changed
  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', val);
    router.replace(`?${params.toString()}`);
  };

  // Build the treatment draft on the server for the confirmed diagnosis.
  const fetchTreatmentPlan = useCallback(async () => {
    try {
      setTreatmentLoading(true);
      const res = await fetch(`/api/cases/${caseId}/treatment`, { method: 'POST' });
      const data = await res.json();
      if (res.status === 409 && data.code === 'reconciliation_required') {
        toast.info(tFollowUp('reconcileFirst'));
        setActiveTab('followup');
        return;
      }
      if (!res.ok) throw new Error(data.error || tDraft('failed'));
      setHistoryUsed(data.history_used ?? []);
      setDraft(data.draft);
      setDraftCaseVersion(data.case_version);
      setConflictReviews(data.conflict_reviews ?? {});
      setSyntheticOnly(Boolean(data.synthetic_only));
      setRegimenAlerts([]);
      // Preselect first-choice options that have no safety stop.
      setSelectedDrugIds(
        new Set(
          (data.draft as TreatmentDraft).options
            // Never preselect an option whose evidence depends on a condition the doctor must confirm.
            // A medicine the guidelines disagree about is never preselected.
            .filter((option) => option.preferred && option.condition === null && !option.dispute && option.safety.status !== 'blocked')
            .slice(0, 1)
            .map((option) => option.drug_id),
        ),
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tDraft('failed'));
    } finally {
      setTreatmentLoading(false);
    }
  }, [caseId, tDraft, tFollowUp]);

  const fetchApproval = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/treatment`);
    if (!res.ok) return;
    const data = await res.json();
    setApproval(data.approval ?? null);
    setOfficialIssuance(Boolean(data.official_issuance));
  }, [caseId]);

  // Fetch case details, latest analysis, and turns
  const fetchCaseData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/cases/${caseId}`);
      if (!res.ok) {
        throw new Error('Case not found or unable to load.');
      }
      const data = await res.json();
      setCaseData(data.case);
      setAnalysis(data.analysis || null);
      setUrgentFindings(data.urgent_findings || []);
      setTurns(data.turns || []);
      setFollowUp(data.follow_up ?? null);

      if (data.case?.confirmed_diagnosis) {
        void fetchApproval();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load case';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [caseId, fetchApproval]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCaseData();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchCaseData]);

  // Run clinical reasoning analysis
  const handleRunAnalysis = async () => {
    try {
      setAnalyzing(true);
      const res = await fetch(`/api/cases/${caseId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Clinical analysis failed');
      }

      setCaseData(data.case);
      setAnalysis(data.analysis);
      setUrgentFindings(data.analysis?.urgent_findings || []);
      toast.info(tAnalysisGuard(data.analysis?.status === 'ok' ? 'completedOk' : 'completed'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to run analysis';
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  // Answer follow-up question
  const handleAnswerSubmit = async (
    questionId: string,
    answer: string,
    questionText: string
  ) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'question_answer',
          question_id: questionId,
          question: questionText,
          answer,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to record follow-up answer.');
      }

      const data = await res.json();
      if (data.turn) {
        setTurns((prev) => [...prev, data.turn]);
        toast.success(locale === 'bn' ? 'ক্লিনিকাল পর্যবেক্ষণ সংরক্ষিত' : 'Observation recorded');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting answer';
      toast.error(msg);
    }
  };

  // Confirm working diagnosis
  const handleConfirmDiagnosis = async (condition: string) => {
    if (!caseData) return;
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedDiagnosis: condition }),
      });
      if (!response.ok) throw new Error('Unable to record working diagnosis');
      const saved = await response.json();
      setCaseData({
        ...caseData,
        confirmed_diagnosis: condition,
        // Stays "red_flag" while an urgent finding is unresolved.
        status: saved.case?.status ?? 'confirmed',
      });
      toast.success(`${locale === 'bn' ? 'নির্ধারিত রোগ' : 'Confirmed diagnosis'}: ${condition}`);
      setDraft(null);
      setApproval(null);
      await fetchTreatmentPlan();
      handleTabChange('treatment');
    } catch {
      toast.error('Failed to confirm working diagnosis');
    }
  };

  const handleToggleDrug = (drugId: string) => {
    setRegimenAlerts([]);
    setSelectedDrugIds((prev) => {
      const next = new Set(prev);
      if (next.has(drugId)) next.delete(drugId);
      else next.add(drugId);
      return next;
    });
  };

  // Record safety facts the doctor asked (allergies, pregnancy, weight), then rebuild.
  const handleRecordInputs = async (form: SafetyInputsForm) => {
    const body = {
      ...(form.noKnownAllergies ? { no_known_allergies: true } : {}),
      ...(form.isPregnant ? { is_pregnant: form.isPregnant === 'yes' } : {}),
      ...(Number(form.weightKg) > 0 ? { weight_kg: Number(form.weightKg) } : {}),
      ...(form.careSetting ? { care_setting: form.careSetting } : {}),
    };
    const res = await fetch(`/api/cases/${caseId}/safety-inputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      toast.error(tDraft('failed'));
      return;
    }
    await fetchCaseData();
    await fetchTreatmentPlan();
  };

  // Save the doctor's reconciliation of what the earlier visit carried forward.
  const handleReconcile = async (body: Reconciliation) => {
    setReconciling(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/carry-forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tDraft('failed'));
      toast.success(tFollowUp('saved'));
      await fetchCaseData();
      setDraft(null);
      setApproval(null);
      await fetchTreatmentPlan();
      handleTabChange('treatment');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tDraft('failed'));
    } finally {
      setReconciling(false);
    }
  };

  // Record the doctor's decision on a guideline disagreement (audited on the server).
  const handleReviewConflict = async (key: string, input: { decision: ConflictDecision; reasoning: string; requested: string[] }) => {
    setReviewingConflict(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/treatment/conflicts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conflict_key: key, case_version: draftCaseVersion, decision: input.decision, reasoning: input.reasoning, requested_information: input.requested }),
      });
      const data = await res.json();
      if (res.status === 409 && data.code === 'stale_review') {
        toast.error(tDraft('stale'));
        await fetchTreatmentPlan();
        return;
      }
      if (!res.ok) throw new Error(data.error || tDraft('failed'));
      setConflictReviews(data.reviews ?? {});
      toast.success(tConflict('saved'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tDraft('failed'));
    } finally {
      setReviewingConflict(false);
    }
  };

  // Approve the selected options. The server re-checks evidence and safety.
  const handleApprove = async () => {
    if (!draft) return;
    setApproving(true);
    try {
      const pendingIds = new Set(
        [...draft.options.filter((option) => selectedDrugIds.has(option.drug_id)).flatMap((option) => option.safety.alerts), ...regimenAlerts]
          .filter((alert) => alert.stop === 'override' && !alert.override)
          .map((alert) => alert.id),
      );
      const res = await fetch(`/api/cases/${caseId}/treatment/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_drug_ids: [...selectedDrugIds],
          case_version: draftCaseVersion,
          overrides: [...pendingIds].map((id) => ({ alert_id: id, reason: (overrideReasons[id] ?? '').trim() })),
          ...(treatmentNote.trim() ? { note: treatmentNote.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 422 && data.safety) {
        // Combined-regimen alerts (e.g. an interaction between two choices).
        setRegimenAlerts((data.safety.alerts as DecisionAlert[]).filter((alert) => alert.stop !== 'none'));
        toast.error(data.error);
        return;
      }
      if (res.status === 409 && data.code === 'stale_review') {
        toast.error(tDraft('stale'));
        await fetchTreatmentPlan();
        return;
      }
      if (!res.ok) throw new Error(data.error || tDraft('failed'));
      setApproval({ ...data.approval, approved_at: new Date().toISOString() });
      setOfficialIssuance(Boolean(data.official_issuance));
      setCaseData((prev) => (prev ? { ...prev, status: 'treated' } : prev));
      toast.success(tDraft('approved'));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tDraft('failed'));
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <LoadingState message={locale === 'bn' ? 'কেস ওয়ার্কস্পেস লোড হচ্ছে...' : 'Loading patient case workspace...'} />
      </AppShell>
    );
  }

  if (error || !caseData) {
    return (
      <AppShell>
        <ErrorState
          title={locale === 'bn' ? 'কেস পাওয়া যায়নি' : 'Case Not Found'}
          message={error || (locale === 'bn' ? 'অনুরোধকৃত রোগীর কেস বিদ্যমান নেই।' : 'The requested patient case does not exist.')}
          onRetry={fetchCaseData}
        />
      </AppShell>
    );
  }

  const input = ((caseData.structured_input ||
    (caseData as unknown as Record<string, unknown>).structuredInput) ||
    {}) as unknown as StructuredPatientInput;

  const planApproved = Boolean(approval?.current) && caseData.status === 'treated';
  const blockedOptions = draft?.options.filter((option) => option.safety.status === 'blocked').length ?? 0;

  const differentials = analysis?.differentials || [];

  return (
    <AppShell fullHeight>
      <div className="h-full min-h-0 flex flex-col overflow-hidden space-y-2">
        {/* Unified Sleek Clinical Workspace Header */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border/80 bg-card shadow-2xs">
          {/* Left: Back button + Patient Code + Status + Chief Complaint */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link href="/cases">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                title={locale === 'bn' ? 'সকল কেস' : 'All Cases'}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="sr-only">{locale === 'bn' ? 'সকল কেস' : 'All Cases'}</span>
              </Button>
            </Link>

            <div className="h-4 w-px bg-border/80 shrink-0 hidden sm:block" />

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-bold text-xs sm:text-sm text-primary tracking-tight">
                {caseData.patient_code}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold h-5 px-1.5 py-0">
                {caseData.status.replace('_', ' ')}
              </Badge>
            </div>

            {input.chief_complaint && (
              <div
                title={input.chief_complaint}
                className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 overflow-hidden"
              >
                <span className="h-3 w-px bg-border/60 shrink-0 mx-0.5" />
                <span className="truncate max-w-md text-foreground/90 font-medium">{input.chief_complaint}</span>
              </div>
            )}
          </div>

          {/* Right: Diagnosis & Patient Summary */}
          <div className="flex items-center gap-2 shrink-0">
            {caseData.confirmed_diagnosis ? (
              <Badge className="bg-emerald-600 text-white text-[11px] gap-1 h-7 py-0 px-2.5 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="truncate max-w-[140px]" title={String(caseData.confirmed_diagnosis ?? '')}>{caseData.confirmed_diagnosis}</span>
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => setConfirmDiagOpen(true)}
                className="h-8 px-3 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs"
              >
                <Stethoscope className="w-3.5 h-3.5" />
                <span>{locale === 'bn' ? 'রোগ নির্ধারণ' : 'Set Diagnosis'}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFollowUpSheetOpen(true)}
              className="h-7 px-2 text-xs font-semibold gap-1 border-primary/30 text-primary hover:bg-primary/10"
              aria-label={tFollowUp('start')}
              data-testid="start-follow-up"
            >
              <History className="w-3 h-3" />
              <span className="hidden sm:inline">{tFollowUp('start')}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPatientDetailOpen(true)}
              className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
              aria-label={t('viewPatientSummary')}
            >
              <User className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">{t('viewPatientSummary')}</span>
            </Button>
          </div>
        </div>

        <UrgentFindingsBanner
          caseId={caseId}
          findings={urgentFindings}
          insufficientEvidence={analysis?.status === 'insufficient_evidence'}
          onChange={(findings) => {
            setUrgentFindings(findings);
            void fetchCaseData();
          }}
        />

        {/* Slide-over Sheet (Desktop) & Bottom Drawer (Mobile) for Patient Details */}
        <FollowUpSheet priorCaseId={caseId} open={followUpSheetOpen} onOpenChange={setFollowUpSheetOpen} />

        <PatientDetailSheet
          open={patientDetailOpen}
          onOpenChange={setPatientDetailOpen}
          caseData={caseData}
          turns={turns}
        />

        {/* Workspace Body: Full Width Tabbed Clinical Workspace */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-stretch">
          <div className="w-full h-full min-h-0 overflow-hidden flex flex-col bg-card rounded-xl border border-border/80 shadow-xs p-2 sm:p-2.5">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full h-full min-h-0 flex flex-col overflow-hidden">
              {/* Tab Navigation List */}
              <div className="shrink-0 border-b border-border/60 pb-2 mb-2 overflow-x-auto scrollbar-none">
                <TabsList className="flex flex-nowrap gap-1 p-0.5 bg-muted/80 rounded-lg min-w-max justify-start">
                  {followUp && (
                    <TabsTrigger
                      value="followup"
                      className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                    >
                      <History className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>{tFollowUp('tab')}</span>
                      {followUp.status === 'pending' && <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />}
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="conversation"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <MessagesSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{t('tabConversation')}</span>
                    {turns.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5 h-4 min-w-4 flex items-center justify-center">
                        {turns.length}
                      </Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="differentials"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <Stethoscope className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{t('tabDifferentials')}</span>
                    {analysis?.differentials?.length ? (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-0.5 h-4 min-w-4 flex items-center justify-center">
                        {analysis.differentials.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>

                  <TabsTrigger
                    value="missing_info"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>{t('tabMissingInfo')}</span>
                    {analysis?.missing_information?.length ? (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-0.5 h-4 min-w-4 flex items-center justify-center">
                        {analysis.missing_information.length}
                      </Badge>
                    ) : null}
                  </TabsTrigger>

                  <TabsTrigger
                    value="treatment"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <Pill className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{t('tabTreatment')}</span>
                    {caseData.confirmed_diagnosis && (
                      <Badge className="bg-emerald-700 text-white text-[9px] px-1 py-0 ml-0.5 h-4">
                        Ready
                      </Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="safety"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{t('tabSafety')}</span>
                    {blockedOptions > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1 py-0 ml-0.5 h-4">
                        {blockedOptions}
                      </Badge>
                    )}
                  </TabsTrigger>

                  <TabsTrigger
                    value="report"
                    className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 data-[state=active]:bg-background data-[state=active]:shadow-xs h-6.5"
                  >
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>{t('tabReport')}</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Tab Contents - Full Height, Internal Scroll */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {followUp && (
                  <TabsContent value="followup" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                    <CarryForwardPanel
                      record={followUp}
                      saving={reconciling}
                      onSubmit={(body) => void handleReconcile(body)}
                      onOpenPrevious={() => router.push(`/${locale}/cases/${followUp.previous_case_id}`)}
                    />
                  </TabsContent>
                )}

                <TabsContent value="conversation" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <CaseConversationTab
                    caseId={caseId}
                    caseData={caseData}
                    turns={turns}
                    onTurnsUpdate={setTurns}
                    onCaseUpdate={setCaseData}
                  />
                </TabsContent>

                <TabsContent value="differentials" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <DifferentialsTab
                    analysis={analysis}
                    analyzing={analyzing}
                    onRunAnalysis={handleRunAnalysis}
                    onSelectDiagnosis={(cond) => {
                      setSelectedDiagnosis(cond);
                      setConfirmDiagOpen(true);
                    }}
                    onGoToMissingInfo={() => handleTabChange('missing_info')}
                  />
                </TabsContent>

                <TabsContent value="missing_info" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <MissingInfoTab
                    missingInfo={analysis?.missing_information || []}
                    onAnswerSubmit={handleAnswerSubmit}
                    onReAnalyze={handleRunAnalysis}
                    reAnalyzing={analyzing}
                  />
                </TabsContent>

                <TabsContent value="treatment" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <TreatmentTab
                    confirmedDiagnosis={caseData.confirmed_diagnosis}
                    draft={draft}
                    syntheticOnly={syntheticOnly}
                    loading={treatmentLoading}
                    approving={approving}
                    approved={planApproved}
                    regimenAlerts={regimenAlerts}
                    selected={selectedDrugIds}
                    overrideReasons={overrideReasons}
                    note={treatmentNote}
                    onBuild={() => void fetchTreatmentPlan()}
                    onOpenConfirmDiag={() => setConfirmDiagOpen(true)}
                    onToggle={handleToggleDrug}
                    onReason={(id, reason) => setOverrideReasons((prev) => ({ ...prev, [id]: reason }))}
                    onNote={setTreatmentNote}
                    conflictReviews={conflictReviews}
                    historyUsed={historyUsed}
                    reviewingConflict={reviewingConflict}
                    onReviewConflict={(key, input) => void handleReviewConflict(key, input)}
                    onApprove={handleApprove}
                    onRecordInputs={handleRecordInputs}
                    onOpenReport={() => handleTabChange('report')}
                  />
                </TabsContent>

                <TabsContent value="safety" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <SafetyTab draft={draft} regimenAlerts={regimenAlerts} />
                </TabsContent>

                <TabsContent value="report" className="mt-0 h-full min-h-0 flex flex-col overflow-hidden focus-visible:outline-none">
                  <ReportTab caseData={caseData} approval={approval} officialIssuance={officialIssuance} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Confirm Working Diagnosis Dialog (Modal) */}
        <ConfirmDiagnosisDialog
          open={confirmDiagOpen}
          onOpenChange={setConfirmDiagOpen}
          differentials={differentials}
          initialCondition={selectedDiagnosis || differentials[0]?.condition}
          onConfirm={handleConfirmDiagnosis}
        />

      </div>
    </AppShell>
  );
}

export default function CaseWorkspacePage(props: CaseWorkspacePageProps) {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground animate-pulse">লোড হচ্ছে...</div>}>
      <CaseWorkspaceContent {...props} />
    </React.Suspense>
  );
}
