import React from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { TextSizeControl } from '@/components/shared/TextSizeControl';
import { AssistantSettingsCard } from '@/components/settings/AssistantSettingsCard';
import { Link } from '@/i18n/routing';
import { getCurrentUser } from '@/lib/auth';
import { ShieldCheck, UserCheck, Database, Globe, Mic } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getLocale, getTranslations } from 'next-intl/server';

export default async function SettingsPage() {
  const [locale, user] = await Promise.all([
    getLocale(),
    getCurrentUser(),
  ]);
  const t = await getTranslations('settings');

  const isPatient = user?.role === 'patient';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title={t('title')}
          subtitle={isPatient ? t('patientSubtitle') : t('subtitle')}
        />

        {/* Super Admin Notice: AI Credentials & Configuration lives exclusively in the Admin Control Plane */}
        {isSuperAdmin && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span>{t('aiCredentialsAdminNoticeTitle')}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('aiCredentialsAdminNoticeDesc')}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href="/admin/voice"
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-background transition-colors border border-primary/30 bg-background text-primary hover:bg-primary/10 h-8 px-3 gap-1 shadow-2xs"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>{locale === 'bn' ? 'ভয়েস সেটিংস' : 'Voice Settings'}</span>
                </Link>
                <Link
                  href="/admin/ai"
                  className="inline-flex items-center justify-center rounded-md text-xs font-semibold ring-offset-background transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3"
                >
                  {t('openAdminAiPanel')}
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Preferences */}
          <Card className="border-border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span>{t('localizationTitle')}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {t('localizationDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/60">
                <div>
                  <h4 className="text-sm font-medium">{t('language')}</h4>
                  <p className="text-xs text-muted-foreground">{locale === 'bn' ? 'শুরুতে: বাংলা' : 'Starts in Bangla'}</p>
                </div>
                <LanguageSwitcher />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border/60">
                <div>
                  <h4 className="text-sm font-medium">{t('theme')}</h4>
                  <p className="text-xs text-muted-foreground">{locale === 'bn' ? 'হালকা, গাঢ় বা ডিভাইসের মতো' : 'Light, dark or same as your device'}</p>
                </div>
                <ThemeToggle />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-sm font-medium">{locale === 'bn' ? 'লেখার আকার' : 'Text size'}</h4>
                  <p className="text-xs text-muted-foreground">{locale === 'bn' ? 'লেখা বড় বা ছোট করুন' : 'Make text bigger or smaller'}</p>
                </div>
                <TextSizeControl />
              </div>
            </CardContent>
          </Card>

          {/* User Profile */}
          <Card className="border-border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <span>{t('userProfile')}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {t('userProfileDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('name')}:</span>
                  <span className="text-xs font-semibold text-foreground">
                    {user?.name || (isPatient ? 'Patient Account' : 'Dr. Farhana Rahman')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {user?.phone ? 'Phone:' : `${t('email')}:`}
                  </span>
                  <span className="text-xs font-mono text-foreground">
                    {user?.phone || user?.email || (isPatient ? '01700000001' : 'doctor@docmate.ai')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{t('role')}:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/30">
                    {user?.role || (isPatient ? 'patient' : 'doctor')}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assistant Personalization & Persona Controls */}
          <AssistantSettingsCard userName={user?.name} />

          {/* Engine Status (Clinicians/Admins) or Privacy Safeguards (Patients) */}
          {isPatient ? (
            <Card className="border-border md:col-span-2">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>ব্যক্তিগত স্বাস্থ্য তথ্য ও গোপনীয়তা (Patient Privacy & Security)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  ডকমেইট এআই-তে আপনার স্বাস্থ্য তথ্য এবং প্রেসক্রিপশন সম্পূর্ণ সুরক্ষিত।
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>এনক্রিপ্ট করা প্রোফাইল</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      আপনার জাতীয় পরিচয়পত্র এবং ব্যক্তিগত তথ্য ডাটাবেজে এনক্রিপ্ট অবস্থায় সংরক্ষিত থাকে।
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>রোগীর অনুমতি ও নিয়ন্ত্রণ</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      আপনার সম্মতি ছাড়া কোনো ডাক্তার আপনার পূর্ববর্তী চিকিৎসার রেকর্ড বা রিপোর্ট দেখতে পারবেন না।
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>যাচাইকৃত প্রেসক্রিপশন</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      প্রতিটি প্রেসক্রিপশন বিএমডিসি নিবন্ধিত ডাক্তার দ্বারা অনুমোদিত এবং ডিজিটালভাবে যাচাইযোগ্য।
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border md:col-span-2">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  <span>{t('engineStatus')}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('engineStatusDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>PostgreSQL + pgvector</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Connected. Hybrid vector similarity & full-text search active.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Closed Library Isolation</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Strict prompt boundaries enforced. No outside web retrieval.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Deterministic Drug Engine</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      TypeScript rule engine active for interactions, renal & allergies.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
