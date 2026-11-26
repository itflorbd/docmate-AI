import { describe, it, expect } from 'vitest';
import {
  humanize,
  ProtectedTokenGuard,
  analyzeDoctorInput,
} from '../src/lib/persona/humanize';
import { VerifiedClinicalResult } from '../src/lib/voice/speakable';

describe('Humanise Layer & Protected Token Guard Tests', () => {
  const verifiedResult: VerifiedClinicalResult = {
    found: true,
    status: 'analyzed',
    verified: true,
    answer: 'রোগীর রক্তচাপ ১২০/৮০ মিমি পারদ। প্যারাসিটামল ৫০০ মিলিগ্রাম দিনে ৩ বার ৭ দিন সেব্য। কোনো অ্যালার্জি নেই।',
    citations: [
      { chunk_id: 'chunk-dgda-01', quote: 'প্যারাসিটামল ৫০০ মিলিগ্রাম', verified: true },
    ],
  };

  it('1. ProtectedTokenGuard extracts all numerals, units, drugs, negations, and citations', () => {
    const text = 'Amoxicillin 500 mg TDS 7 days. BP 120/80 mmHg. No drug allergies. [^1] chunk-test-01.';
    const tokens = ProtectedTokenGuard.extractTokens(text);

    expect(tokens).toContain('amoxicillin');
    expect(tokens).toContain('500');
    expect(tokens).toContain('mg');
    expect(tokens).toContain('tds');
    expect(tokens).toContain('7');
    expect(tokens).toContain('days');
    expect(tokens).toContain('120/80');
    expect(tokens).toContain('no');
    expect(tokens).toContain('[^1]');
    expect(tokens).toContain('chunk-test-01');
  });

  it('2. ProtectedTokenGuard fails validation and identifies missing tokens if text is altered', () => {
    const source = 'Paracetamol 500 mg 1-0-1 for 5 days. No fever.';
    const tampered = 'Paracetamol 250 mg 1-0-1 for 5 days. Fever present.'; // changed 500->250, dropped "no"

    const validation = ProtectedTokenGuard.validate(source, tampered);
    expect(validation.valid).toBe(false);
    expect(validation.missingTokens).toContain('500');
    expect(validation.missingTokens).toContain('no');
  });

  it('3. humanize() passes token guard and produces conversational wrapper for valid clinical text', () => {
    const res = humanize(
      verifiedResult,
      undefined,
      {
        address_style: 'doctor',
        tone_preset: 'friendly',
        verbosity: 'normal',
        sounds_enabled: true,
        hints_enabled: true,
        avatar_enabled: true,
        speech_rate: 1.0,
        voice_id: 'default',
      },
      { sessionId: 'test-h1', turnCount: 1 },
      'bn'
    );

    expect(res.fallbackUsed).toBe(false);
    expect(res.displayText).toContain('১২০/৮০');
    expect(res.displayText).toContain('প্যারাসিটামল');
    expect(res.displayText).toContain('৫০০');
    expect(res.displayText).toContain('নেই');
    expect(res.speechText).toContain('বিস্তারিত স্ক্রিনে দেখুন।');
  });

  it('4. Urgent mode triggers on keywords like "জরুরি" or "emergency", skipping pleasantries', () => {
    const signals = analyzeDoctorInput('জরুরি রোগীর অবস্থা দেখতে হবে', { sessionId: 'test-u1' });
    expect(signals.isUrgent).toBe(true);

    const res = humanize(
      verifiedResult,
      undefined,
      undefined,
      { sessionId: 'test-u2' },
      'bn',
      'রোগীর বুকে তীব্র ব্যথা, তাড়াতাড়ি দেখুন'
    );

    expect(res.urgentActive).toBe(true);
    // Skips conversational greetings like 'শুভ সকাল'
    expect(res.displayText).not.toContain('শুভ সকাল');
  });

  it('5. Critical safety alerts bypass persona layer and prepend fixed alert_intro', () => {
    const res = humanize(
      verifiedResult,
      undefined,
      undefined,
      { sessionId: 'test-alert' },
      'bn',
      '',
      [
        {
          id: 'alert-01',
          drug_id: 'd-1',
          drug_name: 'Warfarin',
          severity: 'critical',
          type: 'contraindication',
          title: 'রক্তক্ষরণের তীব্র ঝুঁকি',
          description: 'অ্যাসপিরিনের সাথে ওয়ারফারিন গ্রহণ করলে প্রাণঘাতী রক্তক্ষরণ হতে পারে।',
        },
      ]
    );

    expect(res.reactions).toContain('concern');
    expect(res.displayText).toMatch(/(?:সতর্কতা|সংকেত|নোটিশ|বিবেচনা)/);
    expect(res.displayText).toContain('রক্তক্ষরণের তীব্র ঝুঁকি');
    expect(res.speechText).toContain('রক্তক্ষরণের তীব্র ঝুঁকি');
  });

  it('6. Enforces single question per turn rule during insufficient evidence', () => {
    const insufficientResult: VerifiedClinicalResult = {
      found: false,
      status: 'insufficient_evidence',
      missing_information: [
        { id: 'q1', text: 'রোগীর রক্তচাপ ও পালস কত?' },
        { id: 'q2', text: 'স্টেথোস্কোপে ফুসফুসের শব্দ কেমন?' },
        { id: 'q3', text: 'ইসিজি রিপোর্ট করা হয়েছে কি?' },
      ],
    };

    const res = humanize(
      insufficientResult,
      undefined,
      undefined,
      { sessionId: 'test-q1' },
      'bn'
    );

    // Only the FIRST question must be featured in singleQuestion
    expect(res.singleQuestion).toBe('রোগীর রক্তচাপ ও পালস কত?');
    expect(res.displayText).toContain('রোগীর রক্তচাপ ও পালস কত?');
    // Does NOT dump question 2 or 3 in the prompt text
    expect(res.displayText).not.toContain('স্টেথোস্কোপে ফুসফুসের শব্দ কেমন?');
    expect(res.displayText).not.toContain('ইসিজি রিপোর্ট করা হয়েছে কি?');
  });

  it('7. Apologizes strictly ONCE in correction flow and offers typing', () => {
    const signals1 = analyzeDoctorInput('না, এটা ভুল হয়েছে', { sessionId: 'test-corr', apologyGiven: false });
    expect(signals1.isCorrection).toBe(true);
    expect(signals1.shouldApologize).toBe(true);

    const res1 = humanize(
      { found: false },
      undefined,
      undefined,
      { sessionId: 'test-corr', apologyGiven: false },
      'bn',
      'না, এটা ভুল হয়েছে'
    );
    expect(res1.reactions).toContain('apology');
    expect(res1.displayText).toContain('দুঃখিত');

    // Second turn in same flow: apologyGiven is true
    const signals2 = analyzeDoctorInput('এটা না', { sessionId: 'test-corr', apologyGiven: true });
    expect(signals2.isCorrection).toBe(true);
    expect(signals2.shouldApologize).toBe(false);
  });

  it('8. Caps spoken speech text to at most 3 short sentences and ~35 words with screen cue', () => {
    const longClinicalResult: VerifiedClinicalResult = {
      found: true,
      answer:
        'কমিউনিটি অ্যাকওয়ার্ড নিউমোনিয়া সন্দেহে কার্ব-৬৫ স্কোর ২ নির্দেশিত হয়েছে। রোগীকে অবিলম্বে হাসপাতালে ভর্তি করে শিরায় অ্যান্টিবায়োটিক শুরু করতে হবে। ফুসফুসের এক্স-রে এবং স্পুটাম কালচার পরীক্ষা জরুরি। নিয়মিত ভাইটালস ও অক্সিজেন স্যাচুরেশন পর্যবেক্ষণ আবশ্যক। আরও বিস্তারিত চিকিৎসা প্রটোকল গাইডলাইনে উল্লেখিত রয়েছে।',
    };

    const res = humanize(
      longClinicalResult,
      undefined,
      undefined,
      { sessionId: 'test-speech' },
      'bn'
    );

    const words = res.speechText.split(/\s+/);
    expect(words.length).toBeLessThanOrEqual(40);
    expect(res.speechText).toContain('বিস্তারিত স্ক্রিনে দেখুন।');
  });
});
