import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
  id: number;
  input: string;
  expected_lang: 'bn' | 'en' | 'banglish' | 'mixed';
  expected_dominant_lang?: 'bn' | 'en';
  expected_intent?: string;
  expected_symptoms?: Array<{ canonical: string; present: boolean; durationDays?: number }>;
  expected_medicines?: Array<{ canonical: string }>;
  expected_vitals?: Array<{ type: string; value: string }>;
  expected_ambiguity?: boolean;
  notes?: string;
}

const cases: TestCase[] = [
  // The 12 Mandatory Benchmark Cases
  {
    id: 1,
    input: "রোগীর তিন দিন ধরে জ্বর",
    expected_lang: "bn",
    expected_dominant_lang: "bn",
    expected_symptoms: [{ canonical: "fever", present: true, durationDays: 3 }],
    notes: "Mandatory Case 1: Pure Bangla fever with 3 days duration"
  },
  {
    id: 2,
    input: "What is the first-line treatment of pneumonia?",
    expected_lang: "en",
    expected_dominant_lang: "en",
    expected_intent: "ask_library",
    expected_symptoms: [{ canonical: "pneumonia", present: true }],
    notes: "Mandatory Case 2: Pure English pneumonia treatment inquiry"
  },
  {
    id: 3,
    input: "pneumonia er first line treatment ki?",
    expected_lang: "banglish",
    expected_dominant_lang: "bn",
    expected_intent: "ask_library",
    expected_symptoms: [{ canonical: "pneumonia", present: true }],
    notes: "Mandatory Case 3: Banglish pneumonia treatment inquiry"
  },
  {
    id: 4,
    input: "jor nai kintu kashi ache 5 din",
    expected_lang: "banglish",
    expected_dominant_lang: "bn",
    expected_symptoms: [
      { canonical: "fever", present: false },
      { canonical: "cough", present: true, durationDays: 5 }
    ],
    notes: "Mandatory Case 4: Banglish split negation (fever absent, cough present)"
  },
  {
    id: 5,
    input: "রোগীর তিন দিন ধরে jor ar kashi, কাঁপুনি নেই",
    expected_lang: "mixed",
    expected_dominant_lang: "bn",
    expected_symptoms: [
      { canonical: "fever", present: true, durationDays: 3 },
      { canonical: "cough", present: true },
      { canonical: "chills", present: false }
    ],
    notes: "Mandatory Case 5: Mixed code-switching with duration and negation"
  },
  {
    id: 6,
    input: "tmi ki dekhte paro how much efficient this is ?",
    expected_lang: "banglish",
    expected_dominant_lang: "bn",
    expected_intent: "ask_capabilities",
    expected_ambiguity: true,
    notes: "Mandatory Case 6: Banglish capabilities inquiry with ambiguous reference"
  },
  {
    id: 7,
    input: "can you see this?",
    expected_lang: "en",
    expected_dominant_lang: "en",
    expected_intent: "ask_capabilities",
    expected_ambiguity: true,
    notes: "Mandatory Case 7: English capabilities inquiry"
  },
  {
    id: 8,
    input: "Napa dose koto",
    expected_lang: "banglish",
    expected_dominant_lang: "bn",
    expected_intent: "medicine_lookup",
    expected_medicines: [{ canonical: "paracetamol" }],
    notes: "Mandatory Case 8: Banglish medicine dosage inquiry"
  },
  {
    id: 9,
    input: "BP 130/85 mmHg, pulse 80",
    expected_lang: "en",
    expected_dominant_lang: "en",
    expected_vitals: [
      { type: "bp", value: "130/85" },
      { type: "pulse", value: "80" }
    ],
    notes: "Mandatory Case 9: English vitals recording"
  },
  {
    id: 10,
    input: "১০২ ডিগ্রি জ্বর",
    expected_lang: "bn",
    expected_dominant_lang: "bn",
    expected_symptoms: [{ canonical: "fever", present: true }],
    expected_vitals: [{ type: "temperature", value: "102" }],
    notes: "Mandatory Case 10: Bengali digits temperature and fever"
  },
  {
    id: 11,
    input: "notun rogi",
    expected_lang: "banglish",
    expected_dominant_lang: "bn",
    expected_intent: "navigate",
    notes: "Mandatory Case 11: Banglish navigation to new patient"
  },
  {
    id: 12,
    input: "rogir talika dekhan",
    expected_lang: "banglish",
    expected_dominant_lang: "bn",
    expected_intent: "navigate",
    notes: "Mandatory Case 12: Banglish navigation to patient list"
  }
];

// Generate additional cases (13 to 220) covering varied clinical scenarios
const symptomsList = [
  { bn: "মাথা ব্যথা", banglish: "matha betha", en: "headache", canonical: "headache" },
  { bn: "বুকে ব্যথা", banglish: "buk betha", en: "chest pain", canonical: "chest pain" },
  { bn: "শ্বাসকষ্ট", banglish: "shashkosto", en: "shortness of breath", canonical: "shortness of breath" },
  { bn: "বমি", banglish: "bomi", en: "vomiting", canonical: "vomiting" },
  { bn: "পেট ব্যথা", banglish: "pet betha", en: "abdominal pain", canonical: "abdominal pain" },
  { bn: "সর্দি", banglish: "sordi", en: "runny nose", canonical: "runny nose" },
  { bn: "পাতলা পায়খানা", banglish: "patla paykhana", en: "diarrhoea", canonical: "diarrhoea" },
  { bn: "দুর্বলতা", banglish: "durbolota", en: "weakness", canonical: "weakness" },
  { bn: "কাশি", banglish: "kashi", en: "cough", canonical: "cough" },
  { bn: "জ্বর", banglish: "jor", en: "fever", canonical: "fever" },
];

const medicinesList = [
  { name: "Amoxicillin", canonical: "amoxicillin" },
  { name: "Azithromycin", canonical: "azithromycin" },
  { name: "Ciprofloxacin", canonical: "ciprofloxacin" },
  { name: "Seclo", canonical: "omeprazole" },
  { name: "Sergel", canonical: "esomeprazole" },
  { name: "Ace", canonical: "paracetamol" },
  { name: "Ceevit", canonical: "vitamin c" },
  { name: "Metronidazole", canonical: "metronidazole" },
  { name: "Ceftriaxone", canonical: "ceftriaxone" },
  { name: "Paracetamol", canonical: "paracetamol" },
];

let idCounter = 13;

// Category A: Pure Bengali script clinical utterances (cases 13-65)
for (let i = 0; i < 50; i++) {
  const sym = symptomsList[i % symptomsList.length];
  const dur = (i % 7) + 1;
  const isNeg = i % 3 === 0;

  const text = isNeg
    ? `রোগীর কোনো ${sym.bn} নেই`
    : `রোগীর ${dur} দিন ধরে ${sym.bn} আছে`;

  cases.push({
    id: idCounter++,
    input: text,
    expected_lang: "bn",
    expected_dominant_lang: "bn",
    expected_symptoms: [{ canonical: sym.canonical, present: !isNeg }],
    notes: `Pure Bangla clinical case ${idCounter - 1}`
  });
}

// Category B: Pure English clinical queries and findings (cases 66-115)
for (let i = 0; i < 50; i++) {
  const sym = symptomsList[i % symptomsList.length];
  const med = medicinesList[i % medicinesList.length];
  const isMed = i % 2 === 0;
  const isNeg = i % 3 === 1;

  const text = isMed
    ? `What is the dosage and administration of ${med.name}?`
    : isNeg
    ? `Patient presents with mild cough but denies ${sym.en}`
    : `Patient complains of acute ${sym.en} for ${((i % 5) + 1)} days`;

  cases.push({
    id: idCounter++,
    input: text,
    expected_lang: "en",
    expected_dominant_lang: "en",
    expected_intent: isMed ? "medicine_lookup" : "ask_library",
    expected_symptoms: !isMed ? [{ canonical: sym.canonical, present: !isNeg }] : undefined,
    expected_medicines: isMed ? [{ canonical: med.canonical }] : undefined,
    notes: `English clinical case ${idCounter - 1}`
  });
}

// Category C: Banglish clinical inquiries and negations (cases 116-165)
for (let i = 0; i < 50; i++) {
  const sym = symptomsList[i % symptomsList.length];
  const dur = (i % 5) + 2;
  const isNeg = i % 2 === 1;

  const text = isNeg
    ? `${sym.banglish} nai kintu shashkosto ache`
    : `rogir ${dur} din dhore ${sym.banglish} hocche`;

  cases.push({
    id: idCounter++,
    input: text,
    expected_lang: "banglish",
    expected_dominant_lang: "bn",
    expected_symptoms: [
      { canonical: sym.canonical, present: !isNeg },
      ...(isNeg ? [{ canonical: "shortness of breath", present: true }] : [])
    ],
    notes: `Banglish clinical case ${idCounter - 1}`
  });
}

// Category D: Mixed code-switching and capabilities (cases 166-215)
for (let i = 0; i < 50; i++) {
  const sym = symptomsList[i % symptomsList.length];
  const med = medicinesList[i % medicinesList.length];
  const dur = (i % 4) + 1;

  const text = i % 3 === 0
    ? `রোগীর ${dur} দিন ধরে ${sym.banglish} এবং fever আছে`
    : i % 3 === 1
    ? `আজকে rogi er ${med.name} dose koto hobe?`
    : `তীব্র ${sym.bn} রয়েছে kintu vomiting nai`;

  cases.push({
    id: idCounter++,
    input: text,
    expected_lang: "mixed",
    expected_dominant_lang: "bn",
    expected_intent: i % 3 === 1 ? "medicine_lookup" : "ask_library",
    notes: `Mixed code-switching case ${idCounter - 1}`
  });
}

// Write out JSONL
const outPath = path.join(process.cwd(), 'eval', 'language', 'test-cases.jsonl');
const content = cases.map((c) => JSON.stringify(c)).join('\n');
fs.writeFileSync(outPath, content, 'utf-8');

console.log(`✓ Successfully generated ${cases.length} test cases at ${outPath}`);
