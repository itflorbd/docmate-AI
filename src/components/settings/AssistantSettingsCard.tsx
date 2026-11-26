'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bot, Volume2, Save, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { selectPhrase } from '@/lib/persona/phrasebank';
import { useVoice } from '@/context/VoiceContext';

interface AssistantPrefs {
  address_style: 'doctor' | 'doctor_sahib' | 'doctor_madam' | 'name';
  tone_preset?: 'reserved' | 'friendly';
  verbosity: 'brief' | 'normal' | 'detailed';
  sounds_enabled: boolean;
  hints_enabled: boolean;
  avatar_enabled: boolean;
  speech_rate?: number;
  voice_id: string;
}

export function AssistantSettingsCard({ userName }: { userName?: string }) {
  const locale = useLocale() as 'bn' | 'en';
  const isBn = locale === 'bn';
  const t = useTranslations('voice');
  const { speakText, config, voiceSettingsLoaded, applySpeechPreferences } = useVoice();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playingSample, setPlayingSample] = useState(false);

  const [prefs, setPrefs] = useState<AssistantPrefs>({
    address_style: 'doctor',
    verbosity: 'normal',
    sounds_enabled: true,
    hints_enabled: true,
    avatar_enabled: true,
    voice_id: 'default',
  });

  const speechRate = prefs.speech_rate ?? config.default_speed;
  const tonePreset = prefs.tone_preset ?? config.persona_preset ?? 'friendly';

  useEffect(() => {
    fetch('/api/settings/assistant')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.preferences && data.persisted) setPrefs(data.preferences);
      })
      .catch(() => toast.error(isBn ? 'সেটিংস লোড ব্যর্থ' : 'Failed to load assistant settings'))
      .finally(() => setLoading(false));
  }, [isBn]);

  const handleSave = async () => {
    setSaving(true);
    const preferences = { ...prefs, speech_rate: speechRate, tone_preset: tonePreset };
    try {
      const res = await fetch('/api/settings/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });

      if (!res.ok) throw new Error('Save failed');
      applySpeechPreferences(preferences);
      toast.success(isBn ? 'সহকারী সেটিংস সফলভাবে সংরক্ষিত হয়েছে' : 'Assistant preferences saved');
    } catch {
      toast.error(isBn ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleListenSample = () => {
    if (playingSample) return;
    setPlayingSample(true);

    const doctorTitle =
      prefs.address_style === 'name' && userName
        ? (isBn ? `ডাঃ ${userName}` : `Dr. ${userName}`)
        : prefs.address_style === 'doctor_sahib'
        ? 'ডাক্তার সাহেব'
        : prefs.address_style === 'doctor_madam'
        ? 'ডাক্তার ম্যাডাম'
        : (isBn ? 'ডাক্তার' : 'Doctor');

    const sampleText = config.tts_provider === 'maya' ? t('conversationGreeting') : selectPhrase('greeting', locale, {
      preset: tonePreset,
      doctorTitle,
      seed: 7,
    });

    void speakText(sampleText, (error) => {
      setPlayingSample(false);
      if (error) toast.error(error);
    }, {
      preview: true,
      rate: speechRate,
      voiceGender: prefs.voice_id === 'male' || prefs.voice_id === 'female'
        ? prefs.voice_id
        : config.default_voice_gender,
      style: tonePreset === 'reserved' ? 'neutral' : 'warm',
    });
  };

  if (loading) {
    return (
      <Card className="border-border">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border md:col-span-2">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span>{isBn ? 'সহকারী ব্যক্তিগতকরণ (DocMate Assistant)' : 'DocMate Assistant Preferences'}</span>
              <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                Persona
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {isBn
                ? 'ডকমেট এআই-এর সম্ভাষণ, বাচনভঙ্গি, ভয়েস গতি ও আচরণ আপনার পছন্দমতো সাজান।'
                : 'Configure how DocMate AI greets you, speaks, and formats clinical summaries.'}
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-3 text-xs gap-1 font-semibold self-start sm:self-auto"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isBn ? 'সংরক্ষণ করুন' : 'Save Preferences'}</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Address Style */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground">
              {isBn ? 'আমাকে যেভাবে সম্বোধন করবেন' : 'How to address me'}
            </Label>
            <select aria-label={isBn ? 'আমাকে যেভাবে সম্বোধন করবেন' : 'How to address me'}
              value={prefs.address_style}
              onChange={(e) => setPrefs({ ...prefs, address_style: e.target.value as AssistantPrefs['address_style'] })}
              className="w-full text-xs h-9 px-2.5 rounded-md border border-input bg-background font-medium focus:ring-1 focus:ring-primary"
            >
              <option value="doctor">{isBn ? 'ডাক্তার (Doctor) [ডিফল্ট]' : 'Doctor [Default]'}</option>
              <option value="doctor_sahib">{isBn ? 'ডাক্তার সাহেব' : 'Doctor Sahib'}</option>
              <option value="doctor_madam">{isBn ? 'ডাক্তার ম্যাডাম' : 'Doctor Madam'}</option>
              <option value="name">{isBn ? 'আমার নাম দিয়ে (ডাঃ ...)' : 'By My Name'}</option>
            </select>
            <p className="text-[10px] text-muted-foreground">
              {isBn ? 'স্বয়ংক্রিয়ভাবে কোনো জেন্ডার অনুমান করা হয় না।' : 'Gender-neutral by default.'}
            </p>
          </div>

          {/* 2. Tone Preset */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground">
              {isBn ? 'টোন / বাচনভঙ্গি' : 'Tone Preset'}
            </Label>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setPrefs({ ...prefs, tone_preset: 'friendly' })}
                className={`py-1.5 px-2.5 text-xs rounded-md border font-medium transition-colors ${
                  tonePreset === 'friendly'
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-background hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                {isBn ? 'বন্ধুসুলভ' : 'Friendly'}
              </button>
              <button
                type="button"
                onClick={() => setPrefs({ ...prefs, tone_preset: 'reserved' })}
                className={`py-1.5 px-2.5 text-xs rounded-md border font-medium transition-colors ${
                  tonePreset === 'reserved'
                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                    : 'bg-background hover:bg-muted text-muted-foreground border-border'
                }`}
              >
                {isBn ? 'সংযত' : 'Reserved'}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {tonePreset === 'friendly'
                ? (isBn ? 'পেশাদার ও উষ্ণ যোগাযোগ।' : 'Professional warmth and courteous phrasing.')
                : (isBn ? 'অতিরিক্ত শিষ্টাচারবিহীন সংক্ষিপ্ত রূপ।' : 'Minimal pleasantries, direct clinical answers.')}
            </p>
          </div>

          {/* 3. Verbosity */}
          <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-card">
            <Label className="text-xs font-semibold text-foreground">
              {isBn ? 'বিস্তারিত মাত্রা' : 'Verbosity Level'}
            </Label>
            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
              {(['brief', 'normal', 'detailed'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setPrefs({ ...prefs, verbosity: level })}
                  className={`py-1.5 px-1.5 text-xs rounded-md border font-medium transition-colors ${
                    prefs.verbosity === level
                      ? 'bg-primary text-primary-foreground border-primary font-semibold'
                      : 'bg-background hover:bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {level === 'brief'
                    ? (isBn ? 'সংক্ষিপ্ত' : 'Brief')
                    : level === 'normal'
                    ? (isBn ? 'স্বাভাবিক' : 'Normal')
                    : (isBn ? 'বিস্তারিত' : 'Detailed')}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {isBn ? 'জরুরি পরিস্থিতিতে স্বয়ংক্রিয়ভাবে সংক্ষিপ্ত মোডে চলে যাবে।' : 'Auto-switches to Brief in urgent cases.'}
            </p>
          </div>
        </div>

        {/* Voice and Speech Controls */}
        <div className="p-3.5 rounded-lg border border-border bg-muted/20 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-primary" />
                <span>{isBn ? 'ভয়েস সহকারী ও কথার গতি' : 'Voice Assistant & Speech Rate'}</span>
              </span>
              <p className="text-[11px] text-muted-foreground">
                {isBn
                  ? 'কথোপকথন ও ড্রাফট সারসংক্ষেপ পড়ার গতি এবং লিঙ্গ নির্বাচন করুন।'
                  : 'Adjust speech pace and assistant voice synthesis gender.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleListenSample}
                disabled={playingSample || !voiceSettingsLoaded}
                aria-describedby="sample-voice-disclosure"
                className="h-8 px-2.5 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
              >
                {playingSample ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isBn ? 'ভয়েস শুনে দেখুন' : 'Sample Voice'}</span>
              </Button>
            </div>
          </div>

          <p id="sample-voice-disclosure" className="text-xs text-muted-foreground">{t('generatedVoice')}</p>

          {config.tts_provider === 'edge' && (
            <div className="flex items-center gap-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[11px]">
              <Sparkles className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                {isBn
                  ? 'সিস্টেম স্থায়ী ফ্রি মাইক্রোসফট এজ নিউরাল ভয়েস ও ইনস্ট্যান্ট হিউম্যান রিঅ্যাকশন মোডে চলছে।'
                  : 'Active voice engine: Edge Neural TTS with 0ms Instant Human Vocal Reactions.'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{isBn ? 'সহকারী ভয়েস:' : 'Voice:'}</span>
              <select aria-label={isBn ? 'সহকারী ভয়েস' : 'Voice'}
                value={prefs.voice_id}
                onChange={(e) => setPrefs({ ...prefs, voice_id: e.target.value })}
                className="text-xs h-8 px-2 rounded-md border border-input bg-background font-medium"
              >
                <option value="default">{t("defaultVoice")}</option>
                <option value="female">{isBn ? 'নারী কণ্ঠ (Female)' : 'Female'}</option>
                <option value="male">{isBn ? 'পুরুষ কণ্ঠ (Male)' : 'Male'}</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{isBn ? 'কথার গতি:' : 'Speech Speed:'}</span>
              <div className="flex items-center gap-1">
                {[0.8, 0.95, 1.0, 1.1, 1.2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPrefs({ ...prefs, speech_rate: spd })}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                      speechRate === spd
                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                        : 'bg-background text-muted-foreground border-border'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-card cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-semibold text-foreground block">
                {isBn ? 'সাউন্ড ইফেক্টস (ইয়ারকন)' : 'Sound Effects (Earcons)'}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {isBn ? 'মাইক খোলা ও বন্ধে মৃদু শব্দ।' : 'Soft audio chimes on mic start/stop.'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={prefs.sounds_enabled}
              onChange={(e) => setPrefs({ ...prefs, sounds_enabled: e.target.checked })}
              className="accent-primary w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-card cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-semibold text-foreground block">
                {isBn ? 'সহায়ক পরামর্শ (Hints)' : 'Proactive Hints'}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {isBn ? 'জরুরি তথ্যের প্রাসঙ্গিক ইঙ্গিত।' : 'Suggest missing lab/exam findings.'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={prefs.hints_enabled}
              onChange={(e) => setPrefs({ ...prefs, hints_enabled: e.target.checked })}
              className="accent-primary w-4 h-4 rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-card cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="space-y-0.5 pr-2">
              <span className="text-xs font-semibold text-foreground block">
                {isBn ? 'ক্যারেক্টার দেখান' : 'Show Cartoon Avatar'}
              </span>
              <span className="text-[10px] text-muted-foreground block">
                {isBn ? 'অ্যানিমেটেড ডাক্তার ক্যারেক্টার।' : 'Animated character expressions.'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={prefs.avatar_enabled}
              onChange={(e) => setPrefs({ ...prefs, avatar_enabled: e.target.checked })}
              className="accent-primary w-4 h-4 rounded cursor-pointer"
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
