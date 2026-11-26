import type { MissingInformation, SafetyAlert, StructuredPatientInput, VerifiedClaim } from '@/types';
import type { ProposedUpdate } from '@/lib/clinical-extractor';
import type { ScoredChunk } from '@/lib/retrieval';

export type ReplyLocale = 'bn' | 'en';

export type AssistantStatus =
  | 'answered'
  /** Verbatim related passages without a synthesized answer (no model, or the model failed). */
  | 'excerpts'
  | 'insufficient_evidence'
  | 'social'
  | 'system'
  | 'recorded'
  | 'stopped'
  | 'error';

export type AssistantMode = 'llm' | 'library_excerpts' | 'deterministic';

export type TurnKind = 'observation' | 'evidence_review' | 'question_answer';

/** A stored case turn as returned by drizzle (`case_turns` row). */
export interface StoredTurn {
  id: string;
  role: string;
  content: unknown;
  createdAt: Date | string;
}

export interface HistoryMessage {
  role: 'doctor' | 'assistant';
  text: string;
}

export interface FollowUpMemory {
  /** Question ids the doctor has answered. */
  answeredIds: Set<string>;
  /** Normalized text of every follow-up question already asked. */
  askedTexts: string[];
  /** Answered follow-ups, oldest first. */
  answered: Array<{ question: string; answer: string }>;
}

export interface ConversationContext {
  history: HistoryMessage[];
  followUps: FollowUpMemory;
  turnCount: number;
}

export interface CitedClaim extends VerifiedClaim {
  /** Marker number shown in the answer text, e.g. [1]. */
  ref: number;
  section?: string;
}

export interface AssistantReply {
  text: string;
  status: AssistantStatus;
  mode: AssistantMode;
  claims: CitedClaim[];
  followUp: MissingInformation | null;
  missingInformation: string[];
  proposedUpdates: ProposedUpdate[];
  safetyAlerts: SafetyAlert[];
  droppedClaims: number;
  replyLanguage: ReplyLocale;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  understanding?: Record<string, unknown>;
  /** Why claims or sentences were rejected during verification. */
  rejections?: { reason: string; detail: string }[];
  /** Result of the evidence assessment, when one ran. */
  assessment?: { status: string; condition: string | null };
}

export type TraceStep = 'understand' | 'retrieve' | 'generate' | 'verify';

export type EngineEvent =
  | { type: 'trace'; step: TraceStep; status: 'running' | 'done' | 'error'; count?: number }
  | { type: 'delta'; text: string }
  | { type: 'safety'; alerts: SafetyAlert[] }
  | { type: 'reset' };

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Streams raw text tokens from a chat model. */
export type LlmStreamer = (
  messages: LlmMessage[],
  signal: AbortSignal,
) => AsyncIterable<string>;

export interface EngineDeps {
  retrieve: (queries: string[], limit: number, weights?: number[]) => Promise<ScoredChunk[]>;
  llm: { stream: LlmStreamer; model: string; translate?: (text: string) => Promise<string | null> } | null;
}

export interface EngineInput {
  sessionId: string;
  text: string;
  kind: TurnKind;
  question?: { id: string; text: string };
  patient: StructuredPatientInput;
  context: ConversationContext;
  replyLanguagePref: 'auto' | 'bn' | 'en';
  banglishReply?: boolean;
  doctorTitle: string;
  tone: 'friendly' | 'reserved' | string;
  verbosity: 'brief' | 'normal' | 'detailed' | string;
  signal: AbortSignal;
}
