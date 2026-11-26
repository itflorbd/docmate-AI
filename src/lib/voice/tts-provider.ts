import { TtsProvider, TtsSpeakOptions, TtsCapabilities, SpeechProviderType } from './types';
import { segmentForSpeech, type SpeechSegment } from '../language/speech-segmenter';

const voiceNames = {
  bn: { female: /piya|female/i, male: /male voice|\bmale\b/i },
  en: { female: /samantha|zira|karen|serena|female/i, male: /daniel|alex|oliver|david|guy|\bmale\b/i },
};

function selectVoice(voices: SpeechSynthesisVoice[], lang: SpeechSegment['lang'], gender: 'male' | 'female') {
  const matching = voices.filter((voice) => voice.localService && voice.lang.split(/[-_]/)[0] === lang);
  const preferred = matching.filter((voice) => voiceNames[lang][gender].test(voice.name));
  const candidates = preferred.length > 0 ? preferred : matching;
  const region = lang === 'bn' ? 'bn-BD' : 'en-US';
  return candidates.find((voice) => voice.lang.replace('_', '-') === region)
    ?? candidates.find((voice) => voice.default)
    ?? candidates[0];
}

export class BrowserSpeechSynthesisTTS implements TtsProvider {
  public name = 'browser_speech_synthesis';
  public capabilities: TtsCapabilities = {
    supports_ssml: false,
    supports_style_instructions: false,
    supports_rate: true,
    supports_pitch: true,
    supports_pause_control: false,
  };
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private cancelVoiceWait: (() => void) | null = null;
  private generation = 0;

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public async speak(options: TtsSpeakOptions): Promise<void> {
    if (!this.isAvailable()) {
      options.onError?.('browser_unsupported');
      return;
    }
    this.stop();
    const generation = this.generation;
    const synth = window.speechSynthesis;
    const segments = segmentForSpeech(options.text, options.locale);
    if (!segments.length) {
      options.onEnd?.();
      return;
    }

    const voiceFor = (lang: SpeechSegment['lang']) => selectVoice(synth.getVoices(), lang, options.voiceGender ?? 'female');
    if (segments.some(({ lang }) => !voiceFor(lang))) {
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          synth.removeEventListener('voiceschanged', onVoicesChanged);
          this.cancelVoiceWait = null;
          resolve();
        };
        const onVoicesChanged = () => {
          if (segments.every(({ lang }) => voiceFor(lang))) finish();
        };
        const timer = setTimeout(finish, 750);
        this.cancelVoiceWait = finish;
        synth.addEventListener('voiceschanged', onVoicesChanged);
      });
    }
    if (this.generation !== generation) return;

    const voices = segments.map(({ lang }) => voiceFor(lang));
    if (voices.some((voice) => !voice)) {
      options.onError?.('local_voice_unavailable');
      return;
    }

    const speakSegment = (index: number) => {
      if (this.generation !== generation) return;
      const segment = segments[index];
      if (!segment) {
        this.currentUtterance = null;
        options.onEnd?.();
        return;
      }
      const voice = voices[index]!;
      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = Math.min(1.2, Math.max(0.8, options.rate ?? 1));
      utterance.pitch = options.pitch ?? (options.style === 'warm' ? 1.04 : 1);
      this.currentUtterance = utterance;
      if (index === 0) {
        utterance.onstart = () => {
          if (this.currentUtterance === utterance) options.onStart?.();
        };
      }
      utterance.onend = () => {
        if (this.currentUtterance === utterance) speakSegment(index + 1);
      };
      utterance.onerror = (event) => {
        if (this.currentUtterance !== utterance) return;
        this.currentUtterance = null;
        options.onError?.(event.error || 'speech_synthesis_failed');
      };
      utterance.onboundary = ({ charIndex, charLength }) => {
        if (this.currentUtterance !== utterance) return;
        options.onBoundary?.(charIndex, segment.text.slice(charIndex, charIndex + (charLength || 10)));
      };
      synth.speak(utterance);
    };
    speakSegment(0);
  }

  public stop(): void {
    this.generation++;
    this.cancelVoiceWait?.();
    if (this.currentUtterance) {
      this.currentUtterance = null;
      window.speechSynthesis.cancel();
    }
  }

  public pause(): void {
    if (this.currentUtterance) window.speechSynthesis.pause();
  }

  public resume(): void {
    if (this.currentUtterance) window.speechSynthesis.resume();
  }
}

class ServerSpeechTTS implements TtsProvider {
  public readonly name: string;

  constructor(private readonly engine: 'openai' | 'maya' | 'edge') {
    this.name = `${engine}_tts`;
  }
  public capabilities: TtsCapabilities = {
    supports_ssml: false,
    supports_style_instructions: true,
    supports_rate: true,
    supports_pitch: false,
    supports_pause_control: true,
  };
  private local = new BrowserSpeechSynthesisTTS();
  private request: AbortController | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;

  public isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  public async speak(options: TtsSpeakOptions): Promise<void> {
    this.stop();
    const text = options.text.trim();
    if (!text) {
      options.onEnd?.();
      return;
    }

    const request = new AbortController();
    this.request = request;
    let started = false;
    const fallback = async () => {
      if (this.request !== request) return;
      this.stop();
      if (started) {
        options.onError?.('playback_failed');
      } else if (options.requireLiveProvider) {
        options.onError?.('live_voice_unavailable');
      } else {
        options.onDeviceFallback?.();
        await this.local.speak(options);
      }
    };

    try {
      const response = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: request.signal,
        body: JSON.stringify({
          provider: this.engine,
          ...(this.engine === 'maya' ? { conversationTone: options.conversationTone } : {}),
          text,
          locale: segmentForSpeech(text, options.locale)[0]?.lang ?? options.locale,
          rate: options.rate ?? 1,
          gender: options.voiceGender ?? 'female',
          style: options.style ?? 'neutral',
        }),
      });
      if (!response.ok) {
        // Recover from an unavailable engine, but honor authentication,
        // permissions and the voice kill switch enforced by the server.
        if (response.status >= 500) {
          await fallback();
        } else if (this.request === request) {
          this.stop();
          options.onError?.('synthesis_request_rejected');
        }
        return;
      }
      const blob = await response.blob();
      if (this.request !== request) return;

      this.audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(this.audioUrl);
      if (this.engine === 'maya') audio.playbackRate = options.rate ?? 1;
      this.audio = audio;
      audio.onplaying = () => {
        if (this.request !== request || started) return;
        started = true;
        options.onStart?.();
      };
      audio.onended = () => {
        if (this.request !== request) return;
        this.stop();
        options.onEnd?.();
      };
      audio.onerror = () => {
        void fallback();
      };
      await audio.play();
    } catch {
      await fallback();
    }
  }

  public stop(): void {
    this.request?.abort();
    this.request = null;
    if (this.audio) {
      this.audio.onplaying = this.audio.onended = this.audio.onerror = null;
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
      this.audio = null;
    }
    if (this.audioUrl) {
      URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = null;
    }
    this.local.stop();
  }

  public pause(): void {
    if (this.audio) this.audio.pause();
    else this.local.pause();
  }

  public resume(): void {
    if (this.audio) void this.audio.play().catch(() => this.audio?.dispatchEvent(new Event('error')));
    else this.local.resume();
  }
}

export class OpenAiTTS extends ServerSpeechTTS {
  constructor() {
    super('openai');
  }
}

/**
 * Stub TTS Provider for testing or server-side execution
 */
export class StubTTS implements TtsProvider {
  public name = 'stub_tts';
  public capabilities: TtsCapabilities = {
    supports_ssml: true,
    supports_style_instructions: true,
    supports_rate: true,
    supports_pitch: true,
    supports_pause_control: true,
  };
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  public isAvailable(): boolean {
    return true;
  }

  public async speak(options: TtsSpeakOptions): Promise<void> {
    options.onStart?.();
    this.timeoutId = setTimeout(() => {
      options.onEnd?.();
    }, 150);
  }

  public stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export function createTtsProvider(type: SpeechProviderType = 'browser'): TtsProvider {
  if (type === 'edge') return new ServerSpeechTTS('edge');
  if (type === 'maya') return new ServerSpeechTTS('maya');
  if (type === 'openai') return new OpenAiTTS();
  if (type === 'custom_stub') return new StubTTS();
  return new BrowserSpeechSynthesisTTS();
}
