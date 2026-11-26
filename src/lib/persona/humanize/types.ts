import { TonePreset, AddressStyle, Verbosity } from '../phrasebank/types';

export interface AssistantPersonaConfig {
  name: string;
  defaultGreetingBn: string;
  defaultGreetingEn: string;
  defaultPreset: TonePreset;
  defaultAddressStyle: AddressStyle;
}

export interface UserAssistantPreferences {
  address_style: AddressStyle;
  tone_preset: TonePreset;
  verbosity: Verbosity;
  sounds_enabled: boolean;
  hints_enabled: boolean;
  avatar_enabled: boolean;
  speech_rate: number;
  voice_id: string;
}

export interface SessionContext {
  sessionId: string;
  isUrgent?: boolean;
  isHurry?: boolean;
  hasCorrection?: boolean;
  isThanks?: boolean;
  isFirstUse?: boolean;
  turnCount?: number;
  recentInputs?: string[];
  interruptionCount?: number;
  apologyGiven?: boolean;
  lastHurryAnnounced?: boolean;
  proactiveHintLastShown?: number;
  userName?: string;
}

export interface HumanizedResult {
  displayText: string;
  speechText: string;
  reactions: string[];
  fallbackUsed: boolean;
  urgentActive: boolean;
  hurryActive: boolean;
  singleQuestion?: string;
  nextSteps: Array<{ label: string; query: string }>;
}
