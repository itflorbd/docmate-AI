/**
 * DocMate AI - Voice Assistant Architecture Types
 */

export type VoiceState =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'alert'
  | 'happy'
  | 'confused'
  | 'error';

export type VoiceIntent =
  | 'ask_library'
  | 'dictate'
  | 'answer_followup'
  | 'navigate'
  | 'read_aloud'
  | 'blocked_action'
  | 'system_query'
  | 'other';

export type VoiceProviderType = 'browser' | 'openai' | 'custom_stub';
export type SpeechProviderType = VoiceProviderType | 'maya' | 'edge';

export interface VoiceConfig {
  enabled: boolean;
  kill_switch: boolean;
  stt_provider: VoiceProviderType;
  tts_provider: SpeechProviderType;
  persona_name: string;
  persona_preset?: 'friendly' | 'reserved';
  persona_greeting_bn: string;
  persona_greeting_en: string;
  intro_disclaimer_bn: string;
  intro_disclaimer_en: string;
  default_voice_gender: 'male' | 'female';
  default_speed: number; // 0.8 to 1.2
  private_mode_default: boolean;
  avatar_enabled_default: boolean;
  sounds_enabled?: boolean;
  edge_voice_bn?: string;
  edge_voice_en?: string;
  vocal_reactions_enabled?: boolean;
}

export interface SttTranscriptionResult {
  text: string;
  confidence?: number;
  lowConfidenceWords?: string[];
  isFinal: boolean;
}

export interface SttListenOptions {
  locale: 'bn' | 'en';
  hints?: string[];
  onResult: (result: SttTranscriptionResult) => void;
  onError: (error: string) => void;
  onEnd?: () => void;
  onVolume?: (volume: number) => void;
}

export interface SttProvider {
  name: string;
  isAvailable(): boolean;
  startListening(options: SttListenOptions): Promise<void>;
  stopListening(): Promise<void>;
  abortListening(): void;
}

export type SpeechStyle = 'neutral' | 'warm' | 'calm_urgent' | 'number_reading';

export interface TtsCapabilities {
  supports_ssml: boolean;
  supports_style_instructions: boolean;
  supports_rate: boolean;
  supports_pitch: boolean;
  supports_pause_control: boolean;
}

export interface TtsSpeakOptions {
  text: string;
  locale: 'bn' | 'en';
  rate?: number; // 0.8x to 1.2x
  pitch?: number; // 0.8 to 1.2
  style?: SpeechStyle;
  voiceGender?: 'male' | 'female';
  conversationTone?: 'warm' | 'neutral';
  requireLiveProvider?: boolean;
  onDeviceFallback?: () => void;
  onBoundary?: (charIndex: number, word: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export interface TtsProvider {
  name: string;
  capabilities: TtsCapabilities;
  isAvailable(): boolean;
  speak(options: TtsSpeakOptions): Promise<void>;
  stop(): void;
  pause?(): void;
  resume?(): void;
}

export interface VoiceMessage {
  id: string;
  sender: 'doctor' | 'assistant';
  locale?: 'bn' | 'en';
  text: string;
  speakableText?: string;
  citations?: Array<{
    chunk_id: string;
    source_title?: string;
    quote?: string;
    page?: number;
  }>;
  verified?: boolean;
  /** Reply text is Markdown with [n] markers that refer to `claims`. */
  markdown?: boolean;
  claims?: Array<{ ref: number; chunk_id: string; quote: string; text: string; source_title?: string; source_year?: number; page?: number; verified: boolean }>;
  status?: string;
  timestamp: number;
  intent?: VoiceIntent;
  confidence?: number;
  lowConfidenceTokens?: string[];
  draftUpdate?: unknown;
}

export interface VoiceSessionMetrics {
  sessionId?: string;
  sttSeconds: number;
  ttsChars: number;
  turnsCount: number;
  latencyMs: number;
}
