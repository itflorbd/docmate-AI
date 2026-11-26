'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Pill,
  ShieldCheck,
  AlertTriangle,
  UploadCloud,
  Search,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  Plus,
  BellRing,
  Users2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface MedicineBrand {
  id: string;
  brandName: string;
  genericName: string;
  manufacturer: string;
  form: string;
  strength: string;
  packSize: string;
  priceBdt: string;
  dgdaRegNum: string | null;
  status: 'pending' | 'partially_approved' | 'approved' | 'rejected';
  createdAt: string;
}

interface SafetyNotice {
  id: string;
  title: string;
  severity: 'critical_recall' | 'warning' | 'info';
  body: string;
  affectedBatches: string[];
  publishedAt: string;
}

interface ValidCsvRecord {
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  form: string;
  strength: string;
  pack_size: string;
  price_bdt: number;
  dgda_reg_num: string;
}

export default function ControllerPage() {
  const locale = useLocale();
  const isBn = locale === 'bn';

  const [activeTab, setActiveTab] = useState<'formulary' | 'review_queue' | 'csv_import' | 'safety_notices'>('formulary');
  const [medicines, setMedicines] = useState<MedicineBrand[]>([]);
  const [notices, setNotices] = useState<SafetyNotice[]>([]);
  const [search, setSearch] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [twoPersonEnabled, setTwoPersonEnabled] = useState(false);
  const [isTogglingTwoPerson, setIsTogglingTwoPerson] = useState(false);

  // New Brand Modal Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBrand, setNewBrand] = useState({
    brandName: '',
    genericName: '',
    manufacturer: 'Square Pharmaceuticals PLC',
    form: 'Tab',
    strength: '500 mg',
    packSize: '10x10',
    priceBdt: 5.0,
    dgdaRegNum: '',
  });

  // Rejection Dialog State
  const [rejectingMedId, setRejectingMedId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // CSV Import State
  const [csvText, setCsvText] = useState('');
  const [csvPreview, setCsvPreview] = useState<{
    validRecords: ValidCsvRecord[];
    errors: { row: number; error: string }[];
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Safety Notice Composer State
  const [newNotice, setNewNotice] = useState({
    title: '',
    severity: 'warning' as 'critical_recall' | 'warning' | 'info',
    batches: '',
    body: '',
  });
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!active) return;
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (manufacturerFilter !== 'all') params.set('manufacturer', manufacturerFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      fetch(`/api/controller/medicines?${params.toString()}`)
        .then((res) => (res.ok ? res.json() : { medicines: [] }))
        .then((data) => {
          if (active) setMedicines(data.medicines || []);
        })
        .catch(() => {});

      fetch('/api/controller/notices')
        .then((res) => (res.ok ? res.json() : { notices: [] }))
        .then((data) => {
          if (active) setNotices(data.notices || []);
        })
        .catch(() => {});

      fetch('/api/controller/settings')
        .then((res) => (res.ok ? res.json() : {}))
        .then((data: { twoPersonReviewEnabled?: boolean }) => {
          if (active && data.twoPersonReviewEnabled !== undefined) {
            setTwoPersonEnabled(Boolean(data.twoPersonReviewEnabled));
          }
        })
        .catch(() => {});
    }, 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, manufacturerFilter, statusFilter]);

  const handleToggleTwoPerson = async () => {
    setIsTogglingTwoPerson(true);
    try {
      const nextVal = !twoPersonEnabled;
      const res = await fetch('/api/controller/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ twoPersonReviewEnabled: nextVal }),
      });
      if (res.ok) {
        setTwoPersonEnabled(nextVal);
        toast.success(
          isBn
            ? `দ্বৈত পর্যালোচনা এখন ${nextVal ? 'সক্রিয়' : 'নিষ্ক্রিয়'}`
            : `Two-person review is now ${nextVal ? 'Enabled' : 'Disabled'}`
        );
      } else {
        toast.error(isBn ? 'সেটিংস আপডেট ব্যর্থ' : 'Failed to update setting');
      }
    } catch {
      toast.error(isBn ? 'সার্ভার এরর' : 'Server error');
    } finally {
      setIsTogglingTwoPerson(false);
    }
  };

  const refreshMedicines = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (manufacturerFilter !== 'all') params.set('manufacturer', manufacturerFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);

    fetch(`/api/controller/medicines?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { medicines: [] }))
      .then((data) => setMedicines(data.medicines || []))
      .catch(() => {});
  };

  const refreshNotices = () => {
    fetch('/api/controller/notices')
      .then((res) => (res.ok ? res.json() : { notices: [] }))
      .then((data) => setNotices(data.notices || []))
      .catch(() => {});
  };

  const handleReviewAction = async (id: string, action: 'approve' | 'reject', reason?: string) => {
    try {
      const res = await fetch(`/api/controller/medicines/${id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || (isBn ? 'কার্যক্রম সফল' : 'Action successful'));
        setRejectingMedId(null);
        setRejectReason('');
        refreshMedicines();
      } else {
        toast.error(data.error || (isBn ? 'পর্যালোচনা ব্যর্থ' : 'Review action failed'));
      }
    } catch {
      toast.error(isBn ? 'অনুরোধ সম্পন্ন করা যায়নি' : 'Network error');
    }
  };

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/controller/medicines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBrand),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || (isBn ? 'নতুন ব্র্যান্ড যোগ হয়েছে' : 'New brand registered'));
        setShowAddModal(false);
        setNewBrand({
          brandName: '',
          genericName: '',
          manufacturer: 'Square Pharmaceuticals PLC',
          form: 'Tab',
          strength: '500 mg',
          packSize: '10x10',
          priceBdt: 5.0,
          dgdaRegNum: '',
        });
        refreshMedicines();
      } else {
        toast.error(data.error || (isBn ? 'যোগ করতে ব্যর্থ' : 'Failed to add brand'));
      }
    } catch {
      toast.error(isBn ? 'অনুরোধ ব্যর্থ' : 'Network error');
    }
  };

  const handleParseCsv = () => {
    if (!csvText.trim()) {
      toast.error(isBn ? 'সিএসভি টেক্সট লিখুন বা পেস্ট করুন' : 'Please paste CSV text');
      return;
    }

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      toast.error(isBn ? 'কমপক্ষে একটি হেডার এবং ডাটা রো প্রয়োজন' : 'Header and at least one row required');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const valid: ValidCsvRecord[] = [];
    const errors: { row: number; error: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = line.split(',').map((v) => v.trim());
      const rowNum = i + 1;

      const record: Record<string, string> = {};
      headers.forEach((h, idx) => {
        record[h] = values[idx] || '';
      });

      const brand = record['brand_name'] || record['brand'];
      const generic = record['generic_name'] || record['generic'];
      const mfg = record['manufacturer'] || record['company'];
      const strength = record['strength'];
      const price = parseFloat(record['price_bdt'] || record['price'] || '0');

      if (!brand) {
        errors.push({ row: rowNum, error: 'Missing Brand Name' });
        continue;
      }
      if (!generic) {
        errors.push({ row: rowNum, error: 'Missing Generic Name' });
        continue;
      }
      if (!mfg) {
        errors.push({ row: rowNum, error: 'Missing Manufacturer' });
        continue;
      }
      if (!strength) {
        errors.push({ row: rowNum, error: 'Missing Strength' });
        continue;
      }
      if (isNaN(price)) {
        errors.push({ row: rowNum, error: 'Invalid Price' });
        continue;
      }

      valid.push({
        brand_name: brand,
        generic_name: generic,
        manufacturer: mfg,
        form: record['form'] || 'Tab',
        strength,
        pack_size: record['pack_size'] || '10x10',
        price_bdt: price,
        dgda_reg_num: record['dgda_reg_num'] || record['reg_no'] || '',
      });
    }

    setCsvPreview({ validRecords: valid, errors });
    if (valid.length > 0) {
      toast.success(
        isBn
          ? `${valid.length} টি ভ্যালিড রেকর্ড প্রিভিউয়ের জন্য প্রস্তুত`
          : `${valid.length} valid records ready for import`
      );
    }
  };

  const handleCommitCsvImport = async () => {
    if (!csvPreview || csvPreview.validRecords.length === 0) return;

    setIsImporting(true);
    try {
      const res = await fetch('/api/controller/medicines/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: csvPreview.validRecords }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          isBn
            ? `${data.importedCount} টি ওষুধ ব্র্যান্ড সফলভাবে আমদানি হয়েছে`
            : `Successfully imported ${data.importedCount} medicine brands`
        );
        setCsvText('');
        setCsvPreview(null);
        refreshMedicines();
      } else {
        toast.error(data.error || (isBn ? 'আমদানি ব্যর্থ' : 'Import failed'));
      }
    } catch {
      toast.error(isBn ? 'অনুরোধ ব্যর্থ' : 'Network error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBroadcastNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotice.title || !newNotice.body) {
      toast.error(isBn ? 'শিরোনাম ও বিবরণ বাধ্যতামূলক' : 'Title and body are required');
      return;
    }

    setIsBroadcasting(true);
    try {
      const batches = newNotice.batches
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);

      const res = await fetch('/api/controller/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newNotice.title,
          severity: newNotice.severity,
          body: newNotice.body,
          affectedBatches: batches,
        }),
      });

      if (res.ok) {
        toast.success(isBn ? 'নিরাপত্তা নোটিশ জারি হয়েছে' : 'Safety notice broadcasted');
        setNewNotice({
          title: '',
          severity: 'warning',
          batches: '',
          body: '',
        });
        refreshNotices();
      } else {
        toast.error(isBn ? 'নোটিশ জারি ব্যর্থ' : 'Broadcast failed');
      }
    } catch {
      toast.error(isBn ? 'অনুরোধ ব্যর্থ' : 'Network error');
    } finally {
      setIsBroadcasting(false);
    }
  };

  const pendingQueue = medicines.filter(
    (m) => m.status === 'pending' || m.status === 'partially_approved'
  );

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <PageHeader
          title={isBn ? 'ডিজিডিএ ওষুধ নিয়ন্ত্রক' : 'DGDA Medicine Controller'}
          subtitle={
            isBn
              ? 'ওষুধের তালিকা, পর্যালোচনা ও প্রত্যাহার নোটিশ'
              : 'Medicine list, reviews and recall notices'
          }
          action={
            <div className="flex items-center gap-3 bg-card px-3 py-1.5 rounded-lg border border-border shadow-2xs">
              <Users2 className="w-4 h-4 text-muted-foreground" />
              <div className="text-xs">
                <span className="font-semibold text-foreground">
                  {isBn ? 'দ্বৈত পর্যালোচনা' : 'Two-Person Review'}:
                </span>{' '}
                <span className="text-muted-foreground">
                  {twoPersonEnabled ? (isBn ? 'সক্রিয়' : 'Active') : (isBn ? 'নিষ্ক্রিয়' : 'Disabled')}
                </span>
              </div>
              <Button
                size="sm"
                variant={twoPersonEnabled ? 'default' : 'outline'}
                className="text-xs h-7 px-2.5 ml-1"
                onClick={handleToggleTwoPerson}
                disabled={isTogglingTwoPerson}
              >
                {twoPersonEnabled ? (isBn ? 'সক্রিয়' : 'Enabled') : (isBn ? 'নিষ্ক্রিয়' : 'Disabled')}
              </Button>
            </div>
          }
        />

      {/* Top Stat Cards */}
      <div data-tour="controller-stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border border-border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">
              {isBn ? 'মোট নিবন্ধিত ব্র্যান্ড' : 'Total Registered Brands'}
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {medicines.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {isBn ? 'শীর্ষ কোম্পানি ও জেনেরিক' : 'Top Pharma & Generics'}
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">
              {isBn ? 'অনুমোদিত ও সক্রিয়' : 'Approved & Active'}
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {medicines.filter((m) => m.status === 'approved').length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {isBn ? 'চিকিৎসকদের প্রেসক্রিপশনে দৃশ্যমান' : 'Live in Prescription Pad'}
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">
              {isBn ? 'পর্যালোচনার অপেক্ষায়' : 'Pending Review'}
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {pendingQueue.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {isBn ? 'অনুমোদনের জন্য সারিভুক্ত' : 'Awaiting Regulatory Sign-off'}
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">
              {isBn ? 'সক্রিয় সুরক্ষা নোটিশ' : 'Active Safety Notices'}
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {notices.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {isBn ? 'প্রত্যাহার ও গুণগত সতর্কতা' : 'Recalls & Advisories'}
          </CardContent>
        </Card>
      </div>

      {/* Main Functional Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="formulary" data-tour="controller-formulary" className="py-2.5 text-xs sm:text-sm">
            <Pill className="w-4 h-4 mr-2" />
            {isBn ? 'অনুমোদিত ফর্মুলারি' : 'Formulary Database'}
          </TabsTrigger>
          <TabsTrigger value="review_queue" data-tour="controller-review" className="py-2.5 text-xs sm:text-sm relative">
            <ShieldCheck className="w-4 h-4 mr-2" />
            {isBn ? 'পর্যালোচনা সারি' : 'Review Queue'}
            {pendingQueue.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold">
                {pendingQueue.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="csv_import" className="py-2.5 text-xs sm:text-sm">
            <UploadCloud className="w-4 h-4 mr-2" />
            {isBn ? 'সিএসভি আমদানি' : 'CSV Bulk Import'}
          </TabsTrigger>
          <TabsTrigger value="safety_notices" data-tour="controller-notices" className="py-2.5 text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 mr-2" />
            {isBn ? 'সুরক্ষা ও প্রত্যাহার নোটিশ' : 'Safety Notices'}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: FORMULARY DATABASE */}
        <TabsContent value="formulary" className="space-y-4">
          <Card className="border border-border">
            <CardHeader className="p-4 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">
                  {isBn ? 'ডিজিডিএ নিবন্ধিত ওষুধ তালিকা' : 'DGDA Registered Medicine Formulary'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isBn
                    ? 'বাংলাদেশের শীর্ষস্থানীয় প্রস্তুতকারকদের অনুমোদিত ব্র্যান্ড ও জেনেরিক ডেটাবেজ'
                    : 'Authorized brands, strengths, and pricing from approved BD manufacturers'}
                </CardDescription>
              </div>
              <Button
                size="sm"
                className="text-xs"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {isBn ? 'নতুন ব্র্যান্ড প্রস্তাব করুন' : 'Propose New Brand'}
              </Button>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                  <Input
                    placeholder={
                      isBn
                        ? 'ব্র্যান্ড, জেনেরিক বা ডিজিডিএ রেজি নং দিয়ে খুঁজুন...'
                        : 'Search by brand, generic, or DGDA reg no...'
                    }
                    className="pl-9 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex gap-2">
                  <select aria-label={isBn ? 'প্রস্তুতকারক অনুযায়ী দেখুন' : 'Filter by manufacturer'}
                    className="h-10 px-3 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-background"
                    value={manufacturerFilter}
                    onChange={(e) => setManufacturerFilter(e.target.value)}
                  >
                    <option value="all">{isBn ? 'সকল প্রস্তুতকারক' : 'All Manufacturers'}</option>
                    <option value="Square">Square Pharmaceuticals</option>
                    <option value="Beximco">Beximco Pharmaceuticals</option>
                    <option value="Incepta">Incepta Pharmaceuticals</option>
                    <option value="Renata">Renata Limited</option>
                    <option value="Opsonin">Opsonin Pharma</option>
                    <option value="Eskayef">Eskayef (SK-F)</option>
                    <option value="ACME">The ACME Laboratories</option>
                    <option value="ACI">ACI Limited</option>
                    <option value="Aristopharma">Aristopharma Ltd.</option>
                    <option value="Gonoshasthaya">Gonoshasthaya</option>
                  </select>

                  <select aria-label={isBn ? 'স্ট্যাটাস অনুযায়ী দেখুন' : 'Filter by status'}
                    className="h-10 px-3 py-1.5 text-xs sm:text-sm rounded-md border border-border bg-background"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">{isBn ? 'সকল স্ট্যাটাস' : 'All Statuses'}</option>
                    <option value="approved">{isBn ? 'অনুমোদিত (Approved)' : 'Approved'}</option>
                    <option value="partially_approved">
                      {isBn ? 'আংশিক অনুমোদিত (Partially Approved)' : 'Partially Approved'}
                    </option>
                    <option value="pending">{isBn ? 'অপেক্ষমান (Pending)' : 'Pending'}</option>
                    <option value="rejected">{isBn ? 'প্রত্যাখ্যাত (Rejected)' : 'Rejected'}</option>
                  </select>
                </div>
              </div>

              {/* Medicines Table */}
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground">
                    <tr>
                      <th className="p-3 font-semibold">{isBn ? 'ব্র্যান্ড নাম' : 'Brand Name'}</th>
                      <th className="p-3 font-semibold">{isBn ? 'জেনেরিক' : 'Generic'}</th>
                      <th className="p-3 font-semibold">{isBn ? 'প্রস্তুতকারক' : 'Manufacturer'}</th>
                      <th className="p-3 font-semibold">{isBn ? 'ফর্ম ও শক্তি' : 'Form & Strength'}</th>
                      <th className="p-3 font-semibold">{isBn ? 'মূল্য (টাকা)' : 'Price (BDT)'}</th>
                      <th className="p-3 font-semibold">{isBn ? 'রেজি: নং' : 'DGDA Reg No'}</th>
                      <th className="p-3 font-semibold">{isBn ? 'স্ট্যাটাস' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {medicines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
                          {isBn ? 'কোনো ওষুধ পাওয়া যায়নি।' : 'No medicines found.'}
                        </td>
                      </tr>
                    ) : (
                      medicines.map((med) => (
                        <tr key={med.id} className="hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-semibold text-foreground">
                            {med.brandName}
                          </td>
                          <td className="p-3 text-muted-foreground">{med.genericName}</td>
                          <td className="p-3 text-muted-foreground">{med.manufacturer}</td>
                          <td className="p-3">
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">
                              {med.form} {med.strength}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-medium">৳ {med.priceBdt}</td>
                          <td className="p-3 text-muted-foreground font-mono text-xs">
                            {med.dgdaRegNum || '—'}
                          </td>
                          <td className="p-3">
                            {med.status === 'approved' && (
                              <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300">
                                {isBn ? 'অনুমোদিত' : 'Approved'}
                              </Badge>
                            )}
                            {med.status === 'partially_approved' && (
                              <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300">
                                {isBn ? '১ম ধাপ অনুমোদিত' : 'Stage 1 Approved'}
                              </Badge>
                            )}
                            {med.status === 'pending' && (
                              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                                {isBn ? 'অপেক্ষমান' : 'Pending'}
                              </Badge>
                            )}
                            {med.status === 'rejected' && (
                              <Badge className="bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300">
                                {isBn ? 'প্রত্যাখ্যাত' : 'Rejected'}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: REVIEW QUEUE */}
        <TabsContent value="review_queue" className="space-y-4">
          <Card className="border border-border">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-lg">
                {isBn ? 'ওষুধ পর্যালোচনা ও অনুমোদন সারি' : 'Regulatory Review & Approval Queue'}
              </CardTitle>
              <CardDescription className="text-xs">
                {twoPersonEnabled
                  ? isBn
                    ? 'দ্বৈত পর্যালোচনা নীতি সক্রিয়: স্টেজ ১ ও স্টেজ ২-এ দুটি পৃথক নিয়ন্ত্রক অ্যাকাউন্টের অনুমোদন প্রয়োজন।'
                    : 'Two-person review policy active: Stage 1 and Stage 2 require distinct reviewer accounts.'
                  : isBn
                    ? 'একক অনুমোদন নীতি সক্রিয়: যেকোনো নিয়ন্ত্রকের অনুমোদনে ওষুধ সরাসরি লাইভ হবে।'
                    : 'Single approval mode active: Approved records publish directly to live formulary.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {pendingQueue.length === 0 ? (
                <div className="p-8 text-center border rounded-lg border-dashed text-muted-foreground space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
                  <p className="font-medium text-foreground">
                    {isBn ? 'সকল পর্যালোচনা সম্পন্ন হয়েছে!' : 'All pending reviews cleared!'}
                  </p>
                  <p className="text-xs">
                    {isBn
                      ? 'বর্তমানে কোনো ওষুধ নিয়ন্ত্রক পর্যালোচনার জন্য অপেক্ষমান নেই।'
                      : 'No medicine brands currently require regulatory approval.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingQueue.map((med) => (
                    <div
                      key={med.id}
                      className="p-4 rounded-lg border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-foreground">
                            {med.brandName}
                          </span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {med.form} {med.strength}
                          </span>
                          {med.status === 'partially_approved' ? (
                            <Badge className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300">
                              {isBn ? 'স্টেজ ১ অনুমোদিত (স্টেজ ২ বাকি)' : 'Stage 1 Signed (Stage 2 Pending)'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border">
                              {isBn ? 'স্টেজ ১ অপেক্ষমান' : 'Stage 1 Pending'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {isBn ? 'জেনেরিক:' : 'Generic:'} <strong className="text-foreground">{med.genericName}</strong> ·{' '}
                          {isBn ? 'কোম্পানি:' : 'Company:'} {med.manufacturer} ·{' '}
                          {isBn ? 'মূল্য:' : 'Price:'} ৳{med.priceBdt}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          onClick={() => setRejectingMedId(med.id)}
                        >
                          <X className="w-4 h-4 mr-1" />
                          {isBn ? 'প্রত্যাখ্যান' : 'Reject'}
                        </Button>
                        <Button
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => handleReviewAction(med.id, 'approve')}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          {med.status === 'partially_approved'
                            ? isBn
                              ? 'চূড়ান্ত অনুমোদন (Sign Stage 2)'
                              : 'Final Sign-off'
                            : isBn
                              ? 'অনুমোদন (Sign Stage 1)'
                              : 'Approve Stage 1'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: CSV BULK IMPORT */}
        <TabsContent value="csv_import" className="space-y-4">
          <Card className="border border-border">
            <CardHeader className="p-4 pb-3">
              <CardTitle className="text-lg">
                {isBn ? 'ডিজিডিএ সিএসভি বাল্ক ব্র্যান্ড আমদানি' : 'DGDA Bulk CSV Medicine Importer'}
              </CardTitle>
              <CardDescription className="text-xs">
                {isBn
                  ? 'কমা-সেপারেটেড টেক্সট পেস্ট করুন অথবা টেমপ্লেট ডাউনলোড করে ভ্যালিডেশন সম্পন্ন করুন'
                  : 'Import batch brand records with format and regulatory validation checks'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {isBn
                    ? 'প্রয়োজনীয় কলাম: brand_name, generic_name, manufacturer, form, strength, pack_size, price_bdt, dgda_reg_num'
                    : 'Required columns: brand_name, generic_name, manufacturer, form, strength, pack_size, price_bdt, dgda_reg_num'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const sample =
                      'brand_name,generic_name,manufacturer,form,strength,pack_size,price_bdt,dgda_reg_num\n' +
                      'D-Cold,Paracetamol + Phenylephrine,Square Pharmaceuticals PLC,Tab,500mg+10mg,10x10,3.50,DAR-012-SMP1\n' +
                      'Pulmokast 10,Montelukast Sodium,Beximco Pharmaceuticals Ltd.,Tab,10 mg,3x10,16.00,DAR-024-SMP2';
                    setCsvText(sample);
                    toast.info(isBn ? 'নমুনা সিএসভি লোড হয়েছে' : 'Sample CSV loaded');
                  }}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                  {isBn ? 'নমুনা টেমপ্লেট লোড করুন' : 'Load Sample CSV'}
                </Button>
              </div>

              <textarea
                className="w-full h-40 p-3 font-mono text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
                placeholder={
                  'brand_name,generic_name,manufacturer,form,strength,pack_size,price_bdt,dgda_reg_num\nNapa Extra,Paracetamol + Caffeine,Beximco Pharmaceuticals Ltd.,Tab,500mg+65mg,20x10,2.50,DAR-024-002'
                }
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />

              <div className="flex justify-between items-center">
                <Button size="sm" variant="outline" onClick={handleParseCsv}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {isBn ? 'যাচাই ও প্রিভিউ করুন (Validate & Preview)' : 'Validate & Preview'}
                </Button>

                {csvPreview && csvPreview.validRecords.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleCommitCsvImport}
                    disabled={isImporting}
                  >
                    <UploadCloud className="w-4 h-4 mr-1.5" />
                    {isBn
                      ? `${csvPreview.validRecords.length} টি ব্র্যান্ড আমদানি সম্পন্ন করুন`
                      : `Commit ${csvPreview.validRecords.length} Records`}
                  </Button>
                )}
              </div>

              {/* Validation Feedback */}
              {csvPreview && (
                <div className="space-y-3 pt-2">
                  {csvPreview.errors.length > 0 && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs space-y-1">
                      <p className="font-semibold flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" />
                        {isBn
                          ? `${csvPreview.errors.length} টি লাইনে ত্রুটি পাওয়া গেছে:`
                          : `Validation errors found in ${csvPreview.errors.length} rows:`}
                      </p>
                      <ul className="list-disc pl-5 space-y-0.5">
                        {csvPreview.errors.map((err, idx) => (
                          <li key={idx}>
                            Row {err.row}: {err.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {csvPreview.validRecords.length > 0 && (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="bg-muted/60 p-2.5 text-xs font-semibold text-foreground flex justify-between">
                        <span>
                          {isBn
                            ? `সফল প্রিভিউ (${csvPreview.validRecords.length} টি)`
                            : `Validated Preview (${csvPreview.validRecords.length} items)`}
                        </span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <tbody className="divide-y divide-border">
                            {csvPreview.validRecords.map((r, i) => (
                              <tr key={i} className="hover:bg-muted/20">
                                <td className="p-2 font-medium">{r.brand_name}</td>
                                <td className="p-2 text-muted-foreground">{r.generic_name}</td>
                                <td className="p-2 text-muted-foreground">{r.manufacturer}</td>
                                <td className="p-2 font-mono">
                                  {r.form} {r.strength}
                                </td>
                                <td className="p-2 font-mono">৳{r.price_bdt}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: SAFETY NOTICES */}
        <TabsContent value="safety_notices" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Compose Card */}
            <Card className="border border-border">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-primary" />
                  {isBn ? 'নতুন ডিজিডিএ নিরাপত্তা নোটিশ জারি' : 'Issue DGDA Safety Notice'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isBn
                    ? 'চিকিৎসক এবং ফার্মেসিদের জন্য রিকল বা সতর্কবার্তা জারি করুন'
                    : 'Broadcast alerts to prescribing physicians and pharmacies'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <form onSubmit={handleBroadcastNotice} className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isBn ? 'নোটিশের শিরোনাম *' : 'Notice Title *'}
                    </label>
                    <Input
                      placeholder={
                        isBn
                          ? 'উদা: নির্দিষ্ট ব্যাচের সিরাপে ভেজাল রোধে সতর্কতা...'
                          : 'e.g. Mandatory recall of specific syrup batches...'
                      }
                      className="text-sm"
                      value={newNotice.title}
                      onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        {isBn ? 'সতর্কতা মাত্রা *' : 'Severity Level *'}
                      </label>
                      <select aria-label={isBn ? 'সতর্কতা মাত্রা *' : 'Severity Level *'}
                        className="w-full h-10 px-3 text-xs sm:text-sm rounded-md border border-border bg-background"
                        value={newNotice.severity}
                        onChange={(e) =>
                          setNewNotice({
                            ...newNotice,
                            severity: e.target.value as 'critical_recall' | 'warning' | 'info',
                          })
                        }
                      >
                        <option value="critical_recall">
                          {isBn ? '🚨 জরুরি প্রত্যাহার (Critical Recall)' : 'Critical Recall'}
                        </option>
                        <option value="warning">
                          {isBn ? '⚠️ সতর্কতা (Warning)' : 'Warning'}
                        </option>
                        <option value="info">
                          {isBn ? 'ℹ️ তথ্যমূলক (Info)' : 'Informational'}
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        {isBn ? 'ক্ষতিগ্রস্ত ব্যাচ নং (কমা দিয়ে পৃথক)' : 'Affected Batches (comma-separated)'}
                      </label>
                      <Input
                        placeholder="BT-2026-A, BT-2026-B"
                        className="text-xs sm:text-sm"
                        value={newNotice.batches}
                        onChange={(e) => setNewNotice({ ...newNotice, batches: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      {isBn ? 'বিস্তারিত নির্দেশিকা ও বিবরণ *' : 'Detailed Advisory & Instructions *'}
                    </label>
                    <textarea
                      className="w-full h-24 p-2.5 text-xs rounded-md border border-border bg-background focus:outline-hidden focus:ring-1 focus:ring-primary"
                      placeholder={
                        isBn
                          ? 'পরীক্ষাগার প্রতিবেদনে অমিল পাওয়ায় উক্ত ব্যাচ বিক্রয় স্থগিতের নির্দেশ দেওয়া হলো...'
                          : 'Laboratory reports identified substandard impurities...'
                      }
                      value={newNotice.body}
                      onChange={(e) => setNewNotice({ ...newNotice, body: e.target.value })}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full font-semibold"
                    disabled={isBroadcasting}
                  >
                    <BellRing className="w-4 h-4 mr-1.5" />
                    {isBn ? 'নিরাপত্তা নোটিশ জারি করুন' : 'Broadcast Safety Notice'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Active Notices Feed */}
            <Card className="border border-border">
              <CardHeader className="p-4 pb-3">
                <CardTitle className="text-base">
                  {isBn ? 'সম্প্রচারিত নোটিশের তালিকা' : 'Active Broadcast Notices'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isBn
                    ? 'চিকিৎসকদের ড্যাশবোর্ড ও প্রেসক্রিপশন স্ক্রিনে প্রদর্শিত নোটিশ'
                    : 'Live safety notices displayed on doctor prescription workflows'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {notices.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    {isBn ? 'কোনো নোটিশ জারি করা হয়নি।' : 'No notices broadcasted yet.'}
                  </p>
                ) : (
                  notices.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        n.severity === 'critical_recall'
                          ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
                          : n.severity === 'warning'
                            ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
                            : 'bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {n.title}
                        </span>
                        {n.severity === 'critical_recall' && (
                          <Badge className="bg-rose-600 text-white border-0 text-[10px]">
                            {isBn ? 'জরুরি প্রত্যাহার' : 'Critical Recall'}
                          </Badge>
                        )}
                        {n.severity === 'warning' && (
                          <Badge className="bg-amber-500 text-white border-0 text-[10px]">
                            {isBn ? 'সতর্কবার্তা' : 'Warning'}
                          </Badge>
                        )}
                        {n.severity === 'info' && (
                          <Badge className="bg-blue-600 text-white border-0 text-[10px]">
                            {isBn ? 'তথ্য' : 'Info'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{n.body}</p>
                      {n.affectedBatches && n.affectedBatches.length > 0 && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] text-muted-foreground">
                            {isBn ? 'ব্যাচ:' : 'Batches:'}
                          </span>
                          {n.affectedBatches.map((b, idx) => (
                            <span
                              key={idx}
                              className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-background border border-border"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* PROPOSE BRAND DIALOG */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {isBn ? 'নতুন ওষুধ ব্র্যান্ড প্রস্তাব করুন' : 'Propose New Medicine Brand'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isBn ? 'ডিজিডিএ ফর্মুলারিতে নতুন ব্র্যান্ড যুক্ত করতে তথ্য দিন।' : 'Submit a new brand entry for DGDA formulary review.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateBrand} className="space-y-3 text-xs pt-1">
            <div>
              <label className="font-medium block mb-1">
                {isBn ? 'ব্র্যান্ড নাম *' : 'Brand Name *'}
              </label>
              <Input
                placeholder="e.g. Napa Extra"
                value={newBrand.brandName}
                onChange={(e) => setNewBrand({ ...newBrand, brandName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="font-medium block mb-1">
                {isBn ? 'জেনেরিক নাম *' : 'Generic Name *'}
              </label>
              <Input
                placeholder="e.g. Paracetamol + Caffeine"
                value={newBrand.genericName}
                onChange={(e) => setNewBrand({ ...newBrand, genericName: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="font-medium block mb-1">
                {isBn ? 'প্রস্তুতকারক কোম্পানি *' : 'Manufacturer *'}
              </label>
              <select aria-label={isBn ? 'প্রস্তুতকারক কোম্পানি *' : 'Manufacturer *'}
                className="w-full h-9 px-3 rounded-md border border-border bg-background"
                value={newBrand.manufacturer}
                onChange={(e) => setNewBrand({ ...newBrand, manufacturer: e.target.value })}
              >
                <option value="Square Pharmaceuticals PLC">Square Pharmaceuticals PLC</option>
                <option value="Beximco Pharmaceuticals Ltd.">Beximco Pharmaceuticals Ltd.</option>
                <option value="Incepta Pharmaceuticals Ltd.">Incepta Pharmaceuticals Ltd.</option>
                <option value="Renata Limited">Renata Limited</option>
                <option value="Opsonin Pharma Ltd.">Opsonin Pharma Ltd.</option>
                <option value="Eskayef Pharmaceuticals Ltd.">Eskayef Pharmaceuticals Ltd.</option>
                <option value="The ACME Laboratories Ltd.">The ACME Laboratories Ltd.</option>
                <option value="ACI Limited">ACI Limited</option>
                <option value="Aristopharma Ltd.">Aristopharma Ltd.</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-medium block mb-1">{isBn ? 'ফর্ম' : 'Form'}</label>
                <select aria-label={isBn ? 'ফর্ম' : 'Form'}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background"
                  value={newBrand.form}
                  onChange={(e) => setNewBrand({ ...newBrand, form: e.target.value })}
                >
                  <option value="Tab">Tablet (Tab)</option>
                  <option value="Cap">Capsule (Cap)</option>
                  <option value="Syr">Syrup (Syr)</option>
                  <option value="Inj">Injection (Inj)</option>
                  <option value="Inhaler">Inhaler</option>
                </select>
              </div>

              <div>
                <label className="font-medium block mb-1">{isBn ? 'শক্তি (Strength)' : 'Strength'}</label>
                <Input
                  placeholder="e.g. 500 mg"
                  value={newBrand.strength}
                  onChange={(e) => setNewBrand({ ...newBrand, strength: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-medium block mb-1">{isBn ? 'প্যাক সাইজ' : 'Pack Size'}</label>
                <Input
                  placeholder="e.g. 10x10"
                  value={newBrand.packSize}
                  onChange={(e) => setNewBrand({ ...newBrand, packSize: e.target.value })}
                />
              </div>

              <div>
                <label className="font-medium block mb-1">{isBn ? 'খুচরা মূল্য (টাকা)' : 'MRP Price (BDT)'}</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newBrand.priceBdt}
                  onChange={(e) =>
                    setNewBrand({ ...newBrand, priceBdt: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div>
              <label className="font-medium block mb-1">{isBn ? 'ডিজিডিএ রেজি নং' : 'DGDA Reg No'}</label>
              <Input
                placeholder="DAR-012-XXXX"
                value={newBrand.dgdaRegNum}
                onChange={(e) => setNewBrand({ ...newBrand, dgdaRegNum: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddModal(false)}
              >
                {isBn ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button type="submit" size="sm">
                {isBn ? 'প্রস্তাব জমা দিন' : 'Submit Proposal'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* REJECTION REASON DIALOG */}
      <Dialog
        open={Boolean(rejectingMedId)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingMedId(null);
            setRejectReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">
              {isBn ? 'প্রত্যাখ্যানের সুনির্দিষ্ট কারণ উল্লেখ করুন' : 'Provide Rejection Reason'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isBn ? 'ওষুধ ব্র্যান্ডটি বাতিলের কারণ লিখুন।' : 'Document the regulatory reason for rejecting this medicine entry.'}
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full h-24 p-2.5 text-xs rounded-md border border-border bg-background"
            placeholder={
              isBn
                ? 'উদা: বায়োইকুইভ্যালেন্স সনদের ঘাটতি বা ত্রুটিপূর্ণ প্যাকেজিং...'
                : 'e.g. Substandard packaging or lack of bioequivalence certificate...'
            }
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRejectingMedId(null);
                setRejectReason('');
              }}
            >
              {isBn ? 'বাতিল' : 'Cancel'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => rejectingMedId && handleReviewAction(rejectingMedId, 'reject', rejectReason)}
            >
              {isBn ? 'প্রত্যাখ্যান নিশ্চিত করুন' : 'Confirm Rejection'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </AppShell>
  );
}
