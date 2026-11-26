/**
 * DocMate AI - Phrase Bank Architecture Types
 */

export type PhraseCategory =
  | 'greeting'
  | 'acknowledge'
  | 'thinking'
  | 'understood'
  | 'clarify'
  | 'confirm_readback'
  | 'success'
  | 'small_error'
  | 'big_error'
  | 'no_evidence'
  | 'alert_intro'
  | 'disagree_respected'
  | 'thanks_reply'
  | 'goodbye'
  | 'waiting_long'
  | 'limit_reached'
  | 'first_use_welcome';

export type TonePreset = 'reserved' | 'friendly';

export type AddressStyle = 'doctor' | 'doctor_sahib' | 'doctor_madam' | 'name';

export type Verbosity = 'brief' | 'normal' | 'detailed';

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export interface PhraseEntry {
  id: string;
  category: PhraseCategory;
  locale: 'bn' | 'en';
  preset: TonePreset | 'all';
  text: string;
  timeOfDay?: TimeOfDay;
  status?: 'draft' | 'reviewed' | 'live';
}

export interface SelectionOptions {
  sessionId?: string;
  preset?: TonePreset;
  timeOfDay?: TimeOfDay;
  doctorTitle?: string;
  seed?: number;
  substitutions?: Record<string, string>;
}
