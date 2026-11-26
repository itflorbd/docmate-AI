'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import {
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  FileCheck2,
  Pill,
  HelpCircle,
  UserCheck,
  ArrowRight,
  ChevronRight,
  Lock,
  FileLock2,
  Database,
} from 'lucide-react';
import { DoctorAiIllustration } from '@/components/shared/DoctorAiIllustration';
import {
  HeroAmbientBackground,
  SectionMedicalPattern,
  SectionWaveDivider,
} from '@/components/shared/MedicalBackgroundDecorations';
import {
  Step1IntakeIllustration,
  Step2GuidelineIllustration,
  Step3SafetyIllustration,
  Step4DoctorSignsIllustration,
} from '@/components/shared/LandingStepIllustrations';
import { PrivacyVaultIllustration } from '@/components/shared/PrivacyVaultIllustration';
import { LandingCtaBanner } from '@/components/shared/LandingCtaBanner';
import {
  DoctorRoleIllustration,
  StudentRoleIllustration,
  ResearcherRoleIllustration,
  AdminRoleIllustration,
} from '@/components/shared/RoleBadgesIllustrations';

export default function LandingPage() {
  const t = useTranslations('landing');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setIsLoggedIn(true);
          setUserRole(data.user.role);
        }
      })
      .catch(() => {});
  }, []);

  const getRoleDestination = (role?: string | null) => {
    if (role === 'super_admin' || role === 'admin') return '/admin';
    if (role === 'student') return '/ask';
    if (role === 'researcher' || role === 'medicine_controller') return '/library';
    if (role === 'patient') return '/prescriptions';
    return '/dashboard';
  };

  const handleRoleAction = (targetPath: string) => {
    if (isLoggedIn) {
      router.push(targetPath);
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-2xs">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm sm:text-base leading-tight tracking-tight text-foreground">
                DocMate AI
              </span>
              <span className="text-[10px] text-muted-foreground font-normal hidden sm:block">
                {locale === 'bn' ? 'ক্লিনিকাল ডিসিশন সাপোর্ট' : 'Clinical Decision Support'}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              {t('navHowItWorks')}
            </a>
            <a href="#standards" className="hover:text-foreground transition-colors">
              {t('navSafety')}
            </a>
            <a href="#privacy" className="hover:text-foreground transition-colors">
              {t('navCases')}
            </a>
            <a href="#roles" className="hover:text-foreground transition-colors">
              {t('navRoles')}
            </a>
            <Link href="/library" className="hover:text-foreground transition-colors">
              {t('navLibrary')}
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />

            {isLoggedIn ? (
              <Button
                size="sm"
                onClick={() => router.push(getRoleDestination(userRole))}
                className="gap-1.5 text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
              >
                <span>{userRole === 'super_admin' ? t('navAdmin') : t('navDashboard')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => router.push('/login')}
                className="gap-1.5 text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
              >
                <span>{t('navSignIn')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section with Ambient Glows, ECG line, and Vector Doctor AI Illustration */}
      <section className="relative overflow-hidden py-12 lg:py-16 border-b border-border/50 bg-background">
        <HeroAmbientBackground />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-5 text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>{t('heroBadge')}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.2] text-foreground">
                {t('heroTitle')}
              </h1>

              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl font-normal">
                {t('heroSubtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="default"
                  onClick={() => router.push('/cases/new')}
                  className="h-10 px-5 font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-2xs rounded-md text-xs"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>{t('startIntake')}</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>

                <Button
                  size="default"
                  variant="outline"
                  onClick={() => router.push('/ask')}
                  className="h-10 px-4 font-medium border-border gap-2 bg-card hover:bg-muted rounded-md text-xs"
                >
                  <HelpCircle className="w-4 h-4 text-primary" />
                  <span>{t('askLibrary')}</span>
                </Button>

                <Button
                  size="default"
                  variant="ghost"
                  onClick={() => router.push('/library')}
                  className="h-10 px-4 font-medium text-muted-foreground hover:text-foreground rounded-md text-xs"
                >
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  <span>{t('browseLibrary')}</span>
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 pt-5 border-t border-border/50 max-w-lg text-left">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>{locale === 'bn' ? 'উৎসসহ উত্তর' : 'Cited answers'}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === 'bn' ? 'শুধু লাইব্রেরি থেকে' : 'From your library only'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Safe Rx</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === 'bn' ? 'ড্রাগ সেফটি চেক' : 'Allergy & DDI Checks'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <span>MD Decides</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === 'bn' ? 'চিকিৎসকের সিদ্ধান্ত' : 'Physician in Control'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Doctor AI Assistant Vector Illustration */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <DoctorAiIllustration locale={locale} />
            </div>
          </div>
        </div>
      </section>

      {/* Decorative Wave Divider */}
      <SectionWaveDivider />

      {/* How It Works Section (4 Steps with Vector Visuals) */}
      <section id="how-it-works" className="py-14 bg-muted/20 border-b border-border/50 relative overflow-hidden">
        <SectionMedicalPattern />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {locale === 'bn' ? 'সহজ চার ধাপের প্রক্রিয়া' : '4 Simple Steps'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {locale === 'bn' ? 'ডকমেট কীভাবে কাজ করে' : 'How DocMate AI Works'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {locale === 'bn'
                ? 'রোগীর লক্ষণ থেকে শুরু করে নিরাপদ চিকিৎসা নিশ্চিত করার সম্পূর্ণ ধাপ।'
                : 'From patient intake to verified treatment recommendations with physician control.'}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Step 1: Patient Intake */}
            <Card className="border-border bg-card/95 hover:border-primary/40 transition-all duration-200 shadow-2xs flex flex-col justify-between overflow-hidden">
              <div className="p-3 bg-muted/30 border-b border-border/40">
                <Step1IntakeIllustration />
              </div>
              <CardHeader className="space-y-1.5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {locale === 'bn' ? 'লক্ষণ গ্রহণ' : '1. Patient Intake'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === 'bn'
                    ? 'রোগীর প্রধান লক্ষণ, অতীত ইতিহাস এবং ভাইটাল সাইন নথিভুক্ত করুন।'
                    : 'Record chief complaints, medical history, vitals, and current medicines.'}
                </p>
              </CardContent>
            </Card>

            {/* Step 2: Guideline Match */}
            <Card className="border-border bg-card/95 hover:border-primary/40 transition-all duration-200 shadow-2xs flex flex-col justify-between overflow-hidden">
              <div className="p-3 bg-muted/30 border-b border-border/40">
                <Step2GuidelineIllustration />
              </div>
              <CardHeader className="space-y-1.5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {locale === 'bn' ? 'গাইডলাইন বিশ্লেষণ' : '2. Guideline Match'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === 'bn'
                    ? 'মেডিকেল লাইব্রেরি খুঁজে সংশ্লিষ্ট রোগের সম্ভাবনা ও প্রমাণ প্রদর্শন করে।'
                    : 'Searches internal clinical guidelines to suggest ranked differential diagnoses.'}
                </p>
              </CardContent>
            </Card>

            {/* Step 3: Safety Engine */}
            <Card className="border-border bg-card/95 hover:border-primary/40 transition-all duration-200 shadow-2xs flex flex-col justify-between overflow-hidden">
              <div className="p-3 bg-muted/30 border-b border-border/40">
                <Step3SafetyIllustration />
              </div>
              <CardHeader className="space-y-1.5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {locale === 'bn' ? 'সেফটি স্ক্রিনিং' : '3. Safety Engine'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === 'bn'
                    ? 'ওষুধের মাত্রা, অ্যালার্জি এবং ড্রাগ মিথস্ক্রিয়া স্বয়ংক্রিয়ভাবে যাচাই হয়।'
                    : 'Instant screening for allergies, harmful drug-drug interactions, and safe doses.'}
                </p>
              </CardContent>
            </Card>

            {/* Step 4: Doctor Signs */}
            <Card className="border-border bg-card/95 hover:border-primary/40 transition-all duration-200 shadow-2xs flex flex-col justify-between overflow-hidden">
              <div className="p-3 bg-muted/30 border-b border-border/40">
                <Step4DoctorSignsIllustration />
              </div>
              <CardHeader className="space-y-1.5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {locale === 'bn' ? 'চিকিৎসকের সিদ্ধান্ত' : '4. Doctor Signs'}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === 'bn'
                    ? 'চিকিৎসক চূড়ান্ত সিদ্ধান্ত নেন এবং প্রেসক্রিপশন সামারি প্রিন্ট করেন।'
                    : 'The physician reviews, confirms diagnosis, and finalizes the care plan.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Decorative Wave Divider */}
      <SectionWaveDivider flip />

      {/* Core Safety Standards Section */}
      <section id="standards" className="py-14 border-b border-border/50 bg-background relative overflow-hidden">
        <SectionMedicalPattern />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {locale === 'bn' ? 'ক্লিনিকাল গুণমান' : 'Clinical Standards'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('pillarsTitle')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('pillarsSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Standard 1 */}
            <Card className="border-border bg-card shadow-2xs hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar1Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar1Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 2 */}
            <Card className="border-border bg-card shadow-2xs hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <FileCheck2 className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar2Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar2Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 3 */}
            <Card className="border-border bg-card shadow-2xs hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Pill className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar3Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar3Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 4 */}
            <Card className="border-border bg-card shadow-2xs hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar4Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar4Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 5 */}
            <Card className="border-border bg-card shadow-2xs sm:col-span-2 lg:col-span-2 hover:border-primary/30 transition-colors">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar5Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar5Desc')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Decorative Wave Divider */}
      <SectionWaveDivider />

      {/* Privacy, Security & Data Protection Section */}
      <section id="privacy" className="py-14 bg-muted/20 border-b border-border/50 relative overflow-hidden">
        <SectionMedicalPattern />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>{locale === 'bn' ? 'গোপনীয়তা ও নিরাপত্তা' : 'Privacy & Security'}</span>
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('demoCases')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('demoCasesSubtitle')}
            </p>
          </div>

          {/* Privacy Vault Visual Centerpiece */}
          <div className="py-2">
            <PrivacyVaultIllustration locale={locale} />
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Guarantee 1: Zero-PHI Exposure */}
            <Card className="border-border bg-card shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-medium border-primary/30 text-primary">
                    {locale === 'bn' ? 'ডেটা গোপনীয়তা' : 'Zero PHI'}
                  </Badge>
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold pt-1 text-foreground">{t('caseA')}</CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {t('caseADesc')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('#standards')}
                  className="w-full text-xs font-medium gap-1.5"
                >
                  <span>{t('viewCase')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardFooter>
            </Card>

            {/* Guarantee 2: Encrypted Records & RBAC */}
            <Card className="border-border bg-card shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-medium border-primary/30 text-primary">
                    {locale === 'bn' ? 'অনুমোদিত অ্যাক্সেস' : 'RBAC Protection'}
                  </Badge>
                  <FileLock2 className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold pt-1 text-foreground">
                  {t('caseB')}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {t('caseBDesc')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('#standards')}
                  className="w-full text-xs font-medium gap-1.5"
                >
                  <span>{t('viewCase')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardFooter>
            </Card>

            {/* Guarantee 3: Closed-Boundary Library */}
            <Card className="border-border bg-card shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-medium border-primary/30 text-primary">
                    {locale === 'bn' ? 'অভ্যন্তরীণ লাইব্রেরি' : 'Zero Web Tracking'}
                  </Badge>
                  <Database className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold pt-1 text-foreground">
                  {t('caseC')}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {t('caseCDesc')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/library')}
                  className="w-full text-xs font-medium gap-1.5"
                >
                  <span>{t('browseLibrary')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Decorative Wave Divider */}
      <SectionWaveDivider flip />

      {/* Roles Section with Visual Badges */}
      <section id="roles" className="py-14 border-b border-border/50 bg-background relative overflow-hidden">
        <SectionMedicalPattern />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {locale === 'bn' ? 'ব্যবহারকারী ভূমিকা' : 'User Roles'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('personasTitle')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('personasSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Role 1: Doctor */}
            <Card className="border-border bg-card hover:border-primary/40 transition-colors shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-3 pb-3">
                <DoctorRoleIllustration />
                <div>
                  <CardTitle className="text-sm font-semibold">{tAuth('doctorAccount')}</CardTitle>
                  <CardDescription className="text-xs pt-1">
                    {locale === 'bn' ? 'রোগী গ্রহণ, রোগ নির্ণয় ও প্রেসক্রিপশন' : 'Clinical intake, diagnosis, and prescribing'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  onClick={() => handleRoleAction('/dashboard')}
                  className="w-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t('tryAsDoctor')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 2: Student */}
            <Card className="border-border bg-card hover:border-primary/40 transition-colors shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-3 pb-3">
                <StudentRoleIllustration />
                <div>
                  <CardTitle className="text-sm font-semibold">{tAuth('studentAccount')}</CardTitle>
                  <CardDescription className="text-xs pt-1">
                    {locale === 'bn' ? 'মেডিকেল কেস স্টাডি ও গাইডলাইন শিক্ষা' : 'Trainee learning and guideline exploration'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRoleAction('/ask')}
                  className="w-full text-xs font-medium hover:bg-muted"
                >
                  {t('tryAsStudent')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 3: Researcher */}
            <Card className="border-border bg-card hover:border-primary/40 transition-colors shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-3 pb-3">
                <ResearcherRoleIllustration />
                <div>
                  <CardTitle className="text-sm font-semibold">{tAuth('researcherAccount')}</CardTitle>
                  <CardDescription className="text-xs pt-1">
                    {locale === 'bn' ? 'চিকিৎসা গবেষণা ও তথ্যের উৎস অনুসন্ধান' : 'Evidence search and literature evaluation'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRoleAction('/library')}
                  className="w-full text-xs font-medium hover:bg-muted"
                >
                  {t('tryAsResearcher')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 4: Admin */}
            <Card className="border-border bg-card hover:border-primary/40 transition-colors shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-3 pb-3">
                <AdminRoleIllustration />
                <div>
                  <CardTitle className="text-sm font-semibold">{tAuth('adminAccount')}</CardTitle>
                  <CardDescription className="text-xs pt-1">
                    {locale === 'bn' ? 'গাইডলাইন নিবন্ধন ও হাসপাতাল পরিচালনা' : 'Formulary management and system oversight'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRoleAction('/admin')}
                  className="w-full text-xs font-medium hover:bg-muted"
                >
                  {t('tryAsAdmin')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Pre-Footer Call to Action Banner */}
      <LandingCtaBanner locale={locale} />

      {/* Persistent Disclaimer Footer */}
      <footer className="border-t border-border bg-card py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground mt-auto">
        <div className="max-w-4xl mx-auto space-y-1.5">
          <p className="flex items-center justify-center gap-1.5 font-semibold text-foreground">
            <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>{tCommon('disclaimer')}</span>
          </p>
          <p className="text-[11px]">{tCommon('doctorDecides')}</p>
          <p className="text-[10px] text-muted-foreground pt-1">
            DocMate AI • Clinical Decision Support System
          </p>
        </div>
      </footer>
    </div>
  );
}
