import { SessionContext } from './types';
import { SafetyAlert } from '@/types';

const URGENT_REGEX = /(?:^|[\s,.\-!?;:])(?:জরুরি|তাড়াতাড়ি|দ্রুত|ইমার্জেন্সি|emergency|urgent|quick|stat|asap|critical|acute)(?:$|[\s,.\-!?;:])/i;
const CORRECTION_REGEX = /(?:^|[\s,.\-!?;:])(?:না|ভুল|এটা\s+না|ঠিক\s+না|no|wrong|incorrect|not\s+this|not\s+that)(?:$|[\s,.\-!?;:])/i;
const THANKS_REGEX = /(?:^|[\s,.\-!?;:])(?:ধন্যবাদ|থ্যাংকস|থ্যাঙ্কস|thank\s*you|thanks|thx)(?:$|[\s,.\-!?;:])/i;

export interface AdaptationSignals {
  isUrgent: boolean;
  isHurry: boolean;
  isCorrection: boolean;
  isThanks: boolean;
  shouldAnnounceHurry: boolean;
  shouldApologize: boolean;
}

/**
 * Analyzes the clinician's latest input and session context to determine adaptive behavior.
 */
export function analyzeDoctorInput(
  inputText: string,
  context: SessionContext,
  safetyAlerts: SafetyAlert[] = []
): AdaptationSignals {
  const clean = inputText.trim();
  const words = clean.split(/\s+/).filter(Boolean);

  // 1. Urgency detection: explicit keyword or active critical safety alert
  const hasCriticalAlert = safetyAlerts.some((a) => a.severity === 'critical');
  const isUrgent = URGENT_REGEX.test(clean) || hasCriticalAlert || Boolean(context.isUrgent);

  // 2. Hurry signals:
  // - Doctor interrupted speech twice in a row, OR
  // - Repeated very short queries (<= 3 words) twice consecutively
  const recent = context.recentInputs || [];
  const consecutiveShortInputs = words.length <= 3 && recent.length > 0 && recent[recent.length - 1].split(/\s+/).length <= 3;
  const isHurry = Boolean(context.isHurry) || consecutiveShortInputs || (context.interruptionCount || 0) >= 2;

  const shouldAnnounceHurry = isHurry && !context.lastHurryAnnounced;

  // 3. Correction / frustration detection
  const isCorrection = CORRECTION_REGEX.test(clean) || Boolean(context.hasCorrection);
  // Apologize strictly once per correction flow
  const shouldApologize = isCorrection && !context.apologyGiven;

  // 4. Gratitude detection
  const isThanks = THANKS_REGEX.test(clean);

  return {
    isUrgent,
    isHurry,
    isCorrection,
    isThanks,
    shouldAnnounceHurry,
    shouldApologize,
  };
}
