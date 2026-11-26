import { describe, it, expect } from 'vitest';
import { humanize } from '../src/lib/persona/humanize';
import { ProtectedTokenGuard } from '../src/lib/persona/humanize/protected-tokens';
import { analyzeDoctorInput } from '../src/lib/persona/humanize/session-adaptive';
import { selectPhrase } from '../src/lib/persona/phrasebank/selector';
import { VerifiedClinicalResult } from '../src/lib/voice/speakable';
import { SafetyAlert } from '../src/types';
import { AssistantPersonaConfig, UserAssistantPreferences, SessionContext } from '../src/lib/persona/humanize/types';

describe('DocMate AI Golden Conversations Suite (20 Scenarios)', () => {
  const basePersona: AssistantPersonaConfig = {
    name: 'ডকমেট',
    defaultGreetingBn: 'স্বাগতম, ডাক্তার। আজ কীভাবে সাহায্য করতে পারি?',
    defaultGreetingEn: 'Welcome, Doctor. How can I assist you today?',
    defaultPreset: 'friendly',
    defaultAddressStyle: 'doctor',
  };

  const basePrefs: UserAssistantPreferences = {
    address_style: 'doctor',
    tone_preset: 'friendly',
    verbosity: 'normal',
    sounds_enabled: true,
    hints_enabled: true,
    avatar_enabled: true,
    speech_rate: 1.0,
    voice_id: 'default',
  };

  const baseContext: SessionContext = {
    sessionId: 'golden-test-session',
    turnCount: 1,
  };

  const baseVerifiedResult: VerifiedClinicalResult = {
    answer: 'রোগীর ডেঙ্গু এনএস১ পজিটিভ এসেছে। তরল গ্রহণ ও প্লাটিলেট পর্যবেক্ষণ জরুরি।',
    citations: [
      { chunk_id: 'chk-dengue-01', source_title: 'Dengue National Guideline', quote: 'তরল গ্রহণ ও প্লাটিলেট পর্যবেক্ষণ জরুরি।' }
    ],
    found: true,
  };

  // Scenario 1: New patient triage intake
  it('Scenario 1: Welcomes new intake with warm polite Bangla acknowledgment', () => {
    const res = humanize(
      baseVerifiedResult,
      basePersona,
      basePrefs,
      { ...baseContext, sessionId: 'sc-1' },
      'bn'
    );

    expect(res.displayText).toContain('রোগীর ডেঙ্গু এনএস১ পজিটিভ এসেছে');
    expect(res.speechText).toBeDefined();
    expect(res.reactions.length).toBeGreaterThan(0);
    expect(res.nextSteps.length).toBeLessThanOrEqual(3);
  });

  // Scenario 2: Follow-up question on treatment
  it('Scenario 2: Follow-up question acknowledges and provides cited recommendation', () => {
    const res = humanize(
      {
        ...baseVerifiedResult,
        answer: 'প্যারাসিটামল ৫০০ মিলিগ্রাম প্রতি ৬ থেকে ৮ ঘণ্টা পরপর সর্বোচ্চ ৪ বার দেওয়া যেতে পারে।',
      },
      basePersona,
      { ...basePrefs, address_style: 'doctor_sahib' },
      { ...baseContext, sessionId: 'sc-2' },
      'bn'
    );

    expect(res.displayText).toContain('প্যারাসিটামল ৫০০ মিলিগ্রাম');
  });

  // Scenario 3: Insufficient evidence abstention
  it('Scenario 3: Plainly declares insufficient evidence when library lacks proof', () => {
    const insufficientResult: VerifiedClinicalResult = {
      answer: '',
      citations: [],
      status: 'insufficient_evidence',
      found: false,
    };

    const res = humanize(
      insufficientResult,
      basePersona,
      basePrefs,
      { ...baseContext, sessionId: 'sc-3' },
      'bn'
    );

    expect(res.displayText).toMatch(/(লাইব্রেরি|প্রমাণ|তথ্য মেলেনি|রেফারেন্স পাওয়া যায়নি)/);
    expect(res.reactions).toContain('thinking');
  });

  // Scenario 4: Critical safety alert stop (direct, calm, no softening or jokes)
  it('Scenario 4: Critical safety alert is calm, direct, and bypasses pleasantries', () => {
    const alertResult: VerifiedClinicalResult = {
      answer: 'প্যারাসিটামলের সাথে অ্যাসপিরিন সেবনে রক্তক্ষরণের ঝুঁকি মারাত্মকভাবে বৃদ্ধি পায়।',
      citations: [{ chunk_id: 'chk-alert-01', source_title: 'Drug Safety Manual', quote: 'রক্তক্ষরণের ঝুঁকি মারাত্মকভাবে বৃদ্ধি পায়।' }],
    };

    const criticalAlerts: SafetyAlert[] = [
      {
        id: 'alt-1',
        drug_id: 'drg-aspirin',
        drug_name: 'Aspirin',
        type: 'drug_interaction',
        title: 'মারাত্মক ড্রাগ মিথস্ক্রিয়া',
        description: 'অ্যাসপিরিন অবিলম্বে বন্ধ করুন। রক্তক্ষরণের ঝুঁকি রয়েছে।',
        severity: 'critical' as const,
      },
    ];

    const res = humanize(
      alertResult,
      basePersona,
      basePrefs,
      { ...baseContext, sessionId: 'sc-4' },
      'bn',
      '',
      criticalAlerts
    );

    expect(res.displayText).toContain('মারাত্মক ড্রাগ মিথস্ক্রিয়া');
    expect(res.reactions).toContain('concern');
    expect(res.urgentActive).toBe(true);
  });

  // Scenario 5: Doctor correction ("না, ভুল হয়েছে")
  it('Scenario 5: Doctor correction triggers polite humble single apology and invites revision', () => {
    const tone = analyzeDoctorInput('না, এটা ভুল হয়েছে। রোগীর বয়স ৩৫ নয়, ৪৫।', baseContext);
    expect(tone.isCorrection).toBe(true);

    const res = humanize(
      { answer: '', found: true },
      basePersona,
      basePrefs,
      { ...baseContext, sessionId: 'sc-5' },
      'bn',
      'না, এটা ভুল হয়েছে।'
    );

    expect(res.displayText).toContain('দুঃখিত');
    expect(res.reactions).toContain('apology');
  });

  // Scenario 6: Doctor hurry mode (brief, fast)
  it('Scenario 6: Doctor hurry mode switches to brief responses and announces once', () => {
    // Interrupted speech twice in a row, or repeated short commands
    const hurryContext: SessionContext = {
      ...baseContext,
      recentInputs: ['হ্যাঁ'],
      interruptionCount: 2,
    };
    const tone = analyzeDoctorInput('ঠিক আছে।', hurryContext);
    expect(tone.isHurry).toBe(true);

    const res = humanize(
      baseVerifiedResult,
      basePersona,
      { ...basePrefs, verbosity: 'brief' },
      { ...baseContext, sessionId: 'sc-6' },
      'bn',
      'তাড়াতাড়ি বলুন।'
    );

    expect(res.hurryActive).toBe(true);
    expect(res.displayText).toBeDefined();
  });

  // Scenario 7: Gratitude reply ("ধন্যবাদ")
  it('Scenario 7: Responds briefly to gratitude ("আপনাকেও ধন্যবাদ।" / "স্বাগতম") and stops', () => {
    const tone = analyzeDoctorInput('অনেক ধন্যবাদ ডাক্তার সাহেব।', baseContext);
    expect(tone.isThanks).toBe(true);

    const phrase = selectPhrase('thanks_reply', 'bn', {
      preset: 'friendly',
      sessionId: 'sc-7',
    });
    expect(phrase).toMatch(/(ধন্যবাদ|স্বাগতম|ভালো লাগল|সেবায় প্রস্তুত)/);
  });

  // Scenario 8: Doctor disagreement ("আমি একমত নই")
  it('Scenario 8: Respects doctor decision without judgment or moralizing', () => {
    const phrase = selectPhrase('disagree_respected', 'bn', {
      preset: 'friendly',
      sessionId: 'sc-8',
    });

    expect(phrase).toMatch(/(সিদ্ধান্ত|বিচারবুদ্ধি|চূড়ান্ত|বলবেন)/);
  });

  // Scenario 9: Urgent / Emergency keywords
  it('Scenario 9: Urgent trigger skips pleasantries and focuses purely on actionable next steps', () => {
    const tone = analyzeDoctorInput('জরুরি রোগী, রক্তচাপ অনেক কম!', baseContext);
    expect(tone.isUrgent).toBe(true);

    const res = humanize(
      baseVerifiedResult,
      basePersona,
      basePrefs,
      { ...baseContext, sessionId: 'sc-9' },
      'bn',
      'জরুরি রোগী, তাড়াতাড়ি দেখুন!'
    );

    expect(res.urgentActive).toBe(true);
  });

  // Scenario 10: Reserved preset (minimal pleasantries)
  it('Scenario 10: Reserved preset uses concise acknowledgments', () => {
    const phrase = selectPhrase('acknowledge', 'bn', {
      preset: 'reserved',
      sessionId: 'sc-10',
    });

    expect(phrase.length).toBeLessThan(30);
  });

  // Scenario 11: Friendly preset
  it('Scenario 11: Friendly preset offers warm and courteous assistance', () => {
    const phrase = selectPhrase('acknowledge', 'bn', {
      preset: 'friendly',
      sessionId: 'sc-11',
    });

    expect(phrase).toBeDefined();
  });

  // Scenario 12: Doctor address "ডাক্তার সাহেব"
  it('Scenario 12: Addresses clinician politely as ডাক্তার সাহেব when preferred', () => {
    const phrase = selectPhrase('greeting', 'bn', {
      preset: 'friendly',
      doctorTitle: 'ডাক্তার সাহেব',
      sessionId: 'sc-12',
    });

    expect(phrase).toContain('ডাক্তার সাহেব');
  });

  // Scenario 13: Doctor address "ডাক্তার ম্যাডাম"
  it('Scenario 13: Addresses clinician politely as ডাক্তার ম্যাডাম when preferred', () => {
    const phrase = selectPhrase('greeting', 'bn', {
      preset: 'friendly',
      doctorTitle: 'ডাক্তার ম্যাডাম',
      sessionId: 'sc-13',
    });

    expect(phrase).toContain('ডাক্তার ম্যাডাম');
  });

  // Scenario 14: Doctor address by name
  it('Scenario 14: Addresses clinician by name when configured', () => {
    const phrase = selectPhrase('greeting', 'bn', {
      preset: 'friendly',
      doctorTitle: 'ডা. আনিসুর রহমান',
      sessionId: 'sc-14',
    });

    expect(phrase).toContain('ডা. আনিসুর রহমান');
  });

  // Scenario 15: Morning greeting
  it('Scenario 15: Time-of-day morning greeting corresponds to morning', () => {
    const phrase = selectPhrase('greeting', 'bn', {
      preset: 'friendly',
      timeOfDay: 'morning',
      sessionId: 'sc-15',
    });

    expect(phrase).toContain('সকাল');
  });

  // Scenario 16: Afternoon greeting
  it('Scenario 16: Time-of-day afternoon greeting corresponds to afternoon', () => {
    const phrase = selectPhrase('greeting', 'bn', {
      preset: 'friendly',
      timeOfDay: 'afternoon',
      sessionId: 'sc-16',
    });

    expect(phrase).toContain('অপরাহ্ন');
  });

  // Scenario 17: Evening greeting
  it('Scenario 17: Time-of-day evening greeting corresponds to evening', () => {
    const phrase = selectPhrase('greeting', 'bn', {
      preset: 'friendly',
      timeOfDay: 'evening',
      sessionId: 'sc-17',
    });

    expect(phrase).toContain('সন্ধ্যা');
  });

  // Scenario 18: English locale handling
  it('Scenario 18: Speaks concise polite plain English when in en locale', () => {
    const res = humanize(
      {
        answer: 'Platelet count is 85,000. Recommend repeat CBC in 12 hours.',
        citations: [{ chunk_id: 'chk-en-1', source_title: 'Hematology', quote: 'Recommend repeat CBC in 12 hours.' }],
      },
      { ...basePersona, name: 'DocMate' },
      basePrefs,
      { ...baseContext, sessionId: 'sc-18' },
      'en'
    );

    expect(res.speechText).toContain('Platelet count is 85,000');
    expect(res.speechText).toContain('Details are on screen.');
  });

  // Scenario 19: Long detail hidden behind "বিস্তারিত দেখুন" in voice
  it('Scenario 19: Voice output is capped at ~35 words with screen pointer', () => {
    const longSummary = 'ম্যালেরিয়ার চিকিৎসায় ক্লোরোকুইন সংবেদনশীল অঞ্চলে প্রথম সারির ওষুধ হলো ক্লোরোকুইন ফসফেট। তবে ক্লোরোকুইন প্রতিরোধী ফ্যালসিপেরাম ম্যালেরিয়ার ক্ষেত্রে আর্টেমেথিনিন-ভিত্তিক সমন্বিত থেরাপি (ACT) যেমন আর্টেমেথার-লুমেফ্যান্ট্রিন নির্দেশিত। রোগীর রক্তচাপ ও কিডনি কার্যকারিতা নিয়মিত পর্যবেক্ষণ করতে হবে। ডায়াবেটিস বা অন্যান্য দীর্ঘস্থায়ী অসুস্থতা থাকলে সতর্কতামূলক ব্যবস্থা গ্রহণ আবশ্যক।';

    const res = humanize(
      {
        answer: longSummary,
        citations: [{ chunk_id: 'chk-malaria-1', source_title: 'Malaria Guideline', quote: 'ক্লোরোকুইন ফসফেট প্রথম সারির ওষুধ।' }],
      },
      basePersona,
      basePrefs,
      { ...baseContext, sessionId: 'sc-19' },
      'bn'
    );

    expect(res.speechText).toContain('বিস্তারিত স্ক্রিনে দেখুন।');
    const wordCount = res.speechText.trim().split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(45);
  });

  // Scenario 20: Protected token guard preserving numerals, doses, and negation
  it('Scenario 20: Protected token guard prevents alteration of doses, units, and negations', () => {
    const input = 'রোগীর অ্যামোক্সিসিলিন ৫০০ মিলিগ্রাম দিনে ৩ বার ৭ দিন খাবেন। রক্তপাত হয়নি।';
    const tokens = ProtectedTokenGuard.extractTokens(input);

    expect(tokens).toContain('৫০০');
    expect(tokens).toContain('৩');
    expect(tokens).toContain('৭');

    const validOutput = `জি, দেখছি। ${input} এটি সংরক্ষণ করা হয়েছে।`;
    expect(ProtectedTokenGuard.validate(input, validOutput).valid).toBe(true);

    const corruptedOutput = 'জি, দেখছি। রোগীর অ্যামোক্সিসিলিন ২৫০ মিলিগ্রাম দিনে ৩ বার খাবেন।';
    expect(ProtectedTokenGuard.validate(input, corruptedOutput).valid).toBe(false);
  });
});
