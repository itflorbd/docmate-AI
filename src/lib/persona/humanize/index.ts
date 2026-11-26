import {
  AssistantPersonaConfig,
  UserAssistantPreferences,
  SessionContext,
  HumanizedResult,
} from './types';
import { VerifiedClinicalResult, cleanMarkdown } from '@/lib/voice/speakable';
import { ProtectedTokenGuard } from './protected-tokens';
import { analyzeDoctorInput } from './session-adaptive';
import { selectPhrase, formatDoctorTitle } from '../phrasebank';
import { SafetyAlert } from '@/types';

export * from './types';
export * from './protected-tokens';
export * from './session-adaptive';

const DEFAULT_PERSONA: AssistantPersonaConfig = {
  name: 'ডকমেট',
  defaultGreetingBn: 'স্বাগতম, ডাক্তার। আজ কীভাবে সাহায্য করতে পারি?',
  defaultGreetingEn: 'Welcome, Doctor. How can I assist you today?',
  defaultPreset: 'friendly',
  defaultAddressStyle: 'doctor',
};

const DEFAULT_PREFS: UserAssistantPreferences = {
  address_style: 'doctor',
  tone_preset: 'friendly',
  verbosity: 'normal',
  sounds_enabled: true,
  hints_enabled: true,
  avatar_enabled: true,
  speech_rate: 1.0,
  voice_id: 'default',
};

/**
 * Caps spoken text to at most 3 short sentences and ~35 words,
 * and appends "বিস্তারিত স্ক্রিনে দেখুন।" if not already present.
 */
function buildSafeSpeechText(rawText: string, locale: 'bn' | 'en'): string {
  const cleaned = cleanMarkdown(rawText);
  if (!cleaned) return '';

  const sentenceDelimiter = locale === 'bn' ? /[।!?]\s+/ : /[.!?]\s+/;
  const sentences = cleaned.split(sentenceDelimiter).filter((s) => s.trim().length > 0);

  // Take at most 2 sentences of content to leave room for the screen visual cue
  const selectedSentences = sentences.slice(0, 2);
  const endPunctuation = locale === 'bn' ? '।' : '.';
  let speech = selectedSentences.join(locale === 'bn' ? '। ' : '. ') + endPunctuation;

  // Cap words to ~30 words
  const words = speech.split(/\s+/);
  if (words.length > 30) {
    speech = words.slice(0, 30).join(' ') + (locale === 'bn' ? '...' : '...');
  }

  const trailingCue = locale === 'bn' ? 'বিস্তারিত স্ক্রিনে দেখুন।' : 'Details are on screen.';
  if (!speech.includes(trailingCue)) {
    speech = `${speech} ${trailingCue}`;
  }

  return speech;
}

/**
 * Humanizes verified clinical results with conversational warmth, respect,
 * and doctor-centric adaptability while strictly guaranteeing clinical token preservation.
 */
export function humanize(
  verifiedResult: VerifiedClinicalResult,
  persona: AssistantPersonaConfig = DEFAULT_PERSONA,
  prefs: UserAssistantPreferences = DEFAULT_PREFS,
  context: SessionContext = { sessionId: 'default' },
  locale: 'bn' | 'en' = 'bn',
  doctorInputText = '',
  safetyAlerts: SafetyAlert[] = []
): HumanizedResult {
  const isBn = locale === 'bn';
  const activePreset = prefs.tone_preset || persona.defaultPreset || 'friendly';
  const doctorTitle = formatDoctorTitle(prefs.address_style, locale, context.userName);
  const signals = analyzeDoctorInput(doctorInputText, context, safetyAlerts);

  const reactions: string[] = [];
  const urgentActive = signals.isUrgent;
  const hurryActive = signals.isHurry || prefs.verbosity === 'brief';

  // Extract core verified clinical text
  const rawClinicalAnswer = verifiedResult.answer || verifiedResult.summary || verifiedResult.text || '';
  const cleanedClinicalAnswer = rawClinicalAnswer.trim();

  const isDefaultRecordedAck =
    cleanedClinicalAnswer === 'ক্লিনিকাল পর্যবেক্ষণ কেস হিস্ট্রিতে লিপিবদ্ধ করা হয়েছে।' ||
    cleanedClinicalAnswer === 'Clinical observation has been recorded in the case consultation history.';

  // ----------------------------------------------------
  // CASE 1: Thanks Gratitude Handshake
  // ----------------------------------------------------
  if (signals.isThanks && (!cleanedClinicalAnswer || isDefaultRecordedAck)) {
    const thanksText = selectPhrase('thanks_reply', locale, {
      preset: activePreset,
      doctorTitle,
      sessionId: context.sessionId,
    });
    reactions.push('task_done');
    return {
      displayText: thanksText,
      speechText: thanksText,
      reactions,
      fallbackUsed: false,
      urgentActive: false,
      hurryActive: false,
      nextSteps: [],
    };
  }

  // ----------------------------------------------------
  // CASE 2: Correction or Frustration Handling
  // ----------------------------------------------------
  if (signals.isCorrection && signals.shouldApologize && (!cleanedClinicalAnswer || isDefaultRecordedAck)) {
    const apology = isBn
      ? 'দুঃখিত, ঠিক বুঝতে পারিনি। কী পরিবর্তন করতে চান? সরাসরি জানাতে পারেন বা টাইপ করতে পারেন।'
      : 'My apologies, I misunderstood. What would you like to update? Feel free to speak or type.';
    reactions.push('apology');
    return {
      displayText: apology,
      speechText: apology,
      reactions,
      fallbackUsed: false,
      urgentActive: false,
      hurryActive: false,
      nextSteps: [
        { label: isBn ? 'সংশোধন লিখুন' : 'Type correction', query: isBn ? 'সংশোধন:' : 'Correction:' },
      ],
    };
  }

  // ----------------------------------------------------
  // CASE 3: Critical Safety Alert / Red Flag Bypass
  // ----------------------------------------------------
  const criticalAlert = safetyAlerts.find((a) => a.severity === 'critical');
  if (criticalAlert) {
    const alertIntro = selectPhrase('alert_intro', locale, {
      preset: activePreset,
      doctorTitle,
      sessionId: context.sessionId,
    });
    reactions.push('concern');

    const alertDisplay = `${alertIntro} **${criticalAlert.title}**\n\n${criticalAlert.description}`;
    const alertSpeech = `${alertIntro} ${cleanMarkdown(criticalAlert.title)}. ${cleanMarkdown(criticalAlert.description)}. ${isBn ? 'বিস্তারিত স্ক্রিনে দেখুন।' : 'Details on screen.'}`;

    return {
      displayText: alertDisplay,
      speechText: alertSpeech,
      reactions,
      fallbackUsed: false,
      urgentActive: true,
      hurryActive: false,
      nextSteps: [
        { label: isBn ? 'জরুরি প্রটোকল' : 'Emergency Protocol', query: isBn ? 'জরুরি প্রটোকল দেখুন' : 'View Emergency Protocol' },
      ],
    };
  }

  // ----------------------------------------------------
  // CASE 4: Insufficient Evidence Handling
  // ----------------------------------------------------
  if (verifiedResult.status === 'insufficient_evidence' || verifiedResult.found === false) {
    reactions.push('thinking');
    const noEvidenceIntro = selectPhrase('no_evidence', locale, {
      preset: activePreset,
      doctorTitle,
      sessionId: context.sessionId,
    });

    let singleQuestion: string | undefined;
    let quickAnswers: string[] = [];

    // Strictly enforce 1 question per turn rule
    if (verifiedResult.missing_information && verifiedResult.missing_information.length > 0) {
      const topQ = verifiedResult.missing_information[0];
      singleQuestion = topQ.text;
      quickAnswers = (topQ as unknown as { quick_answers?: string[] }).quick_answers || [];
    }

    const questionSection = singleQuestion
      ? `\n\n💬 **${singleQuestion}**`
      : '';

    const display = `${noEvidenceIntro}${questionSection}`;
    const speech = singleQuestion
      ? `${noEvidenceIntro} ${cleanMarkdown(singleQuestion)}. ${isBn ? 'বিস্তারিত স্ক্রিনে দেখুন।' : 'Details on screen.'}`
      : `${noEvidenceIntro} ${isBn ? 'বিস্তারিত স্ক্রিনে দেখুন।' : 'Details on screen.'}`;

    const nextSteps = quickAnswers.slice(0, 3).map((ans) => ({
      label: ans,
      query: ans,
    }));

    return {
      displayText: display,
      speechText: buildSafeSpeechText(speech, locale),
      reactions,
      fallbackUsed: false,
      urgentActive,
      hurryActive,
      singleQuestion,
      nextSteps,
    };
  }

  // ----------------------------------------------------
  // CASE 5: Urgent / Hurry Mode Acceleration
  // ----------------------------------------------------
  if (urgentActive || hurryActive) {
    reactions.push('explaining');
    const hurryPrefix = signals.shouldAnnounceHurry
      ? (isBn ? 'সংক্ষেপে বলছি: ' : 'Speaking briefly: ')
      : '';

    const directDisplay = `${hurryPrefix}${cleanedClinicalAnswer}`;
    const directSpeech = buildSafeSpeechText(`${hurryPrefix}${cleanedClinicalAnswer}`, locale);

    // Verify token protection even in urgent mode
    const validation = ProtectedTokenGuard.validate(cleanedClinicalAnswer, directDisplay);
    const finalDisplay = validation.valid ? directDisplay : cleanedClinicalAnswer;

    return {
      displayText: finalDisplay,
      speechText: directSpeech,
      reactions,
      fallbackUsed: !validation.valid,
      urgentActive: true,
      hurryActive: true,
      nextSteps: [
        { label: isBn ? 'প্রমাণ দেখুন' : 'View Proof', query: isBn ? 'প্রমাণ পর্যালোচনা' : 'View evidence' },
      ],
    };
  }

  // ----------------------------------------------------
  // CASE 6: Normal Conversational Flow
  // Pattern: Acknowledge -> Answer -> Offer 1 Next Step
  // ----------------------------------------------------
  reactions.push('understood', 'explaining');

  // 1. Acknowledgment (only when polite, omitted in reserved or short turns)
  const ack = activePreset === 'friendly' && context.turnCount !== 0
    ? selectPhrase('acknowledge', locale, {
        preset: activePreset,
        doctorTitle,
        sessionId: context.sessionId,
      }) + ' '
    : '';

  // 2. Core Clinical Answer (1-3 sentences)
  const answerSection = `${ack}${cleanedClinicalAnswer}`;

  // 3. Next Steps (at most 3 interactive chips)
  const nextSteps: Array<{ label: string; query: string }> = [
    { label: isBn ? 'প্রমাণ দেখুন' : 'View Proof', query: isBn ? 'প্রমাণ পর্যালোচনা' : 'Review evidence' },
    { label: isBn ? 'চিকিৎসা গাইডলাইন' : 'Treatment Guideline', query: isBn ? 'চিকিৎসা নির্দেশনা' : 'Treatment guidelines' },
    { label: isBn ? 'পরবর্তী পরীক্ষা' : 'Next Tests', query: isBn ? 'প্রস্তাবিত ল্যাব পরীক্ষা' : 'Suggested tests' },
  ];

  // 4. Token Protection Guard Execution
  const validation = ProtectedTokenGuard.validate(cleanedClinicalAnswer, answerSection);
  const finalDisplayText = validation.valid ? answerSection : cleanedClinicalAnswer;

  const speechText = buildSafeSpeechText(answerSection, locale);

  return {
    displayText: finalDisplayText,
    speechText,
    reactions,
    fallbackUsed: !validation.valid,
    urgentActive: false,
    hurryActive: false,
    nextSteps,
  };
}
