import {
  PhraseCategory,
  AddressStyle,
  TimeOfDay,
  PhraseEntry,
  SelectionOptions,
} from './types';
import { PHRASEBANK_DATA } from './data';

// In-memory variant history: sessionId -> Array of recent entry IDs (last 5 kept)
const sessionVariantHistory = new Map<string, string[]>();

/**
 * Resets in-memory variant history (useful in tests or session reset)
 */
export function resetSessionVariantHistory(sessionId?: string): void {
  if (sessionId) {
    sessionVariantHistory.delete(sessionId);
  } else {
    sessionVariantHistory.clear();
  }
}

/**
 * Returns current TimeOfDay in Asia/Dhaka timezone
 */
export function getTimeOfDayDhaka(customDate?: Date): TimeOfDay {
  const d = customDate || new Date();
  // Format hour in Asia/Dhaka
  const hourString = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    hour: 'numeric',
    hour12: false,
  }).format(d);

  const hour = parseInt(hourString, 10);
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Formats doctor title according to chosen AddressStyle and locale
 */
export function formatDoctorTitle(
  style: AddressStyle = 'doctor',
  locale: 'bn' | 'en' = 'bn',
  userName?: string
): string {
  if (style === 'name' && userName) {
    const cleanName = userName.trim();
    if (locale === 'bn') {
      return cleanName.startsWith('ডাঃ') || cleanName.startsWith('ডাক্তার')
        ? cleanName
        : `ডাঃ ${cleanName}`;
    }
    return cleanName.startsWith('Dr.') ? cleanName : `Dr. ${cleanName}`;
  }

  if (locale === 'bn') {
    switch (style) {
      case 'doctor_sahib':
        return 'ডাক্তার সাহেব';
      case 'doctor_madam':
        return 'ডাক্তার ম্যাডাম';
      case 'doctor':
      default:
        return 'ডাক্তার';
    }
  }

  return 'Doctor';
}

/**
 * Deterministic pseudo-random generator given a seed
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Selects a phrase variant from the phrase bank adhering to:
 * 1. Category, locale, preset, and optional timeOfDay match
 * 2. Never repeating within the last 5 uses in the active session
 * 3. Seeded deterministic selection if seed is provided
 * 4. Automatic placeholder substitution ({doctorTitle}, {detail}, etc.)
 */
export function selectPhrase(
  category: PhraseCategory,
  locale: 'bn' | 'en' = 'bn',
  options: SelectionOptions = {}
): string {
  const preset = options.preset || 'friendly';
  const targetTime = options.timeOfDay || (category === 'greeting' ? getTimeOfDayDhaka() : undefined);
  const sessionId = options.sessionId || 'default-session';

  // 1. Filter candidates by category and locale
  let candidates = PHRASEBANK_DATA.filter((p) => p.category === category && p.locale === locale);

  if (candidates.length === 0) {
    // Fallback if locale missing
    candidates = PHRASEBANK_DATA.filter((p) => p.category === category);
  }

  // 2. Filter by preset (prefer exact preset match or 'all')
  const presetMatches = candidates.filter((p) => p.preset === preset || p.preset === 'all');
  if (presetMatches.length > 0) {
    candidates = presetMatches;
  }

  // 3. For greetings, filter by time of day if available
  if (category === 'greeting' && targetTime) {
    const timeMatches = candidates.filter((p) => p.timeOfDay === targetTime);
    if (timeMatches.length > 0) {
      candidates = timeMatches;
    }
  }

  // 4. Memory check: filter out variants used in the last 5 turns of this session
  const history = sessionVariantHistory.get(sessionId) || [];
  const freshCandidates = candidates.filter((p) => !history.slice(-5).includes(p.id));

  const pool = freshCandidates.length > 0 ? freshCandidates : candidates;

  // 5. Select variant (deterministic if seed provided, else random)
  let selected: PhraseEntry;
  if (typeof options.seed === 'number') {
    const idx = Math.floor(pseudoRandom(options.seed) * pool.length);
    selected = pool[Math.min(pool.length - 1, Math.max(0, idx))];
  } else {
    const idx = Math.floor(Math.random() * pool.length);
    selected = pool[idx];
  }

  // 6. Record variant in session history
  if (selected) {
    const updatedHistory = [...history, selected.id];
    // Keep last 10 entries in memory
    if (updatedHistory.length > 10) {
      updatedHistory.shift();
    }
    sessionVariantHistory.set(sessionId, updatedHistory);
  }

  let text = selected ? selected.text : '';

  // 7. Perform substitutions
  const doctorTitle = options.doctorTitle || formatDoctorTitle('doctor', locale);
  if (text.includes('{doctorTitle}')) {
    text = text.replace(/\{doctorTitle\}/g, doctorTitle);
  } else if (category === 'greeting' && options.doctorTitle) {
    // If custom doctorTitle is explicitly provided and phrase didn't contain it, prepend politely
    text = `${doctorTitle}, ${text}`;
  }

  if (options.substitutions) {
    for (const [key, value] of Object.entries(options.substitutions)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      text = text.replace(regex, value);
    }
  }

  return text;
}
