'use client';

import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  PatientCase,
  CaseTurn,
  StructuredPatientInput,
  PatientVitals,
} from '@/types';
import {
  User,
  Heart,
  Activity,
  Thermometer,
  Wind,
  AlertTriangle,
  Pill,
  FileText,
  TestTube2,
  CheckCircle2,
  Baby,
  ShieldAlert,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useIsMobile } from '@/hooks/use-mobile';

interface PatientDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: PatientCase;
  turns: CaseTurn[];
}

export function PatientDetailSheet({
  open,
  onOpenChange,
  caseData,
  turns,
}: PatientDetailSheetProps) {
  const locale = useLocale();
  const t = useTranslations('workspace');
  const tIntake = useTranslations('intake');

  const input = ((caseData.structured_input ||
    (caseData as unknown as Record<string, unknown>).structuredInput) ||
    {}) as unknown as StructuredPatientInput;
  const patientCode =
    caseData.patient_code ||
    ((caseData as unknown as Record<string, unknown>).patientCode as string);
  const vitals = input.vitals || {};

  const getVitalStatus = (vital: keyof PatientVitals, val?: number) => {
    if (val === undefined || val === null) return null;
    switch (vital) {
      case 'spo2_percent':
        if (val < 92) return { text: locale === 'bn' ? 'সংকটজনক' : 'Critical', variant: 'destructive' as const };
        if (val < 95) return { text: locale === 'bn' ? 'সতর্কতা' : 'Borderline', variant: 'secondary' as const };
        return { text: locale === 'bn' ? 'স্বাভাবিক' : 'Normal', variant: 'outline' as const };
      case 'blood_pressure_systolic':
        if (val >= 180 || val < 90) return { text: locale === 'bn' ? 'সংকটজনক' : 'Critical', variant: 'destructive' as const };
        if (val >= 140) return { text: locale === 'bn' ? 'উচ্চ' : 'Elevated', variant: 'secondary' as const };
        return { text: locale === 'bn' ? 'স্বাভাবিক' : 'Normal', variant: 'outline' as const };
      case 'temperature_celsius':
        if (val >= 38.5) return { text: locale === 'bn' ? 'উচ্চ জ্বর' : 'High Fever', variant: 'destructive' as const };
        if (val >= 37.5) return { text: locale === 'bn' ? 'হালকা জ্বর' : 'Low-Grade', variant: 'secondary' as const };
        return { text: locale === 'bn' ? 'স্বাভাবিক' : 'Normal', variant: 'outline' as const };
      case 'heart_rate':
        if (val > 110 || val < 50) return { text: locale === 'bn' ? 'অস্বাভাবিক' : 'Abnormal', variant: 'destructive' as const };
        if (val > 90) return { text: locale === 'bn' ? 'উচ্চ' : 'High', variant: 'secondary' as const };
        return { text: locale === 'bn' ? 'স্বাভাবিক' : 'Normal', variant: 'outline' as const };
      case 'respiratory_rate':
        if (val > 24 || val < 10) return { text: locale === 'bn' ? 'অস্বাভাবিক' : 'Abnormal', variant: 'destructive' as const };
        return { text: locale === 'bn' ? 'স্বাভাবিক' : 'Normal', variant: 'outline' as const };
      default:
        return null;
    }
  };

  const content = (
    <div className="space-y-4 p-4 text-xs">
      {/* Demographics & Status Banner */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/70">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
            <User className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground">{patientCode}</div>
            <div className="text-[11px] text-muted-foreground capitalize">
              {input.age ? `${input.age} yrs, ` : ''}
              {input.gender}
              {input.weight_kg ? ` • ${input.weight_kg} kg` : ` • ${locale === 'bn' ? 'ওজন: রেকর্ড করা হয়নি' : 'Weight: Not recorded'}`}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5" data-testid="patient-detail-care-setting">
              <span className="font-medium text-foreground">{tIntake('careSetting')}:</span>{' '}
              {input.care_setting === 'outpatient'
                ? tIntake('careSettingOutpatient')
                : input.care_setting === 'inpatient'
                  ? tIntake('careSettingInpatient')
                  : input.care_setting === 'intensive_care'
                    ? tIntake('careSettingIntensiveCare')
                    : tIntake('notRecorded')}
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
          {caseData.status.replace('_', ' ')}
        </Badge>
      </div>

      {/* Chief Complaint */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          <span>{tIntake('chiefComplaint')}</span>
        </div>
        <p className="p-2.5 rounded-lg bg-card border border-border/80 font-medium text-foreground leading-relaxed">
          {input.chief_complaint || '—'}
        </p>
        {input.symptoms && input.symptoms.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {input.symptoms.map((s, idx) => (
              <Badge key={idx} variant="secondary" className="text-[11px] font-normal">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Vitals Grid */}
      <div className="space-y-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-primary" />
          <span>{tIntake('vitals')}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* BP */}
          <div className="p-2.5 rounded-lg border border-border/70 bg-card flex flex-col justify-between">
            <span className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium">
              <Heart className="w-3 h-3 text-rose-500" />
              {tIntake('bp')}
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-bold text-foreground text-sm">
                {vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic
                  ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`
                  : (locale === 'bn' ? 'রেকর্ড করা হয়নি' : 'Not recorded')}
                {vitals.blood_pressure_systolic && vitals.blood_pressure_diastolic && (
                  <span className="text-[9px] text-muted-foreground font-normal ml-0.5">mmHg</span>
                )}
              </span>
              {getVitalStatus('blood_pressure_systolic', vitals.blood_pressure_systolic) && (
                <Badge
                  variant={getVitalStatus('blood_pressure_systolic', vitals.blood_pressure_systolic)?.variant}
                  className="text-[9px] px-1 py-0"
                >
                  {getVitalStatus('blood_pressure_systolic', vitals.blood_pressure_systolic)?.text}
                </Badge>
              )}
            </div>
          </div>

          {/* HR */}
          <div className="p-2.5 rounded-lg border border-border/70 bg-card flex flex-col justify-between">
            <span className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium">
              <Activity className="w-3 h-3 text-primary" />
              {tIntake('hr')}
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-bold text-foreground text-sm">
                {vitals.heart_rate !== undefined
                  ? `${vitals.heart_rate}`
                  : (locale === 'bn' ? 'রেকর্ড করা হয়নি' : 'Not recorded')}
                {vitals.heart_rate !== undefined && (
                  <span className="text-[9px] text-muted-foreground font-normal ml-0.5">bpm</span>
                )}
              </span>
              {getVitalStatus('heart_rate', vitals.heart_rate) && (
                <Badge
                  variant={getVitalStatus('heart_rate', vitals.heart_rate)?.variant}
                  className="text-[9px] px-1 py-0"
                >
                  {getVitalStatus('heart_rate', vitals.heart_rate)?.text}
                </Badge>
              )}
            </div>
          </div>

          {/* Temp */}
          <div className="p-2.5 rounded-lg border border-border/70 bg-card flex flex-col justify-between">
            <span className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium">
              <Thermometer className="w-3 h-3 text-amber-500" />
              {tIntake('temp')}
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-bold text-foreground text-sm">
                {vitals.temperature_celsius !== undefined
                  ? `${vitals.temperature_celsius}`
                  : (locale === 'bn' ? 'রেকর্ড করা হয়নি' : 'Not recorded')}
                {vitals.temperature_celsius !== undefined && (
                  <span className="text-[9px] text-muted-foreground font-normal ml-0.5">°C</span>
                )}
              </span>
              {getVitalStatus('temperature_celsius', vitals.temperature_celsius) && (
                <Badge
                  variant={getVitalStatus('temperature_celsius', vitals.temperature_celsius)?.variant}
                  className="text-[9px] px-1 py-0"
                >
                  {getVitalStatus('temperature_celsius', vitals.temperature_celsius)?.text}
                </Badge>
              )}
            </div>
          </div>

          {/* SpO2 */}
          <div className="p-2.5 rounded-lg border border-border/70 bg-card flex flex-col justify-between">
            <span className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium">
              <Wind className="w-3 h-3 text-teal-600" />
              {tIntake('spo2')}
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-bold text-foreground text-sm">
                {vitals.spo2_percent !== undefined ? `${vitals.spo2_percent}%` : (locale === 'bn' ? 'রেকর্ড করা হয়নি' : 'Not recorded')}
              </span>
              {getVitalStatus('spo2_percent', vitals.spo2_percent) && (
                <Badge
                  variant={getVitalStatus('spo2_percent', vitals.spo2_percent)?.variant}
                  className="text-[9px] px-1 py-0"
                >
                  {getVitalStatus('spo2_percent', vitals.spo2_percent)?.text}
                </Badge>
              )}
            </div>
          </div>

          {/* RR */}
          <div className="p-2.5 rounded-lg border border-border/70 bg-card flex flex-col justify-between">
            <span className="text-muted-foreground text-[10px] flex items-center gap-1 font-medium">
              <Activity className="w-3 h-3 text-cyan-600" />
              {tIntake('rr')}
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-bold text-foreground text-sm">
                {vitals.respiratory_rate !== undefined
                  ? `${vitals.respiratory_rate}`
                  : (locale === 'bn' ? 'রেকর্ড করা হয়নি' : 'Not recorded')}
                {vitals.respiratory_rate !== undefined && (
                  <span className="text-[9px] text-muted-foreground font-normal ml-0.5">/min</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Allergies */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span>{tIntake('allergies')}</span>
        </div>
        {input.allergies && input.allergies.length > 0 ? (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 font-medium space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>{locale === 'bn' ? 'সতর্কতা: অ্যালার্জি রিপোর্ট' : 'Known Drug Allergies:'}</span>
            </div>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {input.allergies.map((allergy, i) => (
                <Badge key={i} variant="destructive" className="text-[10px] font-semibold">
                  {allergy}
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {locale === 'bn' ? 'কোনো অ্যালার্জি নেই (NKDA)' : 'No known drug allergies (NKDA)'}
          </p>
        )}
      </div>

      <Separator />

      {/* Current Medications & Past History */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Pill className="w-3.5 h-3.5 text-indigo-500" />
          <span>{tIntake('currentMedicines')}</span>
        </div>
        {input.current_medicines && input.current_medicines.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {input.current_medicines.map((med, i) => (
              <Badge key={i} variant="outline" className="text-xs font-normal bg-muted/40">
                {med}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {locale === 'bn' ? 'নিয়মিত কোনো ওষুধ নেই' : 'No regular medications'}
          </p>
        )}
      </div>

      {input.past_medical_history && input.past_medical_history.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {tIntake('pastHistory')}
            </div>
            <div className="flex flex-wrap gap-1">
              {input.past_medical_history.map((hist, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-normal">
                  {hist}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Lab Values */}
      {input.lab_values && input.lab_values.length > 0 && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TestTube2 className="w-3.5 h-3.5 text-teal-600" />
              <span>{tIntake('labs')}</span>
            </div>
            <div className="space-y-1">
              {input.lab_values.map((lab, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs border border-border/40"
                >
                  <span className="font-medium text-foreground">{lab.name}</span>
                  <span className="font-semibold text-primary">
                    {lab.value}{' '}
                    <span className="text-[10px] text-muted-foreground font-normal">{lab.unit}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Special Flags (Pregnancy / eGFR) */}
      {(input.is_pregnant || input.egfr !== undefined) && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {locale === 'bn' ? 'ক্লিনিকাল ফ্ল্যাগ' : 'Clinical Flags'}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {input.is_pregnant && (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
                >
                  <Baby className="w-3 h-3" />
                  {locale === 'bn'
                    ? `গর্ভবতী (ট্রাইমেস্টার ${input.pregnancy_trimester || '১'})`
                    : `Pregnant (Trimester ${input.pregnancy_trimester || '1'})`}
                </Badge>
              )}
              {input.egfr !== undefined && (
                <Badge
                  variant={input.egfr < 60 ? 'destructive' : 'outline'}
                  className="gap-1 text-xs"
                >
                  eGFR: {input.egfr} mL/min/1.73m²
                </Badge>
              )}
            </div>
          </div>
        </>
      )}

      {/* Consultation Observation History */}
      {turns && turns.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{locale === 'bn' ? 'পরামর্শ ইতিহাস' : 'Consultation History'} ({turns.length})</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {turns.slice(-6).map((turn, i) => {
                const c = turn.content as Record<string, string>;
                return (
                  <div
                    key={turn.id || i}
                    className="p-2 rounded-md border border-border/60 bg-muted/20 text-[11px] space-y-0.5"
                  >
                    {c.question && (
                      <p className="font-semibold text-foreground/90">Q: {c.question}</p>
                    )}
                    {c.answer && (
                      <p className="text-emerald-700 dark:text-emerald-400 font-medium pl-1.5 border-l-2 border-emerald-500">
                        A: {c.answer}
                      </p>
                    )}
                    {c.observation && (
                      <p className="text-primary font-medium pl-1.5 border-l-2 border-primary">
                        Obs: {c.observation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] p-0 flex flex-col bg-background">
          <DrawerHeader className="p-4 pb-2 border-b border-border/60">
            <DrawerTitle className="text-base font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span>{t('patientSummary')}</span>
              </span>
              <span className="text-xs font-normal text-muted-foreground">{patientCode}</span>
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-background">
        <SheetHeader className="p-4 border-b border-border/60">
          <SheetTitle className="text-base font-bold flex items-center justify-between pr-6">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span>{t('patientSummary')}</span>
            </span>
            <span className="text-xs font-normal text-muted-foreground">{patientCode}</span>
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 overflow-y-auto">{content}</ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
