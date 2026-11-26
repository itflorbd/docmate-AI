import { StructuredPatientInput } from '@/types';
import { convertBanglaDigitsToAscii } from '@/lib/language/preprocessor';

export interface ProposedUpdate {
  id: string;
  field_path: string;
  label_en: string;
  label_bn: string;
  value: string | number | string[];
  display_value: string;
  original_wording: string;
  status: 'pending' | 'confirmed' | 'dismissed';
}

const SYMPTOM_PATTERNS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /\b(?:dry\s+cough|coughing|chronic\s+cough|productive\s+cough|cough|কাশি|কফ)\b/i, canonical: 'cough' },
  { pattern: /\b(?:shortness\s+of\s+breath|breathlessness|dyspnea|difficulty\s+breathing|শ্বাসকষ্ট|হাঁপানি)\b/i, canonical: 'dyspnea' },
  { pattern: /\b(?:chest\s+pain|pleuritic\s+pain|substernal\s+pressure|বুকে\s+ব্যথা)\b/i, canonical: 'chest pain' },
  { pattern: /\b(?:feverish|high\s+fever|low\s+grade\s+fever|fever|জ্বর)\b/i, canonical: 'fever' },
  { pattern: /\b(?:headache|severe\s+headache|migraine|মাথাব্যথা|মাথা\s+ব্যথা)\b/i, canonical: 'headache' },
  { pattern: /\b(?:fatigue|exhaustion|malaise|weakness|ক্লান্তি|দুর্বলতা)\b/i, canonical: 'fatigue' },
  { pattern: /\b(?:sore\s+throat|pharyngitis|গলা\s+ব্যথা)\b/i, canonical: 'sore throat' },
  { pattern: /\b(?:nausea|vomiting|emesis|বমি|বমি\s+ভাব)\b/i, canonical: 'nausea' },
  { pattern: /\b(?:dizziness|lightheadedness|vertigo|মাথা\s+ঘোরা)\b/i, canonical: 'dizziness' },
];

const AUSCULTATION_PATTERNS: Array<{
  pattern: RegExp;
  label_en: string;
  label_bn: string;
  value: string;
  display_value: string;
}> = [
  {
    pattern: /\b(?:crackles?(?:\s+present)?|crepitations?|creps|র‌্যালস|ক্রেপিটেশন)\b/i,
    label_en: 'Chest Auscultation',
    label_bn: 'বুকের শব্দ (Auscultation)',
    value: 'Localized inspiratory crackles present',
    display_value: 'Inspiratory crackles (ক্রেপিটেশন)',
  },
  {
    pattern: /\b(?:wheez(?:ing|es)?(?:\s+present)?|rhonchi|হুইজ|হুইজিং)\b/i,
    label_en: 'Chest Auscultation',
    label_bn: 'বুকের শব্দ (Auscultation)',
    value: 'Bilateral expiratory wheezing',
    display_value: 'Wheezing (হুইজ)',
  },
  {
    pattern: /\b(?:clear\s+(?:breath\s+sounds?|chest|lungs?)|clear\s+breath|normal\s+(?:breath\s+sounds?|auscultation)|স্বাভাবিক\s+(?:ফুসফুসের\s+)?শব্দ)\b/i,
    label_en: 'Chest Auscultation',
    label_bn: 'বুকের শব্দ (Auscultation)',
    value: 'Clear breath sounds bilaterally',
    display_value: 'Clear breath sounds (স্বাভাবিক)',
  },
  {
    pattern: /\b(?:decreased\s+air\s+entry|reduced\s+air\s+entry|বায়ু\s+চলাচল\s+হ্রাস)\b/i,
    label_en: 'Chest Auscultation',
    label_bn: 'বুকের শব্দ (Auscultation)',
    value: 'Decreased air entry',
    display_value: 'Decreased air entry (বায়ু চলাচল হ্রাস)',
  },
];

export function extractClinicalFacts(
  text: string,
  currentPatient: StructuredPatientInput,
): ProposedUpdate[] {
  const updates: ProposedUpdate[] = [];
  if (!text || !text.trim()) return updates;
  const normalized = convertBanglaDigitsToAscii(text).trim();

  // 1. Temperature in Celsius (e.g., "temperature 38.5 C", "temp is 39", "তাপমাত্রা ৩৮.৫ ডিগ্রি")
  const tempCelsiusMatch = normalized.match(
    /(?:temp(?:erature)?|febrile|fever|তাপমাত্রা)(?:\s+of)?\s*(?:is|was|at|:)?\s*([34]\d(?:\.\d)?)\s*(?:°?\s*c|celsius|ডিগ্রি|ডিগ্রী)?/iu
  );
  if (tempCelsiusMatch) {
    const val = parseFloat(tempCelsiusMatch[1]);
    if (val >= 34.0 && val <= 43.0) {
      updates.push({
        id: `update-temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field_path: 'vitals.temperature_celsius',
        label_en: 'Temperature (°C)',
        label_bn: 'শারীরিক তাপমাত্রা (°C)',
        value: val,
        display_value: `${val} °C`,
        original_wording: tempCelsiusMatch[0].trim(),
        status: 'pending',
      });
    }
  }

  // 2. Temperature in Fahrenheit (e.g., "temp 101.5 F")
  const tempFahrMatch = normalized.match(
    /\b(?:temp(?:erature)?)\s*(?:is|was|at|:)?\s*(10\d(?:\.\d)?|9\d(?:\.\d)?)\s*(?:°?f|fahrenheit)\b/i
  );
  if (tempFahrMatch && !tempCelsiusMatch) {
    const fahr = parseFloat(tempFahrMatch[1]);
    const celsius = Math.round(((fahr - 32) * (5 / 9)) * 10) / 10;
    updates.push({
      id: `update-temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      field_path: 'vitals.temperature_celsius',
      label_en: 'Temperature (°C)',
      label_bn: 'শারীরিক তাপমাত্রা (°C)',
      value: celsius,
      display_value: `${celsius} °C (${fahr} °F)`,
      original_wording: tempFahrMatch[0].trim(),
      status: 'pending',
    });
  }

  // 3. Blood Pressure (e.g. "BP 130/85", "blood pressure 140/90 mmHg", "বিপি ১২০/৮০")
  const bpMatch = normalized.match(
    /(?:bp|blood\s*pressure|প্রেসার|ব্লাড\s*প্রেসার|বিপি|রক্তচাপ)\s*(?:is|was|:)?\s*(\d{2,3})\s*[\/x]\s*(\d{2,3})(?:\s*mm\s*hg)?/iu
  );
  if (bpMatch) {
    const systolic = parseInt(bpMatch[1], 10);
    const diastolic = parseInt(bpMatch[2], 10);
    if (systolic >= 60 && systolic <= 260 && diastolic >= 30 && diastolic <= 160) {
      updates.push({
        id: `update-bp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field_path: 'vitals.blood_pressure',
        label_en: 'Blood Pressure (mmHg)',
        label_bn: 'রক্তচাপ (mmHg)',
        value: `${systolic}/${diastolic}`,
        display_value: `${systolic}/${diastolic} mmHg`,
        original_wording: bpMatch[0].trim(),
        status: 'pending',
      });
    }
  }

  // 4. Heart Rate / Pulse (e.g. "heart rate 98", "pulse 102 bpm", "HR 88", "পালস ৭৬")
  const hrMatch = normalized.match(
    /(?:pulse|heart\s*rate|hr|পালস|হৃদস্পন্দন)\s*(?:is|was|:)?\s*(\d{2,3})\s*(?:bpm)?/iu
  );
  if (hrMatch) {
    const hr = parseInt(hrMatch[1], 10);
    if (hr >= 30 && hr <= 220) {
      updates.push({
        id: `update-hr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field_path: 'vitals.heart_rate',
        label_en: 'Heart Rate (bpm)',
        label_bn: 'হৃদস্পন্দন / পালস (bpm)',
        value: hr,
        display_value: `${hr} bpm`,
        original_wording: hrMatch[0].trim(),
        status: 'pending',
      });
    }
  }

  // 5. Oxygen Saturation (e.g. "SpO2 94%", "SpO2 98", "oxygen sat 96%", "O2 sat 92%")
  const spo2Match = normalized.match(
    /\b(?:spo2|sp\s*o2|o2\s*sat(?:uration)?|oxygen\s*sat(?:uration)?|স্যাচুরেশন)\s*(?:is|was|:)?\s*(\d{2,3})\s*%?/iu
  );
  if (spo2Match) {
    const spo2 = parseInt(spo2Match[1], 10);
    if (spo2 >= 50 && spo2 <= 100) {
      updates.push({
        id: `update-spo2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field_path: 'vitals.spo2_percent',
        label_en: 'Oxygen Saturation SpO2 (%)',
        label_bn: 'অক্সিজেন স্যাচুরেশন SpO2 (%)',
        value: spo2,
        display_value: `${spo2} %`,
        original_wording: spo2Match[0].trim(),
        status: 'pending',
      });
    }
  }

  // 6. Respiratory Rate (e.g. "respiratory rate 24", "resp rate 22 bpm", "RR 20")
  const rrMatch = normalized.match(
    /\b(?:resp(?:iratory)?\s*rate|rr)\s*(?:is|was|:)?\s*(\d{1,2})\s*(?:bpm|\/min)?\b/i
  );
  if (rrMatch) {
    const rr = parseInt(rrMatch[1], 10);
    if (rr >= 8 && rr <= 60) {
      updates.push({
        id: `update-rr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field_path: 'vitals.respiratory_rate',
        label_en: 'Respiratory Rate (/min)',
        label_bn: 'শ্বাসপ্রশ্বাসের হার (/min)',
        value: rr,
        display_value: `${rr} /min`,
        original_wording: rrMatch[0].trim(),
        status: 'pending',
      });
    }
  }

  // 7. Drug Allergies (e.g. "allergic to penicillin", "allergy to amoxicillin")
  const allergyMatch = normalized.match(
    /\b(?:allergic\s+to|allergy(?:\s+to)?|known\s+allergy(?:\s+to)?)\s*:?\s*([a-zA-Z\s]{3,30})\b/i
  );
  if (allergyMatch) {
    const rawAllergy = allergyMatch[1].trim().toLowerCase();
    const existing = (currentPatient.allergies || []).map((a) => a.toLowerCase());
    if (rawAllergy && !existing.includes(rawAllergy)) {
      updates.push({
        id: `update-allergy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field_path: 'allergies',
        label_en: 'Documented Drug Allergy',
        label_bn: 'ওষুধের অ্যালার্জি',
        value: rawAllergy,
        display_value: rawAllergy,
        original_wording: allergyMatch[0].trim(),
        status: 'pending',
      });
    }
  }

  // 8. Presenting Symptoms
  const existingSymptoms = (currentPatient.symptoms || []).map((s) => s.toLowerCase());
  for (const { pattern, canonical } of SYMPTOM_PATTERNS) {
    if (!existingSymptoms.includes(canonical)) {
      const match = normalized.match(pattern);
      if (match) {
        updates.push({
          id: `update-symptom-${canonical}-${Date.now()}`,
          field_path: 'symptoms',
          label_en: 'Presenting Symptom',
          label_bn: 'উপসর্গ',
          value: canonical,
          display_value: canonical,
          original_wording: match[0].trim(),
          status: 'pending',
        });
      }
    }
  }

  // 9. Chest Auscultation & Examination Findings
  for (const { pattern, label_en, label_bn, value, display_value } of AUSCULTATION_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      updates.push({
        id: `update-auscultation-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        field_path: 'examination_findings',
        label_en,
        label_bn,
        value,
        display_value,
        original_wording: match[0].trim(),
        status: 'pending',
      });
      break;
    }
  }

  return updates;
}
