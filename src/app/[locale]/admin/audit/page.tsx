'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  History,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  Hash,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';

interface AuditRecord {
  id: string;
  event: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  caseId?: string | null;
  payload: Record<string, unknown>;
  prevHash?: string | null;
  hash?: string | null;
  createdAt: string;
}

interface VerificationResult {
  valid: boolean;
  totalChecked: number;
  brokenAtId?: string;
  error?: string;
}

export default function AdminAuditPage() {
  const locale = useLocale();
  const t = useTranslations('admin');

  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEvent, setSearchEvent] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<VerificationResult | null>(null);

  // Selected audit record for detail sheet/modal
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (searchEvent) params.set('event', searchEvent);
    params.set('limit', '50');

    fetch(`/api/admin/audit?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setLogs(data.logs || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load audit trail');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [searchEvent, refreshTrigger]);

  const handleVerifyChain = async () => {
    setVerifying(true);
    setVerification(null);
    try {
      const res = await fetch('/api/admin/audit', { method: 'POST' });
      if (!res.ok) throw new Error('Verification request failed');
      const data = await res.json();
      setVerification(data.verification);

      if (data.verification?.valid) {
        toast.success(
          locale === 'bn'
            ? `হ্যাশ চেইন অক্ষত আছে (${data.verification.totalChecked}টি রেকর্ড যাচাই সম্পন্ন)`
            : `Hash chain valid (${data.verification.totalChecked} records verified)`
        );
      } else {
        toast.error(
          locale === 'bn'
            ? `চেইনের অখণ্ডতা লঙ্ঘিত হয়েছে: ${data.verification.error}`
            : `Integrity broken: ${data.verification.error}`
        );
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t('audit')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'bn'
              ? 'SHA-256 হ্যাশ চেইনে সংরক্ষিত নিরাপদ অডিট লগ ও জরুরি অ্যাক্সেস রেকর্ড।'
              : 'Tamper-evident, hash-chained records of admin and emergency events.'}
          </p>
        </div>

        <Button
          onClick={() => {
            setLoading(true);
            setRefreshTrigger((v) => v + 1);
          }}
          variant="outline"
          size="sm"
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{locale === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Cryptographic Hash Chain Verifier Banner Card */}
      <Card className="border-border bg-card shadow-2xs">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {locale === 'bn' ? 'হ্যাশ-চেইন অখণ্ডতা পরীক্ষক' : 'Hash-Chain Integrity Verifier'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {locale === 'bn'
                  ? 'প্রতিটি অডিট রেকর্ড ক্রিপ্টোগ্রাফিকভাবে সংযুক্ত। কোনো পরিবর্তন হলে সাথে সাথে ধরা পড়বে।'
                  : 'Validates that all audit rows link sequentially without tampering or backdating.'}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleVerifyChain}
            disabled={verifying}
            className="text-xs shrink-0 font-medium"
          >
            {verifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                <span>{t('verifying')}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                <span>{t('verifyChain')}</span>
              </>
            )}
          </Button>
        </CardContent>

        {/* Verification Result Notification */}
        {verification && (
          <div
            className={`mx-4 sm:mx-5 mb-4 p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
              verification.valid
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            {verification.valid ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <div className="font-bold">
                {verification.valid ? t('chainValid') : t('chainBroken')}
              </div>
              <p className="text-[11px] opacity-90">
                {verification.valid
                  ? (locale === 'bn'
                      ? `মোট ${verification.totalChecked}টি অডিট রেকর্ড ক্রিপ্টোগ্রাফিকভাবে যাচাই করা হয়েছে। ডাটাবেজে কোনো হেরফের বা টেম্পারিং নেই।`
                      : `Successfully verified all ${verification.totalChecked} consecutive audit records. Zero anomalies detected.`)
                  : verification.error}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Filter & Search */}
      <Card className="border-border bg-card shadow-2xs">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={searchEvent}
              onChange={(e) => setSearchEvent(e.target.value)}
              placeholder={locale === 'bn' ? 'ইভেন্ট নাম দিয়ে খুঁজুন (e.g. BREAK_GLASS, USER_SUSPENDED)...' : 'Search by event name (e.g. BREAK_GLASS, OVERRIDE)...'}
              className="pl-9 text-xs h-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="border-border bg-card shadow-2xs overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            <span>{locale === 'bn' ? 'অডিট রেকর্ড তালিকা (সর্বশেষ ৫০টি)' : 'Recent Audit Trail (Latest 50 Entries)'}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">{locale === 'bn' ? 'অডিট লগ লোড হচ্ছে...' : 'Loading audit logs...'}</span>
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-12 text-center">
              {locale === 'bn' ? 'কোনো অডিট রেকর্ড পাওয়া যায়নি' : 'No audit records match your query'}
            </p>
          ) : (
            <table className="w-full text-xs text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-y border-border bg-muted/40 font-bold text-foreground">
                  <th className="py-3 px-4 w-[160px]">{locale === 'bn' ? 'সময়' : 'Timestamp'}</th>
                  <th className="py-3 px-3">{locale === 'bn' ? 'ইভেন্ট নাম' : 'Event Action'}</th>
                  <th className="py-3 px-3">{locale === 'bn' ? 'ব্যবহারকারী' : 'Actor'}</th>
                  <th className="py-3 px-3 font-mono">{locale === 'bn' ? 'SHA-256 হ্যাশ' : 'Current Hash'}</th>
                  <th className="py-3 px-3 text-center">{locale === 'bn' ? 'বিবরণ' : 'Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => {
                  const isBreakGlass = log.event.includes('BREAK_GLASS');
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-muted/20 transition-colors ${
                        isBreakGlass ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded ${
                            isBreakGlass
                              ? 'bg-destructive text-destructive-foreground'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {log.event}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground text-xs">{log.userName || log.userEmail || 'System'}</div>
                        {log.userEmail && (
                          <div className="text-[10px] font-mono text-muted-foreground">{log.userEmail}</div>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-[10px] text-muted-foreground">
                        {log.hash ? (
                          <span title={log.hash}>
                            {log.hash.slice(0, 8)}...{log.hash.slice(-8)}
                          </span>
                        ) : (
                          <span className="italic text-muted-foreground">Genesis</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedRecord(log)}
                          className="h-7 px-2 text-xs text-primary hover:text-primary/80"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>{locale === 'bn' ? 'দেখুন' : 'Inspect'}</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Inspect Audit Detail Sheet */}
      <Sheet open={Boolean(selectedRecord)} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedRecord && (
            <>
              <SheetHeader className="pb-3 border-b border-border">
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  <Hash className="w-4 h-4 text-primary" />
                  <span className="font-mono break-all">{selectedRecord.event}</span>
                </SheetTitle>
                <SheetDescription className="text-xs font-mono">
                  Log ID: {selectedRecord.id}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-3 pt-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg border border-border">
                  <div>
                    <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                      {locale === 'bn' ? 'সময়কাল' : 'Timestamp'}
                    </span>
                    <span className="font-mono text-xs">{new Date(selectedRecord.createdAt).toISOString()}</span>
                  </div>
                  <div>
                    <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                      {locale === 'bn' ? 'ব্যবহারকারী' : 'Actor'}
                    </span>
                    <span className="font-mono text-xs">{selectedRecord.userEmail || 'System'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase font-mono">
                    Prev Hash (SHA-256)
                  </span>
                  <div className="p-2 rounded bg-muted/40 font-mono text-[11px] break-all border border-border">
                    {selectedRecord.prevHash || '0'.repeat(64)}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase font-mono">
                    Current Hash (SHA-256)
                  </span>
                  <div className="p-2 rounded bg-muted/40 font-mono text-[11px] break-all border border-border text-primary font-semibold">
                    {selectedRecord.hash || 'N/A'}
                  </div>
                </div>

                <div className="space-y-1 pt-1">
                  <span className="font-bold text-muted-foreground block text-[10px] uppercase">
                    {locale === 'bn' ? 'পেলোড ডাটা (Verified Payload)' : 'Verified JSON Payload'}
                  </span>
                  <pre className="p-3 rounded-lg bg-muted/30 border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64">
                    {JSON.stringify(selectedRecord.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
