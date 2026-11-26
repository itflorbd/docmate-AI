// src/lib/language/phonetic.ts
// DocMate AI - Client-side Banglish to Bengali Phonetic Transliteration Engine

const DICTIONARY_SHORTCUTS: Record<string, string> = {
  ami: 'আমি',
  amar: 'আমার',
  amra: 'আমরা',
  amader: 'আমাদের',
  tumi: 'তুমি',
  tmi: 'তুমি',
  tomar: 'তোমার',
  apni: 'আপনি',
  apnar: 'আপনার',
  daktar: 'ডাক্তার',
  doctor: 'ডাক্তার',
  rogi: 'রোগী',
  rogir: 'রোগীর',
  jor: 'জ্বর',
  jhor: 'জ্বর',
  kashi: 'কাশি',
  kasi: 'কাশি',
  sordi: 'সর্দি',
  thanda: 'ঠান্ডা',
  matha: 'মাথা',
  betha: 'ব্যথা',
  batha: 'ব্যথা',
  buk: 'বুক',
  pet: 'পেট',
  pete: 'পেটে',
  bomi: 'বমি',
  shashkosto: 'শ্বাসকষ্ট',
  durbol: 'দুর্বল',
  osudh: 'ওষুধ',
  oshudh: 'ওষুধ',
  oushodh: 'ওষুধ',
  napa: 'নাপা',
  ace: 'এইস',
  seclo: 'সেকলো',
  sergel: 'সারজেল',
  ceevit: 'সিভিট',
  din: 'দিন',
  dhore: 'ধরে',
  hobe: 'হবে',
  hoy: 'হয়',
  ache: 'আছে',
  nai: 'নাই',
  nei: 'নেই',
  kintu: 'কিন্তু',
  ebong: 'এবং',
  ar: 'আর',
  ki: 'কী',
  kemon: 'কেমন',
  kothay: 'কোথায়',
  koto: 'কত',
};

// Vowel signs (Kar)
const KAR_MAP: Record<string, string> = {
  a: 'া',
  aa: 'া',
  i: 'ি',
  ee: 'ী',
  u: 'ু',
  oo: 'ূ',
  e: 'ে',
  oi: 'ৈ',
  o: 'ো',
  ou: 'ৌ',
};

// Independent vowels (Swarabarna)
const VOWEL_MAP: Record<string, string> = {
  a: 'আ',
  aa: 'আ',
  i: 'ই',
  ee: 'ঈ',
  u: 'উ',
  oo: 'ঊ',
  e: 'এ',
  oi: 'ঐ',
  o: 'ও',
  ou: 'ঔ',
};

// Consonant clusters & consonants (Byanjanbarna)
const CONSONANT_MAP: Record<string, string> = {
  k: 'ক',
  kh: 'খ',
  g: 'গ',
  gh: 'ঘ',
  ng: 'ঙ',
  ch: 'চ',
  chh: 'ছ',
  j: 'জ',
  jh: 'ঝ',
  t: 'ত',
  th: 'থ',
  d: 'দ',
  dh: 'ধ',
  n: 'ন',
  p: 'প',
  ph: 'ফ',
  f: 'ফ',
  b: 'ব',
  bh: 'ভ',
  v: 'ভ',
  m: 'ম',
  z: 'য',
  r: 'র',
  l: 'ল',
  sh: 'শ',
  s: 'স',
  h: 'হ',
  T: 'ট',
  Th: 'ঠ',
  D: 'ড',
  Dh: 'ঢ',
  N: 'ণ',
  R: 'ড়',
  Rh: 'ঢ়',
  y: 'য়',
};

/**
 * Transliterates an individual Banglish word to Bengali script.
 */
export function transliterateWord(word: string): string {
  if (!word) return '';
  const lower = word.toLowerCase();

  // 1. Direct dictionary shortcut
  if (DICTIONARY_SHORTCUTS[lower]) {
    return DICTIONARY_SHORTCUTS[lower];
  }

  // 2. Fallback rule-based transliteration
  let out = '';
  let i = 0;
  const len = word.length;

  while (i < len) {
    const two = word.substring(i, i + 2).toLowerCase();
    const one = word.charAt(i);

    if (CONSONANT_MAP[two]) {
      out += CONSONANT_MAP[two];
      i += 2;
      // Check for following vowel (kar)
      if (i < len) {
        const nextTwo = word.substring(i, i + 2).toLowerCase();
        const nextOne = word.charAt(i).toLowerCase();
        if (KAR_MAP[nextTwo]) {
          out += KAR_MAP[nextTwo];
          i += 2;
        } else if (KAR_MAP[nextOne]) {
          out += KAR_MAP[nextOne];
          i += 1;
        }
      }
    } else if (CONSONANT_MAP[one]) {
      out += CONSONANT_MAP[one];
      i += 1;
      // Check for following vowel (kar)
      if (i < len) {
        const nextTwo = word.substring(i, i + 2).toLowerCase();
        const nextOne = word.charAt(i).toLowerCase();
        if (KAR_MAP[nextTwo]) {
          out += KAR_MAP[nextTwo];
          i += 2;
        } else if (KAR_MAP[nextOne]) {
          out += KAR_MAP[nextOne];
          i += 1;
        }
      }
    } else if (VOWEL_MAP[two]) {
      out += VOWEL_MAP[two];
      i += 2;
    } else if (VOWEL_MAP[one.toLowerCase()]) {
      out += VOWEL_MAP[one.toLowerCase()];
      i += 1;
    } else {
      out += one;
      i += 1;
    }
  }

  return out;
}

/**
 * Transliterates full Banglish sentence to Bengali script preserving spaces and punctuation.
 */
export function transliterateBanglishToBangla(text: string): string {
  if (!text) return '';
  return text.replace(/[a-zA-Z]+/g, (match) => transliterateWord(match));
}
