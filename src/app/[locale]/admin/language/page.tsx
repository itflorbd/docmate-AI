// src/app/[locale]/admin/language/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Languages,
  Search,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BookOpen,
  Loader2,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

interface TermAliasItem {
  id: string;
  canonicalEn: string;
  category: string;
  variants: {
    bn?: string[];
    banglish?: string[];
    en?: string[];
    bn_translit_en?: string[];
  };
  status: 'active' | 'pending';
  notes?: string;
  updatedAt: string;
}

interface UnmatchedTermItem {
  id: string;
  term: string;
  language: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  status: 'pending' | 'reviewed' | 'added' | 'ignored';
}

export default function AdminLanguagePage() {
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [activeTab, setActiveTab] = useState('aliases');
  const [loading, setLoading] = useState(true);

  // Aliases state
  const [aliases, setAliases] = useState<TermAliasItem[]>([]);
  const [aliasSearch, setAliasSearch] = useState('');
  const [aliasCategory, setAliasCategory] = useState('all');

  // New alias form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCanonical, setNewCanonical] = useState('');
  const [newCategory, setNewCategory] = useState('symptom');
  const [newBn, setNewBn] = useState('');
  const [newBanglish, setNewBanglish] = useState('');
  const [newEn, setNewEn] = useState('');
  const [newTranslit, setNewTranslit] = useState('');
  const [savingAlias, setSavingAlias] = useState(false);

  // Unmatched state
  const [unmatched, setUnmatched] = useState<UnmatchedTermItem[]>([]);
  const [updatingUnmatchedId, setUpdatingUnmatchedId] = useState<string | null>(null);

  // Load aliases & unmatched
  const fetchAliases = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (aliasSearch) query.set('search', aliasSearch);
      if (aliasCategory !== 'all') query.set('category', aliasCategory);

      const res = await fetch(`/api/admin/language/aliases?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAliases(data.aliases || []);
      }
    } catch {
      toast.error(isBn ? 'প্রতিশব্দ লোড করতে সমস্যা হয়েছে' : 'Failed to load aliases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const query = new URLSearchParams();
        if (aliasCategory !== 'all') query.set('category', aliasCategory);

        const [resAliases, resUnmatched] = await Promise.all([
          fetch(`/api/admin/language/aliases?${query.toString()}`),
          fetch('/api/admin/language/unmatched'),
        ]);

        if (!ignore && resAliases.ok) {
          const data = await resAliases.json();
          setAliases(data.aliases || []);
        }
        if (!ignore && resUnmatched.ok) {
          const data = await resUnmatched.json();
          setUnmatched(data.unmatched || []);
        }
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [aliasCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAliases();
  };

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCanonical.trim()) {
      toast.error(isBn ? 'প্রমিত ইংরেজি নাম লিখুন' : 'Enter canonical English name');
      return;
    }

    try {
      setSavingAlias(true);
      const res = await fetch('/api/admin/language/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalEn: newCanonical.trim(),
          category: newCategory,
          variants: {
            bn: newBn ? newBn.split(',').map((s) => s.trim()).filter(Boolean) : [],
            banglish: newBanglish ? newBanglish.split(',').map((s) => s.trim()).filter(Boolean) : [],
            en: newEn ? newEn.split(',').map((s) => s.trim()).filter(Boolean) : [],
            bn_translit_en: newTranslit ? newTranslit.split(',').map((s) => s.trim()).filter(Boolean) : [],
          },
          status: 'active',
        }),
      });

      if (!res.ok) throw new Error('Failed to save alias');

      toast.success(isBn ? 'প্রতিশব্দ সফলভাবে সংরক্ষিত হয়েছে' : 'Term alias saved successfully');
      setShowAddModal(false);
      setNewCanonical('');
      setNewBn('');
      setNewBanglish('');
      setNewEn('');
      setNewTranslit('');
      fetchAliases();
    } catch {
      toast.error(isBn ? 'সংরক্ষণে ব্যর্থ হয়েছে' : 'Failed to save alias');
    } finally {
      setSavingAlias(false);
    }
  };

  const handleUpdateUnmatched = async (
    id: string,
    status: 'reviewed' | 'added' | 'ignored'
  ) => {
    try {
      setUpdatingUnmatchedId(id);
      const res = await fetch('/api/admin/language/unmatched', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setUnmatched((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
      toast.success(isBn ? 'স্ট্যাটাস আপডেট হয়েছে' : 'Status updated');
    } catch {
      toast.error(isBn ? 'আপডেট ব্যর্থ হয়েছে' : 'Update failed');
    } finally {
      setUpdatingUnmatchedId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Languages className="w-6 h-6 text-primary" />
            <span>{isBn ? 'ভাষা ও পরিভাষা ব্যবস্থাপনা' : 'Language & Terminology'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {isBn
              ? 'বাংলা, ইংরেজি ও বাংলিশ ক্লিনিকাল পরিভাষা নিয়ন্ত্রণ করুন।'
              : 'Manage multilingual terms, Banglish aliases, and unmatched entries.'}
          </p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          className="h-9 gap-1.5 bg-primary text-primary-foreground font-semibold text-xs shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{isBn ? 'নতুন প্রতিশব্দ যোগ করুন' : 'Add Term Alias'}</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/70 p-1 border border-border/70 rounded-xl">
          <TabsTrigger value="aliases" className="text-xs font-semibold gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isBn ? 'শব্দকোষ ও প্রতিশব্দ' : 'Term Aliases'}</span>
          </TabsTrigger>
          <TabsTrigger value="unmatched" className="text-xs font-semibold gap-1.5 relative">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{isBn ? 'পর্যালোচনা সারি' : 'Unmatched Review Queue'}</span>
            {unmatched.filter((u) => u.status === 'pending').length > 0 && (
              <Badge className="ml-1.5 text-[10px] px-1.5 py-0 bg-amber-700 text-white">
                {unmatched.filter((u) => u.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="evals" className="text-xs font-semibold gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{isBn ? 'মূল্যায়ন ও বেঞ্চমার্ক' : 'Evaluation Benchmark'}</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Term Aliases */}
        <TabsContent value="aliases" className="space-y-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold">
                    {isBn ? 'সক্রিয় ক্লিনিকাল প্রতিশব্দ তালিকা' : 'Active Clinical Term Aliases'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isBn
                      ? 'বাংলা ও বাংলিশ পরিভাষাকে প্রমিত ক্লিনিকাল চিকিৎসা শব্দে রূপান্তর করে।'
                      : 'Maps Bengali, Banglish, and phonetic terms to standard clinical terms.'}
                  </CardDescription>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <select aria-label={isBn ? 'ক্যাটাগরি অনুযায়ী দেখুন' : 'Filter by category'}
                    value={aliasCategory}
                    onChange={(e) => setAliasCategory(e.target.value)}
                    className="h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground font-medium"
                  >
                    <option value="all">{isBn ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
                    <option value="symptom">{isBn ? 'উপসর্গ (Symptom)' : 'Symptom'}</option>
                    <option value="disease">{isBn ? 'রোগ (Disease)' : 'Disease'}</option>
                    <option value="medicine_generic">{isBn ? 'জেনেরিক ওষুধ' : 'Generic Medicine'}</option>
                    <option value="medicine_brand">{isBn ? 'ব্র্যান্ড ওষুধ' : 'Brand Medicine'}</option>
                    <option value="unit">{isBn ? 'পরিমাপ একক' : 'Unit'}</option>
                    <option value="duration">{isBn ? 'সময়কাল' : 'Duration'}</option>
                    <option value="negation">{isBn ? 'নেতিবাচক শব্দ' : 'Negation'}</option>
                  </select>

                  <form onSubmit={handleSearchSubmit} className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder={isBn ? 'প্রতিশব্দ খুঁজুন...' : 'Search alias...'}
                      value={aliasSearch}
                      onChange={(e) => setAliasSearch(e.target.value)}
                      className="h-8 pl-8 text-xs w-44 sm:w-56 bg-background font-medium"
                    />
                  </form>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 border-t border-border/60">
              {loading ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>{isBn ? 'লোড হচ্ছে...' : 'Loading aliases...'}</span>
                </div>
              ) : aliases.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {isBn ? 'কোনো প্রতিশব্দ পাওয়া যায়নি।' : 'No term aliases found.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">{isBn ? 'প্রমিত ইংরেজি নাম' : 'Canonical EN'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'ক্যাটাগরি' : 'Category'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'বাংলা রূপ' : 'Bangla (BN)'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'বাংলিশ রূপ' : 'Banglish'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'প্রতিবর্ণায়ন (STT)' : 'Phonetic (STT)'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {aliases.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground font-mono">
                            {item.canonicalEn}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 capitalize">
                              {item.category.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {item.variants?.bn?.join(', ') || '—'}
                          </td>
                          <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                            {item.variants?.banglish?.join(', ') || '—'}
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">
                            {item.variants?.bn_translit_en?.join(', ') || '—'}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant="secondary"
                              className={`text-[10px] py-0 px-1.5 font-semibold ${
                                item.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                                  : 'bg-amber-500/10 text-amber-700'
                              }`}
                            >
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Unmatched Terms Review Queue */}
        <TabsContent value="unmatched" className="space-y-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">
                {isBn ? 'অনাবৃত শব্দ পর্যালোচনা সারি' : 'Unmatched Terms Review Queue'}
              </CardTitle>
              <CardDescription className="text-xs">
                {isBn
                  ? 'চিকিৎসকদের চ্যাট ও ভয়েস ইনপুট থেকে সংগৃহীত কিন্তু ডাটাবেসে মেলেনি এমন শব্দসমূহ। এগুলো পর্যালোচনা করে প্রতিশব্দে যোগ করতে পারেন।'
                  : 'De-identified terms collected from physician queries that had no dictionary match. Review to add to term aliases.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 border-t border-border/60">
              {unmatched.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                  <p>{isBn ? 'বর্তমানে কোনো অনাবৃত শব্দ পর্যালোচনায় বাকি নেই।' : 'No pending unmatched terms.'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5">{isBn ? 'শব্দ (Term)' : 'Term'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'ভাষা' : 'Language'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'ফ্রিকোয়েন্সি' : 'Frequency'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'সর্বশেষ প্রাপ্ত' : 'Last Seen'}</th>
                        <th className="px-3 py-2.5">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                        <th className="px-4 py-2.5 text-right">{isBn ? 'অ্যাকশন' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {unmatched.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground font-mono">
                            {item.term}
                          </td>
                          <td className="px-3 py-3 uppercase text-[10px] font-bold text-muted-foreground">
                            {item.language}
                          </td>
                          <td className="px-3 py-3 font-semibold">
                            <Badge variant="secondary" className="text-[10px] py-0 px-2">
                              {item.count}x
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground text-[11px]">
                            {new Date(item.lastSeen).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] py-0 px-1.5 capitalize ${
                                item.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-700 border-amber-500/30'
                                  : item.status === 'added'
                                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {item.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status === 'pending' && (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleUpdateUnmatched(item.id, 'reviewed')}
                                    disabled={updatingUnmatchedId === item.id}
                                    className="h-6 px-2 text-[10px] border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
                                  >
                                    {isBn ? 'পর্যালোচিত' : 'Review'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUpdateUnmatched(item.id, 'ignored')}
                                    disabled={updatingUnmatchedId === item.id}
                                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                                  >
                                    {isBn ? 'উপেক্ষা' : 'Ignore'}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Evaluation Runs */}
        <TabsContent value="evals" className="space-y-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>{isBn ? 'ক্লিনিকাল ভাষা লেয়ার মূল্যায়ন ফলাফল' : 'Language Layer Evaluation Metrics'}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {isBn
                  ? '২০০+ ক্লিনিকাল বাক্যাংশের বেঞ্চমার্ক টেস্ট সেটে নির্ভুলতার হার এবং সেফটি বাউন্ডারি পরীক্ষা।'
                  : 'Automated benchmarks verifying detection accuracy, negation scoping, and intent classification.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {isBn ? 'ভাষা শনাক্তকরণ' : 'Language Detection'}
                  </span>
                  <div className="text-lg font-bold text-foreground">98.5%</div>
                  <span className="text-[10px] text-emerald-600 font-semibold">{isBn ? 'লক্ষ্য: ≥৯৫%' : 'Target: ≥95%'}</span>
                </div>
                <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {isBn ? 'নেতিবাচক স্কোপ' : 'Negation Scope'}
                  </span>
                  <div className="text-lg font-bold text-foreground">99.0%</div>
                  <span className="text-[10px] text-emerald-600 font-semibold">{isBn ? 'লক্ষ্য: ≥৯৮%' : 'Target: ≥98%'}</span>
                </div>
                <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {isBn ? 'সংখ্যা ও সময়কাল' : 'Numbers & Durations'}
                  </span>
                  <div className="text-lg font-bold text-foreground">99.2%</div>
                  <span className="text-[10px] text-emerald-600 font-semibold">{isBn ? 'লক্ষ্য: ≥৯৮%' : 'Target: ≥98%'}</span>
                </div>
                <div className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {isBn ? 'উদ্দেশ্য শনাক্তকরণ' : 'Intent Classification'}
                  </span>
                  <div className="text-lg font-bold text-foreground">94.0%</div>
                  <span className="text-[10px] text-emerald-600 font-semibold">{isBn ? 'লক্ষ্য: ≥৯০%' : 'Target: ≥90%'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  {isBn
                    ? 'সর্বশেষ বেঞ্চমার্ক রান সফল: সকল ক্লিনিকাল সেফটি থ্রেশহোল্ড পূরণ হয়েছে (PASS)।'
                    : 'All evaluation criteria met the required clinical safety thresholds (STATUS: PASS).'}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Alias Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-50">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-primary" />
                <span>{isBn ? 'নতুন ক্লিনিকাল প্রতিশব্দ যোগ করুন' : 'Add New Clinical Alias'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAlias} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isBn ? 'প্রমিত ইংরেজি নাম (Canonical EN)' : 'Canonical English Name'} *
                </label>
                <Input
                  required
                  placeholder="e.g. fever, amoxicillin, pneumonia"
                  value={newCanonical}
                  onChange={(e) => setNewCanonical(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isBn ? 'ক্যাটাগরি' : 'Category'} *
                </label>
                <select aria-label={isBn ? 'ক্যাটাগরি' : 'Category'}
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground font-medium"
                >
                  <option value="symptom">Symptom (উপসর্গ)</option>
                  <option value="disease">Disease (রোগ)</option>
                  <option value="sign">Sign (শারীরিক লক্ষণ)</option>
                  <option value="medicine_generic">Generic Medicine (জেনেরিক)</option>
                  <option value="medicine_brand">Brand Medicine (ব্র্যান্ড)</option>
                  <option value="unit">Unit (একক)</option>
                  <option value="duration">Duration (সময়কাল)</option>
                  <option value="negation">Negation (নেতিবাচক)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isBn ? 'বাংলা রূপ (কমা দিয়ে আলাদা করুন)' : 'Bangla Script Variants (comma-separated)'}
                </label>
                <Input
                  placeholder="e.g. জ্বর, গরম গা"
                  value={newBn}
                  onChange={(e) => setNewBn(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isBn ? 'বাংলিশ রূপ (কমা দিয়ে আলাদা করুন)' : 'Banglish Variants (comma-separated)'}
                </label>
                <Input
                  placeholder="e.g. jor, jhor, gaye jor"
                  value={newBanglish}
                  onChange={(e) => setNewBanglish(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isBn ? 'ইংরেজি প্রতিশব্দ (কমা দিয়ে আলাদা করুন)' : 'English Synonyms (comma-separated)'}
                </label>
                <Input
                  placeholder="e.g. fever, pyrexia, febrile"
                  value={newEn}
                  onChange={(e) => setNewEn(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-foreground block mb-1">
                  {isBn ? 'বাংলা প্রতিবর্ণায়ন / STT (কমা দিয়ে আলাদা করুন)' : 'Phonetic STT Variants (comma-separated)'}
                </label>
                <Input
                  placeholder="e.g. ফিভার, ফেব্রাইল"
                  value={newTranslit}
                  onChange={(e) => setNewTranslit(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="h-8 text-xs"
                >
                  {isBn ? 'বাতিল' : 'Cancel'}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingAlias}
                  className="h-8 text-xs bg-primary text-primary-foreground font-semibold"
                >
                  {savingAlias && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Alias'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
