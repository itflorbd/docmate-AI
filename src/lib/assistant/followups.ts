import { createHash } from 'node:crypto';
import type { MissingInformation, StructuredPatientInput } from '@/types';
import type { ProposedUpdate } from '@/lib/clinical-extractor';
import bn from '../../../messages/bn.json';
import en from '../../../messages/en.json';
import { hasVitals, normalizeQuestion } from './context';
import type { FollowUpMemory, ReplyLocale } from './types';

const RESPIRATORY = /cough|breath|dyspn|chest|sputum|wheez|কাশি|শ্বাস|বুক|কফ|kashi|shash/iu;

function wasAsked(memory: FollowUpMemory, id: string, text: string): boolean {
  if (memory.answeredIds.has(id)) return true;
  const normalized = normalizeQuestion(text);
  return memory.askedTexts.some((asked) => asked === normalized);
}

/**
 * Deterministic follow-up used when no model is available or the model did not
 * propose one. Returns at most one question that has not been asked before.
 */
export function deterministicFollowUp(
  patient: StructuredPatientInput,
  memory: FollowUpMemory,
  locale: ReplyLocale,
  latestText: string,
  proposedUpdates: ProposedUpdate[] = [],
): MissingInformation | null {
  const guard = (locale === 'bn' ? bn : en).analysisGuard;
  const isBn = locale === 'bn';
  const candidates: MissingInformation[] = [];

  const vitalsKnown = hasVitals(patient) || proposedUpdates.some((update) => update.field_path.startsWith('vitals.'));
  if (!vitalsKnown) {
    candidates.push({
      id: 'vitals-followup',
      type: 'exam',
      text: guard.vitals,
      why_it_helps: isBn
        ? 'রোগের তীব্রতা ও স্থিতিশীলতা বুঝতে'
        : 'Vital signs set severity and stability',
      which_diagnoses_it_separates: [],
      quick_answers: isBn
        ? ['বিপি ১২০/৮০, পালস ৭৬, তাপমাত্রা ৩৭°C', 'বিপি ১৩০/৮৫, পালস ৮৮, SpO2 ৯৭%', 'এখনও মাপা হয়নি']
        : ['BP 120/80, HR 76, Temp 37°C', 'BP 130/85, HR 88, SpO2 97%', 'Not measured yet'],
    });
  }

  const context = `${patient?.chief_complaint ?? ''} ${(patient?.symptoms ?? []).join(' ')} ${latestText}`;
  if (RESPIRATORY.test(context)) {
    candidates.push({
      id: 'chest-auscultation-followup',
      type: 'exam',
      text: isBn
        ? 'বুকের অসকালটেশনে (Auscultation) কী পেলেন? ক্রেপিটেশন (Crackles) বা হুইজ (Wheeze) আছে?'
        : 'What did chest auscultation show? Any crackles or wheeze?',
      why_it_helps: isBn
        ? 'নিউমোনিয়া (Pneumonia) আর অ্যাজমা/সিওপিডি (Asthma/COPD) আলাদা করতে'
        : 'Separates consolidation (pneumonia) from bronchospasm (asthma/COPD)',
      which_diagnoses_it_separates: [],
      quick_answers: isBn
        ? ['ক্রেপিটেশন আছে (Crackles)', 'হুইজ আছে (Wheeze)', 'স্বাভাবিক শ্বাসের শব্দ (Clear)']
        : ['Crackles present', 'Wheeze present', 'Clear breath sounds'],
    });
  } else {
    candidates.push({
      id: 'exam-general-followup',
      type: 'question',
      text: guard.exam,
      why_it_helps: isBn ? 'পরীক্ষার ফলাফল সম্ভাব্য রোগ সংকুচিত করে' : 'Examination findings narrow the differential',
      which_diagnoses_it_separates: [],
      quick_answers: isBn
        ? ['কোনো উল্লেখযোগ্য ফাইন্ডিং নেই', 'পেটে ব্যথা (Abdominal tenderness)', 'পানিশূন্যতা (Dehydration)']
        : ['No significant findings', 'Abdominal tenderness', 'Signs of dehydration'],
    });
  }

  return candidates.find((candidate) => !wasAsked(memory, candidate.id, candidate.text)) ?? null;
}

export interface ModelFollowUp {
  question?: string | null;
  why?: string | null;
  quick_answers?: string[] | null;
}

/** Validates a model-proposed follow-up and rejects repeats. */
export function acceptModelFollowUp(
  proposal: ModelFollowUp | null | undefined,
  memory: FollowUpMemory,
): MissingInformation | null {
  const question = proposal?.question?.trim();
  if (!question || question.length > 300) return null;

  const normalized = normalizeQuestion(question);
  const repeated = memory.askedTexts.some(
    (asked) => asked === normalized || (asked.length > 20 && (asked.includes(normalized) || normalized.includes(asked))),
  );
  if (repeated) return null;
  if (memory.answered.some((entry) => normalizeQuestion(entry.question) === normalized)) return null;

  const id = `fu-${createHash('sha256').update(normalized).digest('hex').slice(0, 12)}`;
  if (memory.answeredIds.has(id)) return null;

  const quickAnswers = (proposal?.quick_answers ?? [])
    .map((answer) => String(answer).trim())
    .filter((answer) => answer.length > 0 && answer.length <= 80)
    .slice(0, 4);

  return {
    id,
    type: 'question',
    text: question,
    why_it_helps: proposal?.why?.trim().slice(0, 200) ?? '',
    which_diagnoses_it_separates: [],
    quick_answers: quickAnswers,
  };
}
