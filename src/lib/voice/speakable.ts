/**
 * DocMate AI - Verified Speakable Formatter
 * 
 * Hard Rule: A spoken answer must come ONLY from an already verified structure.
 * Drops anything marked unverified, strips markdown formatting, converts citation
 * references into "প্রমাণ স্ক্রিনে আছে" / "Proof is on screen", and caps length to 2-3 sentences.
 */

export interface VerifiedClinicalResult {
  found?: boolean;
  status?: string; // 'insufficient_evidence' | 'analyzed' | 'confirmed'
  answer?: string | null;
  text?: string;
  summary?: string;
  verified?: boolean;
  citations?: Array<{
    chunk_id?: string;
    quote?: string;
    verified?: boolean;
    source_title?: string;
    page?: number;
  }>;
  missing_information?: Array<{
    id?: string;
    text: string;
    why_it_helps?: string;
  }>;
}

export function cleanMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[\^?\d+\]/g, '') // strip citation tags like [1], [^1]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link text](url) -> link text
    .replace(/[*_#`~>]/g, '') // strip markdown asterisks, hashes, backticks
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transforms verified clinical structure into short, safe speakable text (max 2-3 sentences).
 * If the claim is explicitly unverified or status is insufficient_evidence, handles appropriately.
 */
export function makeSpeakable(
  result: VerifiedClinicalResult | null | undefined,
  locale: 'bn' | 'en' = 'bn'
): string {
  if (!result) {
    return locale === 'bn'
      ? 'কোনো তথ্য পাওয়া যায়নি। বিস্তারিত স্ক্রিনে দেখুন।'
      : 'No clinical information found. Please check the screen.';
  }

  // 1. Hard check: If the top-level result or claim is marked unverified, NEVER speak it
  if (result.verified === false) {
    return locale === 'bn'
      ? 'পর্যাপ্ত প্রমাণ নেই। অপ্রমাণিত তথ্য মুখে বলা হয় না।'
      : 'Insufficient evidence. Unverified claims are not spoken.';
  }

  // 2. Insufficient Evidence handling
  if (result.status === 'insufficient_evidence' || result.found === false) {
    if (result.missing_information && result.missing_information.length > 0) {
      const firstQ = cleanMarkdown(result.missing_information[0].text);
      return locale === 'bn'
        ? `প্রমাণ অপর্যাপ্ত। নির্ণয়ের জন্য অতিরিক্ত তথ্য প্রয়োজন: ${firstQ}`
        : `Insufficient evidence. Additional clinical findings needed: ${firstQ}`;
    }
    return locale === 'bn'
      ? 'লাইব্রেরিতে পর্যাপ্ত প্রমাণ মেলেনি। অতিরিক্ত পরীক্ষা প্রয়োজন।'
      : 'Insufficient evidence in the medical library. Additional tests required.';
  }

  // 3. Extract verified content text
  const rawText = result.answer || result.summary || result.text || '';
  const cleaned = cleanMarkdown(rawText);

  // If citations exist and verified
  const hasCitations = Boolean(result.citations && result.citations.length > 0);
  // Filter out any citation specifically marked verified === false
  const validCitations = result.citations?.filter((c) => c.verified !== false) || [];

  if (hasCitations && validCitations.length === 0) {
    // Had citations, but none passed code verification
    return locale === 'bn'
      ? 'তথ্যটির কোনো যাচাইকৃত লাইব্রেরি প্রমাণ মেলেনি। বিস্তারিত স্ক্রিনে দেখুন।'
      : 'No verified library evidence was confirmed. Details on screen.';
  }

  // Check if text is just the generic placeholder header
  const isGenericExcerptsHeader =
    /^(?:The library contains the following matching source excerpts\.?|লাইব্রেরিতে অনুসন্ধানের সঙ্গে মেলে এমন উৎসের অংশ নিচে দেওয়া হয়েছে।?)$/i.test(
      cleaned
    );

  let speechBase = cleaned;
  if ((!speechBase || isGenericExcerptsHeader) && validCitations.length > 0 && validCitations[0].quote) {
    speechBase = cleanMarkdown(validCitations[0].quote);
  }

  // Cap length to at most 2 to 3 sentences
  const sentenceDelimiter = locale === 'bn' ? /[।!?]\s+/ : /[.!?]\s+/;
  const sentences = speechBase.split(sentenceDelimiter).filter((s) => s.trim().length > 0);
  const cappedSentences = sentences.slice(0, 2);

  const proofPhrase =
    locale === 'bn'
      ? 'প্রমাণ স্ক্রিনে আছে।'
      : 'Proof is on screen.';

  if (cappedSentences.length > 0) {
    const endPunctuation = locale === 'bn' ? '।' : '.';
    const joined = cappedSentences.join(locale === 'bn' ? '। ' : '. ') + endPunctuation;
    if (hasCitations && validCitations.length > 0) {
      return `${joined} ${proofPhrase}`;
    }
    return joined;
  }

  return proofPhrase;
}
