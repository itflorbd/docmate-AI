'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Mic,
  ShieldAlert,
  Save,
  Loader2,
  Sparkles,
  Bot,
  Play,
  Search,
  Plus,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Layers,
  Edit2,
} from 'lucide-react';
import { toast } from 'sonner';
import { VoiceConfig } from '@/lib/voice/types';
import { useVoice } from '@/context/VoiceContext';
import { DocMateAvatar, DocMateReaction } from '@/components/voice/DocMateAvatar';

interface VoiceMetrics {
  totalSessions: number;
  totalMinutes: number;
  totalTtsChars: number;
  avgLatencyMs: number;
  errorRatePct: number;
  estimatedCostBdt: number;
}

interface PhraseEntry {
  id: string;
  category: string;
  locale: 'bn' | 'en';
  preset: 'reserved' | 'friendly' | 'all';
  text: string;
  status: 'draft' | 'reviewed' | 'live';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
}

interface PhraseMetrics {
  totalFeedback: number;
  helpfulCount: number;
  helpfulPct: number;
  negativeReasons: Record<string, number>;
  medianWords: number;
  statusCounts: {
    live: number;
    reviewed: number;
    draft: number;
  };
}

const PHRASE_CATEGORIES = [
  'greeting',
  'acknowledge',
  'thinking',
  'understood',
  'clarify',
  'confirm_readback',
  'success',
  'small_error',
  'big_error',
  'no_evidence',
  'alert_intro',
  'disagree_respected',
  'thanks_reply',
  'goodbye',
  'waiting_long',
  'limit_reached',
  'first_use_welcome',
];

export default function AdminVoiceSettingsPage() {
  const locale = useLocale();
  const isBn = locale === 'bn';
  const { speakText, applySystemVoiceConfig } = useVoice();
  const t = useTranslations('voice');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTts, setTestingTts] = useState(false);
  const [previewReaction, setPreviewReaction] = useState<DocMateReaction>('idle');
  const [playingReaction, setPlayingReaction] = useState<string | null>(null);

  const handlePlayReactionAudio = (audioPath: string) => {
    try {
      setPlayingReaction(audioPath);
      const audio = new Audio(audioPath);
      audio.onended = () => setPlayingReaction(null);
      audio.onerror = () => setPlayingReaction(null);
      void audio.play().catch(() => setPlayingReaction(null));
    } catch {
      setPlayingReaction(null);
    }
  };

  const [metrics, setMetrics] = useState<VoiceMetrics>({
    totalSessions: 0,
    totalMinutes: 0,
    totalTtsChars: 0,
    avgLatencyMs: 0,
    errorRatePct: 0,
    estimatedCostBdt: 0,
  });

  const [config, setConfig] = useState<VoiceConfig & {
    default_greeting_morning_bn?: string;
    default_greeting_afternoon_bn?: string;
    default_greeting_evening_bn?: string;
    default_greeting_morning_en?: string;
    default_greeting_afternoon_en?: string;
    default_greeting_evening_en?: string;
    sounds_enabled?: boolean;
    edge_voice_bn?: string;
    edge_voice_en?: string;
    vocal_reactions_enabled?: boolean;
  }>({
    enabled: true,
    kill_switch: false,
    stt_provider: 'browser',
    tts_provider: 'edge',
    persona_name: 'ডকমেট (DocMate)',
    persona_greeting_bn: 'স্বাগতম, ডাক্তার। বলুন, কীভাবে সাহায্য করতে পারি?',
    persona_greeting_en: 'Welcome, Doctor. How can I assist you today?',
    intro_disclaimer_bn: 'আমি একটি এআই সহকারী। চূড়ান্ত সিদ্ধান্ত আপনার।',
    intro_disclaimer_en: 'I am an AI assistant. The final decision is yours.',
    default_voice_gender: 'female',
    default_speed: 1.0,
    private_mode_default: true,
    avatar_enabled_default: true,
    persona_preset: 'friendly',
    default_greeting_morning_bn: 'শুভ সকাল, ডাক্তার। আজ কীভাবে সাহায্য করতে পারি?',
    default_greeting_afternoon_bn: 'শুভ অপরাহ্ন, ডাক্তার। বলুন, কী দেখতে পারি?',
    default_greeting_evening_bn: 'শুভ সন্ধ্যা, ডাক্তার। কীভাবে সহায়তা করতে পারি?',
    default_greeting_morning_en: 'Good morning, Doctor. How may I assist you today?',
    default_greeting_afternoon_en: 'Good afternoon, Doctor. How can I help?',
    default_greeting_evening_en: 'Good evening, Doctor. How can I support you?',
    sounds_enabled: true,
    edge_voice_bn: 'bn-BD-NabanitaNeural',
    edge_voice_en: 'en-US-JennyNeural',
    vocal_reactions_enabled: true,
  });

  // Phrase Bank State
  const [phraseEntries, setPhraseEntries] = useState<PhraseEntry[]>([]);
  const [phraseMetrics, setPhraseMetrics] = useState<PhraseMetrics | null>(null);
  const [phraseLoading, setPhraseLoading] = useState(false);
  const [phraseSearch, setPhraseSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLocale, setSelectedLocale] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Edit / Add Dialog State
  const [editEntry, setEditEntry] = useState<PhraseEntry | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('acknowledge');
  const [newLocale, setNewLocale] = useState<'bn' | 'en'>('bn');
  const [newPreset, setNewPreset] = useState<'reserved' | 'friendly' | 'all'>('friendly');
  const [newText, setNewText] = useState('');
  const [newStatus, setNewStatus] = useState<'draft' | 'reviewed' | 'live'>('draft');
  const [dialogSaving, setDialogSaving] = useState(false);

  // Load Voice settings
  useEffect(() => {
    fetch('/api/settings/voice')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config) {
          setConfig((prev) => ({ ...prev, ...data.config, tts_provider: data.config.tts_provider === 'custom_stub' ? 'browser' : data.config.tts_provider ?? prev.tts_provider }));
        }
        if (data?.metrics) {
          setMetrics(data.metrics);
        }
      })
      .catch(() => toast.error(isBn ? 'সেটিংস লোড ব্যর্থ' : 'Failed to load voice settings'))
      .finally(() => setLoading(false));
  }, [isBn]);

  // Load Phrase Bank
  const loadPhraseBank = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedCategory !== 'all') params.set('category', selectedCategory);
    if (selectedLocale !== 'all') params.set('locale', selectedLocale);
    if (selectedStatus !== 'all') params.set('status', selectedStatus);
    if (phraseSearch.trim()) params.set('q', phraseSearch.trim());

    fetch(`/api/admin/phrasebank?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.entries) {
          setPhraseEntries(data.entries);
        }
        if (data?.metrics) {
          setPhraseMetrics(data.metrics);
        }
      })
      .catch(() => toast.error(isBn ? 'ফ্রেজ ব্যাংক লোড ব্যর্থ' : 'Failed to load phrase bank'))
      .finally(() => setPhraseLoading(false));
  }, [selectedCategory, selectedLocale, selectedStatus, phraseSearch, isBn]);

  useEffect(() => {
    loadPhraseBank();
  }, [loadPhraseBank]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (res.ok) {
        const result = await res.json();
        applySystemVoiceConfig(result.config);
        toast.success(isBn ? 'ভয়েস সেটিংস সফলভাবে সংরক্ষিত হয়েছে' : 'Voice configuration saved successfully');
      } else {
        toast.error(isBn ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save settings');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTts = () => {
    setTestingTts(true);
    const testPhrase = config.tts_provider === 'maya'
      ? t('conversationGreeting')
      : isBn ? config.persona_greeting_bn : config.persona_greeting_en;

    void speakText(testPhrase, (error) => {
      setTestingTts(false);
      if (error) toast.error(error);
    }, {
      preview: true,
      requireLiveProvider: config.tts_provider === 'maya' || config.tts_provider === 'edge',
      provider: config.tts_provider,
      rate: config.default_speed,
      voiceGender: config.default_voice_gender,
      style: config.persona_preset === 'reserved' ? 'neutral' : 'warm',
    });
  };

  const handleUpdatePhrase = async () => {
    if (!editEntry) return;
    setDialogSaving(true);
    try {
      const res = await fetch('/api/admin/phrasebank', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editEntry.id,
          text: editEntry.text,
          status: editEntry.status,
          preset: editEntry.preset,
        }),
      });

      if (res.ok) {
        toast.success(isBn ? 'ফ্রেজ হালনাগাদ হয়েছে' : 'Phrase updated successfully');
        setEditEntry(null);
        loadPhraseBank();
      } else {
        toast.error(isBn ? 'হালনাগাদ ব্যর্থ' : 'Update failed');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setDialogSaving(false);
    }
  };

  const handleCreatePhrase = async () => {
    if (!newText.trim()) {
      toast.error(isBn ? 'ফ্রেজের টেক্সট লিখুন' : 'Please provide phrase text');
      return;
    }
    setDialogSaving(true);
    try {
      const res = await fetch('/api/admin/phrasebank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          locale: newLocale,
          preset: newPreset,
          text: newText.trim(),
          status: newStatus,
        }),
      });

      if (res.ok) {
        toast.success(isBn ? 'নতুন ফ্রেজ যোগ হয়েছে' : 'New phrase created');
        setIsAddOpen(false);
        setNewText('');
        loadPhraseBank();
      } else {
        toast.error(isBn ? 'যোগ করতে ব্যর্থ' : 'Failed to create phrase');
      }
    } catch {
      toast.error(isBn ? 'নেটওয়ার্ক ত্রুটি' : 'Network error');
    } finally {
      setDialogSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            <span>{isBn ? 'ভয়েস ও সহকারী গভর্নেন্স' : 'Voice & Assistant Governance'}</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isBn
              ? 'সহকারীর বাচনভঙ্গি, ফ্রেজ ব্যাংক ও ক্লিনিকাল কোয়ালিটি মেট্রিক্স পরিচালনা করুন।'
              : 'Manage assistant tone, vetted phrases, and clinical quality metrics.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isBn ? 'সেটিংস সংরক্ষণ করুন' : 'Save All Settings'}</span>
          </Button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="overview" className="gap-1.5 py-2 text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span>{isBn ? 'সারসংক্ষেপ ও মেট্রিক্স' : 'Overview & Metrics'}</span>
          </TabsTrigger>
          <TabsTrigger value="engine" className="gap-1.5 py-2 text-xs sm:text-sm font-semibold">
            <Mic className="w-4 h-4 text-teal-600" />
            <span>{isBn ? 'ভয়েস ইঞ্জিন ও কিল-সুইচ' : 'Engine & Routing'}</span>
          </TabsTrigger>
          <TabsTrigger value="persona" className="gap-1.5 py-2 text-xs sm:text-sm font-semibold">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <span>{isBn ? 'পারসোনা ও ক্যারেক্টার' : 'Persona & Avatar'}</span>
          </TabsTrigger>
          <TabsTrigger value="phrasebank" className="gap-1.5 py-2 text-xs sm:text-sm font-semibold">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>{isBn ? 'ফ্রেজ ব্যাংক গভর্নেন্স' : 'Phrase Bank'}</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OVERVIEW & QUALITY METRICS */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-3.5 space-y-1 bg-card border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {isBn ? 'মোট সেশন' : 'Total Sessions'}
              </span>
              <span className="text-xl font-bold text-foreground font-mono">{metrics.totalSessions}</span>
            </Card>
            <Card className="p-3.5 space-y-1 bg-card border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {isBn ? 'কথা বলার সময়' : 'Spoken Minutes'}
              </span>
              <span className="text-xl font-bold text-foreground font-mono">{metrics.totalMinutes} m</span>
            </Card>
            <Card className="p-3.5 space-y-1 bg-card border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {isBn ? 'উচ্চারিত অক্ষর' : 'TTS Characters'}
              </span>
              <span className="text-xl font-bold text-foreground font-mono">{metrics.totalTtsChars.toLocaleString()}</span>
            </Card>
            <Card className="p-3.5 space-y-1 bg-card border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {isBn ? 'সহায়তা সন্তুষ্টি' : 'Helpful Rating'}
              </span>
              <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {phraseMetrics?.helpfulPct ?? 100}%
              </span>
            </Card>
            <Card className="p-3.5 space-y-1 bg-card border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {isBn ? 'গড় প্রতিক্রিয়া' : 'Avg Latency'}
              </span>
              <span className="text-xl font-bold text-foreground font-mono">{metrics.avgLatencyMs} ms</span>
            </Card>
            <Card className="p-3.5 space-y-1 bg-card border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                {isBn ? 'আনুমানিক খরচ' : 'Est. Cost'}
              </span>
              <span className="text-xl font-bold text-foreground font-mono">
                ৳ {metrics.estimatedCostBdt}
              </span>
            </Card>
          </div>

          {/* Feedback & Word Count Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  <span>{isBn ? 'সহকারী ফিডব্যাক ও গুণগত মূল্যায়ন' : 'Clinician Feedback Ratings'}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {isBn
                    ? 'ডাক্তারদের প্রদত্ত লাইক ও ডিসলাইক রেটিংয়ের বিস্তারিত পরিসংখ্যান।'
                    : 'Aggregated helpfulness feedback from clinician conversations.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <ThumbsUp className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold">{isBn ? 'সাহায্য হয়েছে' : 'Helpful Responses'}</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-emerald-600">
                    {phraseMetrics?.helpfulCount ?? 0}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <ThumbsDown className="w-3.5 h-3.5 text-amber-600" />
                    <span>{isBn ? 'অসন্তুষ্টির কারণসমূহ (Negative Reasons)' : 'Dislike Reasons Breakdown'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded border border-border bg-card flex justify-between">
                      <span className="text-muted-foreground">{isBn ? 'অনেক বড়' : 'Too Long'}:</span>
                      <span className="font-mono font-semibold">{phraseMetrics?.negativeReasons?.too_long ?? 0}</span>
                    </div>
                    <div className="p-2 rounded border border-border bg-card flex justify-between">
                      <span className="text-muted-foreground">{isBn ? 'বেশি আনুষ্ঠানিক' : 'Too Formal'}:</span>
                      <span className="font-mono font-semibold">{phraseMetrics?.negativeReasons?.too_formal ?? 0}</span>
                    </div>
                    <div className="p-2 rounded border border-border bg-card flex justify-between">
                      <span className="text-muted-foreground">{isBn ? 'বুঝতে পারিনি' : 'Unclear'}:</span>
                      <span className="font-mono font-semibold">{phraseMetrics?.negativeReasons?.did_not_understand ?? 0}</span>
                    </div>
                    <div className="p-2 rounded border border-border bg-card flex justify-between">
                      <span className="text-muted-foreground">{isBn ? 'টোন ঠিক নেই' : 'Wrong Tone'}:</span>
                      <span className="font-mono font-semibold">{phraseMetrics?.negativeReasons?.wrong_tone ?? 0}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>{isBn ? 'ফ্রেজ ব্যাংক স্থিতি ও গড় দৈর্ঘ্য' : 'Phrase Bank Health'}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {isBn
                    ? 'মোট প্রস্তুতকৃত ও সক্রিয় ক্লিনিকাল ফ্রেজের তালিকা।'
                    : 'Distribution of reviewed and active vetted responses.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">{isBn ? 'সক্রিয়' : 'Live'}</span>
                    <span className="text-lg font-bold text-emerald-600 font-mono">
                      {phraseMetrics?.statusCounts?.live ?? 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-sky-500/30 bg-sky-500/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">{isBn ? 'পর্যালোচিত' : 'Reviewed'}</span>
                    <span className="text-lg font-bold text-sky-600 font-mono">
                      {phraseMetrics?.statusCounts?.reviewed ?? 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <span className="text-[10px] text-muted-foreground uppercase block">{isBn ? 'খসড়া' : 'Draft'}</span>
                    <span className="text-lg font-bold text-amber-600 font-mono">
                      {phraseMetrics?.statusCounts?.draft ?? 0}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{isBn ? 'ফ্রেজের মধ্যক শব্দসংখ্যা (Median Words)' : 'Median Words Per Phrase'}:</span>
                  <span className="font-bold font-mono text-sm">{phraseMetrics?.medianWords ?? 6} words</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 2: ENGINE & KILL-SWITCH */}
        <TabsContent value="engine" className="space-y-6">
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-600" />
                  <span>{isBn ? 'সার্বিক ভয়েস নিয়ন্ত্রণ ও কিল-সুইচ' : 'Global Voice Status & Master Kill Switch'}</span>
                </span>
                {config.kill_switch ? (
                  <Badge variant="destructive">{isBn ? 'কিল-সুইচ সক্রিয় (ভয়েস বন্ধ)' : 'Kill Switch Active'}</Badge>
                ) : config.enabled ? (
                  <Badge className="bg-emerald-700 text-white">{isBn ? 'সক্রিয়' : 'Enabled'}</Badge>
                ) : (
                  <Badge variant="secondary">{isBn ? 'নিষ্ক্রিয়' : 'Disabled'}</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs">
                {isBn
                  ? 'জরুরি পরিস্থিতিতে পুরো সিস্টেমে ভয়েস তাৎক্ষণিক বন্ধ করতে কিল-সুইচ ব্যবহার করুন।'
                  : 'Instantly disable voice capabilities across the entire platform in clinical emergency.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border border-border bg-muted/20 gap-3">
                <div>
                  <Label className="font-semibold text-sm">{isBn ? 'ভয়েস সহকারী সক্রিয় রাখুন' : 'Enable Voice Assistant'}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBn ? 'ডাক্তার ও ব্যবহারকারীদের জন্য ভয়েস ফিচার দৃশ্যমান থাকবে।' : 'Toggles visibility and availability of voice assistant globally.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) => setConfig((p) => ({ ...p, enabled: e.target.checked }))}
                  className="accent-primary w-5 h-5 rounded cursor-pointer shrink-0"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5 gap-3">
                <div>
                  <Label className="font-semibold text-sm text-destructive">{isBn ? 'ইমার্জেন্সি ভয়েস কিল-সুইচ' : 'Emergency Voice Kill-Switch'}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBn ? 'চালু থাকলে সমস্ত ভয়েস এপিআই কল এবং অডিও প্লেব্যাক তাৎক্ষণিক ব্লক হবে।' : 'Immediately blocks all STT and TTS API execution system-wide.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.kill_switch}
                  onChange={(e) => setConfig((p) => ({ ...p, kill_switch: e.target.checked }))}
                  className="accent-destructive w-5 h-5 rounded cursor-pointer shrink-0"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg border border-border bg-card gap-3">
                <div>
                  <Label className="font-semibold text-sm">{isBn ? 'কোমল শব্দ সংকেত (Earcon Chimes)' : 'Soft Earcon Chimes'}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isBn ? 'মাইক্রোফোন চালু ও বন্ধে কোমল রিং বাজবে।' : 'Plays gentle sine-wave chime on microphone start and stop.'}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.sounds_enabled ?? true}
                  onChange={(e) => setConfig((p) => ({ ...p, sounds_enabled: e.target.checked }))}
                  className="accent-primary w-5 h-5 rounded cursor-pointer shrink-0"
                />
              </div>
            </CardContent>
          </Card>

          {/* Provider Routing */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                <span>{isBn ? 'প্রদানকারী (Provider) কনফিগারেশন' : 'STT & TTS Provider Routing'}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 p-3.5 rounded-lg border border-border bg-card">
                <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  {isBn ? 'স্পিচ-টু-টেক্সট (STT Engine)' : 'STT Provider'}
                </Label>
                <select aria-label={isBn ? 'স্পিচ-টু-টেক্সট (STT Engine)' : 'STT Provider'}
                  value={config.stt_provider}
                  onChange={(e) => setConfig((p) => ({ ...p, stt_provider: e.target.value as 'browser' | 'openai' | 'custom_stub' }))}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary"
                >
                  <option value="browser">Browser Web Speech API (Free & Local)</option>
                  <option value="openai">OpenAI Whisper (Cloud Paid)</option>
                  <option value="custom_stub">Offline Diagnostic Stub</option>
                </select>
              </div>

              <div className="space-y-2 p-3.5 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    {isBn ? 'টেক্সট-টু-স্পিচ (TTS Engine)' : 'TTS Provider'}
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestTts}
                    disabled={testingTts}
                    aria-describedby="admin-voice-disclosure"
                    className="h-7 px-2.5 text-xs font-semibold gap-1 text-primary border-primary/30"
                  >
                    {testingTts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isBn ? 'শব্দ পরীক্ষা' : 'Test Audio'}</span>
                  </Button>
                </div>
                <select aria-label={isBn ? 'টেক্সট-টু-স্পিচ (TTS)' : 'Text-to-speech provider'}
                  value={config.tts_provider}
                  onChange={(e) => setConfig((p) => ({ ...p, tts_provider: e.target.value as VoiceConfig['tts_provider'] }))}
                  className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="edge">{isBn ? 'মাইক্রোসফট এজ নিউরাল (সম্পূর্ণ ফ্রি ও উচ্চ মানসম্পন্ন - রিকমেন্ডেড)' : 'Edge Neural TTS (Permanent Free & Studio Quality - Recommended)'}</option>
                  <option value="browser">{t("deviceVoice")}</option>
                  <option value="maya">{t("localNeuralVoice")}</option>
                  <option value="openai">{t("expressiveCloudVoice")}</option>
                </select>
                <p id="admin-voice-disclosure" className="text-xs text-muted-foreground">{t('generatedVoice')}</p>
              </div>
            </CardContent>
          </Card>

          {/* Edge Neural Voice Models Configuration */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <span>{isBn ? 'স্থায়ী ফ্রি নিউরাল ভয়েস মডেল কনফিগারেশন' : 'Permanent Free Neural Voice Configuration'}</span>
                </CardTitle>
                <Badge className="w-fit bg-emerald-700/10 text-emerald-700 dark:text-emerald-400 border-emerald-600/20 text-[11px] font-semibold">
                  {isBn ? '১০০% ফ্রি আজীবন • কোনো বিলিং নেই' : '100% Free Forever • Zero API Cost'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                {isBn
                  ? 'কোনো এপিআই কি বা পেমেন্ট ছাড়াই আজীবন উচ্চমানের মানবিক বাংলা ও ইংরেজি কণ্ঠ নির্বাচন করুন।'
                  : 'Select high-fidelity natural neural human voices for Bangla and English with zero API keys or monthly costs.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-card">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>🇧🇩</span>
                    <span>{isBn ? 'বাংলা নিউরাল ভয়েস (Bangla Voice)' : 'Bangla Neural Voice (bn-BD / bn-IN)'}</span>
                  </Label>
                  <select aria-label={isBn ? 'বাংলা নিউরাল ভয়েস (Bangla Voice)' : 'Bangla Neural Voice (bn-BD / bn-IN)'}
                    value={config.edge_voice_bn ?? 'bn-BD-NabanitaNeural'}
                    onChange={(e) => setConfig((p) => ({ ...p, edge_voice_bn: e.target.value }))}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="bn-BD-NabanitaNeural">{isBn ? 'নবনীতা (Nabanita) - নারী, বাংলাদেশী (অত্যন্ত সাবলীল ও প্রাণবন্ত) [ডিফল্ট]' : 'bn-BD-NabanitaNeural (Female, Bangladeshi - Warm & Expressive) [Default]'}</option>
                    <option value="bn-BD-PradeepNeural">{isBn ? 'প্রদীপ (Pradeep) - পুরুষ, বাংলাদেশী (শান্ত, গম্ভীর ও প্রফেশনাল)' : 'bn-BD-PradeepNeural (Male, Bangladeshi - Calm & Clear)'}</option>
                    <option value="bn-IN-TanishaaNeural">{isBn ? 'তানিশা (Tanishaa) - নারী, পশ্চিমবঙ্গ বাংলা' : 'bn-IN-TanishaaNeural (Female, Indian Bengali)'}</option>
                    <option value="bn-IN-BashkarNeural">{isBn ? 'ভাস্কর (Bashkar) - পুরুষ, পশ্চিমবঙ্গ বাংলা' : 'bn-IN-BashkarNeural (Male, Indian Bengali)'}</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    {isBn ? 'বাংলাদেশী চিকিৎসকদের জন্য নবনীতা বা প্রদীপ বাচনভঙ্গি সবচেয়ে প্রাকৃতিক ও বোধগম্য।' : 'Native Bangladeshi cadence designed for clinical clarity and warmth.'}
                  </p>
                </div>

                <div className="space-y-1.5 p-3 rounded-lg border border-border bg-card">
                  <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <span>🌐</span>
                    <span>{isBn ? 'ইংরেজি নিউরাল ভয়েস (English Voice)' : 'English Neural Voice (en-US / en-IN / en-GB)'}</span>
                  </Label>
                  <select aria-label={isBn ? 'ইংরেজি নিউরাল ভয়েস (English Voice)' : 'English Neural Voice (en-US / en-IN / en-GB)'}
                    value={config.edge_voice_en ?? 'en-US-JennyNeural'}
                    onChange={(e) => setConfig((p) => ({ ...p, edge_voice_en: e.target.value }))}
                    className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs focus:ring-1 focus:ring-primary"
                  >
                    <option value="en-US-JennyNeural">{isBn ? 'জেনি (Jenny) - নারী, কনভার্সেশনাল ও স্বাভাবিক [ডিফল্ট]' : 'en-US-JennyNeural (Female, US Conversational & Natural) [Default]'}</option>
                    <option value="en-US-GuyNeural">{isBn ? 'গাই (Guy) - পুরুষ, বন্ধুসুলভ ও স্পষ্ট' : 'en-US-GuyNeural (Male, US Natural & Friendly)'}</option>
                    <option value="en-IN-NeerjaExpressiveNeural">{isBn ? 'নির্জা (Neerja) - নারী, সাউথ এশিয়ান এক্সপ্রেসিভ (মেডিকেল টার্মের জন্য সেরা)' : 'en-IN-NeerjaExpressiveNeural (Female, South Asian - Best for Medical Terms)'}</option>
                    <option value="en-IN-NeerjaNeural">{isBn ? 'নির্জা স্ট্যান্ডার্ড (Neerja Standard) - নারী' : 'en-IN-NeerjaNeural (Female, South Asian Standard)'}</option>
                    <option value="en-GB-RyanNeural">{isBn ? 'রায়ান (Ryan) - পুরুষ, ব্রিটিশ প্রফেশনাল' : 'en-GB-RyanNeural (Male, British Professional)'}</option>
                  </select>
                  <p className="text-[11px] text-muted-foreground">
                    {isBn ? 'ইংরেজি মেডিকেল টার্ম ও ড্রাগের নাম নিখুঁত উচ্চারণে সহায়তা করে।' : 'Natural inflection with precise pronunciation of generic drug names.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instant Human Vocal Reactions */}
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Bot className="w-5 h-5 text-indigo-600" />
                  <span>{isBn ? 'ইনস্ট্যান্ট হিউম্যান ভোকাল রিঅ্যাকশন (০-মিলি-সেকেন্ড ফিলার)' : 'Instant Human Vocal Reactions (0ms Fillers & Feedback)'}</span>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Label htmlFor="toggle-reactions" className="text-xs font-semibold cursor-pointer">
                    {config.vocal_reactions_enabled ?? true ? (
                      <Badge className="bg-primary text-primary-foreground text-[10px]">{isBn ? 'সক্রিয়' : 'Active'}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">{isBn ? 'নিষ্ক্রিয়' : 'Disabled'}</Badge>
                    )}
                  </Label>
                  <input
                    id="toggle-reactions"
                    type="checkbox"
                    checked={config.vocal_reactions_enabled ?? true}
                    onChange={(e) => setConfig((p) => ({ ...p, vocal_reactions_enabled: e.target.checked }))}
                    className="accent-primary w-5 h-5 rounded cursor-pointer shrink-0"
                  />
                </div>
              </div>
              <CardDescription className="text-xs">
                {isBn
                  ? 'কথা বলা শেষ হওয়ার সাথে সাথে রোবোটিক নীরবতা এড়াতে সহকারী তাৎক্ষণিক প্রাকৃতিক হিউম্যান প্রতিক্রিয়া ("হুম...", "জি, দেখছি...", "হয়ে গেছে।") শোনাবে।'
                  : 'Eliminates robotic silence by playing instantaneous natural conversational fillers ("Hmm...", "Looking into this...", "Done.") while medical reasoning computes.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-3">
              <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                  {isBn ? 'ভোকাল রিঅ্যাকশন অডিও পরীক্ষা (ক্লিক করে শুনুন)' : 'Audition Real Human Vocal Clips (Click to Preview)'}
                </span>

                <div className="space-y-3">
                  <div>
                    <span className="text-[11px] font-semibold text-foreground/80 block mb-1.5">
                      {isBn ? 'বাংলা তাৎক্ষণিক প্রতিক্রিয়া:' : 'Bangla Vocal Reactions:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'জি, বুঝেছি', file: '/voice/reactions/bn-understood-1.mp3' },
                        { label: 'ঠিক আছে', file: '/voice/reactions/bn-understood-2.mp3' },
                        { label: 'একটু দেখছি...', file: '/voice/reactions/bn-thinking-1.mp3' },
                        { label: 'লাইব্রেরিতে খুঁজছি...', file: '/voice/reactions/bn-thinking-2.mp3' },
                        { label: 'হুম, একটু সময় দিন...', file: '/voice/reactions/bn-thinking-3.mp3' },
                        { label: 'হয়ে গেছে', file: '/voice/reactions/bn-success-1.mp3' },
                        { label: 'জরুরি সতর্কতা', file: '/voice/reactions/bn-alert-1.mp3' },
                        { label: 'একটু নিশ্চিত হয়ে নিই', file: '/voice/reactions/bn-clarify-1.mp3' },
                      ].map((clip) => (
                        <button
                          key={clip.file}
                          type="button"
                          onClick={() => handlePlayReactionAudio(clip.file)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer ${
                            playingReaction === clip.file
                              ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                              : 'bg-card text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          <Play className="w-3 h-3" />
                          <span>{clip.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-foreground/80 block mb-1.5">
                      {isBn ? 'ইংরেজি তাৎক্ষণিক প্রতিক্রিয়া:' : 'English Vocal Reactions:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Understood', file: '/voice/reactions/en-understood-1.mp3' },
                        { label: 'Got it', file: '/voice/reactions/en-understood-2.mp3' },
                        { label: 'Looking into this...', file: '/voice/reactions/en-thinking-1.mp3' },
                        { label: 'Checking library...', file: '/voice/reactions/en-thinking-2.mp3' },
                        { label: 'Hmm, one moment...', file: '/voice/reactions/en-thinking-3.mp3' },
                        { label: 'Done', file: '/voice/reactions/en-success-1.mp3' },
                        { label: 'Safety Alert', file: '/voice/reactions/en-alert-1.mp3' },
                      ].map((clip) => (
                        <button
                          key={clip.file}
                          type="button"
                          onClick={() => handlePlayReactionAudio(clip.file)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-all cursor-pointer ${
                            playingReaction === clip.file
                              ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                              : 'bg-card text-foreground border-border hover:bg-muted'
                          }`}
                        >
                          <Play className="w-3 h-3" />
                          <span>{clip.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PERSONA & AVATAR */}
        <TabsContent value="persona" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="space-y-4 md:col-span-2">
              <Card className="border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span>{isBn ? 'সহকারী নাম ও টোন প্রিসেট' : 'Persona Name & Default Tone'}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{isBn ? 'সহকারীর নাম' : 'Assistant Name'}</Label>
                      <Input
                        value={config.persona_name}
                        onChange={(e) => setConfig((p) => ({ ...p, persona_name: e.target.value }))}
                        className="text-sm h-9"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{isBn ? 'ডিফল্ট টোন প্রিসেট' : 'Default Tone Preset'}</Label>
                      <select aria-label={isBn ? 'ডিফল্ট টোন প্রিসেট' : 'Default Tone Preset'}
                        value={config.persona_preset ?? 'friendly'}
                        onChange={(e) => setConfig((p) => ({ ...p, persona_preset: e.target.value as 'reserved' | 'friendly' }))}
                        className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                      >
                        <option value="friendly">{isBn ? 'বন্ধুসুলভ (Friendly - Default)' : 'Friendly (Default)'}</option>
                        <option value="reserved">{isBn ? 'সংযত (Reserved - Minimal)' : 'Reserved (Minimal)'}</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{isBn ? 'সকালবেলার অভিবাদন (বাংলা)' : 'Morning Greeting (Bangla)'}</Label>
                    <Input
                      value={config.default_greeting_morning_bn ?? ''}
                      onChange={(e) => setConfig((p) => ({ ...p, default_greeting_morning_bn: e.target.value }))}
                      className="text-sm h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{isBn ? 'অপরাহ্নের অভিবাদন (বাংলা)' : 'Afternoon Greeting (Bangla)'}</Label>
                    <Input
                      value={config.default_greeting_afternoon_bn ?? ''}
                      onChange={(e) => setConfig((p) => ({ ...p, default_greeting_afternoon_bn: e.target.value }))}
                      className="text-sm h-9"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{isBn ? 'সন্ধ্যার অভিবাদন (বাংলা)' : 'Evening Greeting (Bangla)'}</Label>
                    <Input
                      value={config.default_greeting_evening_bn ?? ''}
                      onChange={(e) => setConfig((p) => ({ ...p, default_greeting_evening_bn: e.target.value }))}
                      className="text-sm h-9"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Avatar Preview & Reaction Testing */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-center text-center space-y-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {isBn ? 'লাইভ ক্যারেক্টার ও রিঅ্যাকশন প্রিভিউ' : 'Live Avatar & Reaction Tester'}
              </span>
              <DocMateAvatar state={previewReaction} size="lg" showBadge />
              <div className="space-y-1">
                <span className="font-bold text-sm text-foreground block">{config.persona_name}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {previewReaction}
                </Badge>
              </div>

              {/* Reaction Pill Buttons */}
              <div className="pt-2 flex flex-wrap gap-1 justify-center max-w-[240px]">
                {(['greeting', 'listening', 'understood', 'thinking', 'explaining', 'concern', 'apology', 'happy', 'idle'] as DocMateReaction[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setPreviewReaction(r)}
                    className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
                      previewReaction === r
                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: PHRASE BANK GOVERNANCE */}
        <TabsContent value="phrasebank" className="space-y-4">
          <Card className="border-border">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-600" />
                    <span>{isBn ? 'যাচাইকৃত ফ্রেজ ব্যাংক ম্যানেজার' : 'Vetted Phrase Bank Manager'}</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {isBn
                      ? 'চিকিৎসকদের সঙ্গে সহকারীর সমস্ত প্রমিত বাক্য পরিচালনা ও যাচাই করুন।'
                      : 'Review and manage all conversational response variants in Bangla and English.'}
                  </CardDescription>
                </div>

                <Button
                  size="sm"
                  onClick={() => {
                    setNewCategory('acknowledge');
                    setNewLocale('bn');
                    setNewPreset('friendly');
                    setNewText('');
                    setNewStatus('draft');
                    setIsAddOpen(true);
                  }}
                  className="gap-1.5 h-8 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isBn ? 'নতুন ফ্রেজ যোগ করুন' : 'Add New Phrase'}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-2 space-y-4">
              {/* Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder={isBn ? 'ফ্রেজ অনুসন্ধান...' : 'Search phrases...'}
                    value={phraseSearch}
                    onChange={(e) => setPhraseSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <select aria-label={isBn ? 'ক্যাটাগরি অনুযায়ী দেখুন' : 'Filter by category'}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="all">{isBn ? 'সকল ক্যাটাগরি' : 'All Categories'}</option>
                  {PHRASE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select aria-label={isBn ? 'ভাষা অনুযায়ী দেখুন' : 'Filter by language'}
                  value={selectedLocale}
                  onChange={(e) => setSelectedLocale(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="all">{isBn ? 'উভয় ভাষা (BN/EN)' : 'Both Locales'}</option>
                  <option value="bn">Bangla (বাংলা)</option>
                  <option value="en">English</option>
                </select>

                <select aria-label={isBn ? 'স্ট্যাটাস অনুযায়ী দেখুন' : 'Filter by status'}
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="all">{isBn ? 'সকল স্থিতি' : 'All Status'}</option>
                  <option value="live">{isBn ? 'সক্রিয় (Live)' : 'Live'}</option>
                  <option value="reviewed">{isBn ? 'পর্যালোচিত (Reviewed)' : 'Reviewed'}</option>
                  <option value="draft">{isBn ? 'খসড়া (Draft)' : 'Draft'}</option>
                </select>
              </div>

              {/* Phrase List Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                {phraseLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : phraseEntries.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground">
                    {isBn ? 'কোনো ফ্রেজ পাওয়া যায়নি' : 'No phrases matched your filters'}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {phraseEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {entry.category}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] font-mono">
                              {entry.locale.toUpperCase()}
                            </Badge>
                            <Badge
                              className={`text-[10px] ${
                                entry.status === 'live'
                                  ? 'bg-emerald-700 text-white'
                                  : entry.status === 'reviewed'
                                  ? 'bg-sky-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}
                            >
                              {entry.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              Preset: {entry.preset}
                            </span>
                          </div>
                          <p className="text-sm text-foreground font-medium">{entry.text}</p>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditEntry(entry)}
                            className="h-7 text-xs gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>{isBn ? 'সম্পাদনা' : 'Edit'}</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Phrase Dialog */}
      {editEntry && (
        <Dialog open={Boolean(editEntry)} onOpenChange={() => setEditEntry(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {isBn ? 'ফ্রেজ সম্পাদনা করুন' : 'Edit Phrase Entry'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Category: <strong className="font-mono">{editEntry.category}</strong> ({editEntry.locale.toUpperCase()})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isBn ? 'ফ্রেজের টেক্সট' : 'Phrase Text'}</Label>
                <textarea
                  value={editEntry.text}
                  onChange={(e) => setEditEntry({ ...editEntry, text: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background p-2 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{isBn ? 'স্থিতি' : 'Status'}</Label>
                  <select aria-label={isBn ? 'স্থিতি' : 'Status'}
                    value={editEntry.status}
                    onChange={(e) => setEditEntry({ ...editEntry, status: e.target.value as 'draft' | 'reviewed' | 'live' })}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="draft">{isBn ? 'খসড়া (Draft)' : 'Draft'}</option>
                    <option value="reviewed">{isBn ? 'পর্যালোচিত (Reviewed)' : 'Reviewed'}</option>
                    <option value="live">{isBn ? 'সক্রিয় (Live)' : 'Live'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{isBn ? 'প্রিসেট' : 'Preset'}</Label>
                  <select aria-label={isBn ? 'প্রিসেট' : 'Preset'}
                    value={editEntry.preset}
                    onChange={(e) => setEditEntry({ ...editEntry, preset: e.target.value as 'reserved' | 'friendly' | 'all' })}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="friendly">{isBn ? 'বন্ধুসুলভ' : 'Friendly'}</option>
                    <option value="reserved">{isBn ? 'সংযত' : 'Reserved'}</option>
                    <option value="all">{isBn ? 'উভয়' : 'Both'}</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditEntry(null)}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button size="sm" onClick={handleUpdatePhrase} disabled={dialogSaving}>
                {dialogSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isBn ? 'সংরক্ষণ' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add New Phrase Dialog */}
      {isAddOpen && (
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                {isBn ? 'নতুন ফ্রেজ যোগ করুন' : 'Add New Phrase'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {isBn
                  ? 'ডকমেট এআই সহকারীর ফ্রেজ ব্যাংকে নতুন প্রমিত বাক্য যুক্ত করুন।'
                  : 'Add a new vetted phrase variant to the assistant vocabulary.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{isBn ? 'ক্যাটাগরি' : 'Category'}</Label>
                  <select aria-label={isBn ? 'ক্যাটাগরি' : 'Category'}
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    {PHRASE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{isBn ? 'ভাষা' : 'Locale'}</Label>
                  <select aria-label={isBn ? 'ভাষা' : 'Locale'}
                    value={newLocale}
                    onChange={(e) => setNewLocale(e.target.value as 'bn' | 'en')}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="bn">Bangla (বাংলা)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">{isBn ? 'ফ্রেজের টেক্সট' : 'Phrase Text'}</Label>
                <textarea
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder={isBn ? 'যেমন: জি, দেখছি...' : 'e.g., Understood, let me check that...'}
                  rows={3}
                  className="w-full rounded-md border border-border bg-background p-2 text-sm focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{isBn ? 'প্রিসেট' : 'Preset'}</Label>
                  <select aria-label={isBn ? 'প্রিসেট' : 'Preset'}
                    value={newPreset}
                    onChange={(e) => setNewPreset(e.target.value as 'reserved' | 'friendly' | 'all')}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="friendly">{isBn ? 'বন্ধুসুলভ' : 'Friendly'}</option>
                    <option value="reserved">{isBn ? 'সংযত' : 'Reserved'}</option>
                    <option value="all">{isBn ? 'উভয়' : 'Both'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">{isBn ? 'স্থিতি' : 'Status'}</Label>
                  <select aria-label={isBn ? 'স্থিতি' : 'Status'}
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as 'draft' | 'reviewed' | 'live')}
                    className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs"
                  >
                    <option value="draft">{isBn ? 'খসড়া (Draft)' : 'Draft'}</option>
                    <option value="reviewed">{isBn ? 'পর্যালোচিত (Reviewed)' : 'Reviewed'}</option>
                    <option value="live">{isBn ? 'সক্রিয় (Live)' : 'Live'}</option>
                  </select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                {isBn ? 'বাতিল' : 'Cancel'}
              </Button>
              <Button size="sm" onClick={handleCreatePhrase} disabled={dialogSaving}>
                {dialogSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isBn ? 'যুক্ত করুন' : 'Add Phrase'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
