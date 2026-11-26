import { detectLanguage } from '../language/detector';

export type ConversationLocale = 'bn' | 'en';
export type ConversationLanguage = ConversationLocale | 'auto';

const romanizedGreeting = /^(?:ass?alamu alai[ck]um|salam|nomoskar|namaskar|kemon ach(?:en|o|ho))$/u;
const romanizedThanks = /^(?:dhonnobad|dhonyobad|dhanyabad|onek dhonnobad)$/u;
const romanizedIdentity = /^(?:apni|tumi) ki (?:ai|manush)$/u;

function normalizeTurn(text: string) {
  return text.toLowerCase().trim().replace(/[.!?।]+$/u, '').trim().replace(/\s+/gu, ' ');
}

export function conversationLocale(
  text: string,
  language: ConversationLanguage,
  previous: ConversationLocale,
): ConversationLocale {
  if (language !== 'auto') return language;
  const turn = normalizeTurn(text);
  if (!/\p{L}/u.test(turn) || /^(?:ok|okay|bp|hr|spo2|ecg|bmi|cbc)$/u.test(turn)) return previous;
  if (romanizedGreeting.test(turn) || romanizedThanks.test(turn) || romanizedIdentity.test(turn)) return 'bn';
  return detectLanguage(turn).dominantLang;
}

// These are whole-turn social exchanges. Any clinical text continues through
// the library and safety routing, even when it starts with a greeting.
export function conversationalReply(input: string) {
  const turn = normalizeTurn(input);
  if (romanizedGreeting.test(turn) || /^(hi|hello|hey|hi docmate|hello docmate|hey docmate|হাই|হ্যালো|সালাম|আসসালামু আলাইকুম|নমস্কার|কেমন আছেন)$/u.test(turn)) {
    return 'conversationGreeting';
  }
  if (romanizedThanks.test(turn) || /^(thanks|thank you|thank you docmate|ধন্যবাদ|অনেক ধন্যবাদ)$/u.test(turn)) {
    return 'conversationThanks';
  }
  if (romanizedIdentity.test(turn) || /^(are you human|are you (an? )?ai|am i talking to a human|তুমি কি মানুষ|আপনি কি মানুষ|তুমি কি এআই|আপনি কি এআই)$/u.test(turn)) {
    return 'conversationIdentity';
  }
  return null;
}
