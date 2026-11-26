import { VoiceIntent } from './types';
import { isCapabilitiesQuery } from '../language/capabilities';
import { detectSystemQuery } from '../system-query';

export interface RouteIntentResult {
  intent: VoiceIntent;
  blocked: boolean;
  blockedReason?: string;
  speakableResponse?: string;
  targetRoute?: string;
  actionPayload?: Record<string, unknown>;
}

// Patterns that trigger the strict Voice Safety Stop (AGENTS.md Rule)
const BLOCKED_ACTION_PATTERNS = [
  /finali[sz]e\s+(?:the\s+)?prescription|প্রেসক্রিপশন\s+(?:চূড়ান্ত|স্বাক্ষর|ফাইনাল|সাইন|সই)|সই\s+কইরা\s+দাও/i,
  /sign\s+(?:the\s+)?prescription|প্রেসক্রিপশন\s+(?:সাইন|সই)/i,
  /(?:remove|change).*?allergy|(?:allergy|অ্যালার্জি|এলার্জি).*?(?:remove|change|বাদ|মুছুন|বদলান|পরিবর্তন|লিস্ট|মুছে)/i,
  /(?:alter|change)\s+(?:the\s+)?dose|change\s+dose|alter\s+dose|ডোজ\s+(?:বদলান|পরিবর্তন|বাড়িয়ে|কমিয়ে|অর্ধেক|কমান)/i,
  /grant\s+.*access|revoke\s+.*access|এক্সেস\s+(?:বন্ধ|দিন)|অনুমতি\s+(?:দিন|বাতিল)/i,
  /delete\s+|মুছে\s+(?:ফেলুন|করুন|দাও|ফেল)|বাদ\s+দিন/i,
  /admin\s+settings|পাসওয়ার্ড\s+বদলান|অন্য\s+ব্যবহারকারী|permissions|রোল\b/i,
];

const NAVIGATION_PATTERNS: Array<{ pattern: RegExp; route: string; labelBn: string; labelEn: string }> = [
  {
    pattern: /new\s+intake|new\s+case|নতুন\s+গ্রহণ|নতুন\s+কেস|notun\s+(?:grohon|case)/i,
    route: '/cases/new',
    labelBn: 'নতুন ক্লিনিকাল গ্রহণ পাতা খুলছি...',
    labelEn: 'Opening New Clinical Intake...',
  },
  {
    pattern: /new\s+patient|নতুন\s+রোগী(?:র)?\s*(?:ফাইল|এন্ট্রি|পাতা|ভর্তি|পেজে)?|notun\s+rogi/i,
    route: '/patients/new',
    labelBn: 'নতুন রোগী পাতা খুলছি...',
    labelEn: 'Opening New Patient page...',
  },
  {
    pattern: /patient\s+list|রোগী(?:র)?\s+তালিকা|সব\s+রোগী|rogir\s+talika/i,
    route: '/patients',
    labelBn: 'রোগীর তালিকা খুলছি...',
    labelEn: 'Opening Patient List...',
  },
  {
    pattern: /case\s+list|all\s+cases|রোগীর\s+কেস|কেসসমূহ|case\s+dashboard|কেস\s+ড্যাশবোর্ড|cases/i,
    route: '/cases',
    labelBn: 'রোগীর কেসসমূহ খুলছি...',
    labelEn: 'Opening Cases list...',
  },
  {
    pattern: /medical\s+library|মেডিকেল\s+লাইব্রেরি|লাইব্রেরি\s+খুলুন/i,
    route: '/library',
    labelBn: 'মেডিকেল লাইব্রেরি খুলছি...',
    labelEn: 'Opening Medical Library...',
  },
  {
    pattern: /next\s+question|পরবর্তী\s+প্রশ্ন/i,
    route: 'action:next_question',
    labelBn: 'পরবর্তী প্রশ্নে যাচ্ছি...',
    labelEn: 'Moving to next question...',
  },
  {
    pattern: /go\s+back|পেছনে\s+যান|ফিরে\s+যান/i,
    route: 'action:go_back',
    labelBn: 'পূর্বের পেজে ফিরে যাচ্ছি...',
    labelEn: 'Navigating back...',
  },
];

/**
 * Evaluates spoken transcript and routes to intent with zero-compromise clinical safety stops
 */
export function routeVoiceIntent(transcript: string, locale: 'bn' | 'en' = 'bn'): RouteIntentResult {
  const text = transcript.trim();
  if (!text) {
    return {
      intent: 'other',
      blocked: false,
    };
  }

  // 1. Critical Clinical Safety Block
  for (const pattern of BLOCKED_ACTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        intent: 'blocked_action',
        blocked: true,
        blockedReason: 'critical_action_requires_screen_confirmation',
        speakableResponse:
          locale === 'bn'
            ? 'এটি অত্যন্ত সংবেদনশীল ক্লিনিকাল সিদ্ধান্ত। অনুগ্রহ করে এটি স্ক্রিনে নিশ্চিত করুন।'
            : 'This is a sensitive clinical action. Please confirm this on screen directly.',
      };
    }
  }

  // 1b. System & Contextual Inquiries (Date, Time, Identity)
  const systemQuery = detectSystemQuery(text);
  if (systemQuery) {
    return {
      intent: 'system_query',
      blocked: false,
      speakableResponse: locale === 'bn' ? systemQuery.speakableBn : systemQuery.speakableEn,
      actionPayload: {
        type: systemQuery.type,
        answerBn: systemQuery.answerBn,
        answerEn: systemQuery.answerEn,
        speakableBn: systemQuery.speakableBn,
        speakableEn: systemQuery.speakableEn,
      },
    };
  }

  // 1c. Capabilities Inquiry ("তুমি কি দেখতে পারো / what can you see")
  if (isCapabilitiesQuery(text)) {
    return {
      intent: 'ask_library',
      blocked: false,
      speakableResponse:
        locale === 'bn'
          ? 'আমি শুধুমাত্র খোলা রোগীর কেস এবং ভেরিফাইড ক্লিনিক্যাল লাইব্রেরি দেখতে পারি। চূড়ান্ত সিদ্ধান্ত ডাক্তারের।'
          : 'I can only see the active patient case and verified clinical library. The doctor decides.',
    };
  }

  // 2. Navigation Commands
  for (const nav of NAVIGATION_PATTERNS) {
    if (nav.pattern.test(text)) {
      return {
        intent: 'navigate',
        blocked: false,
        targetRoute: nav.route,
        speakableResponse: locale === 'bn' ? nav.labelBn : nav.labelEn,
      };
    }
  }

  // 3. Evidence Sheet trigger: "প্রমাণ দেখুন" / "open proof" / "citations"
  if (/(?:open|show|view)\s+(?:proof|evidence|citation)|প্রমাণ|সাইটেশন|উদ্ধৃতি/i.test(text)) {
    return {
      intent: 'navigate',
      blocked: false,
      targetRoute: 'action:open_evidence',
      speakableResponse: locale === 'bn' ? 'লাইব্রেরি প্রমাণ শিট খুলছি...' : 'Opening library evidence sheet...',
    };
  }

  // 4. Read aloud prescription / summary / alerts
  if (
    /(?:read\s+(?:aloud|the\s+finalized|prescription|summary)|পড়ে\s*শোনা|পড়ে\s*শোনা|শোনান|শোনাও|সারসংক্ষেপ|ওষুধের\s+তালিকা|সেফটি\s+এলার্ট)/i.test(
      text
    )
  ) {
    return {
      intent: 'read_aloud',
      blocked: false,
    };
  }

  // 5. Follow-Up Question Answer (starts with yes/no or vitals confirmation)
  // e.g. "হ্যাঁ, রোগীর সাথে কাঁপুনি ছিল", "না, কোনো বমি বা পেটব্যথা নেই", "Yes, no history..."
  if (/^(?:হ্যাঁ|না|yes|no|স্বাভাবিক|normal)(?:[,\s]|$)/i.test(text)) {
    return {
      intent: 'answer_followup',
      blocked: false,
    };
  }

  // 6. Explicit Medical Library / Clinical Protocol Queries
  if (
    /(?:লাইব্রেরি|library|গাইডলাইন|guideline|প্রটোকল|protocol|treatment\s+protocol|first-line\s+antibiotics|who\s+guidelines)/i.test(
      text
    )
  ) {
    return {
      intent: 'ask_library',
      blocked: false,
    };
  }

  // 7. Clinical Dictation (Intake, Vitals, Notes, or Prescription)
  if (
    /(?:প্যারাসিটামল|অ্যামোক্সিসিলিন|azithromycin|napa|amoxicillin|omeprazole|অমিপ্রাজল|মিলিগ্রাম|mg|ট্যাবলেট|tab|ক্যাপসুল|cap|সিরাপ|syr|দিনে|times|daily|\d\+\d\+\d|খাওয়ার\s+(?:আগে|পরে)|with\s+meals|after\s+food|od\s+for|পাতা\s+লিখে\s+দাও)/i.test(
      text
    ) ||
    /(?:রোগী|পেশেন্ট|patient|বয়স|years?\s*old|পুরুষ|মহিলা|male|female|কইল|ধইরা|রক্তচাপ|প্রেসার|তাপমাত্রা|জ্বর|কাশি|crepitations|এলার্জি|অ্যালার্জি|বিপি|bp\s+recorded|গায়ে\s+জ্বর|add\s+clinical\s+note|নোট|হিস্ট্রি|ইতিহাস)/i.test(
      text
    )
  ) {
    return {
      intent: 'dictate',
      blocked: false,
    };
  }

  // 8. Default to Ask Library
  return {
    intent: 'ask_library',
    blocked: false,
  };
}
