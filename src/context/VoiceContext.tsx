'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState, VoiceConfig, VoiceMessage, SttProvider, TtsProvider, TtsSpeakOptions } from '@/lib/voice/types';
import { createSttProvider } from '@/lib/voice/stt-provider';
import { createTtsProvider } from '@/lib/voice/tts-provider';
import { routeVoiceIntent } from '@/lib/voice/intent-router';
import { conversationLocale, conversationalReply, type ConversationLanguage, type ConversationLocale } from '@/lib/voice/conversation';
import bn from '../../messages/bn.json';
import en from '../../messages/en.json';
import { extractClinicalFacts } from '@/lib/clinical-extractor';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';
import { earconManager } from '@/lib/voice/earcons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';

type SpeechOverrides = Partial<Pick<TtsSpeakOptions, 'rate' | 'voiceGender' | 'style' | 'locale'>> & {
  provider?: VoiceConfig['tts_provider'];
  preview?: boolean;
  requireLiveProvider?: boolean;
  scripted?: boolean;
};

type SpeechPreferences = {
  tone_preset: 'friendly' | 'reserved';
  speech_rate: number;
  voice_id: string;
  avatar_enabled: boolean;
  sounds_enabled: boolean;
};

interface VoiceContextType {
  // State
  isOpen: boolean;
  state: VoiceState;
  amplitude: number;
  transcript: string;
  interimTranscript: string;
  messages: VoiceMessage[];
  config: VoiceConfig;
  voiceSettingsLoaded: boolean;
  conversationLanguage: ConversationLanguage;
  setConversationLanguage: (language: ConversationLanguage) => void;
  microphoneLocale: ConversationLocale;
  privateMode: boolean;
  avatarVisible: boolean;
  dailyMinutesRemaining: number;
  hasPermission: boolean | null;
  errorText: string | null;

  // Actions
  openVoicePanel: () => void;
  closeVoicePanel: () => void;
  toggleVoicePanel: () => void;
  startPushToTalk: () => Promise<void>;
  stopPushToTalk: () => Promise<void>;
  cancelPushToTalk: () => void;
  speakText: (text: string, onEnd?: (error?: string) => void, overrides?: SpeechOverrides) => Promise<void>;
  playVocalReaction: (category: 'thinking' | 'understood' | 'success' | 'alert' | 'clarify', targetLocale?: 'bn' | 'en') => void;
  stopSpeech: () => void;
  setTranscript: (text: string) => void;
  submitTranscript: (textToSubmit?: string) => Promise<void>;
  setPrivateMode: (enabled: boolean) => void;
  setAvatarVisible: (visible: boolean) => void;
  applySystemVoiceConfig: (config: Partial<VoiceConfig>) => void;
  applySpeechPreferences: (preferences: SpeechPreferences) => void;
  setSpeechSpeed: (speed: number) => void;
  resetSession: () => void;
  clearMessages: () => void;
  /**
   * An open case registers a handler so spoken questions go through the case
   * conversation (patient context, verified citations) instead of library search.
   */
  registerCaseVoiceHandler: (handler: CaseVoiceHandler | null) => void;
}

export type CaseVoiceHandler = (text: string, replyLocale: 'bn' | 'en') => Promise<{ displayText: string; speechText: string; abstained: boolean; markdown?: string; claims?: VoiceMessage['claims']; status?: string } | null>;

const DEFAULT_CONFIG: VoiceConfig = {
  enabled: true,
  kill_switch: false,
  stt_provider: 'browser',
  tts_provider: 'browser',
  persona_name: 'ডকমেট (DocMate)',
  persona_greeting_bn: 'স্বাগতম, ডাক্তার। বলুন, কীভাবে সাহায্য করতে পারি?',
  persona_greeting_en: 'Welcome, Doctor. How can I assist you today?',
  intro_disclaimer_bn: 'আমি একটি এআই সহকারী। চূড়ান্ত সিদ্ধান্ত আপনার।',
  intro_disclaimer_en: 'I am an AI assistant. The final decision is yours.',
  default_voice_gender: 'female',
  default_speed: 1.0,
  private_mode_default: true,
  avatar_enabled_default: true,
  vocal_reactions_enabled: true,
  edge_voice_bn: 'bn-BD-NabanitaNeural',
  edge_voice_en: 'en-US-JennyNeural',
};

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale() as 'bn' | 'en';
  const t = useTranslations('voice');
  const router = useRouter();
  const pathname = usePathname();
  const { openEvidence } = useEvidenceSheet();

  const isCaseWorkspace = Boolean(
    pathname &&
    (/^\/cases\/[^/]+$/i.test(pathname) || /^\/[a-z]{2,5}\/cases\/[^/]+$/i.test(pathname)) &&
    !pathname.endsWith('/cases/new')
  );

  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [conversationLanguage, setConversationLanguage] = useState<ConversationLanguage>('auto');
  const [lastTurnLocale, setLastTurnLocale] = useState<ConversationLocale | null>(null);
  const microphoneLocale = conversationLanguage === 'auto' ? lastTurnLocale ?? locale : conversationLanguage;
  const [systemConfig, setSystemConfig] = useState<VoiceConfig>(DEFAULT_CONFIG);
  const [voiceSettingsLoaded, setVoiceSettingsLoaded] = useState(false);
  const [speechPreferences, setSpeechPreferences] = useState<SpeechPreferences | null>(null);
  const [speedOverride, setSpeedOverride] = useState<number>();
  const config: VoiceConfig = {
    ...systemConfig,
    default_speed: speedOverride ?? speechPreferences?.speech_rate ?? systemConfig.default_speed,
    default_voice_gender: speechPreferences?.voice_id === 'male' || speechPreferences?.voice_id === 'female'
      ? speechPreferences.voice_id
      : systemConfig.default_voice_gender,
    sounds_enabled: speechPreferences?.sounds_enabled ?? systemConfig.sounds_enabled,
  };
  const tone = speechPreferences?.tone_preset ?? systemConfig.persona_preset;
  const [privateMode, setPrivateModeState] = useState(true);
  const setPrivateMode = useCallback((enabled: boolean) => {
    setPrivateModeState(enabled);
    try {
      localStorage.setItem('docmate_voice_private_mode', String(enabled));
    } catch {
      // storage unavailable
    }
  }, []);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [dailyMinutesRemaining] = useState(60);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const sttRef = useRef<SttProvider | null>(null);
  const caseVoiceHandlerRef = useRef<CaseVoiceHandler | null>(null);
  const registerCaseVoiceHandler = useCallback((handler: CaseVoiceHandler | null) => {
    caseVoiceHandlerRef.current = handler;
  }, []);
  const capturedTranscriptRef = useRef('');
  const pendingSubmitRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playbackRef = useRef<{
    provider: TtsProvider;
    interval?: ReturnType<typeof setInterval>;
    complete?: (error?: string) => void;
    preview?: boolean;
    locale: ConversationLocale;
  } | null>(null);
  const sessionIntroducedRef = useRef(false);
  const mayaFallbackRef = useRef(false);
  const reassuranceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interruptionPromptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speakTextRef = useRef<VoiceContextType['speakText'] | null>(null);

  // Initialize providers
  useEffect(() => {
    sttRef.current = createSttProvider(config.stt_provider);

    return () => {
      sttRef.current?.abortListening();
      clearTimeout(pendingSubmitRef.current);
      if (reassuranceTimerRef.current) clearTimeout(reassuranceTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      if (interruptionPromptTimerRef.current) clearTimeout(interruptionPromptTimerRef.current);
    };
  }, [config.stt_provider]);

  const releaseSpeech = useCallback(() => {
    const playback = playbackRef.current;
    playbackRef.current = null;
    if (!playback) return;
    clearInterval(playback.interval);
    playback.provider.stop();
    return playback;
  }, []);

  useEffect(() => () => { releaseSpeech(); }, [releaseSpeech]);

  const applySpeechPreferences = useCallback((preferences: SpeechPreferences) => {
    setSpeechPreferences(preferences);
    setAvatarVisible(preferences.avatar_enabled);
    setSpeedOverride(undefined);
  }, []);

  const applySystemVoiceConfig = useCallback((voice: Partial<VoiceConfig>) => {
    setSystemConfig((previous) => ({ ...previous, ...voice }));
  }, []);

  // Load global voice settings and doctor persona preferences if available
  useEffect(() => {
    const load = async (path: string) => {
      const response = await fetch(path);
      return response.ok ? response.json() : null;
    };
    let active = true;
    // Personal preferences exist only for signed-in users; skip the request otherwise.
    const personal = load('/api/auth/session').then((session) => (session?.user ? load('/api/settings/assistant') : null));
    void Promise.allSettled([load('/api/settings/voice'), personal])
      .then(([global, personal]) => {
        if (!active) return;
        const voice = global.status === 'fulfilled' ? global.value?.config : null;
        if (voice) {
          setSystemConfig((previous) => ({ ...previous, ...voice }));
          // A doctor's own "read replies aloud" choice wins over the system default.
          let saved: string | null = null;
          try {
            saved = localStorage.getItem('docmate_voice_private_mode');
          } catch {
            saved = null;
          }
          setPrivateModeState(saved === null ? voice.private_mode_default ?? false : saved === 'true');
          setAvatarVisible(voice.avatar_enabled_default ?? true);
        }
        if (personal.status === 'fulfilled' && personal.value?.persisted) {
          applySpeechPreferences(personal.value.preferences);
        }
        setVoiceSettingsLoaded(true);
      });
    return () => { active = false; };
  }, [applySpeechPreferences]);

  const stopSpeech = useCallback((isUserInterruption = false) => {
    if (interruptionPromptTimerRef.current) clearTimeout(interruptionPromptTimerRef.current);
    const playback = releaseSpeech();
    setState('idle');
    setAmplitude(0);
    playback?.complete?.();

    // Offer to continue when a live voice turn is interrupted with Escape.
    if (isUserInterruption && playback && !playback.preview) {
      interruptionPromptTimerRef.current = setTimeout(() => {
        const phrases = playback.locale === 'bn' ? bn.voice : en.voice;
        void speakTextRef.current?.(phrases.continueSpeaking, undefined, { scripted: true, locale: playback.locale });
      }, 1200);
    }
  }, [releaseSpeech]);

  // Barge-in keyboard shortcut: Esc key stops ongoing speech immediately (< 200ms)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state === 'speaking') {
        stopSpeech(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, stopSpeech]);

  const speakText = useCallback<VoiceContextType['speakText']>(
    async (text, onEnd, overrides) => {
      if (!text.trim() || !config.enabled || config.kill_switch) {
        onEnd?.(text.trim() ? t('speechDisabled') : undefined);
        return;
      }
      stopSpeech();
      setState('speaking');
      setErrorText(null);
      // Expressive neural synthesis is used for scripted messages, preview, or whenever
      // edge/openai neural providers are configured.
      const conversation = overrides?.scripted === true && !overrides.preview;
      const preferredTone = tone === 'reserved' ? 'neutral' : 'warm';
      const configuredProvider = overrides?.provider ?? config.tts_provider;
      const providerType = overrides?.preview || conversation || configuredProvider === 'edge' || configuredProvider === 'openai'
        ? configuredProvider
        : 'browser';
      const useDevice = providerType === 'custom_stub' || (conversation && providerType === 'maya' && mayaFallbackRef.current);
      const provider = createTtsProvider(useDevice ? 'browser' : providerType);
      const playback: NonNullable<typeof playbackRef.current> = {
        provider,
        complete: onEnd,
        preview: overrides?.preview,
        locale: overrides?.locale ?? locale,
      };
      playbackRef.current = playback;

      const finish = (error?: string) => {
        if (playbackRef.current !== playback) return;
        releaseSpeech();
        setAmplitude(0);
        setState('idle');
        if (error && !overrides?.preview) setErrorText(error);
        onEnd?.(error);
      };

      try {
        await provider.speak({
          text,
          locale: playback.locale,
          rate: overrides?.rate ?? config.default_speed,
          voiceGender: overrides?.voiceGender ?? config.default_voice_gender,
          conversationTone: conversation ? preferredTone : overrides?.requireLiveProvider ? (overrides.style === 'neutral' ? 'neutral' : 'warm') : undefined,
          requireLiveProvider: overrides?.requireLiveProvider,
          onDeviceFallback: () => {
            if (conversation && providerType === 'maya') mayaFallbackRef.current = true;
          },
          style: overrides?.style ?? preferredTone,
          onStart: () => {
            if (playbackRef.current !== playback || playback.interval) return;
            playback.interval = setInterval(() => setAmplitude(0.3 + Math.random() * 0.5), 120);
          },
          onEnd: () => finish(),
          onError: (code) => {
            const key = code === 'live_voice_unavailable' ? 'mayaLiveVoiceUnavailable'
              : code === 'local_voice_unavailable' ? 'localVoiceUnavailable' : 'speechPlaybackFailed';
            finish(t(key));
          },
        });
      } catch {
        finish(t('speechPlaybackFailed'));
      }
    },
    [config.enabled, config.kill_switch, config.tts_provider, config.default_speed,
      config.default_voice_gender, tone, locale, releaseSpeech, stopSpeech, t]
  );

  useEffect(() => {
    speakTextRef.current = speakText;
  }, [speakText]);

  const playVocalReaction = useCallback(
    (category: 'thinking' | 'understood' | 'success' | 'alert' | 'clarify', targetLocale?: 'bn' | 'en') => {
      if (config.vocal_reactions_enabled === false) return;
      const lang = targetLocale || (locale === 'bn' ? 'bn' : 'en');
      const count = category === 'thinking' ? 3 : (category === 'understood' || category === 'success' ? 2 : 1);
      const index = Math.floor(Math.random() * count) + 1;
      const audioSrc = `/voice/reactions/${lang}-${category}-${index}.mp3`;
      try {
        const audio = new Audio(audioSrc);
        audio.volume = 0.85;
        void audio.play().catch(() => {});
      } catch {
        // Audio playback failed or blocked by autoplay
      }
    },
    [config.vocal_reactions_enabled, locale]
  );

  // Introduce once per session
  const introduceAssistantIfNeeded = useCallback(async () => {
    if (sessionIntroducedRef.current) return;
    sessionIntroducedRef.current = true;
    if (playbackRef.current) return;

    const greeting = locale === 'bn' ? systemConfig.persona_greeting_bn : systemConfig.persona_greeting_en;
    const intro = locale === 'bn' ? systemConfig.intro_disclaimer_bn : systemConfig.intro_disclaimer_en;
    const defaultGreeting = locale === 'bn' ? DEFAULT_CONFIG.persona_greeting_bn : DEFAULT_CONFIG.persona_greeting_en;
    const defaultIntro = locale === 'bn' ? DEFAULT_CONFIG.intro_disclaimer_bn : DEFAULT_CONFIG.intro_disclaimer_en;
    const fullIntro = systemConfig.tts_provider === 'maya' && greeting === defaultGreeting && intro === defaultIntro
      ? t(locale === 'bn' ? 'conversationGreeting' : 'conversationWelcome')
      : `${greeting} ${intro}`;

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: fullIntro,
        locale,
        timestamp: Date.now(),
        verified: true,
      },
    ]);

    await speakText(fullIntro, undefined, { scripted: true });
  }, [systemConfig, locale, speakText, t]);

  useEffect(() => {
    if (!isOpen || !voiceSettingsLoaded) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void introduceAssistantIfNeeded();
    });
    return () => { active = false; };
  }, [isOpen, voiceSettingsLoaded, introduceAssistantIfNeeded]);

  // Auto-dismiss voice assistant when navigating away from a specific case workspace
  useEffect(() => {
    if (!isCaseWorkspace && isOpen) {
      queueMicrotask(() => {
        stopSpeech();
        sttRef.current?.abortListening();
        clearTimeout(pendingSubmitRef.current);
        setIsOpen(false);
      });
    }
  }, [isCaseWorkspace, isOpen, stopSpeech]);

  const openVoicePanel = useCallback(() => {
    if (!isCaseWorkspace) return;
    setIsOpen(true);
  }, [isCaseWorkspace]);

  const closeVoicePanel = useCallback(() => {
    stopSpeech();
    sttRef.current?.abortListening();
    clearTimeout(pendingSubmitRef.current);
    setIsOpen(false);
  }, [stopSpeech]);

  const toggleVoicePanel = useCallback(() => {
    if (isOpen) closeVoicePanel();
    else openVoicePanel();
  }, [isOpen, openVoicePanel, closeVoicePanel]);

  const startPushToTalk = useCallback(async () => {
    if (!isCaseWorkspace) return;
    if (interruptionPromptTimerRef.current) {
      clearTimeout(interruptionPromptTimerRef.current);
      interruptionPromptTimerRef.current = null;
    }

    if (dailyMinutesRemaining <= 0) {
      const limitText =
        locale === 'bn'
          ? 'আজকের ভয়েস সীমা শেষ। টাইপ করে চালিয়ে যান।'
          : 'Daily voice limit reached. Please continue by typing.';
      setErrorText(limitText);
      await speakText(limitText);
      return;
    }

    stopSpeech(false);
    earconManager.playStart(config.sounds_enabled ?? true);
    setErrorText(null);
    setState('listening');
    clearTimeout(pendingSubmitRef.current);
    capturedTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');

    try {
      await sttRef.current?.startListening({
        locale: microphoneLocale,
        hints: ['Dengue', 'Pneumonia', 'Amoxicillin', 'Azithromycin', 'Paracetamol', 'রক্তচাপ', 'জ্বর', 'কাশি', 'শ্বাসকষ্ট'],
        onVolume: (vol) => {
          setAmplitude(vol);
        },
        onResult: (res) => {
          setHasPermission(true);
          if (res.isFinal) {
            capturedTranscriptRef.current = res.text;
            setTranscript(res.text);
            setInterimTranscript('');
          } else {
            setInterimTranscript(res.text);
          }
        },
        onError: (err) => {
          setState('error');
          if (err === 'permission_denied') {
            setHasPermission(false);
            setErrorText(
              locale === 'bn'
                ? 'মাইক্রোফোনের অনুমতি প্রয়োজন। অনুগ্রহ করে ব্রাউজারের অনুমতি দিন।'
                : 'Microphone permission required. Please allow access in browser.'
            );
          } else {
            setErrorText(
              locale === 'bn'
                ? 'কথা বুঝতে পারিনি। আবার বলুন অথবা টাইপ করুন।'
                : 'Could not catch that. Please say again or type.'
            );
          }
        },
        onEnd: () => {
          setState((current) => current === 'listening' ? 'idle' : current);
        },
      });
    } catch {
      setState('error');
    }
  }, [dailyMinutesRemaining, locale, microphoneLocale, speakText, stopSpeech, config.sounds_enabled, isCaseWorkspace]);

  const submitTranscript = useCallback(
    async (textToSubmit?: string) => {
      if (interruptionPromptTimerRef.current) {
        clearTimeout(interruptionPromptTimerRef.current);
        interruptionPromptTimerRef.current = null;
      }

      const query = (textToSubmit ?? transcript).trim();
      if (!query) {
        setState('idle');
        return;
      }

      const replyLocale = conversationLocale(query, conversationLanguage, lastTurnLocale ?? locale);
      const phrases = replyLocale === 'bn' ? bn.voice : en.voice;
      const scripted = { scripted: true, locale: replyLocale } as const;
      setLastTurnLocale(replyLocale);

      // Add doctor message to bubble stream
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'doctor',
          text: query,
          timestamp: Date.now(),
        },
      ]);

      setState('thinking');
      playVocalReaction('thinking', conversationLanguage === 'auto' ? (locale === 'bn' ? 'bn' : 'en') : conversationLanguage);

      // Clear any previous reassurance or timeout timers
      if (reassuranceTimerRef.current) clearTimeout(reassuranceTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

      // 6-second reassurance timer
      reassuranceTimerRef.current = setTimeout(() => {
        const reassureMsg = phrases.conversationWait;
        void speakText(reassureMsg, undefined, scripted);
      }, 6000);

      // 15-second switch-to-typing advisory
      timeoutTimerRef.current = setTimeout(() => {
        setErrorText(phrases.conversationSlow);
      }, 15000);

      const clearThinkingTimers = () => {
        if (reassuranceTimerRef.current) {
          clearTimeout(reassuranceTimerRef.current);
          reassuranceTimerRef.current = null;
        }
        if (timeoutTimerRef.current) {
          clearTimeout(timeoutTimerRef.current);
          timeoutTimerRef.current = null;
        }
      };

      const showCaseError = async (text: string) => {
        setMessages((previous) => [...previous, { id: crypto.randomUUID(), sender: 'assistant', locale: replyLocale, text, timestamp: Date.now() }]);
        await speakText(text, undefined, scripted);
      };

      const quickReply = conversationalReply(query);
      if (quickReply) {
        clearThinkingTimers();
        const reply = phrases[quickReply];
        setMessages((previous) => [...previous, {
          id: crypto.randomUUID(),
          sender: 'assistant',
          locale: replyLocale,
          text: reply,
          timestamp: Date.now(),
        }]);
        await speakText(reply, undefined, scripted);
        return;
      }

      const routing = routeVoiceIntent(query, replyLocale);

      // 1. Blocked Action Safety Stop
      if (routing.blocked) {
        clearThinkingTimers();
        setState('alert');
        const alertMsg = routing.speakableResponse || phrases.actionRequiresScreen;
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            locale: replyLocale,
            text: alertMsg,
            timestamp: Date.now(),
            intent: 'blocked_action',
            verified: true,
          },
        ]);
        await speakText(alertMsg, undefined, { ...scripted, style: 'calm_urgent' });
        return;
      }

      // 1b. System Query (Date, Time, Identity) or Direct Capabilities Explanation
      if (routing.intent === 'system_query' || (routing.speakableResponse && routing.actionPayload)) {
        clearThinkingTimers();
        const payload = routing.actionPayload as Record<string, string> | undefined;
        const displayText =
          replyLocale === 'bn'
            ? payload?.answerBn || routing.speakableResponse!
            : payload?.answerEn || routing.speakableResponse!;
        const speakable = routing.speakableResponse!;

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            locale: replyLocale,
            text: displayText,
            speakableText: speakable,
            timestamp: Date.now(),
            intent: routing.intent,
            verified: true,
          },
        ]);
        await speakText(speakable, undefined, scripted);
        return;
      }

      // 2. Navigation Actions
      if (routing.intent === 'navigate') {
        clearThinkingTimers();
        let navText = routing.speakableResponse ?? '';
        if (routing.targetRoute === 'action:open_evidence') {
          const recentResult = [...messages].reverse().find((message) => message.intent === 'ask_library');
          const citation = recentResult?.citations?.find((item) => item.chunk_id && item.quote);
          if (citation) {
            openEvidence(citation);
          } else {
            navText = phrases.noEvidenceToOpen;
          }
        } else if (routing.targetRoute === 'action:go_back') {
          router.back();
        } else if (routing.targetRoute?.startsWith('/')) {
          router.push(routing.targetRoute);
        } else {
          navText = phrases.useScreenControls;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            locale: replyLocale,
            text: navText,
            timestamp: Date.now(),
            intent: 'navigate',
            verified: true,
          },
        ]);
        await speakText(navText, undefined, scripted);
        return;
      }

      // 3. On an open case, dictation and questions go to the case conversation.
      const caseHandler = caseVoiceHandlerRef.current;
      if (caseHandler) {
        try {
          const reply = await caseHandler(query, replyLocale === 'bn' ? 'bn' : 'en');
          clearThinkingTimers();
          if (!reply) {
            await showCaseError(phrases.conversationLibraryError);
            return;
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `msg-${Date.now()}`,
              sender: 'assistant',
              locale: replyLocale,
              text: reply.markdown || reply.displayText,
              markdown: Boolean(reply.markdown),
              claims: reply.claims,
              status: reply.status,
              speakableText: reply.speechText,
              timestamp: Date.now(),
              intent: 'ask_library',
              verified: true,
            },
          ]);
          // Private mode never reads clinical content aloud; it only says where to look.
          const spoken = privateMode
            ? reply.abstained
              ? phrases.libraryAbstained
              : phrases.reviewLibraryEvidence
            : reply.speechText || reply.displayText;
          await speakText(spoken, undefined, { locale: replyLocale });
        } catch {
          clearThinkingTimers();
          await showCaseError(phrases.conversationLibraryError);
        }
        return;
      }

      // 3b. Clinical Dictation
      if (routing.intent === 'dictate') {
        clearThinkingTimers();
        const extracted = extractClinicalFacts(query, {
          age: 35,
          gender: 'male',
          chief_complaint: '',
          symptoms: [],
          past_medical_history: [],
          current_medicines: [],
          allergies: [],
          vitals: {},
          lab_values: [],
        });
        const dictateMsg =
          replyLocale === 'bn'
            ? `আমি যা শুনলাম: ${extracted.length > 0 ? extracted.map((e) => e.display_value).join(', ') : query}। নিশ্চিত করতে স্ক্রিন দেখুন।`
            : `I understood: ${extracted.length > 0 ? extracted.map((e) => e.display_value).join(', ') : query}. Please confirm on screen.`;

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            locale: replyLocale,
            text: dictateMsg,
            timestamp: Date.now(),
            intent: 'dictate',
            verified: true,
            draftUpdate: extracted,
          },
        ]);
        if (privateMode) {
          await speakText(phrases.reviewDictation, undefined, scripted);
        } else {
          await speakText(dictateMsg, undefined, { locale: replyLocale });
        }
        return;
      }

      const showLibraryError = async (text: string) => {
        setMessages((previous) => [...previous, {
          id: crypto.randomUUID(),
          sender: 'assistant',
          locale: replyLocale,
          text,
          timestamp: Date.now(),
        }]);
        await speakText(text, undefined, scripted);
      };

      // 4. Default: Ask Library via verified /api/ask pipeline
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query, locale: replyLocale }),
        });

        clearThinkingTimers();

        if (!res.ok) {
          await showLibraryError(phrases.conversationLibraryError);
          return;
        }

        const data = await res.json();
        const speakable = data.found === true && data.citations?.length
          ? phrases.reviewLibraryEvidence
          : phrases.libraryAbstained;

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            locale: replyLocale,
            text: data.answer || speakable,
            speakableText: speakable,
            citations: data.citations || [],
            timestamp: Date.now(),
            intent: 'ask_library',
            verified: data.found ?? true,
          },
        ]);

        await speakText(speakable, undefined, scripted);
      } catch {
        clearThinkingTimers();
        await showLibraryError(phrases.noConnection);
      }
    },
    [transcript, locale, conversationLanguage, lastTurnLocale, messages, privateMode, speakText, playVocalReaction, openEvidence, router]
  );

  const stopPushToTalk = useCallback(async () => {
    earconManager.playStop(config.sounds_enabled ?? true);
    setState('transcribing');
    await sttRef.current?.stopListening();
    // Submit after short debounce for speech finalization
    clearTimeout(pendingSubmitRef.current);
    pendingSubmitRef.current = setTimeout(() => {
      if (capturedTranscriptRef.current) {
        void submitTranscript(capturedTranscriptRef.current);
      } else {
        setState((current) => current === 'transcribing' ? 'idle' : current);
      }
    }, 250);
  }, [submitTranscript, config.sounds_enabled]);

  const cancelPushToTalk = useCallback(() => {
    clearTimeout(pendingSubmitRef.current);
    sttRef.current?.abortListening();
    setState((current) => current === 'listening' || current === 'transcribing' ? 'idle' : current);
    setAmplitude(0);
  }, []);

  const resetSession = useCallback(() => {
    stopSpeech();
    sttRef.current?.abortListening();
    setState('idle');
    clearTimeout(pendingSubmitRef.current);
    capturedTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setErrorText(null);
  }, [stopSpeech]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastTurnLocale(null);
  }, []);

  const setSpeechSpeed = useCallback((speed: number) => {
    setSpeedOverride(Math.min(1.2, Math.max(0.8, speed)));
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        isOpen,
        state,
        amplitude,
        transcript,
        interimTranscript,
        messages,
        config,
        voiceSettingsLoaded,
        conversationLanguage,
        setConversationLanguage,
        microphoneLocale,
        privateMode,
        avatarVisible,
        dailyMinutesRemaining,
        hasPermission,
        errorText,
        openVoicePanel,
        closeVoicePanel,
        toggleVoicePanel,
        startPushToTalk,
        stopPushToTalk,
        cancelPushToTalk,
        speakText,
        playVocalReaction,
        stopSpeech,
        setTranscript,
        submitTranscript,
        setPrivateMode,
        setAvatarVisible,
        applySystemVoiceConfig,
        applySpeechPreferences,
        setSpeechSpeed,
        resetSession,
        clearMessages,
        registerCaseVoiceHandler,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}
