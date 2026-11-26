// src/lib/language/lexicon.ts
// DocMate AI - Romanized Bangla (Banglish) Lexicon (300+ Words & Frequent Variants)

export const BANGLISH_LEXICON: Set<string> = new Set([
  // Pronouns & Address
  'ami', 'amra', 'amar', 'amader', 'amake', 'amay',
  'tumi', 'tmi', 'tmr', 'tomar', 'tomra', 'tomader', 'tomake',
  'apni', 'apnar', 'apnara', 'apnader', 'apnake',
  'se', 'she', 'tar', 'taar', 'take', 'tader',
  'tini', 'tini-o', 'tahar', 'tahader',
  'o', 'or', 'oder', 'oke', 'ora',
  'e', 'er', 'eder', 'eke', 'era',
  'eta', 'eita', 'eyta', 'ota', 'oita', 'oyta', 'sheta', 'seta', 'otai', 'etai',

  // Interrogatives (Questions)
  'ki', 'kemon', 'kmn', 'kothay', 'kothae', 'koto', 'kototuku', 'kotogulo',
  'kon', 'konta', 'konti', 'konte', 'kokhon', 'kkhn',
  'keno', 'kno', 'kivabe', 'kivbe', 'kemon kore', 'kirokom', 'kirokom bhabe',
  'kar', 'kare', 'kake', 'kader', 'kar jonno',

  // Copula & Auxiliary Verbs (be, have, do, happen)
  'hobe', 'hbe', 'hoy', 'hoi', 'hocche', 'hochhe', 'hoche',
  'hoise', 'hoiche', 'hoyeche', 'hoyese', 'holo', 'hoilo',
  'hoto', 'hote', 'hobena', 'hoyna', 'hocchena', 'hobar',
  'ache', 'achhe', 'ase', 'ashe', 'asilo', 'chilo', 'chilo na',
  'thake', 'thakbe', 'thakle', 'thakuk', 'thaka', 'thakena',
  'lage', 'lagbe', 'lagche', 'lagle', 'laglo', 'lagena',
  'parbo', 'parben', 'paro', 'paren', 'pare', 'parbe',

  // Negation Markers
  'nai', 'nay', 'nei', 'na', 'noy', 'nae', 'chhara', 'chara', 'baad', 'bad', 'hin', 'mukto',

  // Conjunctions, Particles & Prepositions
  'ar', 'aar', 'ebong', 'ebng', 'kintu', 'kntu', 'tobe', 'tobey', 'othoba', 'othba', 'ba',
  'nahoy', 'na hoy', 'karon', 'krn', 'jeno', 'jate', 'jodi', 'jd',
  'taile', 'tahole', 'thle', 'diye', 'dea', 'moto', 'moton',
  'theke', 'thke', 'cheye', 'chye', 'por', 'pore', 'age', 'aage',
  'moddhe', 'modhe', 'bhetore', 'majhe', 'shonge', 'songe', 'sathe',

  // Quantifiers & Numbers (Banglish spellings)
  'ek', 'dui', 'tin', 'char', 'panch', 'choy', 'shat', 'sat', 'at', 'aath', 'noy', 'dosh',
  'egaro', 'baro', 'tero', 'choddo', 'ponero', 'sholo', 'shotro', 'atharo', 'unish', 'bish',
  'koyek', 'koyekta', 'koyekdin', 'onno', 'onk', 'onek', 'olpo', 'beshi', 'kom', 'shob', 'sob',

  // Time & Duration
  'din', 'deen', 'dhore', 'dhoria', 'jabot', 'shoptaho', 'soptaho', 'shoptaha', 'week', 'mash', 'bochhor', 'bochor',
  'shokal', 'sokal', 'bikal', 'dupur', 'rat', 'raat', 'rate', 'daily', 'protidin',
  'ghonta', 'ghontar', 'minute', 'second', 'ajke', 'aaj', 'kal', 'kaal', 'tarpor',

  // Clinical Symptoms & Body Parts (Romanized)
  'jor', 'jhor', 'jwor', 'gaye jor', 'tap',
  'kashi', 'kasi', 'khashi', 'kof', 'sordi', 'sordy', 'thanda',
  'matha', 'matha betha', 'betha', 'batha', 'bedona', 'jontrona',
  'pet', 'pete', 'pet betha', 'pet kharap', 'dast', 'tahol', 'patla paykhana', 'patla',
  'buk', 'buke', 'buk betha', 'buk dhorfor', 'dhorphor',
  'bomi', 'bomy', 'boomi', 'bomi bhab', 'bomi bomi',
  'shash', 'shas', 'shashkosto', 'shas kosto', 'shash nite', 'hafe', 'hapani',
  'chulkani', 'chulkay', 'ghao', 'ghaw', 'khot', 'rokto', 'rakto', 'lal', 'fule', 'fula',
  'durbol', 'durbolota', 'klanto', 'jhimi', 'ghum', 'ghuma', 'ghoom', 'chokh', 'kaan', 'gola',
  'gola betha', 'gola chula', 'khashkhash', 'khurkhur', 'kamrani', 'shirshir', 'kapuni', 'kampuni',
  'peshab', 'pishab', 'mutro', 'jala', 'porapor', 'jalapora', 'osustho', 'bemar', 'rog',

  // Clinical Actors & Context
  'rogi', 'rogir', 'patient', 'daktar', 'doctor', 'sir', 'madam',
  'osudh', 'oshudh', 'oushodh', 'oushod', 'medicine', 'med', 'dawai', 'dawya',
  'khorak', 'khawa', 'khaoa', 'khete', 'khele', 'khan', 'khaben', 'khabo',
  'deya', 'dite', 'dile', 'den', 'diben', 'neya', 'nite', 'nile', 'nen', 'neben',
  'dekha', 'dekhe', 'dekhun', 'dekhte', 'dekhbo', 'bolun', 'bolte', 'bolbo', 'bollam',
  'bujhte', 'bujhi', 'bujhen', 'bujheche', 'shunun', 'shunte', 'shunbo',

  // Actions & Intent Triggers
  'janan', 'bolun', 'dekhun', 'khujun', 'khuje', 'den', 'koren', 'korun',
  'lagbe', 'dorkar', 'proyojon', 'uchit', 'jabe', 'chole', 'cholbe',
  'notun', 'puran', 'purano', 'bhalo', 'kharap', 'thik', 'bhul', 'shotti', 'mittha',
  'dekhte', 'paro', 'dekhte paro', 'korte paro', 'parbe ni', 'ki dekhte paro'
]);

/**
 * Checks whether a token or normalized lowercase string is in the Banglish lexicon.
 */
export function isBanglishWord(word: string): boolean {
  if (!word) return false;
  return BANGLISH_LEXICON.has(word.toLowerCase());
}

/**
 * Counts how many words in a Latin-word array match the Banglish lexicon.
 */
export function countBanglishWords(tokens: string[]): { matched: number; total: number; ratio: number } {
  if (!tokens || tokens.length === 0) {
    return { matched: 0, total: 0, ratio: 0 };
  }
  let matched = 0;
  for (const token of tokens) {
    if (BANGLISH_LEXICON.has(token.toLowerCase())) {
      matched++;
    }
  }
  return {
    matched,
    total: tokens.length,
    ratio: matched / tokens.length,
  };
}
