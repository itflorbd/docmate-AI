'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ShieldCheck,
  Check,
  X,
  Plus,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Clock,
  Sliders,
} from 'lucide-react';
import { toast } from 'sonner';

interface FeatureDef {
  key: string;
  description: string;
  category: string;
}

interface RoleFeatureDef {
  id: string;
  role: string;
  featureKey: string;
  enabled: boolean;
  dailyLimit?: number | null;
}

interface UserOverrideDef {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  featureKey: string;
  enabled: boolean;
  dailyLimit?: number | null;
  expiresAt?: string | null;
  reason?: string | null;
}

const ALL_ROLES = [
  { key: 'doctor', label: 'Doctor', bn: 'চিকিৎসক' },
  { key: 'student', label: 'Student', bn: 'শিক্ষার্থী' },
  { key: 'researcher', label: 'Researcher', bn: 'গবেষক' },
  { key: 'patient', label: 'Patient', bn: 'রোগী' },
  { key: 'medicine_controller', label: 'Controller', bn: 'ওষুধ নিয়ন্ত্রক' },
  { key: 'super_admin', label: 'Super Admin', bn: 'সুপার অ্যাডমিন' },
];

export default function AdminAccessPage() {
  const locale = useLocale();
  const t = useTranslations('admin');

  const [features, setFeatures] = useState<FeatureDef[]>([]);
  const [roleFeatures, setRoleFeatures] = useState<RoleFeatureDef[]>([]);
  const [overrides, setOverrides] = useState<UserOverrideDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Preview as role
  const [previewRole, setPreviewRole] = useState('doctor');

  // New override form state
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideUserId, setOverrideUserId] = useState('');
  const [overrideFeatureKey, setOverrideFeatureKey] = useState('');
  const [overrideEnabled, setOverrideEnabled] = useState(true);
  const [overrideLimit, setOverrideLimit] = useState('');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideSubmitting, setOverrideSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/access', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setFeatures(data.features || []);
          setRoleFeatures(data.roleFeatures || []);
          setOverrides(data.overrides || []);
          if (data.features?.length > 0 && !overrideFeatureKey) {
            setOverrideFeatureKey(data.features[0].key);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load matrix');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refreshTrigger, overrideFeatureKey]);

  const toggleRoleFeature = async (role: string, featureKey: string, currentVal: boolean) => {
    const keyId = `${role}:${featureKey}`;
    setSavingKey(keyId);
    try {
      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_role_feature',
          role,
          featureKey,
          enabled: !currentVal,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update feature');

      toast.success(
        locale === 'bn'
          ? `${role} রোলের জন্য ${featureKey} হালনাগাদ হয়েছে`
          : `Updated ${featureKey} for role ${role}`
      );
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSavingKey(null);
    }
  };

  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideUserId || !overrideReason.trim()) {
      toast.error(locale === 'bn' ? 'ইউজার আইডি ও কারণ পূরণ করুন' : 'User ID and reason required');
      return;
    }

    setOverrideSubmitting(true);
    try {
      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_user_override',
          userId: overrideUserId,
          featureKey: overrideFeatureKey,
          enabled: overrideEnabled,
          dailyLimit: overrideLimit ? parseInt(overrideLimit, 10) : null,
          expiresAt: overrideExpiresAt ? new Date(overrideExpiresAt).toISOString() : null,
          reason: overrideReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save override');

      toast.success(locale === 'bn' ? 'ইউজার ওভাররাইড সংরক্ষিত হয়েছে' : 'User override saved');
      setShowOverrideForm(false);
      setOverrideUserId('');
      setOverrideReason('');
      setOverrideLimit('');
      setOverrideExpiresAt('');
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setOverrideSubmitting(false);
    }
  };

  const handleRemoveOverride = async (overrideId: string) => {
    try {
      const res = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_user_override',
          overrideId,
        }),
      });

      if (!res.ok) throw new Error('Failed to remove override');
      toast.success(locale === 'bn' ? 'ওভাররাইড প্রত্যাহার করা হয়েছে' : 'Override revoked');
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  // Group features by category
  const categories = Array.from(new Set(features.map((f) => f.category)));

  // Lookup helper: is feature enabled for role?
  const isEnabled = (role: string, featureKey: string): boolean => {
    const entry = roleFeatures.find((rf) => rf.role === role && rf.featureKey === featureKey);
    return entry ? entry.enabled : false;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t('access')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'bn'
              ? '৬টি রোলের ফিচার অনুমতি ও দৈনিক কোটা নিয়ন্ত্রণ করুন।'
              : 'Manage permissions and daily quotas for all 6 roles.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
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

          <Button
            onClick={() => setShowOverrideForm(!showOverrideForm)}
            size="sm"
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            <span>{locale === 'bn' ? 'ইউজার ওভাররাইড যোগ করুন' : 'Add User Override'}</span>
          </Button>
        </div>
      </div>

      {/* Add User Override Modal/Card */}
      {showOverrideForm && (
        <Card className="border-border bg-card shadow-md">
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <span>{locale === 'bn' ? 'ব্যবহারকারী ফিচার ওভাররাইড' : 'New User Override'}</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {locale === 'bn'
                ? 'নির্দিষ্ট ব্যবহারকারীকে কোনো ফিচার অনুমতি দিতে বা বন্ধ করতে ব্যবহার করুন।'
                : 'Grant or revoke a specific capability for an individual user.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateOverride} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{locale === 'bn' ? 'ব্যবহারকারী আইডি (UUID)' : 'User ID (UUID)'}</Label>
                <Input
                  value={overrideUserId}
                  onChange={(e) => setOverrideUserId(e.target.value)}
                  placeholder="e.g. 43eb5601-..."
                  className="text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{locale === 'bn' ? 'ফিচার কী (Feature Key)' : 'Feature Key'}</Label>
                <select aria-label={locale === 'bn' ? 'ফিচার কী (Feature Key)' : 'Feature Key'}
                  value={overrideFeatureKey}
                  onChange={(e) => setOverrideFeatureKey(e.target.value)}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-xs font-mono"
                >
                  {features.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.key} ({f.description})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{locale === 'bn' ? 'অবস্থা (State)' : 'Access State'}</Label>
                <select aria-label={locale === 'bn' ? 'অবস্থা (State)' : 'Access State'}
                  value={overrideEnabled ? 'true' : 'false'}
                  onChange={(e) => setOverrideEnabled(e.target.value === 'true')}
                  className="h-10 w-full px-3 rounded-md border border-input bg-background text-xs font-medium"
                >
                  <option value="true">{locale === 'bn' ? 'অনুমতি দিন (Grant/Enable)' : 'Grant / Enable'}</option>
                  <option value="false">{locale === 'bn' ? 'নিষিদ্ধ করুন (Revoke/Disable)' : 'Revoke / Disable'}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{locale === 'bn' ? 'দৈনিক লিমিট (ঐচ্ছিক)' : 'Daily Limit (Optional)'}</Label>
                <Input
                  type="number"
                  value={overrideLimit}
                  onChange={(e) => setOverrideLimit(e.target.value)}
                  placeholder="e.g. 50"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{locale === 'bn' ? 'মেয়াদ শেষ (ঐচ্ছিক)' : 'Expires At (Optional)'}</Label>
                <Input
                  type="datetime-local"
                  value={overrideExpiresAt}
                  onChange={(e) => setOverrideExpiresAt(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label className="text-xs font-semibold">{locale === 'bn' ? 'অডিট কারণ (বাধ্যতামূলক)' : 'Audit Justification Reason (Required)'}</Label>
                <Input
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder={locale === 'bn' ? 'কেন এই ওভাররাইড দেওয়া হচ্ছে তা লিখুন...' : 'Document clinical or administrative reason...'}
                  className="text-xs"
                  required
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOverrideForm(false)}
                  className="text-xs"
                >
                  {locale === 'bn' ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button type="submit" size="sm" disabled={overrideSubmitting} className="text-xs">
                  {overrideSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                  <span>{locale === 'bn' ? 'ওভাররাইড সংরক্ষণ করুন' : 'Save Override'}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* "View as Role" Simulator Card */}
      <Card className="border-border bg-card shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <CardTitle className="text-sm font-bold">{t('viewAsRole')}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">
                {locale === 'bn' ? 'রোল নির্বাচন করুন:' : 'Simulate Role:'}
              </Label>
              <select aria-label={locale === 'bn' ? 'রোল নির্বাচন করুন:' : 'Simulate Role:'}
                value={previewRole}
                onChange={(e) => setPreviewRole(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-xs font-semibold focus:ring-1 focus:ring-primary"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {locale === 'bn' ? r.bn : r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <CardDescription className="text-xs">
            {locale === 'bn'
              ? `বর্তমানে "${previewRole}" রোলের জন্য সক্রিয় ও নিষ্ক্রিয় ফিচারের প্রিভিউ:`
              : `Live capability preview for the "${previewRole}" role:`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {features.map((f) => {
              const permitted = isEnabled(previewRole, f.key);
              return (
                <span
                  key={f.key}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                    permitted
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-medium'
                      : 'border-border bg-muted/40 text-muted-foreground line-through'
                  }`}
                  title={f.description}
                >
                  {permitted ? <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> : <X className="w-3 h-3 text-muted-foreground" />}
                  <span>{f.key}</span>
                </span>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Feature Access Matrix Table */}
      <Card className="border-border bg-card shadow-2xs overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <span>{locale === 'bn' ? 'ফিচার এক্সেস ম্যাট্রিক্স (Role × Feature)' : 'Feature Access Matrix (Roles × Capabilities)'}</span>
          </CardTitle>
          <CardDescription className="text-xs">
            {locale === 'bn'
              ? 'যেকোনো রোলের ঘরে ক্লিক করে তৎক্ষণাৎ ফিচার চালু বা বন্ধ করুন।'
              : 'Click on any role cell to toggle access. Changes invalidate permission caches instantly.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs">{locale === 'bn' ? 'ম্যাট্রিক্স লোড হচ্ছে...' : 'Loading matrix...'}</span>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-y border-border bg-muted/40">
                  <th className="py-3 px-4 font-bold text-foreground w-[280px]">
                    {locale === 'bn' ? 'ফিচার ও বিবরণ' : 'Feature & Capability'}
                  </th>
                  {ALL_ROLES.map((r) => (
                    <th key={r.key} className="py-3 px-2 font-bold text-center text-foreground">
                      <div>{locale === 'bn' ? r.bn : r.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono font-normal">{r.key}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {categories.map((cat) => {
                  const catFeatures = features.filter((f) => f.category === cat);
                  return (
                    <React.Fragment key={cat}>
                      <tr className="bg-muted/60 font-bold text-[11px] text-muted-foreground uppercase tracking-wider">
                        <td colSpan={ALL_ROLES.length + 1} className="py-1.5 px-4">
                          {cat}
                        </td>
                      </tr>
                      {catFeatures.map((f) => (
                        <tr key={f.key} className="hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-4">
                            <div className="font-mono font-semibold text-foreground text-xs">{f.key}</div>
                            <div className="text-[11px] text-muted-foreground line-clamp-1">{f.description}</div>
                          </td>
                          {ALL_ROLES.map((r) => {
                            const enabled = isEnabled(r.key, f.key);
                            const keyId = `${r.key}:${f.key}`;
                            const isSaving = savingKey === keyId;

                            return (
                              <td key={r.key} className="py-2.5 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleRoleFeature(r.key, f.key, enabled)}
                                  disabled={isSaving}
                                  className={`w-7 h-7 rounded-md inline-flex items-center justify-center transition-all ${
                                    enabled
                                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30'
                                      : 'bg-muted/60 text-muted-foreground hover:bg-muted border border-border/60'
                                  }`}
                                  title={`${r.label}: ${f.key} (${enabled ? 'Enabled' : 'Disabled'})`}
                                >
                                  {isSaving ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : enabled ? (
                                    <Check className="w-3.5 h-3.5" />
                                  ) : (
                                    <X className="w-3.5 h-3.5 opacity-50" />
                                  )}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Active User Overrides Section */}
      <Card className="border-border bg-card shadow-2xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" />
            <span>{locale === 'bn' ? 'সক্রিয় ইউজার ওভাররাইড সমূহ' : 'Active User Feature Overrides'}</span>
          </CardTitle>
          <CardDescription className="text-xs">
            {locale === 'bn'
              ? 'নির্দিষ্ট কোনো চিকিৎসকের বিশেষ অ্যাক্সেস বা সাময়িক পরীক্ষামূলক পারমিশন।'
              : 'User-specific overrides that take precedence over default role permissions.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {overrides.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              {locale === 'bn' ? 'বর্তমানে কোনো ব্যক্তিগত ইউজার ওভাররাইড নেই।' : 'No individual user overrides currently configured.'}
            </p>
          ) : (
            <div className="space-y-2">
              {overrides.map((ov) => {
                const isExpired = ov.expiresAt && new Date(ov.expiresAt) <= new Date();
                return (
                  <div
                    key={ov.id}
                    className="p-3 rounded-lg border border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{ov.userName || 'User'}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{ov.userEmail}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-mono uppercase bg-muted">
                          {ov.userRole}
                        </span>
                        {ov.enabled ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                            ENABLED
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-destructive/15 text-destructive">
                            DISABLED
                          </span>
                        )}
                        {isExpired && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                            EXPIRED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span className="text-primary font-semibold">{ov.featureKey}</span>
                        {ov.dailyLimit && <span>Limit: {ov.dailyLimit}/day</span>}
                        {ov.expiresAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>Exp: {new Date(ov.expiresAt).toLocaleDateString()}</span>
                          </span>
                        )}
                      </div>
                      {ov.reason && <p className="text-[11px] text-muted-foreground italic">&ldquo;{ov.reason}&rdquo;</p>}
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveOverride(ov.id)}
                      className="text-destructive hover:bg-destructive/10 self-start sm:self-auto h-8 px-2 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      <span>{locale === 'bn' ? 'বাতিল' : 'Revoke'}</span>
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
