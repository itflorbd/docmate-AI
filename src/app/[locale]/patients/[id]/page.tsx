'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { ConsentSheet } from '@/components/shared/ConsentSheet';
import { FollowUpSheet } from '@/components/shared/FollowUpSheet';
import {
  FileText,
  Calendar,
  Phone,
  AlertTriangle,
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  Pill,
  Download,
  KeyRound,
  ChevronRight,
  Clock,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

interface HealthSummary {
  allergies: string[];
  chronicConditions: string[];
  currentMedicines: Array<{ brand: string; generic: string; dose?: string }>;
  bloodGroup: string | null;
  version: number;
  updatedAt: string;
}

interface GrantInfo {
  hasGrant: boolean;
  scope: 'this_doctor_only' | 'full_history';
  expiresAt: string | null;
  daysRemaining: number | null;
}

interface TimelineItem {
  id: string;
  type: 'visit' | 'prescription' | 'report';
  date: string;
  doctorId?: string | null;
  doctorName: string;
  isOwnRecord: boolean;
  title: string;
  summary: string;
  details: Record<string, unknown>;
}

interface PatientData {
  id: string;
  name: string;
  phone?: string;
  age: number;
  gender: string;
  blood_group?: string | null;
  relation?: string;
  created_at: string;
}

// The API returns encounters with camelCase keys; older code used snake_case.
interface LegacyEncounter {
  id: string;
  chief_complaint?: string;
  chiefComplaint?: string;
  vitals?: Record<string, unknown>;
  visit_date?: string;
  visitDate?: string;
}

interface LegacyPrescription {
  id: string;
  rx_number: string;
  status?: string;
  createdAt?: string;
}

interface RxItemDetail {
  id: string;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosing_schedule: string;
}

export default function PatientProfilePage() {
  const { id } = useParams() as { id: string };
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [isProfile, setIsProfile] = useState(false);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [grant, setGrant] = useState<GrantInfo | null>(null);
  const [otherDoctorRecordsExist, setOtherDoctorRecordsExist] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [legacyEncounters, setLegacyEncounters] = useState<LegacyEncounter[]>([]);
  const [legacyPrescriptions, setLegacyPrescriptions] = useState<LegacyPrescription[]>([]);

  // Filtering states
  const [typeFilter, setTypeFilter] = useState<'all' | 'visit' | 'prescription' | 'report'>('all');
  const [doctorFilter, setDoctorFilter] = useState<'all' | 'mine'>('all');
  const [searchQuery] = useState('');

  // Consent Sheet state
  const [consentOpen, setConsentOpen] = useState(false);
  const tFollowUp = useTranslations('followUp');
  const [followUpFrom, setFollowUpFrom] = useState<string | null>(null);

  const fetchProfileData = useCallback(async () => {
    try {
      const res = await fetch(`/api/patients/${id}`, { credentials: 'same-origin' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load patient records');
      }
      const data = await res.json();
      setPatient(data.patient);
      setIsProfile(Boolean(data.isProfile));
      if (data.isProfile) {
        setHealthSummary(data.healthSummary);
        setGrant(data.grant);
        setOtherDoctorRecordsExist(Boolean(data.otherDoctorRecordsExist));
        setTimeline(data.timeline || []);
      } else {
        setLegacyEncounters(data.encounters || []);
        setLegacyPrescriptions(data.prescriptions || []);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error occurred';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await fetch(`/api/patients/${id}`, { credentials: 'same-origin' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to load patient records');
        }
        const data = await res.json();
        if (!active) return;
        setPatient(data.patient);
        setIsProfile(Boolean(data.isProfile));
        if (data.isProfile) {
          setHealthSummary(data.healthSummary);
          setGrant(data.grant);
          setOtherDoctorRecordsExist(Boolean(data.otherDoctorRecordsExist));
          setTimeline(data.timeline || []);
        } else {
          setLegacyEncounters(data.encounters || []);
          setLegacyPrescriptions(data.prescriptions || []);
        }
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Error occurred';
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [id]);

  // Filtered timeline
  const filteredTimeline = timeline.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (doctorFilter === 'mine' && !item.isOwnRecord) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSummary = item.summary.toLowerCase().includes(q);
      const matchDoctor = item.doctorName.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary && !matchDoctor) return false;
    }
    return true;
  });

  // Extract latest vitals from timeline or legacy encounters
  const latestVitals = React.useMemo(() => {
    if (isProfile) {
      const latestVisit = timeline.find((t) => t.type === 'visit' && t.details?.vitals && Object.keys(t.details.vitals as object).length > 0);
      return (latestVisit?.details?.vitals as Record<string, unknown>) || null;
    } else {
      const latestEnc = legacyEncounters.find((e) => e.vitals && Object.keys(e.vitals).length > 0);
      return (latestEnc?.vitals as Record<string, unknown>) || null;
    }
  }, [isProfile, timeline, legacyEncounters]);

  if (loading) {
    return (
      <AppShell>
        <div className="p-16 text-center text-muted-foreground animate-pulse text-sm">
          {isBn ? 'রোগীর বিস্তারিত ও ক্লিনিকাল হিস্ট্রি লোড হচ্ছে...' : 'Loading patient records and history timeline...'}
        </div>
      </AppShell>
    );
  }

  if (error || !patient) {
    return (
      <AppShell>
        <div className="p-8 text-center max-w-md mx-auto space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">{isBn ? 'প্রোফাইল লোড করা যায়নি' : 'Profile Not Found'}</h2>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Link href="/patients" className={buttonVariants({ className: 'min-h-11' })}>
            {isBn ? 'রোগীর তালিকায় ফিরুন' : 'Back to Patient List'}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Top Header Card */}
        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                    {patient.gender === 'female'
                      ? isBn
                        ? 'মহিলা'
                        : 'Female'
                      : isBn
                        ? 'পুরুষ'
                        : 'Male'}
                    , {patient.age} {isBn ? 'বছর' : 'yrs'}
                  </Badge>

                  {patient.relation && (
                    <Badge variant="secondary" className="text-xs font-medium">
                      {isBn ? `সম্পর্ক: ${patient.relation}` : `Relation: ${patient.relation}`}
                    </Badge>
                  )}

                  {patient.blood_group && (
                    <Badge variant="secondary" className="text-xs font-bold text-destructive">
                      {isBn ? 'রক্ত:' : 'Blood:'} {patient.blood_group}
                    </Badge>
                  )}

                  {/* Grant Status Badge */}
                  {isProfile && grant && (
                    grant.hasGrant && grant.scope === 'full_history' ? (
                      <Badge className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1 py-0.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          {isBn
                            ? `অনুমতি সক্রিয়${grant.daysRemaining !== null ? ` (${grant.daysRemaining} দিন বাকি)` : ''}`
                            : `Full Access Active${grant.daysRemaining !== null ? ` (${grant.daysRemaining}d left)` : ''}`}
                        </span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 text-xs gap-1 py-0.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        <span>{isBn ? 'শুধুমাত্র আপনার রেকর্ড' : 'Author Records Only'}</span>
                      </Badge>
                    )
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {patient.name}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-0.5">
                  {patient.phone && (
                    <div className="flex items-center gap-1 font-mono">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {isBn ? 'নিবন্ধন:' : 'Registered:'}{' '}
                      {new Date(patient.created_at).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                {isProfile && (
                  <Link
                    href={`/cases/new?profileId=${patient.id}&name=${encodeURIComponent(patient.name)}&age=${patient.age}&gender=${patient.gender}`}
                    className={buttonVariants({
                      className: 'min-h-11 px-4 text-xs font-bold bg-primary text-primary-foreground shadow-sm gap-1.5',
                    })}
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isBn ? 'নতুন কেস / ভিজিট শুরু' : 'New Visit / Case'}</span>
                  </Link>
                )}
                <Link
                  href={`/prescriptions/new?patientId=${patient.id}`}
                  className={buttonVariants({
                    variant: 'outline',
                    className: 'min-h-11 px-4 text-xs font-semibold gap-1.5',
                  })}
                >
                  <FileText className="w-4 h-4 text-primary" />
                  <span>{isBn ? 'নতুন প্রেসক্রিপশন' : 'New Rx'}</span>
                </Link>
              </div>
            </div>

            {/* Health Summary Chips Section */}
            {isProfile && healthSummary && (
              <div className="mt-5 pt-4 border-t border-border/60 space-y-3">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {isBn ? 'স্বাস্থ্য সারসংক্ষেপ (Profile Health Summary)' : 'Profile Health Summary'}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Allergies Chip */}
                  <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 space-y-1">
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 block">
                      {isBn ? '⚠️ অ্যালার্জি (Allergies):' : '⚠️ Known Allergies:'}
                    </span>
                    {healthSummary.allergies && healthSummary.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {healthSummary.allergies.map((a) => (
                          <span
                            key={a}
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{isBn ? 'কোনো অ্যালার্জি নেই' : 'None reported'}</span>
                    )}
                  </div>

                  {/* Chronic Conditions */}
                  <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-1">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 block">
                      {isBn ? 'দীর্ঘমেয়াদী রোগ (Chronic Conditions):' : 'Chronic Conditions:'}
                    </span>
                    {healthSummary.chronicConditions && healthSummary.chronicConditions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {healthSummary.chronicConditions.map((c) => (
                          <span
                            key={c}
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{isBn ? 'কোনো পূর্ব ইতিহাস নেই' : 'None reported'}</span>
                    )}
                  </div>

                  {/* Current Medicines */}
                  <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 block">
                      {isBn ? 'বর্তমান ওষুধ (Current Medications):' : 'Current Medications:'}
                    </span>
                    {healthSummary.currentMedicines && healthSummary.currentMedicines.length > 0 ? (
                      <div className="text-xs text-foreground font-mono space-y-0.5">
                        {healthSummary.currentMedicines.map((m, idx) => (
                          <div key={idx} className="truncate">
                            • {m.brand} {m.dose ? `(${m.dose})` : ''}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{isBn ? 'কোনো তথ্য নেই' : 'None recorded'}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warning Banner: Other Doctors' Records Exist but no Grant */}
        {isProfile && otherDoctorRecordsExist && (!grant || !grant.hasGrant || grant.scope !== 'full_history') && (
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-950 dark:text-amber-200">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-0.5">
                <strong className="font-bold text-sm block">
                  {isBn ? 'অন্যান্য ডাক্তারের প্রেসক্রিপশন ও রিপোর্ট সংরক্ষিত আছে' : 'Other Providers Records Available'}
                </strong>
                <p className="text-muted-foreground">
                  {isBn
                    ? 'ওষুধের পারস্পরিক প্রতিক্রিয়া (Interaction) ও সম্পূর্ণ ড্রাগ সেফটি নিশ্চিতে রোগীর ওটিপি যাচাই করে অনুমতি নিন।'
                    : 'To verify contraindications and drug interactions, request patient consent via OTP.'}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setConsentOpen(true)}
              className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs gap-1.5 shrink-0 min-h-9"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isBn ? 'অনুমতি চান (OTP)' : 'Request Access (OTP)'}</span>
            </Button>
          </div>
        )}

        {/* Latest Vitals Mini-Cards */}
        {latestVitals && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="p-3 text-center border-border">
              <span className="text-[10px] font-semibold text-muted-foreground block">
                {isBn ? 'রক্তচাপ (BP)' : 'Blood Pressure'}
              </span>
              <span className="text-base font-bold text-foreground">
                {String(latestVitals.bp_systolic || latestVitals.bpSystolic || '—')}/
                {String(latestVitals.bp_diastolic || latestVitals.bpDiastolic || '—')}
              </span>
              <span className="text-[10px] text-muted-foreground block">mmHg</span>
            </Card>

            <Card className="p-3 text-center border-border">
              <span className="text-[10px] font-semibold text-muted-foreground block">
                {isBn ? 'পালস (Pulse)' : 'Pulse'}
              </span>
              <span className="text-base font-bold text-foreground">
                {String(latestVitals.pulse || '—')}
              </span>
              <span className="text-[10px] text-muted-foreground block">bpm</span>
            </Card>

            <Card className="p-3 text-center border-border">
              <span className="text-[10px] font-semibold text-muted-foreground block">
                {isBn ? 'তাপমাত্রা (Temp)' : 'Temp'}
              </span>
              <span className="text-base font-bold text-foreground">
                {String(latestVitals.temp_f || latestVitals.tempF || '—')}
              </span>
              <span className="text-[10px] text-muted-foreground block">°F</span>
            </Card>

            <Card className="p-3 text-center border-border">
              <span className="text-[10px] font-semibold text-muted-foreground block">
                {isBn ? 'ওজন (Weight)' : 'Weight'}
              </span>
              <span className="text-base font-bold text-foreground">
                {String(latestVitals.weight_kg || latestVitals.weightKg || '—')}
              </span>
              <span className="text-[10px] text-muted-foreground block">kg</span>
            </Card>

            <Card className="p-3 text-center border-border col-span-2 sm:col-span-1">
              <span className="text-[10px] font-semibold text-muted-foreground block">
                {isBn ? 'অক্সিজেন (SpO2)' : 'SpO2'}
              </span>
              <span className="text-base font-bold text-foreground">
                {String(latestVitals.spo2 || '—')}%
              </span>
              <span className="text-[10px] text-muted-foreground block">O2 sat</span>
            </Card>
          </div>
        )}

        {/* Chronological History Timeline */}
        {isProfile ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  <span>{isBn ? 'ক্লিনিকাল হিস্ট্রি টাইমলাইন' : 'Clinical History Timeline'}</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {isBn
                    ? 'রোগীর সমস্ত ভিজিট, প্রেসক্রিপশন ও ল্যাব টেস্টের সময়ক্রমিক ইতিহাস'
                    : 'Unified chronological record of checkups, prescriptions and investigations'}
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Type Filter Buttons */}
                <div className="flex rounded-lg border border-border p-0.5 bg-muted/40 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setTypeFilter('all')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      typeFilter === 'all' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isBn ? 'সব' : 'All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter('visit')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      typeFilter === 'visit' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isBn ? 'ভিজিট' : 'Visits'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter('prescription')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      typeFilter === 'prescription' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isBn ? 'ওষুধ' : 'Rx'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTypeFilter('report')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      typeFilter === 'report' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isBn ? 'রিপোর্ট' : 'Labs'}
                  </button>
                </div>

                {/* Doctor Filter */}
                <select aria-label={isBn ? 'ডাক্তার অনুযায়ী দেখুন' : 'Filter by doctor'}
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value as 'all' | 'mine')}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs font-medium"
                >
                  <option value="all">{isBn ? 'সকল ডাক্তার' : 'All Doctors'}</option>
                  <option value="mine">{isBn ? 'শুধু আমার রেকর্ড' : 'My Records Only'}</option>
                </select>
              </div>
            </div>

            {/* Timeline Items */}
            {filteredTimeline.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <CardContent className="p-0 text-sm text-muted-foreground">
                  {isBn ? 'কোনো টাইমলাইন রেকর্ড পাওয়া যায়নি' : 'No records match the current filter'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border/60">
                {filteredTimeline.map((item) => (
                  <div key={item.id} className="relative flex items-start gap-3.5 pl-1">
                    {/* Timeline icon */}
                    <div className="relative z-10 w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-border bg-muted text-foreground">
                      {item.type === 'visit' && <Stethoscope className="w-3.5 h-3.5" />}
                      {item.type === 'prescription' && <Pill className="w-3.5 h-3.5" />}
                      {item.type === 'report' && <FileText className="w-3.5 h-3.5" />}
                    </div>

                    {/* Timeline content card */}
                    <Card className="flex-1 border-border bg-card shadow-xs">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/40 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{item.title}</span>
                            {item.isOwnRecord ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary">
                                {isBn ? 'আমার' : 'My Record'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {item.doctorName}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(item.date).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <p className="text-xs text-muted-foreground">{item.summary}</p>

                        {/* Detailed breakdown based on item type */}
                        {item.type === 'prescription' && Array.isArray(item.details.items) && (
                          <div className="pt-1 flex flex-wrap gap-1.5">
                            {(item.details.items as unknown as RxItemDetail[]).map((rxIt) => (
                              <span
                                key={rxIt.id}
                                className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-muted/60 text-foreground border border-border"
                              >
                                {rxIt.brand_name} {rxIt.strength} ({rxIt.dosing_schedule})
                              </span>
                            ))}
                          </div>
                        )}

                        {item.type === 'report' && (item.details.fileUrl as string) && (
                          <div className="pt-1">
                            <a
                              href={item.details.fileUrl as string}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>{isBn ? 'রিপোর্ট ফাইল ডাউনলোড করুন' : 'Download Report File'}</span>
                            </a>
                          </div>
                        )}

                        {item.type === 'visit' && (
                          <div className="pt-1 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground font-mono">
                              Case ID: {(item.details.caseId as string).slice(0, 8)}...
                            </span>
                            <div className="flex items-center gap-2">
                              {grant?.hasGrant && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="min-h-9 text-xs"
                                  data-testid="timeline-start-follow-up"
                                  onClick={() => setFollowUpFrom(item.details.caseId as string)}
                                >
                                  {tFollowUp('start')}
                                </Button>
                              )}
                              <Link
                                href={`/cases/${item.details.caseId}`}
                                className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline min-h-9"
                              >
                                <span>{isBn ? 'কেস কথোপকথন খুলুন' : 'Open Case'}</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </Link>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Legacy Fallback View */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                <span>{isBn ? 'ভিজিট ও ক্লিনিকাল হিস্ট্রি' : 'Visits'}</span>
              </h2>
              {legacyEncounters.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">{isBn ? 'এখনও কোনো ভিজিট নেই।' : 'No visits yet.'}</Card>
              ) : (
                legacyEncounters.map((enc) => {
                  const when = enc.visitDate ?? enc.visit_date;
                  return (
                    <Card key={enc.id}>
                      <CardHeader className="p-4 space-y-1">
                        <CardTitle className="text-sm">{enc.chiefComplaint ?? enc.chief_complaint ?? (isBn ? 'সাধারণ ভিজিট' : 'General visit')}</CardTitle>
                        {when && <p className="text-xs text-muted-foreground">{new Date(when).toLocaleDateString(isBn ? 'bn-BD' : 'en-US', { dateStyle: 'medium' })}</p>}
                      </CardHeader>
                    </Card>
                  );
                })
              )}
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>{isBn ? 'প্রেসক্রিপশন' : 'Prescriptions'}</span>
              </h2>
              {legacyPrescriptions.length === 0 ? (
                <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">{isBn ? 'এখনও কোনো প্রেসক্রিপশন নেই।' : 'No prescriptions yet.'}</Card>
              ) : (
                legacyPrescriptions.map((rx) => (
                  <Link key={rx.id} href={`/prescriptions/${rx.id}`} className="block rounded-xl focus-visible:ring-2 focus-visible:ring-ring">
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardHeader className="p-4 flex flex-row items-center justify-between gap-2">
                        <CardTitle className="text-sm font-mono">#{rx.rx_number}</CardTitle>
                        <Badge variant={rx.status === 'finalized' ? 'outline' : 'secondary'} className="text-[11px]">
                          {rx.status === 'finalized' ? (isBn ? 'চূড়ান্ত' : 'Final') : isBn ? 'খসড়া' : 'Draft'}
                        </Badge>
                      </CardHeader>
                    </Card>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        <FollowUpSheet priorCaseId={followUpFrom} open={followUpFrom !== null} onOpenChange={(open) => !open && setFollowUpFrom(null)} />

        {/* Consent Sheet for In-Clinic OTP Access Grant */}
        {isProfile && patient.phone && (
          <ConsentSheet
            isOpen={consentOpen}
            onClose={() => setConsentOpen(false)}
            profileId={patient.id}
            profileName={patient.name}
            phone={patient.phone}
            onGrantSuccess={() => {
              toast.success(isBn ? 'রোগীর সম্পূর্ণ ইতিহাস দেখার অনুমতি সক্রিয় হয়েছে!' : 'Full history access grant activated!');
              fetchProfileData();
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
