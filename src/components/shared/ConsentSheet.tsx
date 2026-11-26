'use client';

import React, { useState } from 'react';
import { useLocale } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  KeyRound,
  Loader2,
  Clock,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

interface ConsentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  profileId: string;
  profileName: string;
  onGrantSuccess: (grant: { scope: string; expiresAt: string | null }) => void;
}

export function ConsentSheet({
  isOpen,
  onClose,
  phone,
  profileId,
  profileName,
  onGrantSuccess,
}: ConsentSheetProps) {
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [otpSent, setOtpSent] = useState(false);
  const [code, setCode] = useState('');
  const [durationDays, setDurationDays] = useState<'7' | '30' | '90'>('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose: 'grant_access' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setOtpSent(true);
      setCode('123456'); // Pre-filled for demo convenience
      toast.success(
        isBn
          ? `রোগীর ফোন নম্বরে (${phone}) ওটিপি পাঠানো হয়েছে`
          : `OTP sent to patient (${phone})`
      );

      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending OTP';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError(isBn ? '৬ সংখ্যার ওটিপি কোড লিখুন' : 'Enter 6-digit OTP code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/patient/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          profileId,
          code,
          durationDays,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to activate grant');
      }

      toast.success(
        isBn
          ? 'অনুমতি সফলভাবে সক্রিয় হয়েছে! পুরনো ইতিহাস দৃশ্যমান।'
          : 'Permission granted! Full medical history unlocked.'
      );

      onGrantSuccess(data.grant);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error verifying grant';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-6 overflow-y-auto">
        <SheetHeader className="space-y-2 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-foreground">
                {isBn ? 'পুরনো ইতিহাস দেখার অনুমতি' : 'Medical History Access Permission'}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {isBn
                  ? 'অন্য চিকিৎসকদের প্রেসক্রিপশন ও রেকর্ড দেখার জন্য রোগীর ওটিপি সম্মতি আবশ্যক'
                  : 'Patient OTP authorization required to access cross-doctor medical records'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="py-5 space-y-5">
          {/* Patient Details Summary */}
          <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isBn ? 'রোগীর নাম:' : 'Patient:'}</span>
              <strong className="text-foreground">{profileName}</strong>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{isBn ? 'ফোন নম্বর:' : 'Phone:'}</span>
              <strong className="font-mono text-primary font-semibold">{phone}</strong>
            </div>
          </div>

          {error && (
            <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
              {error}
            </div>
          )}

          {!otpSent ? (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isBn
                  ? 'নিচের বাটনে চাপ দিলে রোগীর মোবাইল নম্বরে একটি এসএমএস ওটিপি যাবে। রোগী কোডটি জানালে তা দিয়ে অনুমতি সক্রিয় করুন।'
                  : 'Click below to send a 6-digit OTP to the patient. Enter the code to activate history access.'}
              </p>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {isBn
                    ? 'ডেমো মোড সক্রিয়: রোগীর ফোনের জন্য ওটিপি '
                    : 'Demo Mode: OTP is '}
                  <strong className="font-mono font-bold">123456</strong>
                </span>
              </div>

              <Button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isBn ? 'ওটিপি পাঠানো হচ্ছে...' : 'Sending OTP...'}</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{isBn ? 'রোগীর ফোনে ওটিপি পাঠান' : 'Send OTP to Patient'}</span>
                  </>
                )}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerifyGrant} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="grantOtp" className="text-xs font-medium flex justify-between items-center">
                  <span>{isBn ? 'ওটিপি কোড লিখুন' : 'Enter OTP Code'}</span>
                  <Badge variant="outline" className="text-[10px] font-mono text-amber-700 dark:text-amber-400 border-amber-500/40">
                    {isBn ? 'ডেমো: ১২৩৪৫৬' : 'Demo: 123456'}
                  </Badge>
                </Label>
                <Input
                  id="grantOtp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  className="h-11 text-center font-mono text-xl tracking-widest"
                />
              </div>

              {/* Permission Duration Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{isBn ? 'অনুমতির সময়সীমা' : 'Permission Duration'}</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(['7', '30', '90'] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationDays(d)}
                      className={`py-2 px-3 rounded-md border text-xs font-medium transition-colors ${
                        durationDays === d
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border bg-card/60 hover:bg-muted text-muted-foreground'
                      }`}
                    >
                      {d === '7' && (isBn ? '৭ দিন' : '7 Days')}
                      {d === '30' && (isBn ? '৩০ দিন' : '30 Days')}
                      {d === '90' && (isBn ? '৯০ দিন' : '90 Days')}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{isBn ? 'যাচাই করা হচ্ছে...' : 'Verifying...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isBn ? 'অনুমতি নিশ্চিত করুন' : 'Confirm Permission'}</span>
                  </>
                )}
              </Button>

              <div className="text-center pt-1">
                <Button
                  type="button"
                  variant="link"
                  disabled={cooldown > 0 || loading}
                  onClick={handleSendOtp}
                  className="text-xs text-muted-foreground hover:text-foreground h-auto p-0 gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>
                    {cooldown > 0
                      ? `${isBn ? 'পুনরায় পাঠান' : 'Resend'} (${cooldown}s)`
                      : isBn ? 'পুনরায় ওটিপি পাঠান' : 'Resend OTP'}
                  </span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
