'use client';

import React, { useState, useEffect } from 'react';
import { genderLabel } from '@/lib/labels';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { SafetyNoticesBanner } from '@/components/shared/SafetyNoticesBanner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/routing';
import {
  FileText,
  PlusCircle,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  Save,
  Printer,
  Check,
  Info,
} from 'lucide-react';

interface MedicineRow {
  brandName: string;
  genericName: string;
  strength: string;
  form: string;
  dosingSchedule: string;
  mealTiming: string;
  durationDays: number;
  durationText: string;
  instructions: string;
}

interface MedicineBrandMatch {
  id: string;
  brandName: string;
  genericName: string;
  manufacturer: string;
  form: string;
  strength: string;
  packSize: string;
  priceBdt: string;
  dgdaRegNum?: string;
}

const COMMON_DRUG_PRESETS = [
  { brand: 'Napa', generic: 'Paracetamol', strength: '500 mg', form: 'Tab', schedule: '১+০+১', meal: 'খাবারের পর', days: 5, text: '৫ দিন' },
  { brand: 'Napa Extend', generic: 'Paracetamol', strength: '665 mg', form: 'Tab', schedule: '১+০+১', meal: 'খাবারের পর', days: 7, text: '৭ দিন' },
  { brand: 'Seclo', generic: 'Omeprazole', strength: '20 mg', form: 'Cap', schedule: '১+০+১', meal: 'খাবারের আগে', days: 14, text: '১৪ দিন' },
  { brand: 'Azith', generic: 'Azithromycin', strength: '500 mg', form: 'Tab', schedule: '১+০+০', meal: 'খাবারের আগে', days: 5, text: '৫ দিন' },
  { brand: 'Fexo', generic: 'Fexofenadine', strength: '120 mg', form: 'Tab', schedule: '০+০+১', meal: 'খাবারের পর', days: 7, text: '৭ দিন' },
  { brand: 'Montene', generic: 'Montelukast', strength: '10 mg', form: 'Tab', schedule: '০+০+১', meal: 'খাবারের পর', days: 30, text: '১ মাস' },
  { brand: 'Camlosart', generic: 'Amlodipine + Olmesartan', strength: '5/20 mg', form: 'Tab', schedule: '১+০+০', meal: 'খাবারের পর', days: 30, text: '১ মাস' },
  { brand: 'Rosuva', generic: 'Rosuvastatin', strength: '10 mg', form: 'Tab', schedule: '০+০+১', meal: 'খাবারের পর', days: 30, text: '১ মাস' },
  { brand: 'Cipro', generic: 'Ciprofloxacin', strength: '500 mg', form: 'Tab', schedule: '১+০+১', meal: 'খাবারের পর', days: 7, text: '৭ দিন' },
];

const COMMON_INVESTIGATIONS_BN = [
  'CBC with ESR',
  'CXR P/A view (বুকের এক্স-রে)',
  'Serum Creatinine',
  'Fasting Blood Sugar (RBS / FBS)',
  'Serum Electrolytes',
  'Lipid Profile (Fasting)',
  'ECG (12 Leads)',
  'Urine R/M/E',
  'USG of Whole Abdomen',
];

const COMMON_ADVICE_BN = [
  'পর্যাপ্ত বিশুদ্ধ কুসুম গরম পানি ও তরল খাবার গ্রহণ করুন।',
  'খাবারে বাড়তি কাঁচা লবণ সম্পূর্ণ বর্জন করুন।',
  'অতিরিক্ত তেল-চর্বিযুক্ত ও ভাজাপোড়া খাবার পরিহার করুন।',
  'ধূমপান, তামাক ও ধুলাবালি থেকে সম্পূর্ণ দূরে থাকুন।',
  'প্রতিদিন অন্তত ৩০ মিনিট মুক্ত বাতাসে নিয়মিত হাঁটুন।',
  'অবস্থার অবনতি হলে অবিলম্বে নিকটস্থ জরুরি বিভাগে যোগাযোগ করুন।',
];

function NewPrescriptionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();

  const [patientsList, setPatientsList] = useState<Array<{ id: string; name: string; patient_code: string; age: number; gender: string }>>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [diagnosis, setDiagnosis] = useState('');
  const [selectedInvestigations, setSelectedInvestigations] = useState<string[]>([]);
  const [generalAdvice, setGeneralAdvice] = useState('');
  const [followUpText, setFollowUpText] = useState('৭ দিন পর রিপোর্ট সহ আসবেন');

  const [items, setItems] = useState<MedicineRow[]>([
    {
      brandName: 'Napa Extend',
      genericName: 'Paracetamol',
      strength: '665 mg',
      form: 'Tab',
      dosingSchedule: '১+০+১',
      mealTiming: 'খাবারের পর',
      durationDays: 5,
      durationText: '৫ দিন',
      instructions: 'জ্বর বা ব্যথা থাকলে খাবেন',
    },
  ]);

  // Safety Alerts & Active Notices
  const [activeNotices, setActiveNotices] = useState<Array<{ id: string; title: string; severity: string; body: string }>>([]);
  // The server's safety decision for the saved draft. Cleared on any edit.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [decision, setDecision] = useState<SafetyDecisionJson | null>(null);
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [inputs, setInputs] = useState<{ noKnownAllergies: boolean; isPregnant: '' | 'yes' | 'no'; weightKg: string; egfr: string }>({
    noKnownAllergies: false,
    isPregnant: '',
    weightKg: '',
    egfr: '',
  });
  const [gateNotice, setGateNotice] = useState('');
  const [checkingSafety, setCheckingSafety] = useState(false);
  // Any edit makes the last safety result out of date.
  const invalidateSafety = () => {
    setDecision(null);
    setGateNotice('');
  };
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // DGDA Brand Autocomplete search state
  const [activeSearchIdx, setActiveSearchIdx] = useState<number | null>(null);
  const [brandSuggestions, setBrandSuggestions] = useState<MedicineBrandMatch[]>([]);

  const handleBrandChange = (idx: number, query: string) => {
    updateItem(idx, 'brandName', query);
    if (!query || query.trim().length < 2) {
      setBrandSuggestions([]);
      setActiveSearchIdx(null);
      return;
    }
    setActiveSearchIdx(idx);

    fetch(`/api/medicines/search?q=${encodeURIComponent(query.trim())}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { medicines: [] }))
      .then((data) => {
        setBrandSuggestions(data.medicines || []);
      })
      .catch(() => {
        setBrandSuggestions([]);
      });
  };

  const selectBrandSuggestion = (idx: number, brand: MedicineBrandMatch) => {
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      brandName: brand.brandName,
      genericName: brand.genericName,
      strength: brand.strength,
      form: brand.form || updated[idx].form,
    };
    setItems(updated);
    setActiveSearchIdx(null);
    setBrandSuggestions([]);
    invalidateSafety();
  };

  // Pre-select patient if provided in query param and load active notices
  useEffect(() => {
    fetch('/api/medicines/notices/active', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { notices: [] }))
      .then((data) => setActiveNotices(data.notices || []))
      .catch(() => {});

    fetch('/api/patients', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : { patients: [] }))
      .then((data) => {
        setPatientsList(data.patients || []);
        const queryPatient = searchParams.get('patientId');
        if (queryPatient) {
          setSelectedPatientId(queryPatient);
        } else if (data.patients?.length > 0) {
          setSelectedPatientId(data.patients[0].id);
        }
      });
  }, [searchParams]);

  const addItem = () => {
    setItems([
      ...items,
      {
        brandName: '',
        genericName: '',
        strength: '500 mg',
        form: 'Tab',
        dosingSchedule: '১+০+১',
        mealTiming: 'খাবারের পর',
        durationDays: 7,
        durationText: '৭ দিন',
        instructions: '',
      },
    ]);
    invalidateSafety();
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
    invalidateSafety();
  };

  const updateItem = (idx: number, field: keyof MedicineRow, value: string | number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
    invalidateSafety();
  };

  const selectPreset = (idx: number, preset: (typeof COMMON_DRUG_PRESETS)[0]) => {
    const updated = [...items];
    updated[idx] = {
      ...updated[idx],
      brandName: preset.brand,
      genericName: preset.generic,
      strength: preset.strength,
      form: preset.form,
      dosingSchedule: preset.schedule,
      mealTiming: preset.meal,
      durationDays: preset.days,
      durationText: preset.text,
    };
    setItems(updated);
    invalidateSafety();
  };

  const toggleInvestigation = (test: string) => {
    if (selectedInvestigations.includes(test)) {
      setSelectedInvestigations(selectedInvestigations.filter((t) => t !== test));
    } else {
      setSelectedInvestigations([...selectedInvestigations, test]);
    }
  };

  const addAdvice = (line: string) => {
    if (!generalAdvice.includes(line)) {
      setGeneralAdvice(generalAdvice ? `${generalAdvice}\n• ${line}` : `• ${line}`);
    }
  };

  const bn = locale === 'bn';
  const filledItems = items.filter((i) => i.brandName.trim() && i.genericName.trim());

  /** Saves the form as a draft (creates it once, then updates it). Returns the draft id. */
  const saveDraft = async (): Promise<string | null> => {
    if (!selectedPatientId) {
      setErrorMessage(bn ? 'রোগী বেছে নিন' : 'Choose a patient first');
      return null;
    }
    if (filledItems.length === 0) {
      setErrorMessage(bn ? 'অন্তত একটি ওষুধ যোগ করুন' : 'Add at least one medicine');
      return null;
    }
    const fields = {
      diagnosis: diagnosis.trim() || 'General Clinical Consultation',
      investigations: selectedInvestigations,
      generalAdvice: generalAdvice.trim(),
      followUpText: followUpText.trim(),
      items: filledItems,
    };
    const res = draftId
      ? await fetch(`/api/prescriptions/${draftId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fields),
          credentials: 'same-origin',
        })
      : await fetch('/api/prescriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: selectedPatientId,
            ...(searchParams.get('caseId') ? { caseId: searchParams.get('caseId') } : {}),
            status: 'draft',
            ...fields,
          }),
          credentials: 'same-origin',
        });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || (bn ? 'সংরক্ষণ করা যায়নি' : 'Could not save'));
    setDraftId(data.prescription.id);
    return data.prescription.id as string;
  };

  /** Saves the draft and asks the server for the safety decision. */
  const runSafetyCheck = async (withInputs = false) => {
    setCheckingSafety(true);
    setErrorMessage('');
    setGateNotice('');
    try {
      const id = await saveDraft();
      if (!id) return;
      const safety_inputs = withInputs
        ? {
            ...(inputs.noKnownAllergies ? { no_known_allergies: true as const } : {}),
            ...(inputs.isPregnant ? { is_pregnant: inputs.isPregnant === 'yes' } : {}),
            ...(Number(inputs.weightKg) > 0 ? { weight_kg: Number(inputs.weightKg) } : {}),
            ...(Number(inputs.egfr) > 0 ? { egfr: Number(inputs.egfr) } : {}),
          }
        : undefined;
      const res = await fetch(`/api/prescriptions/${id}/safety-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safety_inputs ? { safety_inputs } : {}),
        credentials: 'same-origin',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (bn ? 'নিরাপত্তা যাচাই করা যায়নি' : 'Safety check failed'));
      setDecision(data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : bn ? 'নিরাপত্তা যাচাই করা যায়নি' : 'Safety check failed');
    } finally {
      setCheckingSafety(false);
    }
  };

  const pendingOverrides = decision?.alerts.filter((a) => a.stop === 'override' && !a.override) ?? [];
  const reasonsComplete = pendingOverrides.every((a) => (overrideReasons[a.id] ?? '').trim().length >= 10);
  const canFinalize = Boolean(decision && draftId && decision.status !== 'blocked' && reasonsComplete);

  const finalizePrescription = async () => {
    if (!decision || !draftId) return;
    setSubmitting(true);
    setErrorMessage('');
    try {
      const res = await fetch(`/api/prescriptions/${draftId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          regimen_hash: decision.regimen_hash,
          context_version: decision.context_version,
          overrides: pendingOverrides.map((a) => ({ alert_id: a.id, reason: overrideReasons[a.id].trim() })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/prescriptions/${draftId}`);
        return;
      }
      if (data.safety) setDecision(data.safety);
      if (res.status === 423) {
        setGateNotice(
          bn
            ? 'নিরাপত্তা যাচাই পাস করেছে। ক্লিনিক্যাল অনুমোদন না হওয়া পর্যন্ত অফিশিয়াল প্রেসক্রিপশন বন্ধ। এটি খসড়া হিসেবে সংরক্ষিত আছে।'
            : 'Safety check passed. Official prescriptions are off until clinical release is approved. Your draft is saved.',
        );
      } else {
        setErrorMessage(data.error || (bn ? 'চূড়ান্ত করা যায়নি' : 'Could not finalize'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraftAndOpen = async () => {
    setSubmitting(true);
    setErrorMessage('');
    try {
      const id = await saveDraft();
      if (id) router.push(`/prescriptions/${id}`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : bn ? 'সংরক্ষণ করা যায়নি' : 'Could not save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        <PageHeader
          title={locale === 'bn' ? 'নতুন প্রেসক্রিপশন' : 'New prescription'}
          subtitle={
            locale === 'bn'
              ? 'রোগী বেছে নিন, ওষুধ যোগ করুন, নিরাপত্তা যাচাই করে চূড়ান্ত করুন।'
              : 'Choose a patient, add medicines, check safety, then finalize.'
          }
        />

        {/* Medicine recalls and warnings */}
        <SafetyNoticesBanner notices={activeNotices} />

        {/* Patient Selector Card */}
        <Card className="border-border shadow-xs bg-card">
          <CardContent className="p-5 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="w-full sm:w-1/2">
              <label className="block text-sm font-bold text-foreground mb-1">
                {locale === 'bn' ? 'রোগী নির্বাচন করুন *' : 'Select Patient *'}
              </label>
              <select
                aria-label={locale === 'bn' ? 'রোগী নির্বাচন করুন' : 'Select Patient'}
                value={selectedPatientId}
                onChange={(e) => {
                  // A saved draft belongs to one patient; start a new one.
                  setSelectedPatientId(e.target.value);
                  setDraftId(null);
                  invalidateSafety();
                }}
                className="w-full h-11 px-3 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              >
                {patientsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.patient_code}) · {p.age} {locale === 'bn' ? 'বছর' : 'yrs'} · {genderLabel(p.gender, locale)}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full sm:w-1/2">
              <label className="block text-sm font-bold text-foreground mb-1">
                {locale === 'bn' ? 'ক্লিনিকাল রোগ নির্ণয় (Diagnosis)' : 'Clinical Diagnosis'}
              </label>
              <Input
                placeholder={locale === 'bn' ? 'উদা: Acute Bronchial Asthma / Hypertension' : 'Clinical diagnosis...'}
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="h-11 text-sm font-semibold"
              />
            </div>
          </CardContent>
        </Card>

        {/* Medicine Items Editor */}
        <Card className="border-border shadow-xs bg-card">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-foreground">
                <FileText className="w-5 h-5 text-primary" />
                <span>{locale === 'bn' ? 'ঔষধের তালিকা (Rx Medications)' : 'Rx Medications'}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {locale === 'bn'
                  ? 'বাংলাদেশি ফরম্যাট: Brand (Generic) Strength Form — শিডিউল (১+০+১) — খাবারের আগে/পর — মেয়াদ'
                  : 'Standard format: Brand (Generic) Strength Form — Schedule (1+0+1) — Relation to food — Duration'}
              </CardDescription>
            </div>
            <Button onClick={addItem} size="sm" className="min-h-10 text-xs font-bold">
              <PlusCircle className="w-4 h-4 mr-1.5" />
              <span>{locale === 'bn' ? 'ঔষধ যোগ করুন' : 'Add Medicine'}</span>
            </Button>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border/70 bg-muted/20 space-y-3 relative group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {locale === 'bn' ? 'দ্রুত জনপ্রিয় ঔষধ নির্বাচন করুন:' : 'Quick Presets:'}
                    </span>
                    <div className="hidden sm:flex gap-1">
                      {COMMON_DRUG_PRESETS.slice(0, 4).map((preset) => (
                        <button
                          key={preset.brand}
                          type="button"
                          onClick={() => selectPreset(idx, preset)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-background border border-border hover:border-primary text-foreground"
                        >
                          {preset.brand}
                        </button>
                      ))}
                    </div>
                  </div>
                  {items.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(idx)}
                      className="text-destructive hover:bg-destructive/10 h-8 px-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="relative">
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'ব্র্যান্ড নাম (Brand) *' : 'Brand Name *'}
                    </label>
                    <Input
                      placeholder="e.g. Napa Extend"
                      value={item.brandName}
                      onChange={(e) => handleBrandChange(idx, e.target.value)}
                      onFocus={() => {
                        if (item.brandName.trim().length >= 2) {
                          handleBrandChange(idx, item.brandName);
                        }
                      }}
                      className="h-10 text-sm font-bold"
                    />
                    {activeSearchIdx === idx && brandSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl p-1 text-left">
                        <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground border-b border-border/50 flex items-center justify-between">
                          <span>{locale === 'bn' ? 'ডিজিডিএ অনুমোদিত ঔষধসমূহ:' : 'DGDA Approved Medicines:'}</span>
                          <span className="font-mono text-[10px]">{brandSuggestions.length} {locale === 'bn' ? 'টি' : 'found'}</span>
                        </div>
                        {brandSuggestions.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onMouseDown={() => selectBrandSuggestion(idx, b)}
                            className="w-full text-left px-2.5 py-1.5 hover:bg-accent rounded-md transition-colors flex flex-col gap-0.5 border-b border-border/30 last:border-0"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-foreground">{b.brandName}</span>
                              <span className="text-[11px] font-mono font-semibold text-primary">৳ {b.priceBdt}</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                              <span className="text-foreground/90 font-medium">{b.genericName}</span>
                              <span>•</span>
                              <span>{b.strength}</span>
                              <span>•</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">{b.form}</Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground/70 truncate">
                              {b.manufacturer}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'জেনেরিক নাম (Generic) *' : 'Generic Name *'}
                    </label>
                    <Input
                      placeholder="e.g. Paracetamol"
                      value={item.genericName}
                      onChange={(e) => updateItem(idx, 'genericName', e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'শক্তি / ডোজ (Strength)' : 'Strength'}
                    </label>
                    <Input
                      placeholder="e.g. 500 mg / 20 mg"
                      value={item.strength}
                      onChange={(e) => updateItem(idx, 'strength', e.target.value)}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'ফর্ম (Form)' : 'Form'}
                    </label>
                    <select aria-label={locale === 'bn' ? 'ফর্ম (Form)' : 'Form'}
                      value={item.form}
                      onChange={(e) => updateItem(idx, 'form', e.target.value)}
                      className="w-full h-10 px-2 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    >
                      <option value="Tab">Tab (ট্যাবলেট)</option>
                      <option value="Cap">Cap (ক্যাপসুল)</option>
                      <option value="Syr">Syr (সিরাপ)</option>
                      <option value="Inj">Inj (ইনজেকশন)</option>
                      <option value="Drop">Drop (ড্রপ)</option>
                      <option value="Oint">Oint (মলম)</option>
                      <option value="Inhaler">Inhaler (ইনহেলার)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'সময়সূচী (Schedule) *' : 'Dosing Schedule *'}
                    </label>
                    <select aria-label={locale === 'bn' ? 'সময়সূচী (Schedule) *' : 'Dosing Schedule *'}
                      value={item.dosingSchedule}
                      onChange={(e) => updateItem(idx, 'dosingSchedule', e.target.value)}
                      className="w-full h-10 px-2 rounded-md border border-input bg-background text-sm font-bold text-primary focus:outline-hidden focus:ring-2 focus:ring-primary font-mono"
                    >
                      <option value="১+০+১">১+০+১ (সকাল ও রাত)</option>
                      <option value="১+১+১">১+১+১ (সকাল, দুপুর ও রাত)</option>
                      <option value="০+০+১">০+০+১ (শুধুমাত্র রাতে)</option>
                      <option value="১+০+০">১+০+০ (শুধুমাত্র সকালে)</option>
                      <option value="১+১+১+১">১+১+১+১ (৬ ঘণ্টা পর পর)</option>
                      <option value="প্রয়োজনমতো (SOS)">প্রয়োজনমতো (SOS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'খাবার সম্পর্ক (Food Timing)' : 'Relation to Food'}
                    </label>
                    <select aria-label={locale === 'bn' ? 'খাবার সম্পর্ক (Food Timing)' : 'Relation to Food'}
                      value={item.mealTiming}
                      onChange={(e) => updateItem(idx, 'mealTiming', e.target.value)}
                      className="w-full h-10 px-2 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    >
                      <option value="খাবারের পর">খাবারের পর (After meal)</option>
                      <option value="খাবারের আগে">খাবারের আগে (Before meal)</option>
                      <option value="খাবারের সাথে">খাবারের সাথে (With meal)</option>
                      <option value="খালি পেটে">খালি পেটে (Empty stomach)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'সেবনের মেয়াদ (Duration)' : 'Duration'}
                    </label>
                    <select aria-label={locale === 'bn' ? 'সেবনের মেয়াদ (Duration)' : 'Duration'}
                      value={item.durationText}
                      onChange={(e) => updateItem(idx, 'durationText', e.target.value)}
                      className="w-full h-10 px-2 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                    >
                      <option value="৩ দিন">৩ দিন (3 days)</option>
                      <option value="৫ দিন">৫ দিন (5 days)</option>
                      <option value="৭ দিন">৭ দিন (7 days)</option>
                      <option value="১৪ দিন">১৪ দিন (14 days)</option>
                      <option value="১ মাস">১ মাস (1 month)</option>
                      <option value="চলবে">চলবে (Continue)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      {locale === 'bn' ? 'বিশেষ নির্দেশনা (Instructions)' : 'Special Instructions'}
                    </label>
                    <Input
                      placeholder="উদা: নির্দিষ্ট সময়ে খাবেন"
                      value={item.instructions}
                      onChange={(e) => updateItem(idx, 'instructions', e.target.value)}
                      className="h-10 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Safety Engine Bar */}
        <Card className="border-border bg-card shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-lg font-bold text-foreground">
                  {locale === 'bn' ? 'নিরাপত্তা যাচাই' : 'Safety check'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {locale === 'bn'
                    ? 'এলার্জি (Allergy), ওষুধের মিথস্ক্রিয়া (Interaction) ও অন্যান্য ঝুঁকি দেখে।'
                    : 'Checks allergies, drug interactions and other risks for this patient.'}
                </CardDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => runSafetyCheck()}
              disabled={checkingSafety || !selectedPatientId}
              className="min-h-10 text-xs font-bold border-primary text-primary hover:bg-primary/10"
            >
              {checkingSafety
                ? locale === 'bn'
                  ? 'যাচাই হচ্ছে...'
                  : 'Checking...'
                : locale === 'bn'
                  ? 'নিরাপত্তা যাচাই'
                  : 'Check safety'}
            </Button>
          </CardHeader>
          <CardContent className="p-5">
            <SafetyResult
              decision={decision}
              bn={bn}
              overrideReasons={overrideReasons}
              onReason={(id, reason) => setOverrideReasons((prev) => ({ ...prev, [id]: reason }))}
              inputs={inputs}
              onInputs={setInputs}
              onRecordInputs={() => runSafetyCheck(true)}
              busy={checkingSafety}
            />
            {gateNotice && (
              <div role="status" className="mt-3 p-3 rounded-xl border border-primary/40 bg-primary/5 text-sm text-foreground flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                <span>{gateNotice}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Investigations & Clinical Advice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Investigations */}
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-foreground">
                {locale === 'bn' ? 'রোগ নির্ণয় পরীক্ষা (Investigations Advised)' : 'Investigations Advised'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap gap-2">
                {COMMON_INVESTIGATIONS_BN.map((inv) => {
                  const isSelected = selectedInvestigations.includes(inv);
                  return (
                    <button
                      key={inv}
                      type="button"
                      onClick={() => toggleInvestigation(inv)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/30 hover:bg-muted text-foreground border-border'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 inline mr-1" />}
                      {inv}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Advice & Follow Up */}
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-foreground">
                {locale === 'bn' ? 'সাধারণ উপদেশ ও পরামর্শ (Advice & Follow-up)' : 'Clinical Advice & Follow-up'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ADVICE_BN.slice(0, 3).map((adv, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => addAdvice(adv)}
                    className="text-[11px] px-2 py-1 rounded bg-muted/40 hover:bg-muted border border-border text-foreground"
                  >
                    + {adv.slice(0, 25)}...
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                placeholder={locale === 'bn' ? 'রোগীর পালনীয় সাধারণ নিয়মাবলী...' : 'Clinical advice...'}
                value={generalAdvice}
                onChange={(e) => setGeneralAdvice(e.target.value)}
                className="w-full p-2.5 rounded-md border border-input bg-background text-sm text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              />

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  {locale === 'bn' ? 'পরবর্তী সাক্ষাতের সময় (Follow-up)' : 'Follow-up Date'}
                </label>
                <Input
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  className="h-10 text-xs font-semibold"
                  placeholder="উদা: ৭ দিন পর রিপোর্ট সহ আসবেন"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-destructive/15 border border-destructive text-destructive text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
          <Link href="/prescriptions" className={buttonVariants({ variant: 'outline', className: 'min-h-12 px-5' })}>
            <span>{locale === 'bn' ? 'বাতিল' : 'Cancel'}</span>
          </Link>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={saveDraftAndOpen}
              className="min-h-12 px-5 text-sm font-bold flex-1 sm:flex-initial"
            >
              <Save className="w-4 h-4 mr-2" />
              <span>{locale === 'bn' ? 'খসড়া সংরক্ষণ' : 'Save Draft'}</span>
            </Button>

            <Button
              type="button"
              disabled={submitting || !canFinalize}
              onClick={finalizePrescription}
              className="min-h-12 px-8 text-base font-bold bg-primary hover:bg-primary/95 text-primary-foreground shadow-md flex-1 sm:flex-initial"
            >
              <Printer className="w-5 h-5 mr-2" />
              <span>
                {submitting
                  ? locale === 'bn'
                    ? 'সংরক্ষণ হচ্ছে...'
                    : 'Finalizing...'
                  : locale === 'bn'
                    ? 'চূড়ান্ত করুন'
                    : 'Finalize'}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

interface DecisionAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  stop: 'hard' | 'override' | 'none';
  title: string;
  description: string;
  override?: { reason: string };
}

interface SafetyDecisionJson {
  status: 'clear' | 'needs_override' | 'blocked';
  safe_to_finalize: boolean;
  alerts: DecisionAlert[];
  missing_inputs: string[];
  regimen_hash: string;
  context_version: string;
}

type SafetyInputsState = { noKnownAllergies: boolean; isPregnant: '' | 'yes' | 'no'; weightKg: string; egfr: string };

/** Shows the server's safety decision. Nothing here decides safety; it only displays it. */
function SafetyResult(props: {
  decision: SafetyDecisionJson | null;
  bn: boolean;
  overrideReasons: Record<string, string>;
  onReason: (id: string, reason: string) => void;
  inputs: SafetyInputsState;
  onInputs: (inputs: SafetyInputsState) => void;
  onRecordInputs: () => void;
  busy: boolean;
}) {
  const { decision, bn, inputs, onInputs } = props;
  if (!decision) {
    return (
      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
        <Info className="w-4 h-4 text-primary" />
        <span>{bn ? 'চূড়ান্ত করার আগে "নিরাপত্তা যাচাই" চাপুন।' : 'Press "Check safety" before you finalize.'}</span>
      </p>
    );
  }

  const label = { hard: bn ? 'থামুন — বাদ দেওয়া যাবে না' : 'Stop — can’t be overridden', override: bn ? 'কারণ লিখুন' : 'Needs your reason', none: bn ? 'নোট' : 'Note' };
  const missing = new Set(decision.missing_inputs);

  return (
    <div className="space-y-3" data-testid="safety-result" data-status={decision.status}>
      <p
        className={`text-sm font-bold ${
          decision.status === 'blocked' ? 'text-destructive' : decision.status === 'needs_override' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
        }`}
      >
        {decision.status === 'blocked'
          ? bn ? 'নিরাপত্তা বাধা: এই প্রেসক্রিপশন চূড়ান্ত করা যাবে না।' : 'Safety stop: this prescription can’t be finalized.'
          : decision.status === 'needs_override'
            ? bn ? 'প্রতিটি সতর্কতার জন্য কারণ লিখলে চূড়ান্ত করা যাবে।' : 'Give a reason for each alert to continue.'
            : bn ? 'কোনো বাধা নেই।' : 'No safety stops found.'}
      </p>

      {decision.alerts.map((alert) => (
        <div
          key={alert.id}
          className={`p-3 rounded-xl border-2 ${
            alert.stop === 'hard'
              ? 'border-destructive bg-destructive/10'
              : alert.stop === 'override'
                ? 'border-amber-500 bg-amber-500/10'
                : 'border-border bg-muted/30'
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${alert.stop === 'hard' ? 'text-destructive' : 'text-amber-600'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label[alert.stop]}</p>
              <h4 className="font-bold text-sm text-foreground">{alert.title}</h4>
              <p className="text-xs mt-0.5 leading-relaxed text-foreground/80">{alert.description}</p>
              {alert.stop === 'override' && !alert.override && (
                <textarea
                  rows={2}
                  aria-label={bn ? `কারণ: ${alert.title}` : `Reason: ${alert.title}`}
                  placeholder={bn ? 'কেন এটি দেবেন? (কমপক্ষে ১০ অক্ষর)' : 'Why is this right for the patient? (at least 10 characters)'}
                  value={props.overrideReasons[alert.id] ?? ''}
                  onChange={(e) => props.onReason(alert.id, e.target.value)}
                  className="mt-2 w-full p-2 rounded-md border border-input bg-background text-sm"
                />
              )}
              {alert.override && (
                <p className="mt-1 text-xs text-foreground/80">
                  {bn ? 'আপনার কারণ: ' : 'Your reason: '}
                  {alert.override.reason}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {missing.size > 0 && (
        <div className="p-3 rounded-xl border border-border bg-muted/30 space-y-3">
          <p className="text-sm font-bold text-foreground">{bn ? 'রোগীকে জিজ্ঞেস করে লিখুন' : 'Ask the patient and record'}</p>
          {missing.has('allergy_status') && (
            <label className="flex items-center gap-2 text-sm min-h-11">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={inputs.noKnownAllergies}
                onChange={(e) => onInputs({ ...inputs, noKnownAllergies: e.target.checked })}
              />
              {bn ? 'জিজ্ঞেস করেছি — কোনো এলার্জি নেই' : 'I asked — no known allergies'}
            </label>
          )}
          {missing.has('pregnancy_status') && (
            <fieldset className="flex items-center gap-4 text-sm min-h-11">
              <legend className="sr-only">{bn ? 'গর্ভবতী?' : 'Pregnant?'}</legend>
              <span>{bn ? 'গর্ভবতী?' : 'Pregnant?'}</span>
              {(['yes', 'no'] as const).map((value) => (
                <label key={value} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="pregnant"
                    className="h-5 w-5"
                    checked={inputs.isPregnant === value}
                    onChange={() => onInputs({ ...inputs, isPregnant: value })}
                  />
                  {value === 'yes' ? (bn ? 'হ্যাঁ' : 'Yes') : bn ? 'না' : 'No'}
                </label>
              ))}
            </fieldset>
          )}
          {missing.has('weight') && (
            <label className="flex items-center gap-2 text-sm">
              {bn ? 'ওজন (কেজি)' : 'Weight (kg)'}
              <Input type="number" inputMode="decimal" min={1} className="h-11 w-28" value={inputs.weightKg} onChange={(e) => onInputs({ ...inputs, weightKg: e.target.value })} />
            </label>
          )}
          <Button type="button" size="sm" className="min-h-11" disabled={props.busy} onClick={props.onRecordInputs}>
            {bn ? 'সংরক্ষণ করে আবার যাচাই করুন' : 'Save and check again'}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function NewPrescriptionPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground animate-pulse">লোড হচ্ছে...</div>}>
      <NewPrescriptionContent />
    </React.Suspense>
  );
}
