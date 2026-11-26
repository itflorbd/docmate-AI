'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import {
  Printer,
  Share2,
  AlertTriangle,
  ArrowLeft,
  QrCode,
} from 'lucide-react';

interface PrescriptionDetails {
  id: string;
  rx_number: string;
  status: string;
  diagnosis: string;
  investigations: string[];
  general_advice: string;
  follow_up_text: string;
  qr_hash: string;
  finalized_at?: string;
  created_at: string;
  patient: {
    id: string;
    patient_code: string;
    name: string;
    phone: string;
    age: number;
    gender: string;
    blood_group?: string;
  };
  doctor: {
    id: string;
    name: string;
    bmdc_number: string | null;
    phone: string | null;
  };
  encounter?: {
    chief_complaint?: string;
    symptoms?: string[];
    vitals?: {
      bpSystolic?: number;
      bpDiastolic?: number;
      pulse?: number;
      tempF?: number;
      spo2?: number;
      weightKg?: number;
    };
    allergies?: string[];
  };
  items: Array<{
    id: string;
    brand_name: string;
    generic_name: string;
    strength: string;
    form: string;
    dosing_schedule: string;
    meal_timing: string;
    duration_days: number;
    duration_text: string;
    instructions: string;
  }>;
}

export default function PrescriptionViewAndPrintPage() {
  const { id } = useParams() as { id: string };
  const locale = useLocale();

  const [prescription, setPrescription] = useState<PrescriptionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/prescriptions/${id}`, { credentials: 'same-origin', signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load prescription');
        return res.json();
      })
      .then((data) => {
        setPrescription(data.prescription);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyVerificationLink = () => {
    if (!prescription) return;
    const verifyUrl = `${window.location.origin}/${locale}/verify/rx/${prescription.qr_hash}`;
    navigator.clipboard.writeText(verifyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-12 text-center text-muted-foreground animate-pulse text-base">
          {locale === 'bn' ? 'প্রেসক্রিপশন লোড হচ্ছে...' : 'Loading prescription...'}
        </div>
      </AppShell>
    );
  }

  if (error || !prescription) {
    return (
      <AppShell>
        <div className="p-8 text-center max-w-md mx-auto space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">{locale === 'bn' ? 'প্রেসক্রিপশন পাওয়া যায়নি' : 'Prescription Not Found'}</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Link href="/prescriptions" className={buttonVariants({ className: 'min-h-11' })}>
            {locale === 'bn' ? 'তালিকায় ফিরুন' : 'Back to Prescriptions'}
          </Link>
        </div>
      </AppShell>
    );
  }

  const { patient, doctor, encounter, items } = prescription;
  // Only a finalized prescription (issued under an approved clinical release) can be printed or shared.
  const official = prescription.status === 'finalized';

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-16">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="print:hidden flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/40 p-4 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <Link href="/prescriptions" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              <span>{locale === 'bn' ? 'তালিকায় ফিরুন' : 'Back to Prescriptions'}</span>
            </Link>
            <Badge
              variant={prescription.status === 'finalized' ? 'outline' : 'secondary'}
              className={
                prescription.status === 'finalized'
                  ? 'border-emerald-500/50 text-emerald-800 dark:text-emerald-300 bg-emerald-500/10'
                  : ''
              }
            >
              {prescription.status === 'finalized'
                ? locale === 'bn'
                  ? 'চূড়ান্ত (Finalized)'
                  : 'Finalized'
                : locale === 'bn'
                  ? 'খসড়া (Draft)'
                  : 'Draft'}
            </Badge>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleCopyVerificationLink}
              disabled={!official}
              className="text-xs min-h-10 flex-1 sm:flex-initial"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              <span>
                {copiedLink
                  ? locale === 'bn'
                    ? 'লিংক কপি হয়েছে!'
                    : 'Link Copied!'
                  : locale === 'bn'
                    ? 'ভেরিফিকেশন লিংক'
                    : 'Share Link'}
              </span>
            </Button>

            <Button
              onClick={handlePrint}
              disabled={!official}
              title={official ? undefined : locale === 'bn' ? 'খসড়া প্রিন্ট করা যায় না' : 'Drafts can’t be printed'}
              className="min-h-10 px-5 text-sm font-bold bg-primary text-primary-foreground shadow-sm flex-1 sm:flex-initial"
            >
              <Printer className="w-4 h-4 mr-2" />
              <span>{locale === 'bn' ? 'প্রিন্ট করুন (Print)' : 'Print Prescription'}</span>
            </Button>
          </div>
        </div>

        {/* 
          OFFICIAL BMDC PRESCRIPTION PAD
          Styled for screen and optimized for standard A4 / Letter paper with print media queries.
        */}
        <div
          id="printablePrescription"
          className="bg-white text-black p-8 sm:p-10 rounded-2xl shadow-md border border-neutral-300 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:rounded-none min-h-[1000px] flex flex-col justify-between"
        >
          {/* 1. DOCTOR & CLINIC HEADER */}
          <div>
            {!official && (
              <p className="mb-4 rounded-md border-2 border-dashed border-neutral-500 py-2 text-center text-sm font-bold uppercase tracking-wide text-neutral-700">
                {locale === 'bn' ? 'খসড়া — রোগীকে দেওয়ার জন্য নয়' : 'Draft — not valid for dispensing'}
              </p>
            )}
            <div className="border-b-2 border-primary pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-neutral-900">{doctor.name}</h2>
                <div className="mt-1 flex items-center gap-3 text-xs font-bold text-teal-800">
                  {doctor.bmdc_number && <span>BMDC Reg. No: {doctor.bmdc_number}</span>}
                  {doctor.bmdc_number && doctor.phone && <span>•</span>}
                  {doctor.phone && <span>{doctor.phone}</span>}
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-neutral-600">
                <p className="font-mono text-neutral-600 mt-1">Rx: {prescription.rx_number}</p>
              </div>
            </div>

            {/* 2. PATIENT DETAILS BAR */}
            <div className="bg-neutral-100 border border-neutral-300 rounded-lg p-3 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium text-neutral-800">
              <div>
                <span className="text-neutral-600 text-[11px] block">Patient Name:</span>
                <span className="font-bold text-sm text-neutral-900">{patient.name}</span>
              </div>
              <div>
                <span className="text-neutral-600 text-[11px] block">Age / Gender:</span>
                <span className="font-semibold">
                  {patient.age} Yrs / {patient.gender.toUpperCase()}
                  {patient.blood_group ? ` (${patient.blood_group})` : ''}
                </span>
              </div>
              <div>
                <span className="text-neutral-600 text-[11px] block">Patient ID:</span>
                <span className="font-mono font-bold">{patient.patient_code}</span>
              </div>
              <div>
                <span className="text-neutral-600 text-[11px] block">Date:</span>
                <span className="font-semibold">
                  {new Date(prescription.finalized_at || prescription.created_at).toLocaleDateString(
                    'en-US',
                    { day: 'numeric', month: 'short', year: 'numeric' }
                  )}
                </span>
              </div>
            </div>

            {/* 3. CLINICAL BODY: TWO COLUMN LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[600px]">
              {/* Left Column: Complaints, Vitals, Investigations (~35%) */}
              <div className="md:col-span-4 border-r-0 md:border-r border-neutral-200 pr-0 md:pr-4 space-y-5 text-xs text-neutral-800">
                {/* Chief Complaints */}
                {encounter?.chief_complaint && (
                  <div>
                    <h4 className="font-bold text-neutral-900 border-b border-neutral-300 pb-1 mb-1.5 uppercase text-[11px] tracking-wider">
                      Chief Complaints (C/C)
                    </h4>
                    <p className="leading-relaxed font-medium">{encounter.chief_complaint}</p>
                  </div>
                )}

                {/* Vitals */}
                {encounter?.vitals && Object.keys(encounter.vitals).length > 0 && (
                  <div>
                    <h4 className="font-bold text-neutral-900 border-b border-neutral-300 pb-1 mb-1.5 uppercase text-[11px] tracking-wider">
                      On Examination (O/E)
                    </h4>
                    <ul className="space-y-1 font-medium">
                      {encounter.vitals.bpSystolic && (
                        <li>• BP: {encounter.vitals.bpSystolic}/{encounter.vitals.bpDiastolic} mmHg</li>
                      )}
                      {encounter.vitals.pulse && <li>• Pulse: {encounter.vitals.pulse} bpm</li>}
                      {encounter.vitals.tempF && <li>• Temp: {encounter.vitals.tempF}°F</li>}
                      {encounter.vitals.spo2 && <li>• SpO2: {encounter.vitals.spo2}%</li>}
                      {encounter.vitals.weightKg && <li>• Weight: {encounter.vitals.weightKg} kg</li>}
                    </ul>
                  </div>
                )}

                {/* Investigations */}
                {prescription.investigations && prescription.investigations.length > 0 && (
                  <div>
                    <h4 className="font-bold text-neutral-900 border-b border-neutral-300 pb-1 mb-1.5 uppercase text-[11px] tracking-wider">
                      Investigations Advised
                    </h4>
                    <ul className="space-y-1 font-medium">
                      {prescription.investigations.map((inv, idx) => (
                        <li key={idx}>• {inv}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Known Allergies Warning */}
                {encounter?.allergies && encounter.allergies.length > 0 && (
                  <div className="p-2 rounded bg-red-50 border border-red-200 text-red-800 text-[11px]">
                    <span className="font-bold block">Allergies:</span>
                    <span>{encounter.allergies.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Right Column: Rx Symbol, Medicines & Advice (~65%) */}
              <div className="md:col-span-8 pl-0 md:pl-2 space-y-6">
                {/* Rx Symbol */}
                <div className="flex items-center gap-2">
                  <span className="font-serif italic text-3xl font-black text-teal-800">℞</span>
                  {prescription.diagnosis && (
                    <span className="text-xs font-bold text-neutral-600 bg-neutral-100 px-2.5 py-0.5 rounded">
                      Dx: {prescription.diagnosis}
                    </span>
                  )}
                </div>

                {/* Prescribed Medicines List */}
                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div key={item.id || idx} className="pl-3 border-l-2 border-neutral-300 space-y-0.5 text-xs">
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm font-bold text-neutral-900">
                          {idx + 1}. {item.form} {item.brand_name} {item.strength}
                        </span>
                        <span className="font-mono font-bold text-teal-800 text-sm tracking-wide">
                          {item.dosing_schedule}
                        </span>
                      </div>

                      <div className="text-neutral-600 text-[11px] italic">
                        Generic: {item.generic_name}
                      </div>

                      <div className="flex items-center gap-3 text-neutral-700 font-medium pt-0.5">
                        <span className="bg-neutral-100 px-2 py-0.5 rounded font-semibold">
                          {item.meal_timing}
                        </span>
                        <span>—</span>
                        <span className="font-semibold text-neutral-800">{item.duration_text}</span>
                        {item.instructions && (
                          <>
                            <span>•</span>
                            <span className="text-neutral-600">{item.instructions}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* General Advice */}
                {prescription.general_advice && (
                  <div className="pt-4 border-t border-neutral-200">
                    <h4 className="font-bold text-xs text-neutral-900 mb-1">উপদেশ / Advice:</h4>
                    <p className="text-xs text-neutral-700 whitespace-pre-line leading-relaxed">
                      {prescription.general_advice}
                    </p>
                  </div>
                )}

                {/* Follow-up Note */}
                {prescription.follow_up_text && (
                  <div className="text-xs font-bold text-neutral-800 bg-neutral-100 p-2 rounded">
                    <span>পরবর্তী সাক্ষাৎ / Follow-up: </span>
                    <span className="text-teal-800">{prescription.follow_up_text}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 4. FOOTER: SIGNATURE, QR AUTH CODE & DISCLAIMER */}
          <div className="border-t-2 border-neutral-200 pt-4 mt-8">
            <div className="flex flex-col sm:flex-row items-end justify-between gap-4">
              {/* QR Verification Badge */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 bg-neutral-100 border border-neutral-300 rounded flex items-center justify-center p-1">
                  <QrCode className="w-10 h-10 text-neutral-800" />
                </div>
                <div className="text-[10px] text-neutral-600 leading-tight">
                  <span className="font-bold text-neutral-700 block">DocMate Verified Rx</span>
                  <span className="font-mono break-all">{prescription.qr_hash.slice(0, 16)}...</span>
                  <span className="block mt-0.5">Scan to verify BMDC digital authenticity</span>
                </div>
              </div>

              {/* Signature Line */}
              <div className="text-center sm:text-right min-w-[160px]">
                <div className="border-b border-neutral-400 w-36 mb-1 ml-auto"></div>
                <span className="text-xs font-bold text-neutral-900 block">{doctor.name}</span>
                <span className="text-[10px] text-neutral-600">Registered Physician Signature</span>
              </div>
            </div>

            {/* Persistent Disclaimer */}
            <div className="text-[9px] text-center text-neutral-600 border-t border-neutral-200 mt-3 pt-2 font-medium">
              ক্লিনিকাল সিদ্ধান্ত সহায়তা ও প্রেসক্রিপশন সিস্টেম · চিকিৎসকই চূড়ান্ত সিদ্ধান্ত গ্রহণ করেন · Generated via DocMate AI
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
