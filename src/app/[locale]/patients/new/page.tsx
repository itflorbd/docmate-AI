'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ConsentSheet } from '@/components/shared/ConsentSheet';
import {
  UserPlus,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Save,
  Check,
  Search,
  Smartphone,
  Users,
  Loader2,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProfileMatch {
  id: string;
  name: string;
  nameMasked: string;
  relation: string;
  age: number;
  gender: string;
  bloodGroup: string | null;
  hasOtherDoctorRecords: boolean;
  hasActiveGrant: boolean;
  grantScope: string | null;
  expiresAt: string | null;
}

const COMMON_SYMPTOMS_BN = [
  'জ্বর (Fever)',
  'কাশি (Cough)',
  'বুকে ব্যথা (Chest Pain)',
  'শ্বাসকষ্ট (Shortness of breath)',
  'পেট ব্যথা (Abdominal Pain)',
  'বমি ভাব (Nausea / Vomiting)',
  'মাথা ব্যথা (Headache)',
  'দুর্বলতা (Fatigue)',
  'প্রস্রাবে জ্বালা (Dysuria)',
  'ডায়রিয়া (Diarrhea)',
  'মাথা ঘোরা (Dizziness)',
];

const COMMON_ALLERGIES_BN = [
  'Penicillin (পেনিসিলিন)',
  'Sulfa Drugs (সালফা)',
  'Ciprofloxacin (সিপ্রোফ্লক্সাসিন)',
  'Aspirin / NSAIDs (অ্যাসপিরিন)',
  'ধূলোবালি / অ্যালার্জি (Dust / Allergen)',
];

const COMMON_HISTORY_BN = [
  'উচ্চ রক্তচাপ (Hypertension)',
  'ডায়াবেটিস (Diabetes Mellitus)',
  'অ্যাজমা / হাঁপানি (Asthma)',
  'কিডনি রোগ (Chronic Kidney Disease)',
  'হৃদরোগ (Ischemic Heart Disease)',
];

export default function NewPatientIntakePage() {
  const router = useRouter();
  const locale = useLocale();
  const isBn = locale === 'bn';
  const tFlow = useTranslations('patientFlow');
  const tIntake = useTranslations('intake');

  // Multi-step Flow: 'find' | 'create_profile' | 'intake'
  const [flowStep, setFlowStep] = useState<'find' | 'create_profile' | 'intake'>('find');
  const [intakeStep, setIntakeStep] = useState<1 | 2 | 3 | 4>(1);

  // Phone Search State
  const [searchPhone, setSearchPhone] = useState('01700000001');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [foundProfiles, setFoundProfiles] = useState<ProfileMatch[]>([]);
  const [phoneMasked, setPhoneMasked] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<ProfileMatch | null>(null);

  // Consent Sheet State
  const [isConsentOpen, setIsConsentOpen] = useState(false);

  // Profile Creation State
  const [createName, setCreateName] = useState('');
  const [createAge, setCreateAge] = useState<number | ''>('');
  const [createGender, setCreateGender] = useState<'male' | 'female' | 'other'>('male');
  const [createRelation, setCreateRelation] = useState<'self' | 'child' | 'spouse' | 'parent' | 'other'>('self');
  const [createBloodGroup, setCreateBloodGroup] = useState('');
  // Consent needs an explicit tick by the person creating the profile.
  const [createConsent, setCreateConsent] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState<Record<string, unknown> | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Clinical Intake State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Forward old intake flow directly to advanced /cases/new
  useEffect(() => {
    if (flowStep === 'intake') {
      if (selectedProfile) {
        router.push(`/cases/new?profileId=${selectedProfile.id}&name=${encodeURIComponent(selectedProfile.name)}&age=${selectedProfile.age}&gender=${selectedProfile.gender}`);
      } else {
        router.push('/cases/new');
      }
    }
  }, [flowStep, selectedProfile, router]);

  // Step 2: Chief Complaint, Care Setting & Symptoms
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [careSetting, setCareSetting] = useState<'' | 'outpatient' | 'inpatient' | 'intensive_care'>('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  // Step 3: Vitals
  // Vitals start empty. An unmeasured value stays unknown; it is never filled with a normal value.
  const [bpSystolic, setBpSystolic] = useState<number | ''>('');
  const [bpDiastolic, setBpDiastolic] = useState<number | ''>('');
  const [pulse, setPulse] = useState<number | ''>('');
  const [tempF, setTempF] = useState<number | ''>('');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [spo2, setSpo2] = useState<number | ''>('');
  const [respiratoryRate, setRespiratoryRate] = useState<number | ''>('');

  // Step 4: Allergies & History
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [customAllergy, setCustomAllergy] = useState('');
  const [currentMedsText, setCurrentMedsText] = useState('');
  const [selectedHistory, setSelectedHistory] = useState<string[]>([]);
  const [autoSavedTime, setAutoSavedTime] = useState<string | null>(null);

  // Auto-save timestamp when clinical data is entered
  useEffect(() => {
    if (selectedSymptoms.length > 0 || chiefComplaint || bpSystolic || tempF) {
      const timer = setTimeout(() => {
        setAutoSavedTime(new Date().toLocaleTimeString(isBn ? 'bn-BD' : 'en-US', { hour: '2-digit', minute: '2-digit' }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedSymptoms, chiefComplaint, bpSystolic, tempF, isBn]);

  // Search Patient Phone
  const handleSearchPatient = async (phoneToSearch?: string) => {
    const target = (phoneToSearch || searchPhone).trim();
    if (!target || target.length < 8) {
      toast.error(isBn ? 'সঠিক ফোন নম্বর লিখুন' : 'Please enter valid phone number');
      return;
    }

    setSearchLoading(true);
    setSearchPerformed(false);
    setFoundProfiles([]);

    try {
      const res = await fetch(`/api/patient/search?phone=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to search patients');
      }

      setSearchPerformed(true);
      setPhoneMasked(data.phoneMasked || target);
      if (data.found && data.profiles.length > 0) {
        setFoundProfiles(data.profiles);
      } else {
        setFoundProfiles([]);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error searching patient');
    } finally {
      setSearchLoading(false);
    }
  };

  // Select profile
  const handleSelectProfile = (prof: ProfileMatch) => {
    setSelectedProfile(prof);

    // Pre-fill demographics
    setCreateName(prof.name);
    setCreateAge(prof.age);
    setCreateGender(prof.gender as 'male' | 'female' | 'other');
    if (prof.bloodGroup) setCreateBloodGroup(prof.bloodGroup);

    // If active grant or author, directly proceed to new clinical case intake
    if (prof.hasActiveGrant || !prof.hasOtherDoctorRecords) {
      router.push(`/cases/new?profileId=${prof.id}&name=${encodeURIComponent(prof.name)}&age=${prof.age}&gender=${prof.gender}`);
    } else {
      setIsConsentOpen(true);
    }
  };

  // Handle Create Profile
  const handleCreateProfileSubmit = async (confirmDuplicate = false) => {
    if (!createName || createAge === '') {
      toast.error(isBn ? 'নাম ও বয়স প্রদান করুন' : 'Name and age are required');
      return;
    }

    setCreatingProfile(true);
    setDuplicateWarning(null);

    try {
      const idempotencyKey = `create-profile-${searchPhone}-${createName}-${Date.now()}`;
      const res = await fetch('/api/patient/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: searchPhone.trim(),
          name: createName.trim(),
          age: Number(createAge),
          gender: createGender,
          relation: createRelation,
          bloodGroup: createBloodGroup,
          consentObtained: createConsent,
          confirmDuplicate,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (res.status === 409 && data.duplicateWarning) {
        setDuplicateWarning(data.message);
        setDuplicateCandidate(data.existingProfile);
        setCreatingProfile(false);
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create profile');
      }

      toast.success(isBn ? 'রোগীর প্রোফাইল সফলভাবে তৈরি হয়েছে' : 'Profile created successfully');
      router.push(`/cases/new?profileId=${data.profile.id}&name=${encodeURIComponent(data.profile.name)}&age=${data.profile.age}&gender=${data.profile.gender}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error creating profile');
    } finally {
      setCreatingProfile(false);
    }
  };

  // Symptoms, Allergies, History toggles
  const toggleSymptom = (sym: string) => {
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
      if (!chiefComplaint) setChiefComplaint(sym);
    }
  };

  const toggleAllergy = (all: string) => {
    if (selectedAllergies.includes(all)) {
      setSelectedAllergies(selectedAllergies.filter((a) => a !== all));
    } else {
      setSelectedAllergies([...selectedAllergies, all]);
    }
  };

  const toggleHistory = (h: string) => {
    if (selectedHistory.includes(h)) {
      setSelectedHistory(selectedHistory.filter((item) => item !== h));
    } else {
      setSelectedHistory([...selectedHistory, h]);
    }
  };

  const addCustomAllergy = () => {
    if (customAllergy.trim() && !selectedAllergies.includes(customAllergy.trim())) {
      setSelectedAllergies([...selectedAllergies, customAllergy.trim()]);
      setCustomAllergy('');
    }
  };

  // Final Clinical Case Submit
  const handleFinalCaseSubmit = async () => {
    setSubmitting(true);
    setErrorMessage('');

    // Only measured values are sent; missing ones stay unknown for follow-up.
    const measured = (value: number | '') => (value === '' || !Number.isFinite(Number(value)) ? undefined : Number(value));
    const tempMeasured = measured(tempF);
    const vitalsData = Object.fromEntries(
      Object.entries({
        blood_pressure_systolic: measured(bpSystolic),
        blood_pressure_diastolic: measured(bpDiastolic),
        heart_rate: measured(pulse),
        temperature_celsius: tempMeasured === undefined ? undefined : Math.round((tempMeasured - 32) * (5 / 9) * 10) / 10,
        spo2_percent: measured(spo2),
        respiratory_rate: measured(respiratoryRate),
      }).filter(([, value]) => value !== undefined),
    );

    const currentMedsList = currentMedsText
      .split('\n')
      .map((m) => m.trim())
      .filter(Boolean);

    const seq = Math.floor(100 + Math.random() * 900);
    const patientCode = `P-${new Date().getFullYear()}-${seq}`;
    const idempotencyKey = `case-create-${selectedProfile?.id || searchPhone}-${Date.now()}`;

    const resolvedAge = selectedProfile?.age ? Number(selectedProfile.age) : Number(createAge);
    const rawGender = (selectedProfile?.gender || createGender || 'male').toLowerCase();
    const resolvedGender: 'male' | 'female' | 'other' =
      rawGender === 'female' ? 'female' : rawGender === 'other' ? 'other' : 'male';

    const payload = {
      patient_code: patientCode,
      profile_id: selectedProfile?.id || undefined,
      idempotency_key: idempotencyKey,
      structured_input: {
        age: resolvedAge,
        gender: resolvedGender,
        ...(measured(weightKg) !== undefined ? { weight_kg: measured(weightKg) } : {}),
        ...(careSetting ? { care_setting: careSetting } : {}),
        chief_complaint: chiefComplaint.trim() || selectedSymptoms.join(', ') || 'General Consultation',
        symptoms: selectedSymptoms,
        past_medical_history: selectedHistory,
        current_medicines: currentMedsList,
        allergies: selectedAllergies,
        vitals: vitalsData,
        lab_values: [],
        clinical_notes: `Patient Profile: ${selectedProfile?.name || createName}`,
      },
    };

    try {
      const res = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        const errorText = data.details ? `${data.error} (${data.details})` : (data.error || 'Failed to create case');
        throw new Error(errorText);
      }

      toast.success(isBn ? 'কেস সফলভাবে তৈরি হয়েছে!' : 'Case created successfully!');
      router.push(`/cases/${data.case.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating case';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        <PageHeader
          title={isBn ? 'নতুন রোগী গ্রহণ ও কেস শুরু' : 'New Patient Intake & Case Creation'}
          subtitle={
            isBn
              ? 'মোবাইল নম্বর দিয়ে রোগী খুঁজুন বা নতুন প্রোফাইল তৈরি করে তাৎক্ষণিক কেস শুরু করুন'
              : 'Find patient by mobile phone or create profile to begin clinical consultation'
          }
        />

        {/* =========================================================================
            STAGE 1: FIND OR SELECT PATIENT PROFILE
           ========================================================================= */}
        {flowStep === 'find' && (
          <div className="space-y-6">
            <Card className="border border-border shadow-xs bg-card">
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-primary" />
                  <span>{tFlow('phoneNumber')}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {isBn
                    ? 'রোগী নিবন্ধিত থাকলে তার সকল পারিবারিক প্রোফাইল প্রদর্শিত হবে'
                    : 'Search patient by 11-digit mobile number to view family profiles'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Input
                      type="tel"
                      inputMode="numeric"
                      data-testid="patient-phone-input"
                      value={searchPhone}
                      onChange={(e) => setSearchPhone(e.target.value)}
                      placeholder={tFlow('phonePlaceholder')}
                      className="h-12 text-base font-mono tracking-wide pl-4 pr-10"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchPatient()}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleSearchPatient()}
                    disabled={searchLoading}
                    data-testid="search-patient-btn"
                    className="h-12 px-6 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0"
                  >
                    {searchLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span>{tFlow('findPatient')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/cases/new')}
                    className="h-12 px-4 text-xs font-semibold border-primary/30 text-primary hover:bg-primary/10 gap-2 shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isBn ? 'সরাসরি নতুন গ্রহণ (Direct Intake)' : 'Direct Clinical Intake'}</span>
                  </Button>
                </div>

                {/* Demo Phone Shortcuts */}
                <div className="pt-1 space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {isBn ? 'ডেমো রোগী নম্বর:' : 'Demo Patient Shortcuts:'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSearchPhone('01711223344');
                        handleSearchPatient('01711223344');
                      }}
                      className="px-2.5 py-1 rounded border border-border text-xs bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-mono"
                    >
                      01711223344 (আয়েশা বেগম)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchPhone('01819554433');
                        handleSearchPatient('01819554433');
                      }}
                      className="px-2.5 py-1 rounded border border-border text-xs bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-mono"
                    >
                      01819554433 (রফিকুল ইসলাম)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchPhone('01912445566');
                        handleSearchPatient('01912445566');
                      }}
                      className="px-2.5 py-1 rounded border border-border text-xs bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-mono"
                    >
                      01912445566 (তানিয়া সুলতানা)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchPhone('01700000001');
                        handleSearchPatient('01700000001');
                      }}
                      className="px-2.5 py-1 rounded border border-border text-xs bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-mono"
                    >
                      01700000001 (কামাল হোসেন)
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search Results Display */}
            {searchPerformed && (
              <div className="space-y-4">
                {foundProfiles.length > 0 ? (
                  <Card className="border border-border bg-card shadow-xs">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-bold">
                          {isBn ? 'পাওয়া গেছে: প্রোফাইল তালিকা' : 'Found Profiles on this Account'}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {phoneMasked} • {foundProfiles.length} {isBn ? 'টি প্রোফাইল' : 'profiles'}
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFlowStep('create_profile')}
                        className="text-xs gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{tFlow('addFamilyMember')}</span>
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {foundProfiles.map((prof) => {
                          const isSelected = selectedProfile?.id === prof.id;
                          return (
                            <div
                              key={prof.id}
                              data-testid="patient-profile-card"
                              onClick={() => handleSelectProfile(prof)}
                              className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-2 ring-primary/40 shadow-xs'
                                  : 'border-border bg-card hover:border-primary/50 hover:bg-muted/30'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div className="font-bold text-base text-foreground">
                                  {prof.name}
                                </div>
                                <Badge variant="outline" className="text-[10px] capitalize">
                                  {prof.relation}
                                </Badge>
                              </div>

                              <div className="text-xs text-muted-foreground space-x-2 mb-3">
                                <span>{prof.age} {isBn ? 'বছর' : 'yrs'}</span>
                                <span>•</span>
                                <span className="capitalize">{prof.gender}</span>
                                {prof.bloodGroup && (
                                  <>
                                    <span>•</span>
                                    <span className="font-semibold text-primary">{prof.bloodGroup}</span>
                                  </>
                                )}
                              </div>

                              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                                {prof.hasActiveGrant ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>{isBn ? 'অনুমতি আছে' : 'Access Active'}</span>
                                  </span>
                                ) : prof.hasOtherDoctorRecords ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span>{isBn ? 'অনুমতি প্রয়োজন' : 'Consent Needed'}</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    {isBn ? 'নতুন পরামর্শ' : 'Direct Access'}
                                  </span>
                                )}

                                <Button size="sm" variant={isSelected ? 'default' : 'secondary'} className="h-7 text-xs px-2.5">
                                  {isBn ? 'নির্বাচন করুন' : 'Select'}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* History Permission Banner if selected profile has other doctor records */}
                      {selectedProfile && selectedProfile.hasOtherDoctorRecords && !selectedProfile.hasActiveGrant && (
                        <div className="mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <strong className="font-semibold flex items-center gap-1.5 text-sm">
                              <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>{tFlow('needHistoryConsent')}</span>
                            </strong>
                            <p className="text-muted-foreground">
                              {isBn
                                ? 'রোগীর পূর্ববর্তী ডাক্তারদের প্রেসক্রিপশন ও ড্রাগ হিস্ট্রি দেখার জন্য ওটিপি অনুমোদন নিন।'
                                : 'Obtain patient OTP authorization to inspect past prescriptions and drug safety records.'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (selectedProfile) {
                                  router.push(`/cases/new?profileId=${selectedProfile.id}&name=${encodeURIComponent(selectedProfile.name)}&age=${selectedProfile.age}&gender=${selectedProfile.gender}`);
                                } else {
                                  router.push('/cases/new');
                                }
                              }}
                              className="text-xs h-9"
                            >
                              {tFlow('skipForNow')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setIsConsentOpen(true)}
                              className="text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{tFlow('askPermission')}</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border border-border bg-card shadow-xs text-center p-8 space-y-4">
                    <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
                      <Users className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-base text-foreground">
                        {tFlow('patientNotFound')}
                      </h3>
                      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                        {isBn
                          ? `নম্বর ${searchPhone}-এর বিপরীতে কোনো অ্যাকাউন্ট পাওয়া যায়নি। এখনই নতুন রোগীর প্রোফাইল তৈরি করুন।`
                          : `No patient account found for ${searchPhone}. Create a new patient profile now.`}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setFlowStep('create_profile')}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{tFlow('createNewProfile')}</span>
                    </Button>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            STAGE 2: CREATE PATIENT PROFILE (OR ADD FAMILY MEMBER)
           ========================================================================= */}
        {flowStep === 'create_profile' && (
          <Card className="border border-border shadow-xs bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
              <div className="space-y-1">
                <CardTitle className="text-lg font-bold">
                  {tFlow('createNewProfile')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isBn ? `মোবাইল নম্বর: ${searchPhone}` : `Account Phone: ${searchPhone}`}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFlowStep('find')}
                className="text-xs gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{isBn ? 'ফিরে যান' : 'Back'}</span>
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {duplicateWarning && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <strong className="font-bold text-sm">{tFlow('duplicateWarningTitle')}</strong>
                      <p>{duplicateWarning}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (duplicateCandidate) {
                          handleSelectProfile(duplicateCandidate as unknown as ProfileMatch);
                        }
                      }}
                      className="text-xs"
                    >
                      {tFlow('pickExisting')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleCreateProfileSubmit(true)}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    >
                      {tFlow('duplicateConfirm')}
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="profName" className="text-xs font-medium">
                    {isBn ? 'রোগীর পূর্ণ নাম *' : 'Patient Full Name *'}
                  </Label>
                  <Input
                    id="profName"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="কামাল হোসেন"
                    required
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="profAge" className="text-xs font-medium">
                    {isBn ? 'বয়স *' : 'Age *'}
                  </Label>
                  <Input
                    id="profAge"
                    type="number"
                    value={createAge}
                    onChange={(e) => setCreateAge(e.target.value ? Number(e.target.value) : '')}
                    placeholder="35"
                    required
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isBn ? 'লিঙ্গ *' : 'Gender *'}
                  </Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['male', 'female', 'other'] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setCreateGender(g)}
                        className={`py-2 px-3 rounded-md border text-xs font-medium transition-colors ${
                          createGender === g
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border bg-card hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {g === 'male' && (isBn ? 'পুরুষ' : 'Male')}
                        {g === 'female' && (isBn ? 'মহিলা' : 'Female')}
                        {g === 'other' && (isBn ? 'অন্যান্য' : 'Other')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isBn ? 'সম্পর্ক (Relation)' : 'Account Relation'}
                  </Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['self', 'child', 'spouse', 'parent'] as const).map((rel) => (
                      <button
                        key={rel}
                        type="button"
                        onClick={() => setCreateRelation(rel)}
                        className={`py-2 px-2 rounded-md border text-[11px] font-medium transition-colors ${
                          createRelation === rel
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border bg-card hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        {rel === 'self' && (isBn ? 'নিজ' : 'Self')}
                        {rel === 'child' && (isBn ? 'সন্তান' : 'Child')}
                        {rel === 'spouse' && (isBn ? 'স্বামী/স্ত্রী' : 'Spouse')}
                        {rel === 'parent' && (isBn ? 'পিতামাতা' : 'Parent')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Data Storage Consent Tick */}
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border flex items-center gap-3">
                <input
                  id="consentCheckbox"
                  type="checkbox"
                  checked={createConsent}
                  onChange={(e) => setCreateConsent(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                />
                <label htmlFor="consentCheckbox" className="text-xs text-foreground cursor-pointer font-medium">
                  {isBn
                    ? 'রোগী তথ্য সংরক্ষণে সম্মত (Patient consents to digital health record storage under BMDC rules)'
                    : 'Patient explicitly consents to digital health record storage under BMDC guidelines'}
                </label>
              </div>

              <Button
                type="button"
                onClick={() => handleCreateProfileSubmit(false)}
                disabled={creatingProfile || !createConsent}
                className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {creatingProfile ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                <span>{isBn ? 'প্রোফাইল তৈরি করুন ও কেস শুরু করুন' : 'Create Profile & Start Case'}</span>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* =========================================================================
            STAGE 3: CLINICAL INTAKE (PRE-FILLED WITH PROFILE HEALTH SUMMARY)
           ========================================================================= */}
        {flowStep === 'intake' && (
          <div className="space-y-6">
            {/* Active Patient Summary Banner */}
            <div data-testid="selected-patient-banner" className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                  {selectedProfile?.name?.charAt(0) || 'P'}
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    {selectedProfile?.name || createName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedProfile?.age || createAge} {isBn ? 'বছর' : 'years'} •{' '}
                    <span className="capitalize">{selectedProfile?.gender || createGender}</span> •{' '}
                    <span className="font-mono text-primary font-semibold">{searchPhone}</span>
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFlowStep('find')}
                className="text-xs h-8"
              >
                {isBn ? 'রোগী পরিবর্তন' : 'Change Patient'}
              </Button>
            </div>

            {/* 4-Step Clinical Intake Form */}
            <Card className="border border-border shadow-xs bg-card">
              <CardHeader className="pb-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs font-mono font-medium">
                    {isBn ? `ধাপ ${intakeStep}/৪` : `Step ${intakeStep}/4`}
                  </Badge>
                  {autoSavedTime && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Save className="w-3 h-3 text-emerald-600" />
                      <span>{isBn ? `স্বয়ংক্রিয় সংরক্ষিত: ${autoSavedTime}` : `Autosaved: ${autoSavedTime}`}</span>
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {/* INTAKE STEP 1: Quick Symptoms */}
                {intakeStep === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="complaint" className="text-xs font-semibold">
                        {isBn ? 'প্রধান উপসর্গ (Chief Complaint) *' : 'Chief Complaint *'}
                      </Label>
                      <Input
                        id="complaint"
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        placeholder={isBn ? 'যেমন: ৩ দিন ধরে তীব্র জ্বর ও কাশি' : 'e.g. High fever and cough for 3 days'}
                        className="h-11 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {tIntake('careSettingOptional')}
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label={tIntake('careSetting')}>
                        {(
                          [
                            { value: '', label: tIntake('careSettingUnset') },
                            { value: 'outpatient', label: tIntake('careSettingOutpatient') },
                            { value: 'inpatient', label: tIntake('careSettingInpatient') },
                            { value: 'intensive_care', label: tIntake('careSettingIntensiveCare') },
                          ] as const
                        ).map((opt) => {
                          const active = careSetting === opt.value;
                          return (
                            <button
                              key={opt.value || 'unset'}
                              type="button"
                              aria-pressed={active}
                              data-testid={`intake-care-setting-${opt.value || 'unset'}`}
                              onClick={() => setCareSetting(opt.value)}
                              className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                                active
                                  ? 'border-primary bg-primary/10 text-primary font-semibold'
                                  : 'border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">
                        {isBn ? 'দ্রুত উপসর্গ নির্বাচন (Quick Symptom Tap):' : 'Common Symptoms Tap:'}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {COMMON_SYMPTOMS_BN.map((sym) => {
                          const active = selectedSymptoms.includes(sym);
                          return (
                            <button
                              key={sym}
                              type="button"
                              onClick={() => toggleSymptom(sym)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                active
                                  ? 'bg-primary text-primary-foreground font-semibold shadow-2xs'
                                  : 'bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border'
                              }`}
                            >
                              {active && <Check className="w-3 h-3 inline mr-1" />}
                              {sym}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={() => setIntakeStep(2)}
                      className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 mt-4"
                    >
                      <span>{isBn ? 'পরবর্তী: ভাইটালস ও শারীরিক পরীক্ষা' : 'Next: Vitals & Exam'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* INTAKE STEP 2: Vitals */}
                {intakeStep === 2 && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="bpSystolic" className="text-xs font-medium">রক্তচাপ (Systolic)</Label>
                        <Input
                          id="bpSystolic"
                          type="number"
                          value={bpSystolic}
                          onChange={(e) => setBpSystolic(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 120"
                          className="h-10 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bpDiastolic" className="text-xs font-medium">রক্তচাপ (Diastolic)</Label>
                        <Input
                          id="bpDiastolic"
                          type="number"
                          value={bpDiastolic}
                          onChange={(e) => setBpDiastolic(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 80"
                          className="h-10 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pulse" className="text-xs font-medium">পালস (Pulse bpm)</Label>
                        <Input
                          id="pulse"
                          type="number"
                          value={pulse}
                          onChange={(e) => setPulse(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 76"
                          className="h-10 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="tempF" className="text-xs font-medium">তাপমাত্রা (°F)</Label>
                        <Input
                          id="tempF"
                          type="number"
                          step="0.1"
                          value={tempF}
                          onChange={(e) => setTempF(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 98.6"
                          className="h-10 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="respiratoryRate" className="text-xs font-medium">শ্বাসপ্রশ্বাস (Resp Rate /min)</Label>
                        <Input
                          id="respiratoryRate"
                          type="number"
                          value={respiratoryRate}
                          onChange={(e) => setRespiratoryRate(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 18"
                          className="h-10 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="weightKg" className="text-xs font-medium">ওজন (Weight kg)</Label>
                        <Input
                          id="weightKg"
                          type="number"
                          value={weightKg}
                          onChange={(e) => setWeightKg(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 65"
                          className="h-10 text-sm font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="spo2" className="text-xs font-medium">SpO2 (%)</Label>
                        <Input
                          id="spo2"
                          type="number"
                          value={spo2}
                          onChange={(e) => setSpo2(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 98"
                          className="h-10 text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setIntakeStep(1)} className="h-11 px-4">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setIntakeStep(3)}
                        className="flex-1 h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      >
                        <span>{isBn ? 'পরবর্তী: ড্রাগ অ্যালার্জি ও হিস্ট্রি' : 'Next: Allergies & History'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* INTAKE STEP 3: Allergies & Current Meds */}
                {intakeStep === 3 && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                        {isBn ? 'ড্রাগ অ্যালার্জি (Drug Allergies):' : 'Known Drug Allergies:'}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {COMMON_ALLERGIES_BN.map((all) => {
                          const active = selectedAllergies.includes(all);
                          return (
                            <button
                              key={all}
                              type="button"
                              onClick={() => toggleAllergy(all)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                active
                                  ? 'bg-rose-600 text-white font-semibold'
                                  : 'bg-muted/60 hover:bg-muted text-muted-foreground border border-border'
                              }`}
                            >
                              {active && <Check className="w-3 h-3 inline mr-1" />}
                              {all}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Input
                          value={customAllergy}
                          onChange={(e) => setCustomAllergy(e.target.value)}
                          placeholder={isBn ? 'অন্য অ্যালার্জি লিখুন...' : 'Add other allergy...'}
                          className="h-9 text-xs"
                          onKeyDown={(e) => e.key === 'Enter' && addCustomAllergy()}
                        />
                        <Button type="button" size="sm" onClick={addCustomAllergy} className="h-9 text-xs">
                          {isBn ? 'যোগ করুন' : 'Add'}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                        {isBn ? 'দীর্ঘমেয়াদী রোগ (Chronic Conditions / History):' : 'Chronic Conditions / Past History:'}
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {COMMON_HISTORY_BN.map((h) => {
                          const active = selectedHistory.includes(h);
                          return (
                            <button
                              key={h}
                              type="button"
                              onClick={() => toggleHistory(h)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                active
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-muted/60 hover:bg-muted text-muted-foreground border border-border'
                              }`}
                            >
                              {active && <Check className="w-3 h-3 inline mr-1" />}
                              {h}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        {isBn ? 'বর্তমান ওষুধসমূহ (Current Medications):' : 'Current Medications:'}
                      </Label>
                      <textarea
                        value={currentMedsText}
                        onChange={(e) => setCurrentMedsText(e.target.value)}
                        placeholder={isBn ? 'প্রতি লাইনে একটি ওষুধের নাম (যেমন: Tab. Osartil 50 mg)' : 'One medication per line'}
                        rows={3}
                        className="w-full rounded-md border border-border bg-background p-2.5 text-xs font-mono"
                      />
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" onClick={() => setIntakeStep(2)} className="h-11 px-4">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        onClick={() => setIntakeStep(4)}
                        className="flex-1 h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      >
                        <span>{isBn ? 'পরবর্তী: পর্যালোচনা ও নিশ্চিতকরণ' : 'Next: Review & Confirm'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* INTAKE STEP 4: Review & Finalize Case Creation */}
                {intakeStep === 4 && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3 text-xs">
                      <h4 className="font-bold text-sm text-foreground">
                        {isBn ? 'ক্লিনিকাল কেস সামারি' : 'Clinical Case Summary'}
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                        <div>
                          <span>{isBn ? 'রোগী:' : 'Patient:'} </span>
                          <strong className="text-foreground">{selectedProfile?.name || createName}</strong>
                        </div>
                        <div>
                          <span>{isBn ? 'উপসর্গ:' : 'Complaint:'} </span>
                          <strong className="text-foreground">{chiefComplaint || 'General'}</strong>
                        </div>
                        <div>
                          <span>{tIntake('careSetting')}: </span>
                          <strong className="text-foreground">
                            {careSetting === 'outpatient'
                              ? tIntake('careSettingOutpatient')
                              : careSetting === 'inpatient'
                                ? tIntake('careSettingInpatient')
                                : careSetting === 'intensive_care'
                                  ? tIntake('careSettingIntensiveCare')
                                  : tIntake('careSettingUnset')}
                          </strong>
                        </div>
                        <div>
                          <span>{isBn ? 'রক্তচাপ:' : 'BP:'} </span>
                          <strong className="text-foreground font-mono">{bpSystolic !== '' && bpDiastolic !== '' ? `${bpSystolic}/${bpDiastolic} mmHg` : isBn ? 'মাপা হয়নি' : 'Not measured'}</strong>
                        </div>
                        <div>
                          <span>{isBn ? 'ওজন:' : 'Weight:'} </span>
                          <strong className="text-foreground">{weightKg !== '' ? `${weightKg} kg` : isBn ? 'মাপা হয়নি' : 'Not measured'}</strong>
                        </div>
                        <div>
                          <span>{isBn ? 'অ্যালার্জি:' : 'Allergies:'} </span>
                          <strong className="text-foreground">{selectedAllergies.length > 0 ? selectedAllergies.join(', ') : isBn ? 'লেখা হয়নি' : 'Not recorded'}</strong>
                        </div>
                      </div>
                    </div>

                    {errorMessage && (
                      <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
                        {errorMessage}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setIntakeStep(3)} className="h-11 px-4">
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        onClick={handleFinalCaseSubmit}
                        disabled={submitting}
                        className="flex-1 h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{isBn ? 'কেস তৈরি হচ্ছে...' : 'Creating case...'}</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isBn ? 'কেস শুরু করুন (Open Clinical Workspace)' : 'Open Clinical Workspace'}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Consent Sheet Modal */}
        {selectedProfile && (
          <ConsentSheet
            isOpen={isConsentOpen}
            onClose={() => setIsConsentOpen(false)}
            phone={searchPhone}
            profileId={selectedProfile.id}
            profileName={selectedProfile.name}
            onGrantSuccess={(grant) => {
              setSelectedProfile({
                ...selectedProfile,
                hasActiveGrant: true,
                grantScope: grant.scope,
                expiresAt: grant.expiresAt,
              });
              router.push(`/cases/new?profileId=${selectedProfile.id}&name=${encodeURIComponent(selectedProfile.name)}&age=${selectedProfile.age}&gender=${selectedProfile.gender}`);
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
