'use client';

import React, { useState } from 'react';
import { usePathname } from '@/i18n/routing';
import { useLocale } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  HelpCircle,
  Stethoscope,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from 'lucide-react';

interface ScreenHelpInfo {
  titleBn: string;
  titleEn: string;
  whatIsItBn: string;
  whatIsItEn: string;
  stepsBn: string[];
  stepsEn: string[];
  tipsBn: string;
  tipsEn: string;
}

const HELP_MAP: Record<string, ScreenHelpInfo> = {
  dashboard: {
    titleBn: 'চিকিৎসক ড্যাশবোর্ড',
    titleEn: 'Doctor Dashboard',
    whatIsItBn: 'এটি আপনার প্রাত্যহিক ক্লিনিকাল ড্যাশবোর্ড। এখান থেকে দ্রুত নতুন রোগী গ্রহণ, সাম্প্রতিক কেস এবং প্রেসক্রিপশন পরিচালনা করা যায়।',
    whatIsItEn: 'This is your central clinical dashboard to manage recent patient cases, visits, and active prescriptions.',
    stepsBn: [
      'নতুন রোগী বা ভিজিট শুরু করতে "নতুন গ্রহণ (New Intake)" বাটনে চাপুন।',
      'চলমান বা পূর্ববর্তী কেস পর্যালোচনা করতে কেস তালিকায় ক্লিক করুন।',
      'ডিজিটাল প্রেসক্রিপশন তৈরি ও প্রিন্ট করতে প্রেসক্রিপশন মেনু ব্যবহার করুন।',
    ],
    stepsEn: [
      'Click "New Intake" to record a new patient or clinical encounter.',
      'Select any case from the list to review symptoms and diagnostic suggestions.',
      'Navigate to Prescriptions to create, sign, and print official pads.',
    ],
    tipsBn: 'জরুরি রক্তের চাপ বা অ্যালার্জি থাকলে তা রোগীর প্রোফাইলে সংরক্ষণ করুন।',
    tipsEn: 'Ensure patient allergies are logged to trigger automatic safety halts.',
  },
  patients: {
    titleBn: 'রোগীর তালিকা ও গ্রহণ',
    titleEn: 'Patient Directory & Intake',
    whatIsItBn: 'আপনার অধীনে নিবন্ধিত রোগীদের এনক্রিপ্টকৃত স্বাস্থ্য প্রোফাইল এবং ভিজিট ইতিহাস দেখতে এই স্ক্রিন ব্যবহার করুন।',
    whatIsItEn: 'View end-to-end encrypted medical records, vital histories, and past visits for patients under your direct care.',
    stepsBn: [
      'রোগীর কোড (যেমন P-101) বা নাম দিয়ে সার্চ বারে খুঁজুন।',
      '"নতুন গ্রহণ (New Intake)" ৪-ধাপের উইজার্ড দিয়ে রোগীর তথ্য ও সম্মতি লিপিবদ্ধ করুন।',
      'রোগীর প্রোফাইলে ক্লিক করে পূর্ববর্তী ভিজিট নোট ও প্রেসক্রিপশন দেখুন।',
    ],
    stepsEn: [
      'Search patients by patient code (e.g. P-101) or full name.',
      'Use the 4-step Intake Wizard to capture vitals, history, and consent.',
      'Click any patient to review longitudinal visit history and prescriptions.',
    ],
    tipsBn: 'রোগীর স্পষ্ট সম্মতি ব্যতীত ডিজিটাল ডাটা প্রক্রিয়াকরণ শুরু করবেন না।',
    tipsEn: 'Always obtain and log explicit patient consent prior to digital analysis.',
  },
  prescriptions: {
    titleBn: 'বিএমডিসি ডিজিটাল প্রেসক্রিপশন প্যাড',
    titleEn: 'BMDC Digital Prescription Pad',
    whatIsItBn: 'বিএমডিসি মানসম্মত অফিসিয়াল প্রেসক্রিপশন তৈরি, ড্রাগ ইন্টারঅ্যাকশন পরীক্ষা, এবং ক্রিপ্টোগ্রাফিক কিউআর কোডসহ প্রিন্ট করার প্ল্যাটফর্ম।',
    whatIsItEn: 'Generate standardized BMDC-compliant prescriptions with deterministic allergy/interaction safety and cryptographic QR verification.',
    stepsBn: [
      'বাংলাদেশি ফর্মুলারি (DGDA) থেকে ব্র্যান্ড বা জেনেরিক ড্রাগ নির্বাচন করুন।',
      '১+০+১ ফরম্যাটে মাত্রা, খাওয়ার সম্পর্ক ও সময়কাল নির্ধারণ করুন।',
      'রিয়েল-টাইম সেফটি চেক সম্পন্ন করে প্রেসক্রিপশন চূড়ান্ত (Finalize) ও প্রিন্ট করুন।',
    ],
    stepsEn: [
      'Search approved DGDA brands and generics from top pharma manufacturers.',
      'Set doses in the standard 1+0+1 notation with meal instructions and duration.',
      'Verify automated interaction checks before finalizing and printing with QR code.',
    ],
    tipsBn: 'ড্রাগ রিকল বা অ্যালার্জি অ্যালার্ট দেখা দিলে বিকল্প নিরাপদ ওষুধ নির্বাচন করুন।',
    tipsEn: 'Critical drug recall notices or severe interactions will block finalization.',
  },
  portal: {
    titleBn: 'রোগী স্বাস্থ্য পোর্টাল',
    titleEn: 'Patient Health Portal',
    whatIsItBn: 'রোগীদের জন্য ব্যক্তিগত ওষুধ খাওয়ার সময়সূচি, প্রেসক্রিপশন দেখা, টেস্ট রিপোর্ট আপলোড এবং সম্মতি ব্যবস্থাপনার নিরাপদ স্থান।',
    whatIsItEn: 'Personal patient portal to view daily medication schedules, official prescriptions, upload reports, and manage privacy consent.',
    stepsBn: [
      '"ওষুধ সূচি"-তে সকাল, দুপুর বা রাতের ওষুধ গ্রহণের পর টিক চিহ্ন দিন।',
      '"প্রেসক্রিপশন" ট্যাবে গিয়ে আপনার ডাক্তারের অফিসিয়াল প্যাড ডাউনলোড করুন।',
      'পরবর্তী সাক্ষাতের আগে টেস্ট রিপোর্ট ও লক্ষণসমূহ আপলোড করে রাখুন।',
    ],
    stepsEn: [
      'Check off morning, noon, or night doses in the Daily Schedule tab.',
      'View or download your doctor’s signed prescription from the Prescriptions tab.',
      'Upload pre-visit lab reports and symptom descriptions before your appointment.',
    ],
    tipsBn: 'আপনার ইচ্ছানুযায়ী যেকোনো সময় স্বাস্থ্য তথ্যের ডিজিটাল ব্যবহারের সম্মতি প্রত্যাহার করা যায়।',
    tipsEn: 'You retain full control to revoke digital sharing consent at any time.',
  },
  study: {
    titleBn: 'শিক্ষার্থী ক্লিনিকাল কর্নার',
    titleEn: 'Student Clinical Workspace',
    whatIsItBn: 'মেডিকেল শিক্ষার্থীদের জন্য সিন্থেটিক রোগীর কেস সিমুলেশন, বিএমডিসি গাইডলাইন ভিত্তিক কুইজ এবং উচ্চ-ফলনশীল ক্লিনিকাল নোটের প্ল্যাটফর্ম।',
    whatIsItEn: 'Dedicated educational sandbox for medical trainees featuring virtual patient simulations, guideline quizzes, and clinical study notes.',
    stepsBn: [
      'সিন্থেটিক রোগীর ইতিহাস ও ভাইটালস পড়ে ডায়াগনোসিস নির্বাচন ও সাবমিট করুন।',
      'অনুমোদিত ন্যাশনাল গাইডলাইনের উদ্ধৃতি ও যৌক্তিক ব্যাখ্যা দেখে জ্ঞান বৃদ্ধি করুন।',
      'চ্যাপ্টার কুইজের মাধ্যমে নিজের প্রস্তুতি যাচাই করুন এবং গুরুত্বপূর্ণ নোট সংরক্ষণ করুন।',
    ],
    stepsEn: [
      'Read virtual patient vignettes and vitals to select differential diagnoses.',
      'Study verified guideline citations and clinical pearls linked to the answers.',
      'Test retention with multiple-choice quizzes and save personal clinical pearls.',
    ],
    tipsBn: 'শিক্ষার্থী মোডে বাস্তব কোনো রোগীর তথ্য দৃশ্যমান হয় না—সম্পূর্ণ সিন্থেটিক পরিবেশ।',
    tipsEn: 'Zero real patient data is accessible in Student mode; cases are fully synthetic.',
  },
  research: {
    titleBn: 'ক্লিনিকাল রিসার্চ স্যুট',
    titleEn: 'Clinical Research Suite',
    whatIsItBn: 'স্বাস্থ্য গবেষক ও নীতিনির্ধারকদের জন্য এভিডেন্স লেভেল ফিল্টারিং, দ্বৈত গাইডলাইন তুলনা এবং আন্তর্জাতিক ফরম্যাটে সাইটেশন এক্সপোর্ট ব্যবস্থা।',
    whatIsItEn: 'Evidence synthesis and literature suite with Grade Ia-IV facet filtering, protocol comparison matrix, and bibliography export.',
    stepsBn: [
      'প্রমাণের মাত্রা (Grade Ia - IV), বছর ও উৎস অনুযায়ী ফিল্টার করে পেসেজ অনুসন্ধান করুন।',
      'বাংলাদেশ ডিজিএইচএস ও আন্তর্জাতিক ডব্লিউএইচও প্রটোকলের পাশাপাশি তুলনা দেখুন।',
      'প্রয়োজনীয় সাইটেশন নির্বাচন করে CSV, RIS বা BibTeX ফরম্যাটে ডাউনলোড করুন।',
    ],
    stepsEn: [
      'Filter guideline evidence by Grade Ia-IV, publication year, and source type.',
      'Inspect side-by-side guideline differences between DGHS and WHO protocols.',
      'Export selected citations to EndNote/Zotero (RIS), LaTeX (BibTeX), or CSV.',
    ],
    tipsBn: 'ক্লোজড ইন্টারনাল লাইব্রেরির বাইরে কোনো আনভেরিফায়েড ওয়েব তথ্য এখানে প্রদর্শিত হয় না।',
    tipsEn: 'All citations derive strictly from verified internal medical library chunks.',
  },
  controller: {
    titleBn: 'ডিজিডিএ ড্রাগ কন্ট্রোলার পোর্টাল',
    titleEn: 'DGDA Medicine Controller Portal',
    whatIsItBn: 'বাংলাদেশ ওষুধ প্রশাসন অধিদপ্তরের জন্য ন্যাশনাল ড্রাগ ফর্মুলারি হালনাগাদ, টু-পারসন রিভিউ এবং জরুরি নিরাপত্তা নোটিশ জারির পোর্টাল।',
    whatIsItEn: 'Regulatory medicine control portal for DGDA to maintain the national formulary, review brand submissions, and broadcast drug recalls.',
    stepsBn: [
      '"ব্র্যান্ড ক্যাটালগ"-এ নতুন প্রস্তুতকারক ও স্ট্রেন্থ সম্বলিত ওষুধ প্রস্তাব করুন।',
      'দ্বৈত রিভিউয়ার নীতি অনুসারে প্রস্তাবিত ওষুধ অনুমোদন বা সংশোধন করুন।',
      'মার্কেট থেকে ভেজাল বা ঝুঁকিপূর্ণ ব্যাচ প্রত্যাহার করতে নিরাপত্তা নোটিশ জারি করুন।',
    ],
    stepsEn: [
      'Propose new medicine brands and strengths with DGDA registration numbers.',
      'Review pending brand proposals under the Two-Person Review governance rule.',
      'Broadcast active drug recalls and safety warnings to immediately halt prescribing.',
    ],
    tipsBn: 'রিকলকৃত যেকোনো ওষুধ সমগ্র দেশের চিকিৎসকদের সিস্টেমে তাৎক্ষণিক ব্লক হয়ে যাবে।',
    tipsEn: 'Recalled drugs instantly trigger hard prescribing stops across the entire platform.',
  },
};

interface HelpSheetProps {
  variant?: 'default' | 'icon';
  className?: string;
}

export function HelpSheet({ variant = 'default', className = '' }: HelpSheetProps = {}) {
  const pathname = usePathname();
  const locale = useLocale();
  const isBn = locale === 'bn';
  const [isOpen, setIsOpen] = useState(false);

  // Extract clean segment e.g. 'dashboard', 'patients', 'prescriptions'
  const cleanPath = pathname.replace(/^\/(?:bn|en)(?:\/|$)/, '').replace(/^\//, '');
  const rootSegment = cleanPath.split('/')[0] || 'dashboard';

  const helpInfo = HELP_MAP[rootSegment] || HELP_MAP.dashboard;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger
        render={
          variant === 'icon' ? (
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8 text-muted-foreground hover:text-foreground', className)}
              aria-label={isBn ? 'স্ক্রিন সাহায্য ও হেল্পলাইন খুলুন' : 'Open Screen Help & Helpline'}
              title={isBn ? 'সাহায্য ও হেল্পলাইন' : 'Help & Helpline'}
            >
              <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 px-2.5 sm:px-3 text-xs font-semibold flex items-center gap-1.5 border-border/80 bg-background hover:bg-muted/60 text-foreground transition-all duration-150',
                className
              )}
              aria-label={isBn ? 'স্ক্রিন সাহায্য ও হেল্পলাইন খুলুন' : 'Open Screen Help & Helpline'}
            >
              <HelpCircle className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="hidden sm:inline">{isBn ? 'সাহায্য' : 'Help'}</span>
            </Button>
          )
        }
      />

      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-6 overflow-y-auto space-y-6 border-l border-border bg-background"
      >
        <SheetHeader className="space-y-1.5 text-left border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center text-teal-700 dark:text-teal-300">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-foreground">
                {isBn ? helpInfo.titleBn : helpInfo.titleEn}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {isBn ? 'ব্যবহার নির্দেশিকা ও হেল্পলাইন' : 'Quick Guide & Clinical Helpline'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Section 1: What this screen is */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span>{isBn ? 'এই স্ক্রিনটি কী?' : 'What is this screen?'}</span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed bg-muted/40 p-3.5 rounded-lg border border-border/60">
            {isBn ? helpInfo.whatIsItBn : helpInfo.whatIsItEn}
          </p>
        </div>

        {/* Section 2: How to use it */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{isBn ? 'কীভাবে ব্যবহার করবেন (৩টি সহজ ধাপ)' : 'How to use it (3 Simple Steps)'}</span>
          </div>

          <div className="space-y-2">
            {(isBn ? helpInfo.stepsBn : helpInfo.stepsEn).map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/70 bg-card/60 text-xs text-foreground/90 leading-relaxed"
              >
                <Badge
                  variant="secondary"
                  className="w-5 h-5 rounded-full p-0 flex items-center justify-center text-[11px] font-bold shrink-0 bg-primary/10 text-primary"
                >
                  {idx + 1}
                </Badge>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pro tip / safety note */}
        <div className="p-3 rounded-lg border border-teal-200 dark:border-teal-800/60 bg-teal-50/60 dark:bg-teal-950/20 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>{isBn ? 'টিপস: ' : 'Tip: '}</strong>
            {isBn ? helpInfo.tipsBn : helpInfo.tipsEn}
          </p>
        </div>

        {/* Section 3: Who to call / Helpline */}
        <div className="space-y-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <PhoneCall className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{isBn ? 'জরুরি সহায়তা ও হেল্পলাইন' : 'Support & Emergency Hotline'}</span>
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">
                {isBn ? 'ডকমেইট সার্বক্ষণিক টেকনিক্যাল সাপোর্ট' : 'DocMate 24/7 Clinical Desk'}
              </span>
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-primary" />
                +880 9612-DOCMATE (362628)
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">
                {isBn ? 'স্বাস্থ্য অধিদপ্তর (DGHS) জাতীয় স্বাস্থ্য বাতায়ন' : 'DGHS Bangladesh National Helpline'}
              </span>
              <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                16263 (টোল ফ্রি / Toll-Free)
              </p>
            </div>
          </div>
        </div>

        {/* Non-negotiable Doctor Decides Disclaimer */}
        <div className="p-3 rounded-lg border border-border/60 bg-muted/30 text-center space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground block">
            {isBn
              ? 'ক্লিনিকাল সিদ্ধান্ত সহায়তা। চূড়ান্ত সিদ্ধান্ত চিকিৎসকের।'
              : 'Clinical decision support only. Doctor retains final authority.'}
          </span>
          <span className="text-[10px] text-muted-foreground block">
            {isBn
              ? 'DocMate AI কোনো অবস্থাতেই চিকিৎসকের পেশাদার সিদ্ধান্তের বিকল্প নয়।'
              : 'DocMate AI is not a substitute for professional clinical judgement.'}
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
