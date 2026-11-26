'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  Smartphone,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface PlanTier {
  id: string;
  nameBn: string;
  nameEn: string;
  priceBdt: number;
  interval: string;
  dailyLimit: number;
  features: string[];
  isPopular?: boolean;
}

interface PaymentGatewayStub {
  id: 'bkash' | 'nagad' | 'sslcommerz';
  name: string;
  enabled: boolean;
  sandboxMode: boolean;
  merchantNumber: string;
}

export default function AdminPlansPage() {
  const locale = useLocale();
  const t = useTranslations('admin');

  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [gateways, setGateways] = useState<PaymentGatewayStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit plan state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editLimit, setEditLimit] = useState<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/plans', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setPlans(data.plans || []);
          setGateways(data.gateways || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load plans data');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refreshTrigger]);

  const toggleGateway = async (gatewayId: string, currentEnabled: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_gateway',
          gatewayId,
          enabled: !currentEnabled,
        }),
      });

      if (!res.ok) throw new Error('Failed to toggle gateway');
      toast.success(
        !currentEnabled
          ? (locale === 'bn' ? `${gatewayId} গেটওয়ে চালু করা হয়েছে` : `${gatewayId} gateway enabled`)
          : (locale === 'bn' ? `${gatewayId} গেটওয়ে বন্ধ করা হয়েছে` : `${gatewayId} gateway disabled`)
      );
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gateway action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePlan = async (planId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_plan',
          planId,
          priceBdt: editPrice,
          dailyLimit: editLimit,
        }),
      });

      if (!res.ok) throw new Error('Failed to update plan');
      toast.success(locale === 'bn' ? 'প্ল্যান সংরক্ষিত হয়েছে' : 'Plan updated successfully');
      setEditingPlanId(null);
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Plan update failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t('plans')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'bn'
              ? 'চিকিৎসক ও ক্লিনিকদের সাবস্ক্রিপশন টিয়ার এবং বাংলাদেশি পেমেন্ট গেটওয়ে (bKash, Nagad, SSLCommerz) নিয়ন্ত্রণ।'
              : 'Configure subscription tiers, daily case allowances, and Bangladeshi payment gateways.'}
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
          className="text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{locale === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Payment Gateways (Bangladesh Localized) */}
      <Card className="border-border bg-card shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            <CardTitle className="text-base font-bold">
              {locale === 'bn' ? 'বাংলাদেশি পেমেন্ট গেটওয়ে (Payment Gateways)' : 'Bangladeshi Payment Gateways'}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {locale === 'bn'
              ? 'bKash, Nagad এবং SSLCommerz গেটওয়ে সক্রিয় বা নিষ্ক্রিয় করুন।'
              : 'Toggle bKash merchant PGW, Nagad direct pay, and SSLCommerz multi-bank sandbox gateways.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {gateways.map((gw) => (
              <div
                key={gw.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                  gw.enabled
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-muted/20 opacity-70'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-foreground uppercase tracking-wider">{gw.id}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-muted text-muted-foreground uppercase">
                      Sandbox
                    </span>
                  </div>
                  <h2 className="text-xs font-semibold text-foreground">{gw.name}</h2>
                  <p className="text-[11px] font-mono text-muted-foreground">Acc: {gw.merchantNumber}</p>
                </div>

                <Button
                  size="sm"
                  variant={gw.enabled ? 'outline' : 'secondary'}
                  onClick={() => toggleGateway(gw.id, gw.enabled)}
                  disabled={actionLoading}
                  className={`text-xs h-8 ${
                    gw.enabled ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10' : ''
                  }`}
                >
                  {gw.enabled ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      <span>{locale === 'bn' ? 'সক্রিয় (ENABLED)' : 'ENABLED'}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                      <span>{locale === 'bn' ? 'বন্ধ (DISABLED)' : 'DISABLED'}</span>
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Subscription Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isEditing = editingPlanId === p.id;
          return (
            <Card
              key={p.id}
              className={`border-border bg-card shadow-2xs flex flex-col justify-between ${
                p.isPopular ? 'border-primary ring-1 ring-primary/30' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase font-bold text-muted-foreground">{p.id}</span>
                  {p.isPopular && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary text-primary-foreground">
                      {locale === 'bn' ? 'জনপ্রিয়' : 'POPULAR'}
                    </span>
                  )}
                </div>
                <CardTitle className="text-base font-bold text-foreground">
                  {locale === 'bn' ? p.nameBn : p.nameEn}
                </CardTitle>

                {isEditing ? (
                  <div className="space-y-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{locale === 'bn' ? 'মূল্য (BDT)' : 'Price (BDT)'}</Label>
                      <Input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(parseInt(e.target.value, 10) || 0)}
                        className="text-xs h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">{locale === 'bn' ? 'দৈনিক কেস লিমিট' : 'Daily Limit'}</Label>
                      <Input
                        type="number"
                        value={editLimit}
                        onChange={(e) => setEditLimit(parseInt(e.target.value, 10) || 1)}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="pt-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">৳{p.priceBdt}</span>
                      <span className="text-xs text-muted-foreground">/{p.interval}</span>
                    </div>
                    <p className="text-xs text-primary font-semibold mt-1">
                      {locale === 'bn' ? `দৈনিক ${p.dailyLimit}টি কেস` : `${p.dailyLimit} cases / day`}
                    </p>
                  </div>
                )}
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <ul className="space-y-2 text-xs text-muted-foreground border-t border-border/60 pt-3">
                  {p.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2 border-t border-border/60">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingPlanId(null)}
                        className="text-xs flex-1 h-8"
                      >
                        {locale === 'bn' ? 'বাতিল' : 'Cancel'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdatePlan(p.id)}
                        disabled={actionLoading}
                        className="text-xs flex-1 h-8"
                      >
                        {locale === 'bn' ? 'সংরক্ষণ' : 'Save'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingPlanId(p.id);
                        setEditPrice(p.priceBdt);
                        setEditLimit(p.dailyLimit);
                      }}
                      className="w-full text-xs h-8"
                    >
                      {locale === 'bn' ? 'টিয়ার এডিট করুন' : 'Edit Plan Details'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
