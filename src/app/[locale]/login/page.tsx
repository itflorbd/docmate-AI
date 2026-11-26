'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { DemoBanner } from '@/components/shared/DemoBanner';
import {
  Stethoscope,
  ShieldCheck,
  GraduationCap,
  Microscope,
  ShieldAlert,
  ArrowRight,
  Loader2,
  Pill,
  HeartHandshake,
  Smartphone,
  KeyRound,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isBn = locale === 'bn';

  // Professional Email Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Patient Phone + OTP State
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpError, setOtpError] = useState('');

  // Auto-clear stale session if redirected with logout flag
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('logout') || params.has('switch')) {
        fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      }
    }
  }, []);

  const demoAccounts = [
    {
      role: 'doctor',
      title: t('doctorAccount'),
      email: 'doctor@docmate.ai',
      icon: Stethoscope,
    },
    {
      role: 'patient',
      title: t('patientAccount'),
      email: 'patient@docmate.ai',
      icon: HeartHandshake,
    },
    {
      role: 'controller',
      title: t('controllerAccount'),
      email: 'controller@docmate.ai',
      icon: Pill,
    },
    {
      role: 'student',
      title: t('studentAccount'),
      email: 'student@docmate.ai',
      icon: GraduationCap,
    },
    {
      role: 'researcher',
      title: t('researcherAccount'),
      email: 'researcher@docmate.ai',
      icon: Microscope,
    },
    {
      role: 'super_admin',
      title: t('adminAccount'),
      email: 'admin@docmate.ai',
      icon: ShieldAlert,
    },
  ];

  const demoPatientPhones = [
    { label: isBn ? 'কামাল (০১৭০০০০০০০১)' : 'Kamal (01700000001)', phone: '01700000001' },
    { label: isBn ? 'রফিকুল ও পরিবার (০১৭০০০০০০০২)' : 'Rafiqul & Family (01700000002)', phone: '01700000002' },
    { label: isBn ? 'ফাতেমা (০১৭০০০০০০০৩)' : 'Fatema (01700000003)', phone: '01700000003' },
  ];

  const handleSelectDemo = (accEmail: string) => {
    setEmail(accEmail);
    setPassword('demo123');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const callback = params?.get('callbackUrl') || undefined;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, callbackUrl: callback }),
        cache: 'no-store',
        credentials: 'same-origin',
      });

      const data = await res.json();
      if (!res.ok) {
        const errorText = data.details ? `${data.error} (${data.details})` : (data.error || t('errorInvalid'));
        throw new Error(errorText);
      }

      toast.success(t('signedIn'));

      const role = data.user?.role;
      let targetPath = data.redirectUrl;
      if (!targetPath) {
        if (role === 'super_admin' || role === 'admin') targetPath = '/admin';
        else if (role === 'student') targetPath = '/study';
        else if (role === 'researcher') targetPath = '/research';
        else if (role === 'medicine_controller') targetPath = '/controller';
        else if (role === 'patient') targetPath = '/portal';
        else targetPath = '/dashboard';
      }

      const targetUrl = targetPath.startsWith('/en') || targetPath.startsWith('/bn')
        ? targetPath
        : `/${locale}${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}`;

      window.location.replace(targetUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errorInvalid');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Patient Phone OTP Handlers
  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!phone || phone.trim().length < 8) {
      setOtpError(isBn ? 'সঠিক ফোন নম্বর লিখুন' : 'Please enter a valid phone number');
      return;
    }

    setOtpLoading(true);
    setOtpError('');

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), purpose: 'login' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ওটিপি পাঠাতে সমস্যা হয়েছে');
      }

      setOtpSent(true);
      setOtpCode('123456'); // Pre-filled for demo convenience
      toast.success(data.message || (isBn ? 'ওটিপি পাঠানো হয়েছে' : 'OTP sent'));

      // 60-second cooldown timer
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error sending OTP';
      setOtpError(message);
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError(isBn ? '৬ সংখ্যার ওটিপি লিখুন' : 'Enter 6-digit OTP');
      return;
    }

    setOtpLoading(true);
    setOtpError('');

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.trim(),
          code: otpCode.trim(),
          purpose: 'login',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ওটিপি যাচাই ব্যর্থ হয়েছে');
      }

      toast.success(isBn ? 'রোগী পোর্টালে স্বাগতম!' : 'Welcome to Patient Portal!');
      window.location.replace(`/${locale}/portal`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error verifying OTP';
      setOtpError(message);
      toast.error(message);
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-muted/20 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-foreground">
              DocMate AI
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              {tCommon('appTagline')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md mx-auto w-full my-auto py-4 space-y-4">
        {/* Prominent Demo Mode Banner */}
        <DemoBanner variant="prominent" />

        <Card className="border-border shadow-md bg-card">
          <CardHeader className="space-y-1.5 pb-3 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {t('title')}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              {t('subtitle')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pt-1">
            <Tabs defaultValue="staff" className="w-full">
              <TabsList className="grid grid-cols-2 w-full h-auto min-h-12 p-1 bg-muted/60 group-data-horizontal/tabs:h-auto gap-1">
                <TabsTrigger value="staff" className="text-xs sm:text-sm font-medium py-2 px-2 gap-1.5 whitespace-normal leading-snug text-center">
                  <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('staffLogin')}</span>
                </TabsTrigger>
                <TabsTrigger value="patient_otp" className="text-xs sm:text-sm font-medium py-2 px-2 gap-1.5 whitespace-normal leading-snug text-center">
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  <span>{t('patientPhoneLogin')}</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: Doctor & Staff Password Login */}
              <TabsContent value="staff" className="space-y-4 pt-3">
                {/* Quick Demo Account Selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t('demoAccounts')}
                    </Label>
                    <span className="text-[11px] font-mono text-muted-foreground bg-muted/80 border border-border/60 px-2 py-0.5 rounded font-medium">
                      {isBn ? 'পাসওয়ার্ড: demo123' : 'Password: demo123'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {demoAccounts.map((acc) => {
                      const isSelected = email === acc.email;
                      return (
                        <button
                          key={acc.email}
                          type="button"
                          onClick={() => handleSelectDemo(acc.email)}
                          className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all text-xs font-medium ${
                            isSelected
                              ? 'border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary/40 shadow-2xs'
                              : 'border-border bg-card/60 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <div className="flex items-start gap-1.5 mb-1">
                            <acc.icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="wrap-anywhere">{acc.title}</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground wrap-anywhere">{acc.email}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && (
                  <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form method="post" action="/api/auth/login" onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium">
                      {t('email')}
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="doctor@docmate.ai"
                      required
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs font-medium">
                      {t('password')}
                    </Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="demo123"
                      required
                      className="h-10 text-sm"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 mt-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('signingIn')}</span>
                      </>
                    ) : (
                      <>
                        <span>{t('signIn')}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* TAB 2: Patient Mobile Phone + OTP Login */}
              <TabsContent value="patient_otp" className="space-y-4 pt-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {isBn ? 'ডেমো রোগী ফোন নম্বর' : 'Demo Patient Phones'}
                  </Label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {demoPatientPhones.map((dp) => (
                      <button
                        key={dp.phone}
                        type="button"
                        onClick={() => {
                          setPhone(dp.phone);
                          setOtpError('');
                        }}
                        className={`text-left px-3 py-2 rounded-md border text-xs font-medium transition-colors ${
                          phone === dp.phone
                            ? 'border-primary bg-primary/10 text-primary font-semibold'
                            : 'border-border bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {dp.label}
                      </button>
                    ))}
                  </div>
                </div>

                {otpError && (
                  <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                {!otpSent ? (
                  <form method="post" onSubmit={handleSendOtp} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="patientPhone" className="text-xs font-medium">
                        {t('phoneNumber')}
                      </Label>
                      <Input
                        id="patientPhone"
                        type="tel"
                        inputMode="numeric"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        required
                        className="h-10 text-sm font-mono tracking-wide"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {isBn ? 'বাংলা বা ইংরেজি সংখ্যায় ১১ ডিজিটের নম্বর লিখুন' : 'Enter 11-digit mobile number in Bangla or English digits'}
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={otpLoading || !phone}
                      className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    >
                      {otpLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('sendingOtp')}</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4" />
                          <span>{t('sendOtp')}</span>
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  <form method="post" onSubmit={handleVerifyOtp} className="space-y-3">
                    <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20 text-xs flex items-center justify-between">
                      <div>
                        <span className="text-muted-foreground">{t('otpSentTo')} </span>
                        <strong className="font-mono text-primary font-semibold">{phone}</strong>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setOtpSent(false);
                          setOtpCode('');
                        }}
                        className="h-7 text-xs px-2 text-primary"
                      >
                        {t('changePhone')}
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="otpCode" className="text-xs font-medium flex items-center justify-between">
                        <span>{t('enterOtp')}</span>
                        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-mono font-medium">
                          {isBn ? 'ডেমো ওটিপি: ১২৩৪৫৬' : 'Demo OTP: 123456'}
                        </span>
                      </Label>
                      <Input
                        id="otpCode"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        required
                        className="h-11 text-center font-mono text-xl tracking-widest"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={otpLoading || otpCode.length !== 6}
                      className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                    >
                      {otpLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{t('verifyingOtp')}</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>{t('verifyOtp')}</span>
                        </>
                      )}
                    </Button>

                    <div className="text-center pt-1">
                      <Button
                        type="button"
                        variant="link"
                        disabled={cooldown > 0 || otpLoading}
                        onClick={() => handleSendOtp()}
                        className="text-xs text-muted-foreground hover:text-foreground h-auto p-0 gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>
                          {cooldown > 0
                            ? `${isBn ? 'পুনরায় পাঠান' : 'Resend'} (${cooldown}s)`
                            : t('resendOtp')}
                        </span>
                      </Button>
                    </div>
                  </form>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>

          <CardFooter className="pt-2 pb-5 border-t border-border/60 text-center flex flex-col gap-1">
            <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('closedLibrary')}</span>
            </span>
          </CardFooter>
        </Card>
      </main>

      {/* Mandatory Disclaimer Footer */}
      <footer className="max-w-2xl mx-auto text-center text-xs text-muted-foreground pt-4">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          {tCommon('disclaimer')}
        </p>
        <p className="text-[11px] mt-0.5">{tCommon('doctorDecides')}</p>
      </footer>
    </div>
  );
}
