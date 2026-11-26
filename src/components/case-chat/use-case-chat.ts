'use client';

import * as React from 'react';
import type { SafetyAlert } from '@/types';
import type { TraceStep } from '@/lib/assistant/types';

export interface ChatTurn {
  id: string;
  role: string;
  content: Record<string, unknown>;
  createdAt?: string | Date;
  created_at?: string | Date;
}

export type TraceState = Partial<Record<TraceStep, { status: 'running' | 'done' | 'error'; count?: number }>>;

export interface SendInput {
  kind: 'observation' | 'evidence_review' | 'question_answer';
  text: string;
  question?: { id: string; text: string };
  editOf?: string;
  regenerateOf?: string;
  /** Overrides the composer's reply language (used by voice). */
  replyLanguage?: 'auto' | 'bn' | 'en';
  /** Automatic case review started by the app, not typed by the doctor. */
  auto?: boolean;
}

export interface PendingRun {
  input: SendInput;
  doctorText: string;
  draft: string;
  trace: TraceState;
  safety: SafetyAlert[];
  status: 'sending' | 'streaming' | 'error';
  errorKind?: 'send' | 'reply';
  /** True once the server has saved the doctor's message. */
  doctorSaved: boolean;
}

interface Options {
  caseId: string;
  turns: ChatTurn[];
  onTurnsUpdate: (turns: ChatTurn[]) => void;
  locale: 'bn' | 'en';
  replyLanguage: 'auto' | 'bn' | 'en';
}

function draftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * `send` resolves to true when the server accepted the doctor's message (even
 * if the reply later failed), so the composer only restores text on real send failures.
 *
 * Owns the streaming conversation with POST /api/cases/[id]/chat:
 * optimistic doctor message, NDJSON events, stop, retry, edit and regenerate.
 */
export function useCaseChat({ caseId, turns, onTurnsUpdate, locale, replyLanguage }: Options) {
  const [pending, setPending] = React.useState<PendingRun | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const currentRunRef = React.useRef<Promise<boolean> | null>(null);
  const lastFinalRef = React.useRef<ChatTurn | null>(null);
  const turnsRef = React.useRef(turns);
  React.useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  const refreshTurns = React.useCallback(async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}`);
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.turns)) onTurnsUpdate(data.turns);
    } catch {
      // keep current turns
    }
  }, [caseId, onTurnsUpdate]);

  const run = React.useCallback(
    async (input: SendInput): Promise<boolean> => {
      // One reply streams at a time. A message sent meanwhile (e.g. by voice
      // during the automatic review) waits for it instead of being dropped.
      while (currentRunRef.current) {
        try {
          await currentRunRef.current;
        } catch {
          // previous run failed; continue
        }
      }
      const runPromise = executeRef.current(input);
      currentRunRef.current = runPromise;
      try {
        return await runPromise;
      } finally {
        if (currentRunRef.current === runPromise) currentRunRef.current = null;
      }
    },
    [],
  );

  const execute = React.useCallback(
    async (input: SendInput): Promise<boolean> => {
      const controller = new AbortController();
      abortRef.current = controller;
      const doctorText = input.text;
      setPending({ input, doctorText, draft: '', trace: {}, safety: [], status: 'sending', doctorSaved: Boolean(input.regenerateOf) });

      let receivedFinal = false;
      let doctorTurnSeen = false;
      try {
        const response = await fetch(`/api/cases/${caseId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            kind: input.kind,
            text: input.text,
            question_id: input.question?.id,
            question: input.question?.text,
            client_draft_id: input.regenerateOf ? undefined : draftId(),
            reply_language: input.replyLanguage ?? replyLanguage,
            locale,
            edit_of: input.editOf,
            regenerate_of: input.regenerateOf,
            auto: input.auto,
          }),
        });

        if (!response.ok || !response.body) {
          setPending((current) => (current ? { ...current, status: 'error', errorKind: 'send' } : current));
          return false;
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          // Duplicate submission: the server already has this message.
          await refreshTurns();
          setPending(null);
          return true;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        setPending((current) => (current ? { ...current, status: 'streaming' } : current));

        const handle = (event: Record<string, unknown>) => {
          switch (event.type) {
            case 'doctor_turn': {
              doctorTurnSeen = true;
              setPending((current) => (current ? { ...current, doctorSaved: true } : current));
              const turn = event.turn as ChatTurn | null;
              const replaced = new Set((event.replaced as string[] | undefined) ?? []);
              let next = turnsRef.current;
              if (replaced.size) {
                next = next.map((existing) =>
                  replaced.has(existing.id) ? { ...existing, content: { ...existing.content, superseded: true } } : existing,
                );
              }
              if (input.editOf) {
                const index = next.findIndex((existing) => existing.id === input.editOf);
                if (index !== -1) {
                  const nextDoctor = next.findIndex((existing, i) => i > index && existing.role === 'doctor');
                  next = next.map((existing, i) =>
                    i >= index && (nextDoctor === -1 || i < nextDoctor)
                      ? { ...existing, content: { ...existing.content, superseded: true } }
                      : existing,
                  );
                }
              }
              if (turn) next = [...next, turn];
              turnsRef.current = next;
              onTurnsUpdate(next);
              break;
            }
            case 'trace': {
              const step = event.step as TraceStep;
              setPending((current) =>
                current
                  ? {
                      ...current,
                      trace: {
                        ...current.trace,
                        [step]: { status: event.status as 'running' | 'done' | 'error', count: event.count as number | undefined },
                      },
                    }
                  : current,
              );
              break;
            }
            case 'delta':
              setPending((current) => (current ? { ...current, draft: current.draft + String(event.text ?? '') } : current));
              break;
            case 'reset':
              setPending((current) => (current ? { ...current, draft: '' } : current));
              break;
            case 'safety':
              setPending((current) => (current ? { ...current, safety: (event.alerts as SafetyAlert[]) ?? [] } : current));
              break;
            case 'final': {
              receivedFinal = true;
              const turn = event.turn as ChatTurn;
              lastFinalRef.current = turn;
              const next = [...turnsRef.current, turn];
              turnsRef.current = next;
              onTurnsUpdate(next);
              break;
            }
            case 'error':
              setPending((current) => (current ? { ...current, status: 'error', errorKind: 'reply' } : current));
              break;
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let newline = buffer.indexOf('\n');
          while (newline !== -1) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            if (line) {
              try {
                handle(JSON.parse(line));
              } catch {
                // ignore malformed line
              }
            }
            newline = buffer.indexOf('\n');
          }
        }

        if (receivedFinal) {
          setPending(null);
          return true;
        }
        setPending((current) => (current ? { ...current, status: 'error', errorKind: 'reply' } : current));
        return doctorTurnSeen;
      } catch {
        if (controller.signal.aborted) {
          // The server saves a "stopped" reply; pick it up shortly.
          setPending(null);
          setTimeout(() => void refreshTurns(), 800);
          return true;
        }
        setPending((current) =>
          current ? { ...current, status: 'error', errorKind: doctorTurnSeen ? 'reply' : 'send' } : current,
        );
        return doctorTurnSeen;
      } finally {
        abortRef.current = null;
      }
    },
    [caseId, locale, onTurnsUpdate, refreshTurns, replyLanguage],
  );
  const executeRef = React.useRef(execute);
  React.useEffect(() => {
    executeRef.current = execute;
  }, [execute]);

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const dismissError = React.useCallback(() => setPending(null), []);

  /** Retries a failed run. A reply failure regenerates; a send failure re-sends. */
  const retry = React.useCallback(async () => {
    if (!pending || pending.status !== 'error') return;
    const { input, errorKind } = pending;
    setPending(null);
    if (errorKind === 'reply') {
      // The doctor turn is saved; re-run it instead of sending a duplicate.
      const lastDoctor = [...turnsRef.current].reverse().find((turn) => turn.role === 'doctor' && !turn.content.superseded);
      if (lastDoctor) return run({ ...input, editOf: undefined, regenerateOf: lastDoctor.id });
    }
    return run(input);
  }, [pending, run]);

  /** Sends a message and resolves with the saved assistant turn (used by voice). */
  const sendAndWait = React.useCallback(
    async (input: SendInput): Promise<ChatTurn | null> => {
      lastFinalRef.current = null;
      await run(input);
      return lastFinalRef.current;
    },
    [run],
  );

  return {
    pending,
    sendAndWait,
    busy: pending !== null && pending.status !== 'error',
    send: run,
    stop,
    retry,
    dismissError,
    refreshTurns,
  };
}
