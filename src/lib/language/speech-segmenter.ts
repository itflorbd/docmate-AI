export interface SpeechSegment {
  text: string;
  lang: 'bn' | 'en';
}

export function segmentForSpeech(text: string, locale: SpeechSegment['lang'] = 'bn'): SpeechSegment[] {
  const cleanText = text
    .replace(/\[\^chunk_[a-zA-Z0-9_-]+\]/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
  if (!cleanText) return [];

  // Keep parenthetical terms and units with their sentence. A decimal point is
  // not a sentence boundary, and Bangla danda belongs to the preceding text.
  const sentences = cleanText.split(/(?<=[।!?])\s*|(?<=\.)\s+(?=[\p{L}“"‘'])|\n+/u);
  const segments: SpeechSegment[] = [];
  for (const sentence of sentences) {
    const value = sentence.trim();
    if (!value) continue;
    const previous = segments.at(-1);
    const bangla = value.match(/[\u0985-\u09B9\u09CE\u09DC-\u09E1]/g)?.length ?? 0;
    const english = value.match(/[a-z]/gi)?.length ?? 0;
    const lang = bangla === english ? previous?.lang ?? locale : bangla > english ? 'bn' : 'en';
    if (previous?.lang === lang) {
      previous.text += /^[।!?]/.test(value) ? value : ` ${value}`;
    } else {
      segments.push({ text: value, lang });
    }
  }
  return segments;
}
