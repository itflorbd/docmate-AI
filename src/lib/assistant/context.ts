import type { MissingInformation, StructuredPatientInput } from '@/types';
import type { ConversationContext, HistoryMessage, StoredTurn } from './types';

const MAX_HISTORY_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 1500;

export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, ' ')
    .trim();
}

function contentOf(turn: StoredTurn): Record<string, unknown> {
  return turn.content && typeof turn.content === 'object' ? (turn.content as Record<string, unknown>) : {};
}

export function isSuperseded(turn: StoredTurn): boolean {
  return contentOf(turn).superseded === true;
}

function clip(text: string): string {
  return text.length > MAX_MESSAGE_CHARS ? `${text.slice(0, MAX_MESSAGE_CHARS)}…` : text;
}

/** Strips citation markers so the model does not reuse stale numbering. */
function stripMarkers(text: string): string {
  return text.replace(/\s?\[\d+\]/g, '');
}

/**
 * Builds conversation memory from stored turns: chat history for the model and
 * which follow-up questions were already asked or answered.
 */
export function buildConversationContext(turns: StoredTurn[]): ConversationContext {
  const active = turns.filter((turn) => !isSuperseded(turn));
  const history: HistoryMessage[] = [];
  const answeredIds = new Set<string>();
  const askedTexts: string[] = [];
  const answered: Array<{ question: string; answer: string }> = [];

  for (const turn of active) {
    const content = contentOf(turn);
    const type = content.type;

    if (turn.role === 'doctor') {
      if (type === 'question_answer') {
        const question = String(content.question ?? '');
        const answer = String(content.answer ?? '');
        if (typeof content.question_id === 'string') answeredIds.add(content.question_id);
        answered.push({ question, answer });
        history.push({ role: 'doctor', text: clip(`(Answer to "${question}") ${answer}`) });
      } else {
        const text = String(content.text ?? content.observation ?? content.note ?? '').trim();
        if (text) history.push({ role: 'doctor', text: clip(text) });
      }
      continue;
    }

    if (type === 'assistant_response') {
      const text = stripMarkers(String(content.text ?? '')).trim();
      if (text) history.push({ role: 'assistant', text: clip(text) });
      const followUps = Array.isArray(content.follow_ups) ? (content.follow_ups as MissingInformation[]) : [];
      for (const followUp of followUps) {
        if (followUp?.text) askedTexts.push(normalizeQuestion(followUp.text));
      }
    }
  }

  return {
    history: history.slice(-MAX_HISTORY_MESSAGES),
    followUps: { answeredIds, askedTexts, answered },
    turnCount: active.filter((turn) => turn.role === 'doctor').length,
  };
}

export function hasVitals(patient: StructuredPatientInput): boolean {
  const vitals = patient?.vitals ?? {};
  return Boolean(
    vitals.blood_pressure_systolic || vitals.temperature_celsius || vitals.heart_rate || vitals.spo2_percent,
  );
}

/** Compact, model-friendly summary of the structured patient record. */
export function summarizePatient(patient: StructuredPatientInput): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    age: patient?.age,
    gender: patient?.gender,
    chief_complaint: patient?.chief_complaint || undefined,
    symptoms: patient?.symptoms?.length ? patient.symptoms : undefined,
    history_of_present_illness: patient?.history_of_present_illness || undefined,
    past_medical_history: patient?.past_medical_history?.length ? patient.past_medical_history : undefined,
    current_medicines: patient?.current_medicines?.length ? patient.current_medicines : undefined,
    allergies: patient?.allergies?.length ? patient.allergies : undefined,
    vitals: hasVitals(patient) ? patient.vitals : 'not recorded',
    lab_values: patient?.lab_values?.length ? patient.lab_values : undefined,
    is_pregnant: patient?.is_pregnant || undefined,
    egfr: patient?.egfr,
    weight_kg: patient?.weight_kg,
  };
  return Object.fromEntries(Object.entries(summary).filter(([, value]) => value !== undefined));
}
