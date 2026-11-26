'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import {
  CheckCircle2,
  AlertTriangle,
  Stethoscope,
} from 'lucide-react';

interface VerificationResult {
  verified: boolean;
  verification_status: string;
  rx_number: string;
  issued_at: string;
  doctor: {
    name: string;
    bmdc_number: string | null;
  } | null;
  patient_summary: {
    patient_code: string;
    age: number;
    gender: string;
  } | null;
  diagnosis: string;
  items: Array<{
    brand_name: string;
    generic_name: string;
    strength: string;
    form: string;
    dosing_schedule: string;
    duration_text: string;
  }>;
}

export default function PrescriptionPublicVerifyPage() {
  const { hash } = useParams() as { hash: string };
  const locale = useLocale();

  const [data, setData] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/verify/rx/${hash}`)
      .then((res) => {
        if (!res.ok) throw new Error('Invalid verification hash or prescription record not found');
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [hash]);

  return (
    <div className="min-h-screen bg-muted/20 py-12 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
              <Stethoscope className="w-6 h-6" />
            </div>
            <span className="text-2xl font-black text-foreground">DocMate AI</span>
          </Link>
          <p className="text-xs text-muted-foreground font-medium">
            {locale === 'bn' ? 'ডিজিটাল প্রেসক্রিপশন যাচাইকরণ' : 'Digital Prescription Verification'}
          </p>
        </div>

        {loading ? (
          <Card className="p-12 text-center border-dashed">
            <CardContent className="p-0 text-sm text-muted-foreground animate-pulse">
              {locale === 'bn' ? 'প্রেসক্রিপশন যাচাই করা হচ্ছে...' : 'Verifying digital signature...'}
            </CardContent>
          </Card>
        ) : error || !data?.verified ? (
          <Card className="border-destructive/40 bg-destructive/5 text-center p-8">
            <CardContent className="p-0 space-y-3">
              <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold text-destructive">
                {locale === 'bn' ? 'প্রেসক্রিপশনটি পাওয়া যায়নি' : 'Prescription Not Found'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {locale === 'bn'
                  ? 'এই কিউআর কোডের কোনো রেকর্ড ডাটাবেজে পাওয়া যায়নি।'
                  : 'No valid prescription record matches this digital signature.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border shadow-sm bg-card overflow-hidden">
            {/* Green Authenticity Banner */}
            <div className="p-4 bg-emerald-500/10 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-400 flex items-center gap-3">
              <CheckCircle2 className="w-7 h-7 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h3 className="font-bold text-sm">
                  {locale === 'bn'
                    ? '✓ আসল ডিজিটাল প্রেসক্রিপশন যাচাইকৃত'
                    : '✓ Verified Authentic BMDC Prescription'}
                </h3>
                <p className="text-xs opacity-90">
                  {locale === 'bn'
                    ? 'ডিজিটাল সিগনেচার ডাটাবেজের মূল রেকর্ডের সাথে মিলেছে।'
                    : 'Cryptographic signature verified against immutable records.'}
                </p>
              </div>
            </div>

            <CardContent className="p-6 space-y-6">
              {/* Doctor Details */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/60 flex items-start justify-between">
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block">
                    {locale === 'bn' ? 'চিকিৎসকের বিবরণ:' : 'Prescribing Physician:'}
                  </span>
                  <h4 className="text-lg font-bold text-foreground mt-0.5">{data.doctor?.name}</h4>
                  <p className="text-xs font-mono font-bold text-primary mt-1">
                    BMDC Reg: {data.doctor?.bmdc_number}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground font-semibold block">
                    {locale === 'bn' ? 'প্রেসক্রিপশন নং:' : 'Rx Number:'}
                  </span>
                  <span className="font-mono font-bold text-sm text-foreground">{data.rx_number}</span>
                  <span className="text-xs text-muted-foreground block mt-1">
                    {new Date(data.issued_at).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US')}
                  </span>
                </div>
              </div>

              {/* Patient Summary */}
              {data.patient_summary && (
                <div className="flex items-center gap-4 text-xs font-medium text-foreground bg-muted/20 p-3 rounded-lg border border-border/40">
                  <div>
                    <span className="text-muted-foreground">Patient ID: </span>
                    <span className="font-mono font-bold">{data.patient_summary.patient_code}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Age / Gender: </span>
                    <span className="font-bold">
                      {data.patient_summary.age} Yrs / {data.patient_summary.gender.toUpperCase()}
                    </span>
                  </div>
                </div>
              )}

              {/* Diagnosis */}
              {data.diagnosis && (
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    {locale === 'bn' ? 'রোগ নির্ণয় (Clinical Diagnosis):' : 'Clinical Diagnosis:'}
                  </span>
                  <p className="text-sm font-semibold text-foreground p-2.5 rounded bg-muted/30 border border-border/50">
                    {data.diagnosis}
                  </p>
                </div>
              )}

              {/* Prescribed Medications */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  {locale === 'bn' ? 'ঔষধের তালিকা (Verified Medications):' : 'Verified Medications:'}
                </span>
                <div className="space-y-1.5">
                  {data.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-border/60 bg-muted/10 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-bold text-sm text-foreground">
                          {idx + 1}. {it.form} {it.brand_name} {it.strength}
                        </span>
                        <span className="text-muted-foreground block text-[11px] italic">
                          Generic: {it.generic_name}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-primary block">{it.dosing_schedule}</span>
                        <span className="text-muted-foreground text-[11px]">{it.duration_text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>

            {/* Persistent Disclaimer */}
            <div className="p-3 bg-muted/40 border-t border-border text-center text-[10px] text-muted-foreground">
              {locale === 'bn'
                ? 'শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়। চিকিৎসকই চূড়ান্ত সিদ্ধান্ত নেন।'
                : 'Clinical decision support only. Not a substitute for professional judgement. Doctor decides.'}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
