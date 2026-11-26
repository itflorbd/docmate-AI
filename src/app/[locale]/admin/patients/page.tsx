'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { genderLabel } from '@/lib/labels';
import { useLocale } from 'next-intl';
import {
  Users,
  Search,
  AlertTriangle,
  GitMerge,
  CheckCircle2,
  Phone,
  User,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ProfileMeta {
  id: string;
  accountId: string;
  name: string;
  phoneMasked: string;
  phoneRaw: string;
  relation: string;
  age: number;
  gender: string;
  bloodGroup: string | null;
  claimed: boolean;
  createdAt: string;
}

interface AccountMeta {
  id: string;
  phoneMasked: string;
  profileCount: number;
  createdAt: string;
}

interface DuplicateCandidate {
  profileA: ProfileMeta;
  profileB: ProfileMeta;
  confidence: string;
  reason: string;
}

export default function AdminPatientGovernancePage() {
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountMeta[]>([]);
  const [profiles, setProfiles] = useState<ProfileMeta[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Merge modal state
  const [mergeTarget, setMergeTarget] = useState<DuplicateCandidate | null>(null);
  const [canonicalId, setCanonicalId] = useState<string>('');
  const [duplicateId, setDuplicateId] = useState<string>('');
  const [justification, setJustification] = useState('');
  const [merging, setMerging] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/patients', { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to fetch patient governance data');
      const data = await res.json();
      setAccounts(data.accounts || []);
      setProfiles(data.profiles || []);
      setDuplicates(data.duplicateCandidates || []);
    } catch (err: unknown) {
      console.error(err);
      toast.error(isBn ? 'তথ্য লোড করতে ব্যর্থ' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [isBn]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch('/api/admin/patients', { credentials: 'same-origin' });
        if (!res.ok) throw new Error('Failed to fetch patient governance data');
        const data = await res.json();
        if (!mounted) return;
        setAccounts(data.accounts || []);
        setProfiles(data.profiles || []);
        setDuplicates(data.duplicateCandidates || []);
      } catch (err: unknown) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const openMergeModal = (candidate: DuplicateCandidate) => {
    setMergeTarget(candidate);
    setCanonicalId(candidate.profileA.id);
    setDuplicateId(candidate.profileB.id);
    setJustification('');
  };

  const handleExecuteMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!justification.trim() || justification.trim().length < 5) {
      toast.error(isBn ? 'কমপক্ষে ৫ অক্ষরের লিখিত কারণ আবশ্যক' : 'Written justification is required');
      return;
    }
    try {
      setMerging(true);
      const res = await fetch('/api/admin/patients/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalProfileId: canonicalId,
          duplicateProfileId: duplicateId,
          justification: justification.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(isBn ? 'প্রোফাইল সফলভাবে মার্জ করা হয়েছে' : 'Profiles merged successfully');
        setMergeTarget(null);
        fetchData();
      } else {
        toast.error(data.error || 'Merge failed');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setMerging(false);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.phoneMasked.includes(q) ||
      p.relation.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="p-12 text-center text-muted-foreground animate-pulse text-sm">
        {isBn ? 'রোগী ও অ্যাকাউন্ট তথ্য লোড হচ্ছে...' : 'Loading patient accounts and duplicate queue...'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            <span>{isBn ? 'রোগী ও অ্যাকাউন্ট গভর্ন্যান্স' : 'Patient Account Governance'}</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {isBn
              ? 'রোগী অ্যাকাউন্ট মেটাডাটা, ডুপ্লিকেট সনাক্তকরণ এবং নন-ডেস্ট্রাক্টিভ মার্জ টুল'
              : 'Metadata overview, duplicate review queue, and non-destructive merge tools'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground block">
              {isBn ? 'মোট রোগী ফোন অ্যাকাউন্ট' : 'Total Phone Accounts'}
            </span>
            <span className="text-2xl font-bold text-foreground">{accounts.length}</span>
            <span className="text-[11px] text-muted-foreground block">E.164 verified</span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-semibold text-muted-foreground block">
              {isBn ? 'মোট রোগী প্রোফাইল' : 'Total Patient Profiles'}
            </span>
            <span className="text-2xl font-bold text-foreground">{profiles.length}</span>
            <span className="text-[11px] text-muted-foreground block">Dependents & family</span>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 space-y-1">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 block">
              {isBn ? 'ডুপ্লিকেট পর্যালোচনা কিউ' : 'Duplicate Review Queue'}
            </span>
            <span className="text-2xl font-bold text-amber-600">{duplicates.length}</span>
            <span className="text-[11px] text-muted-foreground block">Potential duplicate pairs</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="duplicates" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="duplicates" className="text-xs font-semibold gap-1.5">
            <GitMerge className="w-3.5 h-3.5" />
            <span>{isBn ? `ডুপ্লিকেট রিভিউ (${duplicates.length})` : `Duplicates (${duplicates.length})`}</span>
          </TabsTrigger>
          <TabsTrigger value="profiles" className="text-xs font-semibold gap-1.5">
            <User className="w-3.5 h-3.5" />
            <span>{isBn ? `প্রোফাইল মেটাডাটা (${profiles.length})` : `Profiles (${profiles.length})`}</span>
          </TabsTrigger>
          <TabsTrigger value="accounts" className="text-xs font-semibold gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            <span>{isBn ? `ফোন অ্যাকাউন্ট (${accounts.length})` : `Accounts (${accounts.length})`}</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Duplicate Review Queue */}
        <TabsContent value="duplicates" className="space-y-4">
          {duplicates.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <CardContent className="p-0 text-sm text-muted-foreground space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <p className="font-semibold text-foreground">
                  {isBn ? 'কোনো ডুপ্লিকেট প্রোফাইল সনাক্ত হয়নি' : 'No duplicate profile candidates found'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isBn ? 'সমস্ত রোগীর নাম ও অ্যাকাউন্ট যথাযথভাবে আলাদা রয়েছে।' : 'All patient profiles are clean and unique.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {duplicates.map((item, idx) => (
                <Card key={idx} className="border-border bg-card shadow-xs">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="font-bold text-sm text-foreground">{item.reason}</span>
                      </div>
                      <Badge variant="outline" className="text-[11px] border-amber-500 text-amber-700 dark:text-amber-400">
                        {item.confidence}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* Profile A */}
                      <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="font-bold text-foreground text-sm">{item.profileA.name}</strong>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.profileA.relation}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {isBn ? 'বয়স:' : 'Age:'} {item.profileA.age} • {isBn ? 'লিঙ্গ:' : 'Gender:'} {item.profileA.gender}
                        </p>
                        <p className="text-muted-foreground font-mono">
                          {isBn ? 'ফোন:' : 'Phone:'} {item.profileA.phoneMasked}
                        </p>
                      </div>

                      {/* Profile B */}
                      <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="font-bold text-foreground text-sm">{item.profileB.name}</strong>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.profileB.relation}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">
                          {isBn ? 'বয়স:' : 'Age:'} {item.profileB.age} • {isBn ? 'লিঙ্গ:' : 'Gender:'} {item.profileB.gender}
                        </p>
                        <p className="text-muted-foreground font-mono">
                          {isBn ? 'ফোন:' : 'Phone:'} {item.profileB.phoneMasked}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-1">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openMergeModal(item)}
                        className="text-xs h-8 px-3 font-semibold gap-1.5 bg-primary text-primary-foreground"
                      >
                        <GitMerge className="w-3.5 h-3.5" />
                        <span>{isBn ? 'প্রোফাইল দুটি মার্জ করুন' : 'Merge Profiles'}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: Profiles Metadata List (Strictly No PHI) */}
        <TabsContent value="profiles" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder={isBn ? 'নাম বা ফোন দিয়ে খুঁজুন...' : 'Search by name or phone...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {filteredProfiles.length} {isBn ? 'টি প্রোফাইল' : 'profiles'}
            </span>
          </div>

          <Card className="border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">রোগীর নাম (Name)</th>
                    <th className="p-3">ফোন (Phone)</th>
                    <th className="p-3">সম্পর্ক (Relation)</th>
                    <th className="p-3">বয়স (Age)</th>
                    <th className="p-3">লিঙ্গ (Gender)</th>
                    <th className="p-3">নিবন্ধন তারিখ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredProfiles.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="p-3 font-semibold text-foreground">{p.name}</td>
                      <td className="p-3 font-mono text-muted-foreground">{p.phoneMasked}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">
                          {p.relation}
                        </Badge>
                      </td>
                      <td className="p-3">{p.age}</td>
                      <td className="p-3">{genderLabel(p.gender, locale)}</td>
                      <td className="p-3 text-muted-foreground font-mono">
                        {new Date(p.createdAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Phone Accounts Overview */}
        <TabsContent value="accounts" className="space-y-4">
          <Card className="border-border">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-3">অ্যাকাউন্ট আইডি</th>
                    <th className="p-3">ফোন নম্বর (Masked)</th>
                    <th className="p-3">প্রোফাইল সংখ্যা</th>
                    <th className="p-3">অ্যাকাউন্ট তৈরির তারিখ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {accounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {acc.id.slice(0, 8)}...
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground">
                        {acc.phoneMasked}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-xs">
                          {acc.profileCount} {isBn ? 'টি প্রোফাইল' : 'profiles'}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">
                        {new Date(acc.createdAt).toLocaleDateString(isBn ? 'bn-BD' : 'en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Non-Destructive Profile Merge Dialog */}
      <Dialog open={Boolean(mergeTarget)} onOpenChange={(open) => { if (!open) setMergeTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitMerge className="w-5 h-5 text-primary" />
              <span>{isBn ? 'প্রোফাইল মার্জ নিশ্চিতকরণ' : 'Confirm Profile Merge'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isBn
                ? 'ডুপ্লিকেট প্রোফাইলের সমস্ত রেকর্ড ক্যানোনিক্যাল প্রোফাইলে স্থানান্তরিত হবে। কোনো ক্লিনিকাল ডেটা মোছা হবে না।'
                : 'All clinical records will be reassigned to the canonical profile without deleting data.'}
            </DialogDescription>
          </DialogHeader>
          {mergeTarget && (
            <form onSubmit={handleExecuteMerge} className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground block">
                  {isBn ? 'মূল (ক্যানোনিক্যাল) প্রোফাইল নির্বাচন করুন:' : 'Select Canonical Profile:'}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCanonicalId(mergeTarget.profileA.id);
                      setDuplicateId(mergeTarget.profileB.id);
                    }}
                    className={`p-3 rounded-lg border text-left text-xs space-y-1 transition-all ${
                      canonicalId === mergeTarget.profileA.id
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border bg-muted/40'
                    }`}
                  >
                    <strong className="block font-bold text-foreground">{mergeTarget.profileA.name}</strong>
                    <span className="text-muted-foreground block">{mergeTarget.profileA.phoneMasked}</span>
                    <span className="text-[10px] text-muted-foreground block">Age: {mergeTarget.profileA.age} ({mergeTarget.profileA.relation})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCanonicalId(mergeTarget.profileB.id);
                      setDuplicateId(mergeTarget.profileA.id);
                    }}
                    className={`p-3 rounded-lg border text-left text-xs space-y-1 transition-all ${
                      canonicalId === mergeTarget.profileB.id
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border bg-muted/40'
                    }`}
                  >
                    <strong className="block font-bold text-foreground">{mergeTarget.profileB.name}</strong>
                    <span className="text-muted-foreground block">{mergeTarget.profileB.phoneMasked}</span>
                    <span className="text-[10px] text-muted-foreground block">Age: {mergeTarget.profileB.age} ({mergeTarget.profileB.relation})</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground block">
                  {isBn ? 'মার্জ করার লিখিত কারণ / অডিট জাস্টিফিকেশন *' : 'Written Clinical / Admin Justification *'}
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder={isBn ? 'যেমন: একই রোগীর দুটি প্রোফাইল তৈরি হয়েছিল, প্রেসক্রিপশন ও ভিজিট একত্রিত করা হলো' : 'e.g. Duplicate account created for same patient'}
                  rows={3}
                  required
                  className="w-full text-xs p-2.5 rounded-md border border-border bg-background text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="outline" size="sm" onClick={() => setMergeTarget(null)}>
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button type="submit" size="sm" disabled={merging}>
                  {merging ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      <span>{isBn ? 'মার্জ হচ্ছে...' : 'Merging...'}</span>
                    </>
                  ) : (
                    <span>{isBn ? 'মার্জ নিশ্চিত করুন' : 'Confirm Merge'}</span>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
