'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { AppShell } from '@/components/shared/AppShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from '@/i18n/routing';
import {
  Users,
  PlusCircle,
  Search,
  Phone,
  FileText,
  Droplet,
  User,
  X,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PatientItem {
  id: string;
  patient_code: string;
  name: string;
  phone: string;
  age: number;
  gender: string;
  blood_group?: string;
  emergency_contact?: string;
  created_at: string;
  updated_at: string;
}

export default function PatientsListPage() {
  const locale = useLocale();
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/patients?search=${encodeURIComponent(search)}`, { credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : { patients: [] }))
      .then((data) => {
        setPatients(data.patients || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching patients:', err);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [search]);

  const filtered = patients.filter((p) => {
    if (genderFilter !== 'all' && p.gender !== genderFilter) return false;
    return true;
  });

  return (
    <AppShell>
      <div className="space-y-4 max-w-7xl mx-auto pb-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {locale === 'bn' ? 'রোগীর তালিকা' : 'Patient List'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {locale === 'bn'
                ? 'চিকিৎসাধীন রোগীর তালিকা ও রেকর্ড'
                : 'Registered patients and consultation records'}
            </p>
          </div>
          <Link
            href="/patients/new"
            data-tour="patients-new-btn"
            className={buttonVariants({
              size: 'sm',
              className: 'h-8 sm:h-9 px-3.5 text-xs sm:text-sm font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs shrink-0 self-start sm:self-auto',
            })}
          >
            <PlusCircle className="w-4 h-4" />
            <span>{locale === 'bn' ? 'নতুন রোগী' : 'New Patient'}</span>
          </Link>
        </div>

        {/* Compact, Narrow Filter and Expandable Search Bar */}
        <div
          data-tour="patients-search"
          className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2 rounded-xl border border-border/80 bg-card/60 backdrop-blur-xs shadow-2xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>
                {locale === 'bn'
                  ? `মোট ${filtered.length} জন রোগী`
                  : `${filtered.length} Patients`}
              </span>
            </span>

            {search && (
              <Badge
                variant="secondary"
                className="text-[11px] h-6 px-2 gap-1 font-mono font-medium"
              >
                <span className="truncate max-w-[120px]">&ldquo;{search}&rdquo;</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setIsSearchOpen(false);
                  }}
                  className="hover:text-destructive transition-colors ml-0.5"
                  aria-label={locale === 'bn' ? 'মুছে ফেলুন' : 'Clear search'}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}

            {genderFilter !== 'all' && (
              <Badge variant="outline" className="text-[11px] h-6 px-2 gap-1 capitalize">
                <span>
                  {genderFilter === 'female'
                    ? locale === 'bn' ? 'মহিলা' : 'Female'
                    : genderFilter === 'male'
                    ? locale === 'bn' ? 'পুরুষ' : 'Male'
                    : locale === 'bn' ? 'অন্যান্য' : 'Other'}
                </span>
                <button
                  type="button"
                  onClick={() => setGenderFilter('all')}
                  className="hover:text-destructive transition-colors ml-0.5"
                  aria-label={locale === 'bn' ? 'ফিল্টার মুছুন' : 'Clear filter'}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Expandable Search: icon by default, expands on click */}
            {isSearchOpen || search ? (
              <div className="relative flex items-center transition-all duration-200">
                <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
                <Input
                  ref={searchInputRef}
                  autoFocus
                  type="text"
                  placeholder={
                    locale === 'bn'
                      ? 'রোগীর নাম, কোড (P-101) বা ফোন নম্বর দিয়ে খুঁজুন...'
                      : 'Search name, code (P-101), phone...'
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onBlur={() => {
                    if (!search.trim()) {
                      setIsSearchOpen(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setSearch('');
                      setIsSearchOpen(false);
                    }
                  }}
                  className="h-8 pl-8 pr-7 text-xs w-56 sm:w-72 md:w-80 bg-background font-medium focus-visible:ring-1"
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearch('');
                    setIsSearchOpen(false);
                  }}
                  aria-label={locale === 'bn' ? 'অনুসন্ধান বন্ধ করুন' : 'Close search'}
                  className="absolute right-2 text-muted-foreground hover:text-foreground transition-colors p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
                title={locale === 'bn' ? 'রোগী খুঁজুন (Search)' : 'Search patients'}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/60 border-border"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="sr-only">
                  {locale === 'bn' ? 'রোগী খুঁজুন' : 'Search patients'}
                </span>
              </Button>
            )}

            {/* Compact Gender Select */}
            <select
              aria-label={locale === 'bn' ? 'লিঙ্গ ফিল্টার' : 'Gender Filter'}
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-md border border-input bg-background text-foreground font-medium focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer hover:bg-muted/40 transition-colors"
            >
              <option value="all">{locale === 'bn' ? 'সকল লিঙ্গ' : 'All Genders'}</option>
              <option value="female">{locale === 'bn' ? 'মহিলা (Female)' : 'Female'}</option>
              <option value="male">{locale === 'bn' ? 'পুরুষ (Male)' : 'Male'}</option>
              <option value="other">{locale === 'bn' ? 'অন্যান্য' : 'Other'}</option>
            </select>
          </div>
        </div>

        {/* Patient Table List */}
        <div data-tour="patients-list">
          {loading ? (
            <Card className="border-border shadow-xs">
              <CardContent className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-0">
                    <Skeleton className="h-6 w-20 rounded-md" />
                    <Skeleton className="h-5 w-40 rounded-md" />
                    <Skeleton className="h-5 w-24 rounded-md hidden sm:block" />
                    <Skeleton className="h-5 w-28 rounded-md hidden md:block" />
                    <Skeleton className="h-8 w-24 rounded-md ml-auto" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <CardContent className="p-0 space-y-4">
                <Users className="w-12 h-12 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-bold text-foreground">
                  {locale === 'bn' ? 'কোনো রোগী পাওয়া যায়নি' : 'No patients found'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {locale === 'bn'
                    ? 'আপনার অনুসন্ধানের সাথে কোনো রেকর্ড মিলছে না। নতুন রোগী যুক্ত করতে নিচের বাটনে ক্লিক করুন।'
                    : 'No patient matched your search criteria. Register a new patient to get started.'}
                </p>
                <Link href="/patients/new" className={buttonVariants({ className: 'min-h-11 mt-2' })}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  <span>{locale === 'bn' ? 'নতুন রোগী গ্রহণ করুন' : 'New Patient Intake'}</span>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Mobile Cards (< md) */}
              <div className="space-y-2.5 md:hidden">
                {filtered.map((patient) => (
                  <Link
                    key={patient.id}
                    href={`/patients/${patient.id}`}
                    className="block p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                        {patient.patient_code}
                      </span>
                      {patient.blood_group && (
                        <Badge variant="outline" className="font-bold text-destructive border-destructive/30 bg-destructive/5 text-[11px]">
                          {patient.blood_group}
                        </Badge>
                      )}
                    </div>
                    <div className="font-bold text-sm text-foreground">{patient.name}</div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                      <span>
                        {patient.gender === 'female' ? (locale === 'bn' ? 'মহিলা' : 'Female') : (locale === 'bn' ? 'পুরুষ' : 'Male')}, {patient.age} {locale === 'bn' ? 'বছর' : 'yrs'}
                      </span>
                      <span className="font-mono">{patient.phone || '—'}</span>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Desktop Table (>= md) */}
              <Card className="hidden md:block border-border shadow-xs overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/40">
                      <TableHead className="w-32 font-semibold">
                        {locale === 'bn' ? 'রোগী কোড' : 'Patient Code'}
                      </TableHead>
                      <TableHead className="font-semibold">
                        {locale === 'bn' ? 'রোগীর নাম' : 'Patient Name'}
                      </TableHead>
                      <TableHead className="w-36 font-semibold">
                        {locale === 'bn' ? 'বয়স ও লিঙ্গ' : 'Age & Gender'}
                      </TableHead>
                      <TableHead className="w-28 font-semibold">
                        {locale === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}
                      </TableHead>
                      <TableHead className="w-44 font-semibold">
                        {locale === 'bn' ? 'যোগাযোগ' : 'Contact'}
                      </TableHead>
                      <TableHead className="w-44 text-right font-semibold">
                        {locale === 'bn' ? 'অ্যাকশন' : 'Actions'}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((patient) => (
                      <TableRow
                        key={patient.id}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-mono font-bold text-xs">
                          <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md inline-block">
                            {patient.patient_code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/patients/${patient.id}`}
                            className="font-bold text-sm text-foreground hover:text-primary transition-colors block"
                          >
                            {patient.name}
                          </Link>
                          {patient.emergency_contact && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-xs mt-0.5">
                              {patient.emergency_contact}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs font-medium">
                            {patient.gender === 'female'
                              ? locale === 'bn'
                                ? 'মহিলা'
                                : 'Female'
                              : locale === 'bn'
                                ? 'পুরুষ'
                                : 'Male'}
                            , {patient.age} {locale === 'bn' ? 'বছর' : 'yrs'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {patient.blood_group ? (
                            <Badge
                              variant="outline"
                              className="font-bold text-destructive border-destructive/30 bg-destructive/5 text-xs inline-flex items-center gap-1"
                            >
                              <Droplet className="w-3 h-3 fill-destructive/20 text-destructive" />
                              {patient.blood_group}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {patient.phone ? (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="w-3.5 h-3.5 text-muted-foreground/70" />
                              <span>{patient.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/patients/${patient.id}`}
                              className={buttonVariants({
                                variant: 'outline',
                                size: 'sm',
                                className: 'h-8 px-2.5 text-xs font-medium gap-1',
                              })}
                            >
                              <User className="w-3.5 h-3.5" />
                              <span>{locale === 'bn' ? 'প্রোফাইল' : 'Profile'}</span>
                            </Link>
                            <Link
                              href={`/prescriptions/new?patientId=${patient.id}`}
                              className={buttonVariants({
                                size: 'sm',
                                className: 'h-8 px-2.5 text-xs bg-primary hover:bg-primary/90 font-semibold gap-1',
                              })}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>{locale === 'bn' ? 'প্রেসক্রাইব' : 'Prescribe'}</span>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
