'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useRouter } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import {
  Stethoscope,
  HeartPulse,
  Activity,
  Pill,
  TestTube2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Save,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Search,
  Users,
  Zap,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LabValue, StructuredPatientInput } from '@/types';
import { extractClinicalFacts } from '@/lib/clinical-extractor';

const SPECIALTY_PRESETS = [
  {
    id: 'cardio',
    nameEn: 'Cardiovascular / Chest Pain',
    nameBn: 'কার্ডিওভাসকুলার / বুকে ব্যথা',
    subtitleEn: 'ACS / Myocardial Infarction',
    subtitleBn: 'অ্যাকিউট করোনারি সিন্ড্রোম / হার্ট অ্যাটাক',
    badge: '🫀 Cardio',
    patientCode: 'P-201',
    age: 52,
    gender: 'male' as const,
    weightKg: '72',
    chiefComplaint: 'Severe retrosternal squeezing chest pain radiating to left arm and jaw for 2 hours',
    symptomsInput: 'Chest pain, diaphoresis (profuse sweating), shortness of breath, palpitations, nausea',
    hpi: '52-year-old male with acute onset substernal crushing chest pain that started at rest 2 hours ago. Pain radiates to left shoulder and jaw, accompanied by diaphoresis and nausea. Not relieved by rest.',
    pastHistoryInput: 'Hypertension (10 years), Dyslipidemia, Smoker (20 pack-years)',
    currentMedsInput: 'Amlodipine 5mg OD, Atorvastatin 20mg at night',
    allergiesInput: '',
    vitals: {
      bpSystolic: '155',
      bpDiastolic: '95',
      heartRate: '98',
      respiratoryRate: '22',
      temperatureCelsius: '36.8',
      spo2Percent: '95',
    },
    labs: [
      { name: 'Troponin I', value: '1.8', unit: 'ng/mL', reference_range: '<0.04' },
      { name: 'WBC', value: '9200', unit: '/μL', reference_range: '4000-11000' },
      { name: 'ECG', value: 'ST elevation in V1-V4', unit: 'lead', reference_range: 'Normal' },
    ],
    clinicalNotes: 'ECG shows acute anterior ST-segment elevation. Urgent cardiology consultation and primary PCI / thrombolytic pathway indicated.',
  },
  {
    id: 'respiratory',
    nameEn: 'Respiratory / Pneumonia & Dyspnea',
    nameBn: 'শ্বাসযন্ত্র / নিউমোনিয়া ও শ্বাসকষ্ট',
    subtitleEn: 'Community-Acquired Pneumonia / Severe ARI',
    subtitleBn: 'কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া',
    badge: '🫁 Respiratory',
    patientCode: 'P-202',
    age: 45,
    gender: 'female' as const,
    weightKg: '58',
    chiefComplaint: 'High continuous fever with chills and productive cough with rusty sputum for 4 days',
    symptomsInput: 'High fever, productive cough, rusty sputum, shortness of breath, right pleuritic chest pain',
    hpi: '45-year-old female with 4 days of worsening fever, productive cough with rust-colored sputum, and shortness of breath. Localized right-sided chest pain on inspiration. Auscultation reveals localized right base inspiratory crackles (crepitations).',
    pastHistoryInput: 'None known',
    currentMedsInput: 'Paracetamol 500mg occasionally',
    allergiesInput: 'Penicillin',
    vitals: {
      bpSystolic: '110',
      bpDiastolic: '70',
      heartRate: '104',
      respiratoryRate: '28',
      temperatureCelsius: '38.9',
      spo2Percent: '92',
    },
    labs: [
      { name: 'WBC', value: '15400', unit: '/μL', reference_range: '4000-11000' },
      { name: 'Neutrophils', value: '86', unit: '%', reference_range: '40-75' },
      { name: 'Chest X-Ray', value: 'Right lower lobe consolidation', unit: 'PA', reference_range: 'Clear' },
    ],
    clinicalNotes: 'Inspiratory crackles in right lower lung field. SpO2 92% on room air - supplemental oxygen indicated. Allergy to penicillin noted.',
  },
  {
    id: 'dengue',
    nameEn: 'Infectious / Dengue Fever',
    nameBn: 'সংক্রামক / ডেঙ্গু জ্বর',
    subtitleEn: 'Dengue with Warning Signs',
    subtitleBn: 'ডেঙ্গু জ্বর (সতর্কতা সংকেতসহ)',
    badge: '🌡️ Dengue',
    patientCode: 'P-203',
    age: 28,
    gender: 'male' as const,
    weightKg: '65',
    chiefComplaint: 'Sudden onset high fever for 3 days with severe retro-orbital headache and persistent abdominal pain',
    symptomsInput: 'High fever, retro-orbital pain, severe arthralgia, persistent abdominal pain, vomiting, extreme fatigue',
    hpi: '28-year-old male with acute onset continuous fever (up to 39.4°C) for 3 days with intense headache and body pain. Over past 12 hours developed persistent upper abdominal pain and 3 episodes of vomiting. No spontaneous bleeding.',
    pastHistoryInput: 'None',
    currentMedsInput: 'Paracetamol 500mg TDS',
    allergiesInput: '',
    vitals: {
      bpSystolic: '100',
      bpDiastolic: '70',
      heartRate: '96',
      respiratoryRate: '20',
      temperatureCelsius: '39.2',
      spo2Percent: '98',
    },
    labs: [
      { name: 'Platelet count', value: '82000', unit: '/μL', reference_range: '150000-450000' },
      { name: 'Hematocrit (Hct)', value: '47', unit: '%', reference_range: '38-50' },
      { name: 'Dengue NS1 Ag', value: 'Positive', unit: 'Serology', reference_range: 'Negative' },
      { name: 'WBC', value: '3100', unit: '/μL', reference_range: '4000-11000' },
    ],
    clinicalNotes: 'Dengue with warning signs: persistent abdominal pain, vomiting, thrombocytopenia < 100k, rising hematocrit. Needs fluid management and close monitoring.',
  },
  {
    id: 'gastro',
    nameEn: 'Gastrointestinal / Acute Abdomen',
    nameBn: 'গ্যাস্ট্রো / তীব্র পেটে ব্যথা',
    subtitleEn: 'Acute Appendicitis / Peptic Ulcer',
    subtitleBn: 'অ্যাকিউট অ্যাপেন্ডিসাইটিস / পেপটিক আলসার',
    badge: '🤢 GI / Abdomen',
    patientCode: 'P-204',
    age: 24,
    gender: 'male' as const,
    weightKg: '60',
    chiefComplaint: 'Periumbilical pain shifting to right lower quadrant for 18 hours with nausea and vomiting',
    symptomsInput: 'Right lower quadrant abdominal pain, anorexia, nausea, low-grade fever, localized tenderness',
    hpi: '24-year-old male with sudden onset periumbilical pain that shifted to right lower abdomen over 18 hours. Patient has anorexia, 2 episodes of vomiting, and McBurney point tenderness with rebound tenderness.',
    pastHistoryInput: 'None',
    currentMedsInput: 'None',
    allergiesInput: '',
    vitals: {
      bpSystolic: '120',
      bpDiastolic: '80',
      heartRate: '92',
      respiratoryRate: '18',
      temperatureCelsius: '38.1',
      spo2Percent: '99',
    },
    labs: [
      { name: 'WBC', value: '14200', unit: '/μL', reference_range: '4000-11000' },
      { name: 'Ultrasound Abdomen', value: 'Non-compressible appendix > 6mm', unit: 'USG', reference_range: 'Normal' },
    ],
    clinicalNotes: 'McBurney point tenderness and localized guarding present. Alvarado score suggests high probability of acute appendicitis. Urgent surgical evaluation indicated.',
  },
  {
    id: 'pediatric',
    nameEn: 'Pediatrics / Acute Diarrhea & Dehydration',
    nameBn: 'শিশু বিভাগ / ডায়রিয়া ও ডিহাইড্রেশন',
    subtitleEn: 'Acute Watery Diarrhea with Some Dehydration',
    subtitleBn: 'তীব্র পাতলা পায়খানা ও পানিশূন্যতা',
    badge: '👶 Pediatric',
    patientCode: 'P-205',
    age: 3,
    gender: 'female' as const,
    weightKg: '14',
    chiefComplaint: 'Frequent watery stools 8-10 times daily for 2 days with sunken eyes and irritability',
    symptomsInput: 'Watery diarrhea, vomiting, sunken eyes, thirst, reduced urine output, irritability',
    hpi: '3-year-old child weighing 14kg brought with 2 days of profuse watery diarrhea without blood. Child is irritable, drinks eagerly when offered fluids. Skin pinch goes back slowly (1-2 seconds). Oral mucosa dry.',
    pastHistoryInput: 'Fully immunized under EPI',
    currentMedsInput: 'Oral Zinc syrup',
    allergiesInput: '',
    vitals: {
      bpSystolic: '90',
      bpDiastolic: '60',
      heartRate: '124',
      respiratoryRate: '32',
      temperatureCelsius: '37.6',
      spo2Percent: '98',
    },
    labs: [
      { name: 'Serum Sodium (Na+)', value: '136', unit: 'mmol/L', reference_range: '135-145' },
      { name: 'Serum Potassium (K+)', value: '3.6', unit: 'mmol/L', reference_range: '3.5-5.0' },
      { name: 'Stool R/M/E', value: 'No RBC, Pus cells 1-2/HPF', unit: 'microscopy', reference_range: 'Normal' },
    ],
    clinicalNotes: 'Features of acute watery diarrhea with some dehydration (WHO Plan B). Initiate oral rehydration salts (ORS) 75 ml/kg over 4 hours plus Zinc supplementation.',
  },
  {
    id: 'hypertension',
    nameEn: 'Cardiometabolic / Severe Hypertension',
    nameBn: 'কার্ডিওমেটাবলিক / তীব্র উচ্চ রক্তচাপ',
    subtitleEn: 'Hypertensive Urgency / Metabolic Syndrome',
    subtitleBn: 'উচ্চ রক্তচাপ ও মাথাব্যথা',
    badge: '🩸 Hypertension',
    patientCode: 'P-206',
    age: 58,
    gender: 'female' as const,
    weightKg: '68',
    chiefComplaint: 'Severe throbbing occipital headache, dizziness and blurred vision with elevated blood pressure',
    symptomsInput: 'Occipital headache, lightheadedness, blurred vision, neck stiffness, fatigue',
    hpi: '58-year-old female with known hypertension and diabetes presenting with 2 days of severe throbbing headache. Discontinued anti-hypertensive medication 2 weeks ago. No chest pain, no focal neurological deficit.',
    pastHistoryInput: 'Hypertension (8 years), Type 2 Diabetes Mellitus (6 years)',
    currentMedsInput: 'Metformin 500mg BD (Amlodipine 5mg was discontinued by patient)',
    allergiesInput: '',
    vitals: {
      bpSystolic: '190',
      bpDiastolic: '110',
      heartRate: '84',
      respiratoryRate: '18',
      temperatureCelsius: '36.7',
      spo2Percent: '97',
    },
    labs: [
      { name: 'Random Blood Sugar (RBS)', value: '11.4', unit: 'mmol/L', reference_range: '4.0-7.8' },
      { name: 'Serum Creatinine', value: '1.1', unit: 'mg/dL', reference_range: '0.6-1.2' },
      { name: 'Urine Albumin', value: 'Trace', unit: 'dipstick', reference_range: 'Negative' },
    ],
    clinicalNotes: 'Blood pressure 190/110 mmHg. Hypertensive urgency without acute target organ damage. Restart antihypertensive therapy gradually and evaluate cardiovascular risk.',
  },
];

function NewCaseContent() {
  const t = useTranslations('intake');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const profileIdParam = searchParams.get('profileId');
  const nameParam = searchParams.get('name');
  const ageParam = searchParams.get('age');
  const genderParam = searchParams.get('gender');
  const codeParam = searchParams.get('patientCode');

  const [linkedProfileId, setLinkedProfileId] = useState<string | null>(profileIdParam || null);
  const [linkedPatientName, setLinkedPatientName] = useState<string>(nameParam ? decodeURIComponent(nameParam) : '');
  const [profileLoading, setProfileLoading] = useState(Boolean(profileIdParam));

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [noteExtractorOpen, setNoteExtractorOpen] = useState(false);
  const [dictationText, setDictationText] = useState('');

  // Form State
  // Values from the linked profile link win over a saved draft; set once at first render.
  const [patientCode, setPatientCode] = useState(() => {
    const valid = (code: unknown): code is string => typeof code === 'string' && /^P-(?:[0-9]+-)*[0-9]+$/.test(code);
    if (valid(codeParam)) return codeParam;
    // The saved draft (restored below) and a random code are applied after mount;
    // reading them here would differ between the server render and the browser.
    return '';
  });
  const [age, setAge] = useState<number | ''>(() => {
    if (ageParam && !isNaN(Number(ageParam))) return Number(ageParam);
    return '';
  });
  const [gender, setGender] = useState<StructuredPatientInput['gender'] | ''>(() => {
    if (genderParam && ['male', 'female', 'other'].includes(genderParam)) return genderParam as StructuredPatientInput['gender'];
    return '';
  });
  const [weightKg, setWeightKg] = useState('');

  const [bpSystolic, setBpSystolic] = useState('');
  const [bpDiastolic, setBpDiastolic] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [temperatureCelsius, setTemperatureCelsius] = useState('');
  const [spo2Percent, setSpo2Percent] = useState('');

  // Symptoms
  const [chiefComplaint, setChiefComplaint] = useState('');
  // Where the patient is treated today; guideline advice can differ by setting.
  const [careSetting, setCareSetting] = useState<'' | 'outpatient' | 'inpatient' | 'intensive_care'>('');
  const [symptomsInput, setSymptomsInput] = useState('');

  // After mount (and after any saved draft is restored below), give the patient a
  // code if it still has none. Random values are never made during render.
  useEffect(() => {
    const timer = window.setTimeout(() => setPatientCode((prev) => prev || `P-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const [hpi, setHpi] = useState('');

  // History & Meds
  const [pastHistoryInput, setPastHistoryInput] = useState('');
  const [currentMedsInput, setCurrentMedsInput] = useState('');
  const [allergiesInput, setAllergiesInput] = useState('');
  const [isPregnant, setIsPregnant] = useState(false);
  const [pregnancyTrimester, setPregnancyTrimester] = useState<'1' | '2' | '3'>('1');

  // Labs & Notes
  const [egfr, setEgfr] = useState('');
  const [labValues, setLabValues] = useState<LabValue[]>([
    { name: 'WBC', value: '', unit: '/μL', reference_range: '4000-11000' },
  ]);
  const [clinicalNotes, setClinicalNotes] = useState('');

  // Fetch the linked profile's name and health summary (identity fields were set from the link).
  useEffect(() => {
    if (profileIdParam) {
      fetch(`/api/patients/${profileIdParam}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.patient) {
            if (data.patient.name) setLinkedPatientName(data.patient.name);
            if (data.patient.age && !ageParam) setAge(data.patient.age);
            if (data.patient.gender && !genderParam) setGender(data.patient.gender);
          }
          if (data?.healthSummary) {
            const hs = data.healthSummary;
            if (hs.allergies && Array.isArray(hs.allergies) && hs.allergies.length > 0) {
              setAllergiesInput(hs.allergies.join(', '));
            }
            if (hs.chronicConditions && Array.isArray(hs.chronicConditions) && hs.chronicConditions.length > 0) {
              setPastHistoryInput(hs.chronicConditions.join(', '));
            }
            if (hs.currentMedicines && Array.isArray(hs.currentMedicines) && hs.currentMedicines.length > 0) {
              const meds = hs.currentMedicines.map((m: { brand?: string; generic?: string; dose?: string } | string) => {
                if (typeof m === 'string') return m;
                return [m.brand, m.generic ? `(${m.generic})` : '', m.dose].filter(Boolean).join(' ');
              });
              setCurrentMedsInput(meds.join(', '));
            }
          }
        })
        .catch((err) => console.warn('Failed to load patient health summary:', err))
        .finally(() => setProfileLoading(false));
    }
  }, [profileIdParam, ageParam, genderParam]);

  // Autosave Draft in localStorage
  useEffect(() => {
    try {
      const draft = localStorage.getItem('docmate_intake_draft');
      if (draft && !profileIdParam) {
        const parsed = JSON.parse(draft);
        queueMicrotask(() => {
          if (parsed.patientCode) setPatientCode(parsed.patientCode);
          if (typeof parsed.age === 'number') setAge(parsed.age);
          if (parsed.gender) setGender(parsed.gender);
          if (parsed.chiefComplaint) setChiefComplaint(parsed.chiefComplaint);
          if (parsed.symptomsInput) setSymptomsInput(parsed.symptomsInput);
        });
      }
    } catch {}
  }, [profileIdParam]);
  const saveToLocalStorage = () => {
    const data = {
      patientCode,
      age,
      gender,
      chiefComplaint,
      symptomsInput,
      hpi,
      pastHistoryInput,
      currentMedsInput,
      allergiesInput,
      isPregnant,
      egfr,
    };
    localStorage.setItem('docmate_intake_draft', JSON.stringify(data));
    toast.success(t('draftSaved'));
  };

  const handleAddLab = () => {
    setLabValues([...labValues, { name: '', value: '', unit: '', reference_range: '' }]);
  };

  const handleRemoveLab = (index: number) => {
    setLabValues(labValues.filter((_, idx) => idx !== index));
  };

  const handleLabChange = (index: number, field: keyof LabValue, val: string) => {
    const updated = [...labValues];
    updated[index] = { ...updated[index], [field]: val };
    setLabValues(updated);
  };

  const applyPreset = (preset: (typeof SPECIALTY_PRESETS)[0]) => {
    setActivePreset(preset.id);
    setPatientCode(preset.patientCode);
    setAge(preset.age);
    setGender(preset.gender);
    setWeightKg(preset.weightKg);
    setChiefComplaint(preset.chiefComplaint);
    setSymptomsInput(preset.symptomsInput);
    setHpi(preset.hpi);
    setPastHistoryInput(preset.pastHistoryInput);
    setCurrentMedsInput(preset.currentMedsInput);
    setAllergiesInput(preset.allergiesInput);
    setBpSystolic(preset.vitals.bpSystolic);
    setBpDiastolic(preset.vitals.bpDiastolic);
    setHeartRate(preset.vitals.heartRate);
    setRespiratoryRate(preset.vitals.respiratoryRate);
    setTemperatureCelsius(preset.vitals.temperatureCelsius);
    setSpo2Percent(preset.vitals.spo2Percent);
    setLabValues(preset.labs);
    setClinicalNotes(preset.clinicalNotes);
    toast.success(
      locale === 'bn'
        ? `${preset.nameBn} টেমপ্লেট সফলভাবে লোড হয়েছে`
        : `${preset.nameEn} preset loaded successfully`
    );
  };

  const handleExtractFromNote = () => {
    if (!dictationText.trim()) {
      toast.error(
        locale === 'bn'
          ? 'অনুগ্রহ করে নোট বা ডিক্টেশন টেক্সট লিখুন'
          : 'Please enter a clinical note or dictation text'
      );
      return;
    }

    const dummyPatient: StructuredPatientInput = {
      age: typeof age === 'number' ? age : 40,
      gender: gender || 'male',
      chief_complaint: chiefComplaint,
      symptoms: [],
      past_medical_history: [],
      current_medicines: [],
      allergies: [],
      vitals: {},
      lab_values: [],
    };

    const extracted = extractClinicalFacts(dictationText, dummyPatient);
    let updatedCount = 0;

    for (const item of extracted) {
      if (item.field_path === 'vitals.temperature_celsius') {
        setTemperatureCelsius(String(item.value));
        updatedCount++;
      } else if (item.field_path === 'vitals.blood_pressure_systolic') {
        setBpSystolic(String(item.value));
        updatedCount++;
      } else if (item.field_path === 'vitals.blood_pressure_diastolic') {
        setBpDiastolic(String(item.value));
        updatedCount++;
      } else if (item.field_path === 'vitals.heart_rate') {
        setHeartRate(String(item.value));
        updatedCount++;
      } else if (item.field_path === 'vitals.respiratory_rate') {
        setRespiratoryRate(String(item.value));
        updatedCount++;
      } else if (item.field_path === 'vitals.spo2_percent') {
        setSpo2Percent(String(item.value));
        updatedCount++;
      } else if (item.field_path === 'symptoms') {
        const valStr = Array.isArray(item.value) ? item.value.join(', ') : String(item.value);
        setSymptomsInput((prev) => (prev ? `${prev}, ${valStr}` : valStr));
        updatedCount++;
      } else if (item.field_path === 'examination_findings') {
        setClinicalNotes((prev) => (prev ? `${prev}\n${item.value}` : String(item.value)));
        updatedCount++;
      }
    }

    const ageMatch = dictationText.match(/\b(\d{1,3})\s*(?:years?(?:\s*old)?|yo|yr|বছর)\b/i);
    if (ageMatch) {
      setAge(parseInt(ageMatch[1], 10));
      updatedCount++;
    }
    const genderMatch = dictationText.match(/\b(male|female|পুরুষ|নারী|মহিলা)\b/i);
    if (genderMatch) {
      const g = genderMatch[1].toLowerCase();
      setGender(g.includes('fe') || g.includes('নারী') || g.includes('মহিলা') ? 'female' : 'male');
      updatedCount++;
    }

    if (!chiefComplaint.trim()) {
      const firstLine = dictationText.split(/[.\n]/)[0].trim();
      if (firstLine.length > 5) {
        setChiefComplaint(firstLine.slice(0, 150));
        updatedCount++;
      }
    }

    toast.success(
      locale === 'bn'
        ? `${updatedCount} টি ক্লিনিকাল তথ্য এক্সট্র্যাক্ট করা হয়েছে!`
        : `Extracted ${updatedCount} clinical findings into form!`
    );
    setNoteExtractorOpen(false);
  };

  const sys = Number(bpSystolic);
  const dia = Number(bpDiastolic);
  const hr = Number(heartRate);
  const rr = Number(respiratoryRate);
  const temp = Number(temperatureCelsius);
  const spo2 = Number(spo2Percent);

  const vitalsAlerts: Array<{ severity: 'critical' | 'warning'; text: string }> = [];

  if (sys >= 180 || dia >= 120) {
    vitalsAlerts.push({
      severity: 'critical',
      text:
        locale === 'bn'
          ? '🚨 Hypertensive Crisis (জরুরি উচ্চ রক্তচাপ: ≥ 180/120 mmHg)'
          : '🚨 Hypertensive Crisis / Urgency (BP ≥ 180/120 mmHg)',
    });
  } else if (sys > 0 && sys < 90) {
    vitalsAlerts.push({
      severity: 'critical',
      text:
        locale === 'bn'
          ? '🚨 Hypotension / Shock Risk (রক্তচাপ বিপজ্জনকভাবে কম < 90 mmHg)'
          : '🚨 Hypotension / Shock Risk (Systolic BP < 90 mmHg)',
    });
  } else if (sys >= 140 || dia >= 90) {
    vitalsAlerts.push({
      severity: 'warning',
      text:
        locale === 'bn'
          ? '⚠️ Stage 2 Hypertension (উচ্চ রক্তচাপ ≥ 140/90 mmHg)'
          : '⚠️ Stage 2 Hypertension (BP ≥ 140/90 mmHg)',
    });
  }

  if (spo2 > 0 && spo2 < 94) {
    vitalsAlerts.push({
      severity: 'critical',
      text:
        locale === 'bn'
          ? '🚨 Hypoxemia (অক্সিজেন স্বল্পতা SpO2 < 94%) - অবিলম্বে অক্সিজেন প্রদেয়'
          : '🚨 Hypoxemia (SpO2 < 94%) - Supplemental O2 indicated',
    });
  }

  if (hr > 100) {
    vitalsAlerts.push({
      severity: 'warning',
      text:
        locale === 'bn'
          ? '⚠️ Tachycardia (দ্রুত হৃদস্পন্দন > 100 bpm)'
          : '⚠️ Tachycardia (Heart Rate > 100 bpm)',
    });
  } else if (hr > 0 && hr < 50) {
    vitalsAlerts.push({
      severity: 'warning',
      text:
        locale === 'bn'
          ? '⚠️ Bradycardia (ধীর হৃদস্পন্দন < 50 bpm)'
          : '⚠️ Bradycardia (Heart Rate < 50 bpm)',
    });
  }

  if (temp >= 38.5) {
    vitalsAlerts.push({
      severity: 'warning',
      text:
        locale === 'bn'
          ? '⚠️ High-Grade Fever (তীব্র জ্বর ≥ 38.5°C / 101.3°F)'
          : '⚠️ High-Grade Fever (Temp ≥ 38.5°C / 101.3°F)',
    });
  }

  if (rr >= 24) {
    vitalsAlerts.push({
      severity: 'warning',
      text:
        locale === 'bn'
          ? '⚠️ Tachypnea (দ্রুত শ্বাসপ্রশ্বাস ≥ 24/min)'
          : '⚠️ Tachypnea (Respiratory Rate ≥ 24/min)',
    });
  }

  // Same rule as the server (P-101, P-2026-123).
  const hasDemographics = /^P-(?:[0-9]+-)*[0-9]+$/.test(patientCode.trim()) &&
    age !== '' && Number.isInteger(age) && age >= 0 && age <= 130 && gender !== '';

  const handleSubmit = async () => {
    if (!hasDemographics) {
      toast.error(t('invalidDemographics'));
      setCurrentStep(1);
      return;
    }

    if (!chiefComplaint.trim()) {
      toast.error('Chief complaint is required');
      setCurrentStep(2);
      return;
    }

    setLoading(true);

    const structuredPayload: StructuredPatientInput = {
      age,
      gender,
      weight_kg: weightKg && !isNaN(Number(weightKg)) && Number(weightKg) > 0 ? Number(weightKg) : undefined,
      chief_complaint: chiefComplaint.trim(),
      symptoms: symptomsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      history_of_present_illness: hpi.trim() || undefined,
      past_medical_history: pastHistoryInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      current_medicines: currentMedsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      allergies: allergiesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      vitals: {
        blood_pressure_systolic:
          bpSystolic && !isNaN(Number(bpSystolic)) && Number(bpSystolic) >= 0 ? Number(bpSystolic) : undefined,
        blood_pressure_diastolic:
          bpDiastolic && !isNaN(Number(bpDiastolic)) && Number(bpDiastolic) >= 0 ? Number(bpDiastolic) : undefined,
        heart_rate:
          heartRate && !isNaN(Number(heartRate)) && Number(heartRate) >= 0 ? Number(heartRate) : undefined,
        respiratory_rate:
          respiratoryRate && !isNaN(Number(respiratoryRate)) && Number(respiratoryRate) >= 0 ? Number(respiratoryRate) : undefined,
        temperature_celsius:
          temperatureCelsius && !isNaN(Number(temperatureCelsius)) && Number(temperatureCelsius) >= 0 ? Number(temperatureCelsius) : undefined,
        spo2_percent:
          spo2Percent && !isNaN(Number(spo2Percent)) && Number(spo2Percent) >= 0 && Number(spo2Percent) <= 100 ? Number(spo2Percent) : undefined,
      },
      lab_values: labValues
        .filter((l) => l.name && l.name.trim() !== '' && l.value !== '' && l.value !== undefined)
        .map((l) => ({
          name: l.name.trim(),
          value: typeof l.value === 'number' ? l.value : String(l.value).trim(),
          unit: (l.unit || '').trim(),
          reference_range: (l.reference_range || '').trim() || undefined,
        })),
      is_pregnant: isPregnant,
      pregnancy_trimester: isPregnant ? (Number(pregnancyTrimester) as 1 | 2 | 3) : undefined,
      egfr: egfr && !isNaN(Number(egfr)) && Number(egfr) >= 0 ? Number(egfr) : undefined,
      clinical_notes: clinicalNotes.trim() || undefined,
      ...(careSetting ? { care_setting: careSetting } : {}),
    };

    try {
      // 1. Create Case
      const createRes = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_code: patientCode,
          profile_id: linkedProfileId || undefined,
          structured_input: structuredPayload,
        }),
      });

      if (!createRes.ok) {
        let errorMsg = 'Failed to create case';
        try {
          const errorData = await createRes.json();
          errorMsg = errorData.details || errorData.error || errorMsg;
        } catch {
          const text = await createRes.text().catch(() => '');
          if (text) errorMsg = text.slice(0, 200);
        }
        throw new Error(errorMsg);
      }

      const caseData = await createRes.json();
      const caseId = caseData.case.id;

      // 2. Trigger Diagnostic Analysis Immediately
      await fetch(`/api/cases/${caseId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      }).catch((err) => console.warn('Diagnostic evaluation trigger warning:', err));

      // Clear draft
      localStorage.removeItem('docmate_intake_draft');
      toast.success(locale === 'bn' ? 'কেস সফলভাবে তৈরি হয়েছে এবং এআই বিশ্লেষণ সম্পন্ন' : 'Patient case created & diagnostic evaluation started');
      router.push(`/cases/${caseId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error starting analysis');
      setLoading(false);
    }
  };

  const steps = [
    { num: 1, label: t('stepVitals'), icon: HeartPulse },
    { num: 2, label: t('stepSymptoms'), icon: Stethoscope },
    { num: 3, label: t('stepHistory'), icon: Pill },
    { num: 4, label: t('stepLabs'), icon: TestTube2 },
  ];

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-12">
        <PageHeader
          title={t('title')}
          subtitle={locale === 'bn' ? 'রোগীর তথ্য ধাপে ধাপে লিখুন। যা মাপা হয়নি তা ফাঁকা রাখুন।' : 'Enter the patient step by step. Leave anything not measured blank.'}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/patients/new')}
                className="gap-1.5 text-xs font-medium border-border hover:bg-muted"
              >
                <Search className="w-3.5 h-3.5" />
                <span>{locale === 'bn' ? 'রোগী খুঁজুন (ফোন)' : 'Find Patient by Phone'}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNoteExtractorOpen(!noteExtractorOpen)}
                className="gap-1.5 text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{locale === 'bn' ? 'নোট / অডিও এক্সট্র্যাক্ট' : 'AI Note Extractor'}</span>
                {noteExtractorOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={saveToLocalStorage}
                className="gap-1.5 text-xs font-medium"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{t('saveDraft')}</span>
              </Button>
            </div>
          }
        />

        {/* Linked Patient Profile Banner */}
        {linkedProfileId && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-primary/10 text-foreground shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">
                    {linkedPatientName || (locale === 'bn' ? 'রোগী প্রোফাইল' : 'Patient Profile')}
                  </span>
                  <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-primary/20">
                    {locale === 'bn' ? 'সংযুক্ত প্রোফাইল' : 'Linked Profile'}
                  </Badge>
                  {profileLoading && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {locale === 'bn'
                    ? `বয়স: ${age || 'N/A'}, লিঙ্গ: ${gender || 'N/A'} • পূর্বের স্বাস্থ্য রেকর্ড ও অ্যালার্জি হিস্ট্রি স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে`
                    : `Age: ${age || 'N/A'}, Gender: ${gender || 'N/A'} • Past clinical history & allergies automatically linked`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push(`/patients/${linkedProfileId}`)}
                className="text-xs h-8 gap-1.5 bg-background"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{locale === 'bn' ? 'প্রোফাইল দেখুন' : 'View Profile'}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLinkedProfileId(null);
                  setLinkedPatientName('');
                  toast.info(locale === 'bn' ? 'প্রোফাইল সংযোগ বাতিল করা হয়েছে' : 'Profile unlinked');
                }}
                className="text-xs h-8 text-muted-foreground hover:text-destructive"
              >
                {locale === 'bn' ? 'আলাদা কেস করুন' : 'Unlink'}
              </Button>
            </div>
          </div>
        )}

        {/* AI Note / Voice Dictation Extractor Collapsible */}
        {noteExtractorOpen && (
          <Card className="border border-primary/30 bg-primary/5 shadow-xs transition-all">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-primary flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  {locale === 'bn' ? 'ক্লিনিকাল নোট বা অডিও ট্রান্সক্রিপ্ট থেকে অটো-ফিল' : 'Auto-fill from Clinical Note or Dictation'}
                </span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  বাংলা / Banglish / English
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={3}
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                placeholder={
                  locale === 'bn'
                    ? 'উদাহরণ: 45 yo male with high fever 39 C and productive cough for 4 days, BP 110/70, SpO2 92%, crackles present in right lung base...'
                    : 'Paste doctor note or voice dictation here (e.g. 52 yo male with acute retrosternal chest pain, BP 155/95, HR 98, diaphoresis...)'
                }
                className="text-xs resize-none bg-background"
              />
              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setNoteExtractorOpen(false)}
                  className="h-8 text-xs"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  size="sm"
                  onClick={handleExtractFromNote}
                  className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{locale === 'bn' ? 'তথ্য ফর্মে বসান' : 'Extract into Form'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Specialty Case Templates Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>{locale === 'bn' ? 'ক্লিনিকাল স্পেশালিটি টেমপ্লেট' : 'Clinical Specialty Presets'}</span>
            </span>
            <span className="text-[11px] text-muted-foreground">
              {locale === 'bn' ? '১-ক্লিকে কেস ডেটা লোড করুন' : 'Load realistic case scenario in 1 click'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {SPECIALTY_PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-2.5 rounded-lg border text-left transition-all hover:scale-[1.02] cursor-pointer flex flex-col justify-between ${
                    isActive
                      ? 'border-primary bg-primary/10 shadow-xs'
                      : 'border-border/80 bg-card hover:bg-muted/40'
                  }`}
                >
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-foreground block truncate">
                      {preset.badge}
                    </span>
                    <span className="text-[10px] text-muted-foreground block line-clamp-1 leading-tight">
                      {locale === 'bn' ? preset.subtitleBn : preset.subtitleEn}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`mt-2 text-[9px] w-fit font-mono px-1 py-0 ${
                      isActive ? 'border-primary/50 text-primary font-bold' : 'text-muted-foreground'
                    }`}
                  >
                    {preset.patientCode}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Multi-Step Stepper Header */}
        <div className="grid grid-cols-4 gap-2 border-b border-border pb-4">
          {steps.map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setCurrentStep(s.num)}
                className={`min-w-0 flex flex-col sm:flex-row items-center gap-2 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-primary/10 text-primary font-semibold border border-primary/30'
                    : isCompleted
                    ? 'text-foreground font-medium hover:bg-muted/50'
                    : 'text-muted-foreground hover:bg-muted/30'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className="text-xs leading-snug text-center sm:text-left break-words">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step 1: Demographics & Vitals */}
        {currentStep === 1 && (
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-primary" />
                <span>{t('stepVitals')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="patient-code" className="text-xs font-semibold">
                    {t('patientCode')}
                  </Label>
                  <Input
                    id="patient-code"
                    value={patientCode}
                    onChange={(e) => setPatientCode(e.target.value.toUpperCase())}
                    placeholder="P-104"
                    required
                    className="font-mono text-xs uppercase"
                  />
                  <p className="text-[11px] text-muted-foreground">{t('patientCodeHint')}</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="age" className="text-xs font-semibold">
                    {t('age')} *
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : e.target.valueAsNumber)}
                    min="0"
                    max="130"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-semibold">
                    {t('gender')}
                  </Label>
                  <Select value={gender} items={{ "male": t('genderMale'), "female": t('genderFemale'), "other": t('genderOther') }} onValueChange={(val) => val && setGender(val as 'male' | 'female' | 'other')}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder={t('gender')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('genderMale')}</SelectItem>
                      <SelectItem value="female">{t('genderFemale')}</SelectItem>
                      <SelectItem value="other">{t('genderOther')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="case-weight" className="text-xs font-semibold">{t('weight')}</Label>
                  <Input id="case-weight" type="number" min="0.01" max="1000" step="any"
                    value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <span>Objective Vital Signs</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="bp-sys" className="text-xs font-medium">
                      {t('bpSystolic')}
                    </Label>
                    <Input
                      id="bp-sys"
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      placeholder={locale === 'bn' ? 'মাপা হয়নি' : 'Not measured'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="bp-dia" className="text-xs font-medium">
                      {t('bpDiastolic')}
                    </Label>
                    <Input
                      id="bp-dia"
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      placeholder={locale === 'bn' ? 'মাপা হয়নি' : 'Not measured'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hr" className="text-xs font-medium">
                      {t('heartRate')}
                    </Label>
                    <Input
                      id="hr"
                      type="number"
                      value={heartRate}
                      onChange={(e) => setHeartRate(e.target.value)}
                      placeholder={locale === 'bn' ? 'মাপা হয়নি' : 'Not measured'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="rr" className="text-xs font-medium">
                      {t('respiratoryRate')}
                    </Label>
                    <Input
                      id="rr"
                      type="number"
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                      placeholder={locale === 'bn' ? 'মাপা হয়নি' : 'Not measured'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="temp" className="text-xs font-medium">
                      {t('temperature')}
                    </Label>
                    <Input
                      id="temp"
                      type="number"
                      step="0.1"
                      value={temperatureCelsius}
                      onChange={(e) => setTemperatureCelsius(e.target.value)}
                      placeholder={locale === 'bn' ? 'মাপা হয়নি' : 'Not measured'}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="spo2" className="text-xs font-medium">
                      {t('spo2')}
                    </Label>
                    <Input
                      id="spo2"
                      type="number"
                      value={spo2Percent}
                      onChange={(e) => setSpo2Percent(e.target.value)}
                      placeholder={locale === 'bn' ? 'মাপা হয়নি' : 'Not measured'}
                    />
                  </div>
                </div>

                {/* Real-time Vitals Clinical Triage Warnings */}
                {vitalsAlerts.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{locale === 'bn' ? 'ক্লিনিকাল ভাইটাল সাইন সতর্কতা' : 'Clinical Vital Signs Warning'}</span>
                    </div>
                    <div className="space-y-1">
                      {vitalsAlerts.map((alert, idx) => (
                        <p key={idx} className="text-xs font-semibold text-destructive/90 flex items-center gap-1.5">
                          <span>{alert.text}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <span className="text-xs text-muted-foreground">Step 1 of 4</span>
              <Button onClick={() => {
                if (hasDemographics) setCurrentStep(2);
                else toast.error(t('invalidDemographics'));
              }} className="gap-2 bg-primary text-primary-foreground font-semibold">
                <span>{tCommon('next')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 2: Symptoms & Complaint */}
        {currentStep === 2 && (
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-primary" />
                <span>{t('stepSymptoms')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="chief-complaint" className="text-xs font-semibold">
                  {t('chiefComplaint')} *
                </Label>
                <Input
                  id="chief-complaint"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. High fever, chills, and productive cough with rust-colored sputum for 4 days"
                  required
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t('careSettingOptional')}</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" role="group" aria-label={t('careSetting')}>
                  {(
                    [
                      { value: '', label: t('careSettingUnset') },
                      { value: 'outpatient', label: t('careSettingOutpatient') },
                      { value: 'inpatient', label: t('careSettingInpatient') },
                      { value: 'intensive_care', label: t('careSettingIntensiveCare') },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value || 'unset'}
                      type="button"
                      aria-pressed={careSetting === option.value}
                      data-testid={`intake-care-setting-${option.value || 'unset'}`}
                      onClick={() => setCareSetting(option.value)}
                      className={`min-h-11 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        careSetting === option.value
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="symptoms" className="text-xs font-semibold">
                  {t('symptoms')}
                </Label>
                <Input
                  id="symptoms"
                  value={symptomsInput}
                  onChange={(e) => setSymptomsInput(e.target.value)}
                  placeholder="Fever, Productive cough, Right pleuritic chest pain, Dyspnea"
                  className="text-sm"
                />
                {/* Quick-Add Common Symptoms Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { en: 'Fever', bn: 'জ্বর' },
                    { en: 'Cough', bn: 'কাশি' },
                    { en: 'Chest pain', bn: 'বুকে ব্যথা' },
                    { en: 'Shortness of breath', bn: 'শ্বাসকষ্ট' },
                    { en: 'Headache', bn: 'মাথাব্যথা' },
                    { en: 'Vomiting', bn: 'বমি' },
                    { en: 'Abdominal pain', bn: 'পেটে ব্যথা' },
                    { en: 'Diaphoresis', bn: 'ঘাম' },
                    { en: 'Fatigue', bn: 'ক্লান্তি' },
                  ].map((sym) => {
                    const label = locale === 'bn' ? `${sym.bn} (${sym.en})` : sym.en;
                    return (
                      <button
                        key={sym.en}
                        type="button"
                        onClick={() => {
                          setSymptomsInput((prev) => (prev ? `${prev}, ${sym.en}` : sym.en));
                        }}
                        className="text-[11px] px-2 py-0.5 rounded-full border border-border/80 bg-muted/40 hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                      >
                        + {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hpi" className="text-xs font-semibold">
                  {t('hpi')}
                </Label>
                <Textarea
                  id="hpi"
                  rows={4}
                  value={hpi}
                  onChange={(e) => setHpi(e.target.value)}
                  placeholder="Detail the timeline, onset, character, radiation, severity, aggravating and relieving factors..."
                  className="text-sm resize-none"
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>{tCommon('back')}</span>
              </Button>
              <Button onClick={() => setCurrentStep(3)} className="gap-2 bg-primary text-primary-foreground font-semibold">
                <span>{tCommon('next')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 3: Past History, Medications & Allergies */}
        {currentStep === 3 && (
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Pill className="w-5 h-5 text-primary" />
                <span>{t('stepHistory')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="allergies" className="text-xs font-bold text-destructive flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t('allergies')}</span>
                </Label>
                <Input
                  id="allergies"
                  value={allergiesInput}
                  onChange={(e) => setAllergiesInput(e.target.value)}
                  placeholder="e.g. Penicillin, Aspirin, Sulfa drugs (leave blank if none)"
                  className="text-sm border-destructive/40 focus-visible:ring-destructive"
                />
                <p className="text-[11px] text-muted-foreground">
                  Every suggested medication is strictly checked against this field by the deterministic safety engine.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="current-meds" className="text-xs font-semibold">
                  {t('currentMeds')}
                </Label>
                <Input
                  id="current-meds"
                  value={currentMedsInput}
                  onChange={(e) => setCurrentMedsInput(e.target.value)}
                  placeholder="e.g. Amlodipine 5mg OD, Warfarin, Metformin"
                  className="text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used for automated pairwise drug-drug interaction screening.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="past-history" className="text-xs font-semibold">
                  {t('pastHistory')}
                </Label>
                <Input
                  id="past-history"
                  value={pastHistoryInput}
                  onChange={(e) => setPastHistoryInput(e.target.value)}
                  placeholder="e.g. Hypertension, Asthma, Diabetes Mellitus Type 2, Peptic Ulcer"
                  className="text-sm"
                />
              </div>

              <div className="p-3.5 rounded-lg border border-border/80 bg-muted/20 flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="is-pregnant" className="text-xs font-semibold">
                    {t('isPregnant')}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Activates FDA pregnancy category X and D teratogenicity blockers.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isPregnant && (
                    <Select value={pregnancyTrimester} items={{ "1": "1st Trimester", "2": "2nd Trimester", "3": "3rd Trimester" }} onValueChange={(val) => val && setPregnancyTrimester(val as '1' | '2' | '3')}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue placeholder="Trimester" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1st Trimester</SelectItem>
                        <SelectItem value="2">2nd Trimester</SelectItem>
                        <SelectItem value="3">3rd Trimester</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Switch
                    id="is-pregnant"
                    checked={isPregnant}
                    onCheckedChange={setIsPregnant}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>{tCommon('back')}</span>
              </Button>
              <Button onClick={() => setCurrentStep(4)} className="gap-2 bg-primary text-primary-foreground font-semibold">
                <span>{tCommon('next')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* Step 4: Labs, Renal & Analysis Submission */}
        {currentStep === 4 && (
          <Card className="border-border shadow-xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TestTube2 className="w-5 h-5 text-primary" />
                <span>{t('stepLabs')}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="egfr" className="text-xs font-semibold">
                    {t('egfr')}
                  </Label>
                  <Input
                    id="egfr"
                    type="number"
                    value={egfr}
                    onChange={(e) => setEgfr(e.target.value)}
                    placeholder="90"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required for renal dosage adjustments and clearance alerts.
                  </p>
                </div>
              </div>

              {/* Dynamic Lab Values */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {t('labs')} (Objective Evidence)
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAddLab}
                    className="h-7 text-xs gap-1 border-dashed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('addLab')}</span>
                  </Button>
                </div>

                {labValues.map((lab, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      placeholder={t('labName')}
                      value={lab.name}
                      onChange={(e) => handleLabChange(idx, 'name', e.target.value)}
                      className="col-span-4 text-xs h-8"
                    />
                    <Input
                      placeholder={t('labValue')}
                      value={String(lab.value)}
                      onChange={(e) => handleLabChange(idx, 'value', e.target.value)}
                      className="col-span-3 text-xs h-8"
                    />
                    <Input
                      placeholder={t('labUnit')}
                      value={lab.unit}
                      onChange={(e) => handleLabChange(idx, 'unit', e.target.value)}
                      className="col-span-3 text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveLab(idx)}
                      className="col-span-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Physician Clinical Notes */}
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label htmlFor="clinical-notes" className="text-xs font-semibold">
                  {t('clinicalNotes')}
                </Label>
                <Textarea
                  id="clinical-notes"
                  rows={3}
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Physical exam observations, auscultation findings, tentative working thoughts..."
                  className="text-sm resize-none"
                />
              </div>

              {/* Review Summary Pill Box */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-primary">
                  <span>Intake Profile Summary: {patientCode}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {age}yo {gender}
                  </Badge>
                </div>
                <p className="text-xs text-foreground font-medium truncate">
                  Chief Complaint: {chiefComplaint || 'None provided'}
                </p>
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground pt-1">
                  <span>Allergies: {allergiesInput || 'None'}</span>
                  <span>•</span>
                  <span>Meds: {currentMedsInput || 'None'}</span>
                  <span>•</span>
                  <span>eGFR: {egfr || 'Normal'}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/60 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(3)} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                <span>{tCommon('back')}</span>
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || !chiefComplaint.trim()}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm h-10 px-6"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Clinical Evidence...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{t('submitAndAnalyze')}</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

export default function NewCasePage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading Clinical Intake...</p>
          </div>
        </AppShell>
      }
    >
      <NewCaseContent />
    </Suspense>
  );
}
