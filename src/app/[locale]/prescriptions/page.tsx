'use client';

import React, { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import {
  FileText,
  PlusCircle,
  Search,
  Calendar,
  Printer,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

interface PrescriptionItem {
  id: string;
  rx_number: string;
  diagnosis: string;
  status: string;
  created_at: string;
  patient: {
    id: string;
    patient_code: string;
    name: string;
    age: number;
    gender: string;
  } | null;
  items_count: number;
  items: Array<{
    brand_name: string;
    generic_name: string;
    form: string;
    strength: string;
    dosing_schedule: string;
  }>;
}

export default function PrescriptionsListPage() {
  const locale = useLocale();
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/prescriptions', { credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { prescriptions: [] }))
      .then((data) => {
        setPrescriptions(data.prescriptions || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching prescriptions:', err);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, []);

  const filtered = prescriptions.filter((rx) => {
    if (statusFilter !== 'all' && rx.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const numMatch = rx.rx_number.toLowerCase().includes(q);
      const diagMatch = (rx.diagnosis || '').toLowerCase().includes(q);
      const pMatch = (rx.patient?.name || '').toLowerCase().includes(q);
      const codeMatch = (rx.patient?.patient_code || '').toLowerCase().includes(q);
      if (!numMatch && !diagMatch && !pMatch && !codeMatch) return false;
    }
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Persistent Clinical Disclaimer */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-primary font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {locale === 'bn'
                ? 'শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।'
                : 'Clinical decision support only. Not a substitute for professional judgement.'}
            </span>
          </div>
          <span className="text-muted-foreground hidden sm:inline">
            {locale === 'bn' ? 'চিকিৎসকই চূড়ান্ত সিদ্ধান্ত নেন।' : 'The doctor decides.'}
          </span>
        </div>

        <PageHeader
          title={locale === 'bn' ? 'প্রেসক্রিপশন তালিকা' : 'Prescription Records'}
          subtitle={
            locale === 'bn'
              ? 'ডিজিটাল প্রেসক্রিপশন ও বিএমডিসি রেকর্ড'
              : 'Digital prescriptions and clinical records'
          }
          action={
            <Link
              href="/prescriptions/new"
              className={buttonVariants({ className: 'h-10 text-sm font-semibold px-4 shadow-xs' })}
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              <span>{locale === 'bn' ? 'নতুন প্রেসক্রিপশন' : 'New Prescription'}</span>
            </Link>
          }
        />

        {/* Search & Filter Bar */}
        <Card data-tour="rx-search" className="border-border shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={
                  locale === 'bn'
                    ? 'প্রেসক্রিপশন নম্বর (RX-2026-...), রোগীর নাম বা রোগ দিয়ে খুঁজুন...'
                    : 'Search by Rx number, patient name, or diagnosis...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-11 text-base"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto" data-tour="rx-filter">
              <select
                aria-label={locale === 'bn' ? 'স্ট্যাটাস ফিল্টার' : 'Status Filter'}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 px-3 rounded-md border border-input bg-background text-sm font-medium text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary w-full sm:w-auto"
              >
                <option value="all">{locale === 'bn' ? 'সকল প্রেসক্রিপশন' : 'All Prescriptions'}</option>
                <option value="finalized">{locale === 'bn' ? 'চূড়ান্ত (Finalized)' : 'Finalized'}</option>
                <option value="draft">{locale === 'bn' ? 'খসড়া (Draft)' : 'Draft'}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Prescription Cards Grid */}
        <div data-tour="rx-list">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground animate-pulse text-base">
              {locale === 'bn' ? 'প্রেসক্রিপশন লোড হচ্ছে...' : 'Loading prescriptions...'}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <CardContent className="p-0 space-y-4">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-bold text-foreground">
                  {locale === 'bn' ? 'কোনো প্রেসক্রিপশন পাওয়া যায়নি' : 'No prescriptions found'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {locale === 'bn'
                    ? 'আপনার কোনো প্রেসক্রিপশন রেকর্ড নেই অথবা অনুসন্ধানের সাথে কোনো রেকর্ড মিলছে না।'
                    : 'No prescription matched your search. Write a new prescription to get started.'}
                </p>
                <Link href="/prescriptions/new" className={buttonVariants({ className: 'min-h-11 mt-2' })}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  <span>{locale === 'bn' ? 'নতুন প্রেসক্রিপশন লিখুন' : 'New Prescription'}</span>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((rx) => (
              <Card
                key={rx.id}
                className="border-border hover:border-primary/50 transition-all hover:shadow-sm bg-card flex flex-col justify-between"
              >
                <div className="p-5 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                      {rx.rx_number}
                    </span>
                    <Badge
                      variant={rx.status === 'finalized' ? 'outline' : 'secondary'}
                      className={`text-xs font-semibold ${
                        rx.status === 'finalized'
                          ? 'border-emerald-500/50 text-emerald-800 dark:text-emerald-300 bg-emerald-500/10'
                          : ''
                      }`}
                    >
                      {rx.status === 'finalized'
                        ? locale === 'bn'
                          ? 'চূড়ান্ত (Finalized)'
                          : 'Finalized'
                        : locale === 'bn'
                          ? 'খসড়া (Draft)'
                          : 'Draft'}
                    </Badge>
                  </div>

                  {rx.patient && (
                    <div className="mb-2">
                      <span className="text-sm font-bold text-foreground block">
                        {rx.patient.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {rx.patient.patient_code} · {rx.patient.age} {locale === 'bn' ? 'বছর' : 'yrs'} ·{' '}
                        {rx.patient.gender === 'female'
                          ? locale === 'bn'
                            ? 'মহিলা'
                            : 'Female'
                          : locale === 'bn'
                            ? 'পুরুষ'
                            : 'Male'}
                      </span>
                    </div>
                  )}

                  <h4 className="text-base font-bold text-foreground mt-2 line-clamp-1">
                    {rx.diagnosis || (locale === 'bn' ? 'রোগ নির্ণয় উল্লেখ নেই' : 'Clinical Diagnosis')}
                  </h4>

                  {/* Medicines Preview */}
                  <div className="mt-3 space-y-1">
                    {rx.items.slice(0, 2).map((item, idx) => (
                      <div key={idx} className="text-xs p-1.5 rounded bg-muted/30 flex justify-between">
                        <span className="font-semibold truncate">
                          {item.form} {item.brand_name} ({item.strength})
                        </span>
                        <span className="font-mono text-muted-foreground ml-2">{item.dosing_schedule}</span>
                      </div>
                    ))}
                    {rx.items_count > 2 && (
                      <span className="text-[11px] text-muted-foreground italic block">
                        +{rx.items_count - 2} {locale === 'bn' ? 'টি আরো ওষুধ...' : 'more items...'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 pt-3 border-t border-border/50 bg-muted/20 rounded-b-xl flex items-center justify-between">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(rx.created_at).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US')}
                  </span>

                  <Link
                    href={`/prescriptions/${rx.id}`}
                    className={buttonVariants({ size: 'sm', className: 'text-xs min-h-10 bg-primary font-semibold' })}
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    <span>{locale === 'bn' ? 'প্রিন্ট ও শেয়ার' : 'Print & Share'}</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
        </div>
      </div>
    </AppShell>
  );
}
