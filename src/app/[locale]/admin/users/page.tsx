'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  CheckCircle,
  XCircle,
  Ban,
  FileText,
  KeyRound,
  Loader2,
  RefreshCw,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  mfaEnabled: boolean;
  phone?: string | null;
  bmdcNumber?: string | null;
  createdAt: string;
  doctorVerification?: {
    bmdcNumber: string;
    documentUrl: string;
    status: string;
    rejectionReason?: string;
  } | null;
  studentVerification?: {
    instituteName: string;
    studentIdNumber: string;
    status: string;
  } | null;
  researcherVerification?: {
    instituteName: string;
    orcid?: string;
    status: string;
  } | null;
}

export default function AdminUsersPage() {
  const locale = useLocale();
  const t = useTranslations('admin');

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Reject dialog state
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);

    fetch(`/api/admin/users?${params.toString()}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setUsers(data.users || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load users');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [search, roleFilter, statusFilter, refreshTrigger]);

  const handleAction = async (action: string, userId: string, extraReason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId,
          reason: extraReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      toast.success(
        action === 'approve_verification'
          ? (locale === 'bn' ? 'যাচাইকরণ অনুমোদিত হয়েছে' : 'Verification approved')
          : action === 'reject_verification'
          ? (locale === 'bn' ? 'যাচাইকরণ প্রত্যাখ্যাত হয়েছে' : 'Verification rejected')
          : action === 'suspend_user'
          ? (locale === 'bn' ? 'ব্যবহারকারী স্থগিত করা হয়েছে' : 'User suspended')
          : action === 'activate_user'
          ? (locale === 'bn' ? 'ব্যবহারকারী সক্রিয় করা হয়েছে' : 'User activated')
          : (locale === 'bn' ? 'MFA রিসেট সম্পন্ন' : 'MFA reset successful')
      );

      setRejectingUserId(null);
      setRejectionReason('');
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'doctor':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 whitespace-nowrap">
            {locale === 'bn' ? 'চিকিৎসক (Doctor)' : 'Doctor'}
          </Badge>
        );
      case 'patient':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 whitespace-nowrap">
            {locale === 'bn' ? 'রোগী (Patient)' : 'Patient'}
          </Badge>
        );
      case 'student':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 whitespace-nowrap">
            {locale === 'bn' ? 'শিক্ষার্থী (Student)' : 'Student'}
          </Badge>
        );
      case 'researcher':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 whitespace-nowrap">
            {locale === 'bn' ? 'গবেষক (Researcher)' : 'Researcher'}
          </Badge>
        );
      case 'medicine_controller':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 whitespace-nowrap">
            {locale === 'bn' ? 'নিয়ন্ত্রক (Controller)' : 'Controller'}
          </Badge>
        );
      case 'super_admin':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 whitespace-nowrap">
            {locale === 'bn' ? 'অ্যাডমিন' : 'Admin'}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-semibold whitespace-nowrap">
            {role.replace('_', ' ')}
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_verification':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 whitespace-nowrap">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{locale === 'bn' ? 'যাচাই পেন্ডিং' : 'Pending'}</span>
          </Badge>
        );
      case 'suspended':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-destructive/15 text-destructive border-destructive/30 gap-1 whitespace-nowrap">
            <Ban className="w-3 h-3 shrink-0" />
            <span>{locale === 'bn' ? 'স্থগিত' : 'Suspended'}</span>
          </Badge>
        );
      case 'active':
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 whitespace-nowrap">
            <CheckCircle className="w-3 h-3 shrink-0" />
            <span>{locale === 'bn' ? 'সক্রিয়' : 'Active'}</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t('users')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'bn'
              ? 'নিবন্ধিত স্বাস্থ্যকর্মী, শিক্ষার্থী ও গবেষকদের পরিচয় যাচাই এবং অ্যাকাউন্ট নিয়ন্ত্রণ।'
              : 'Verify clinician licenses, institute affiliations, and manage user access states.'}
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

      {/* Search & Filter Bar */}
      <Card className="border-border bg-card shadow-2xs">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === 'bn' ? 'নাম, ইমেইল, বা BMDC নম্বর দিয়ে খুঁজুন...' : 'Search by name, email, or BMDC...'}
              className="pl-9 text-xs h-10"
            />
          </div>

          <div className="flex gap-2">
            <select aria-label={locale === 'bn' ? 'রোল অনুযায়ী দেখুন' : 'Filter by role'}
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-xs font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="all">{locale === 'bn' ? 'সকল রোল' : 'All Roles'}</option>
              <option value="doctor">{locale === 'bn' ? 'চিকিৎসক (Doctor)' : 'Doctor'}</option>
              <option value="patient">{locale === 'bn' ? 'রোগী (Patient)' : 'Patient'}</option>
              <option value="student">{locale === 'bn' ? 'শিক্ষার্থী (Student)' : 'Student'}</option>
              <option value="researcher">{locale === 'bn' ? 'গবেষক (Researcher)' : 'Researcher'}</option>
              <option value="medicine_controller">{locale === 'bn' ? 'ওষুধ নিয়ন্ত্রক (Controller)' : 'Medicine Controller'}</option>
              <option value="super_admin">{locale === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin'}</option>
            </select>

            <select aria-label={locale === 'bn' ? 'স্ট্যাটাস অনুযায়ী দেখুন' : 'Filter by status'}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 px-3 rounded-md border border-input bg-background text-xs font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="all">{locale === 'bn' ? 'সকল স্ট্যাটাস' : 'All Status'}</option>
              <option value="active">{locale === 'bn' ? 'সক্রিয় (Active)' : 'Active'}</option>
              <option value="pending_verification">{locale === 'bn' ? 'যাচাই পেন্ডিং' : 'Pending Verification'}</option>
              <option value="suspended">{locale === 'bn' ? 'স্থগিত (Suspended)' : 'Suspended'}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users & Verifications Table */}
      <Card className="border-border bg-card shadow-2xs overflow-hidden">
        <div className="relative w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="min-w-[200px] text-xs font-semibold">{locale === 'bn' ? 'ব্যবহারকারী' : 'User'}</TableHead>
                <TableHead className="min-w-[130px] text-xs font-semibold">{locale === 'bn' ? 'ভূমিকা (Role)' : 'Role'}</TableHead>
                <TableHead className="min-w-[120px] text-xs font-semibold">{locale === 'bn' ? 'স্ট্যাটাস' : 'Status'}</TableHead>
                <TableHead className="min-w-[220px] text-xs font-semibold">{locale === 'bn' ? 'যাচাইকরণ ও শংসাপত্র' : 'Verification & Credentials'}</TableHead>
                <TableHead className="min-w-[80px] text-xs font-semibold">{locale === 'bn' ? 'MFA' : 'MFA'}</TableHead>
                <TableHead className="min-w-[110px] text-xs font-semibold">{locale === 'bn' ? 'নিবন্ধন তারিখ' : 'Registered'}</TableHead>
                <TableHead className="min-w-[160px] text-right text-xs font-semibold">{locale === 'bn' ? 'পদক্ষেপ' : 'Actions'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-xs text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span>{locale === 'bn' ? 'ব্যবহারকারী লোড হচ্ছে...' : 'Loading users...'}</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-muted-foreground font-medium">
                    {locale === 'bn' ? 'কোনো ব্যবহারকারী পাওয়া যায়নি' : 'No users match your filters'}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => {
                  const isPending = u.status === 'pending_verification';
                  const isSuspended = u.status === 'suspended';
                  const regDate = u.createdAt
                    ? new Date(u.createdAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—';

                  return (
                    <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                      {/* User Info */}
                      <TableCell className="align-middle py-3">
                        <div className="space-y-0.5">
                          <span className="font-bold text-xs sm:text-sm text-foreground block">{u.name}</span>
                          <span className="text-[11px] text-muted-foreground font-mono block truncate max-w-[220px]" title={u.email}>
                            {u.email}
                          </span>
                          {u.phone && (
                            <span className="text-[10px] text-muted-foreground block">{u.phone}</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Role */}
                      <TableCell className="align-middle py-3">
                        {getRoleBadge(u.role)}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="align-middle py-3">
                        {getStatusBadge(u.status)}
                      </TableCell>

                      {/* Verification & Credentials */}
                      <TableCell className="align-middle py-3">
                        <div className="space-y-1 text-xs">
                          {u.bmdcNumber && (
                            <div className="font-semibold text-primary text-[11px] font-mono">
                              BMDC: {u.bmdcNumber}
                            </div>
                          )}

                          {u.doctorVerification && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                              <a
                                href={u.doctorVerification.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
                              >
                                <span>{locale === 'bn' ? 'সনদপত্র দেখুন' : 'View Document'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {u.studentVerification && (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">ID: {u.studentVerification.studentIdNumber}</span>
                              <span className="block text-[10px]">({u.studentVerification.instituteName})</span>
                            </div>
                          )}

                          {u.researcherVerification && (
                            <div className="text-[11px] text-muted-foreground">
                              <span className="font-medium text-foreground">ORCID: {u.researcherVerification.orcid || 'N/A'}</span>
                              <span className="block text-[10px]">({u.researcherVerification.instituteName})</span>
                            </div>
                          )}

                          {!u.bmdcNumber && !u.doctorVerification && !u.studentVerification && !u.researcherVerification && (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* MFA */}
                      <TableCell className="align-middle py-3">
                        {u.mfaEnabled ? (
                          <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
                            MFA
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Registered Date */}
                      <TableCell className="align-middle py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {regDate}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="align-middle py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isPending ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleAction('approve_verification', u.id)}
                                disabled={actionLoading}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs h-7 px-2.5 shadow-2xs gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>{t('approve')}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setRejectingUserId(u.id)}
                                disabled={actionLoading}
                                className="text-xs h-7 px-2.5 gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{t('reject')}</span>
                              </Button>
                            </>
                          ) : (
                            <>
                              {isSuspended ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction('activate_user', u.id)}
                                  disabled={actionLoading}
                                  className="text-xs h-7 px-2.5 text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10 gap-1"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>{t('activate')}</span>
                                </Button>
                              ) : (
                                u.role !== 'super_admin' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAction('suspend_user', u.id)}
                                    disabled={actionLoading}
                                    className="text-xs h-7 px-2.5 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>{t('suspend')}</span>
                                  </Button>
                                )
                              )}

                              {u.mfaEnabled && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAction('reset_mfa', u.id)}
                                  disabled={actionLoading}
                                  className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground gap-1"
                                  title="Reset MFA"
                                  aria-label={t('resetMfa')}
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  <span className="hidden lg:inline">{t('resetMfa')}</span>
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Reject Verification Dialog */}
      <Dialog
        open={Boolean(rejectingUserId)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingUserId(null);
            setRejectionReason('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <XCircle className="w-5 h-5" />
              <span>{locale === 'bn' ? 'যাচাইকরণ প্রত্যাখ্যান' : 'Reject Verification'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {locale === 'bn'
                ? 'প্রত্যাখ্যানের সুনির্দিষ্ট কারণ উল্লেখ করুন (যেমন: অস্পষ্ট BMDC সনদ, মেয়াদ উত্তীর্ণ আইডি)।'
                : 'Specify the clinical or regulatory reason for rejecting this verification request.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t('rejectionReason')}</Label>
              <Input
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={locale === 'bn' ? 'প্রত্যাখ্যানের কারণ লিখুন...' : 'Enter rejection reason...'}
                className="text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRejectingUserId(null);
                  setRejectionReason('');
                }}
                disabled={actionLoading}
                className="text-xs"
              >
                {locale === 'bn' ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => rejectingUserId && handleAction('reject_verification', rejectingUserId, rejectionReason)}
                disabled={actionLoading || !rejectionReason.trim() || !rejectingUserId}
                className="text-xs"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                <span>{t('confirmReject')}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
