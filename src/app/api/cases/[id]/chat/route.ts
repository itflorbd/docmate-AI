import { and, asc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, caseTurns, cases, userAssistantPrefs, userLanguagePrefs } from '@/db/schema';
import { boundedJson, rateLimit } from '@/lib/api-input';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import { hybridRetrieve } from '@/lib/retrieval';
import { formatDoctorTitle, type AddressStyle } from '@/lib/persona/phrasebank';
import { buildConversationContext } from '@/lib/assistant/context';
import { runAssistantTurn, speechFrom } from '@/lib/assistant/engine';
import { getChatModel } from '@/lib/assistant/llm';
import type { AssistantReply, EngineEvent, StoredTurn, TurnKind } from '@/lib/assistant/types';
import type { StructuredPatientInput } from '@/types';

export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    kind: z.enum(['observation', 'evidence_review', 'question_answer']).default('observation'),
    text: z.string().trim().max(4000).default(''),
    question_id: z.string().min(1).max(100).optional(),
    question: z.string().min(1).max(1000).optional(),
    client_draft_id: z.string().max(100).optional(),
    reply_language: z.enum(['auto', 'bn', 'en']).optional(),
    locale: z.enum(['bn', 'en']).default('bn'),
    regenerate_of: z.uuid().optional(),
    edit_of: z.uuid().optional(),
    /** Set by the client for the automatic case review after patient details are recorded. */
    auto: z.boolean().optional(),
  })
  .refine((body) => body.regenerate_of || body.text.length > 0 || body.kind === 'evidence_review', {
    message: 'text is required',
  })
  .refine((body) => body.kind !== 'question_answer' || (body.question_id && body.question), {
    message: 'question_id and question are required for answers',
  });

type ChatBody = z.infer<typeof bodySchema>;

const supersede = sql`${caseTurns.content} || '{"superseded": true}'::jsonb`;

function contentOf(turn: { content: unknown }): Record<string, unknown> {
  return (turn.content ?? {}) as Record<string, unknown>;
}

function doctorTextOf(turn: { content: unknown }): { text: string; kind: TurnKind; questionId?: string; question?: string } {
  const content = contentOf(turn);
  if (content.type === 'question_answer') {
    return {
      text: String(content.answer ?? ''),
      kind: 'question_answer',
      questionId: String(content.question_id ?? ''),
      question: String(content.question ?? ''),
    };
  }
  return {
    text: String(content.text ?? content.observation ?? content.note ?? ''),
    kind: content.action === 'evidence_review' ? 'evidence_review' : 'observation',
  };
}

function assistantContent(reply: AssistantReply, extra: Record<string, unknown>) {
  return {
    type: 'assistant_response',
    text: reply.text,
    speech_text: reply.text ? speechFrom(reply.text, reply.replyLanguage) : '',
    status: reply.status,
    mode: reply.mode,
    claims: reply.claims,
    citations: reply.claims,
    follow_ups: reply.followUp ? [reply.followUp] : [],
    missing_information: reply.missingInformation,
    proposed_updates: reply.proposedUpdates,
    safety_alerts: reply.safetyAlerts,
    dropped_claims: reply.droppedClaims,
    // Rejection reasons and assessment result, so a reviewer can see why a claim was not shown.
    verification: { rejections: reply.rejections ?? [], assessment: reply.assessment ?? null },
    model: reply.model,
    language_metadata: { reply_language: reply.replyLanguage, understanding: reply.understanding },
    ...extra,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePhysician();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const limited = rateLimit(`case-chat:${user.id}`, 30);
  if (limited) return limited;

  let body: ChatBody;
  try {
    const parsed = bodySchema.safeParse(await boundedJson(request));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 });
  }

  // Phase 1: short transaction. Record the doctor turn and load context. No
  // network calls happen while the case row is locked.
  type Prepared =
    | { error: 'not_found' | 'bad_target' }
    | { duplicate: Record<string, unknown> }
    | {
        doctorTurn: Record<string, unknown> | null;
        doctorTurnId: string;
        engineText: string;
        kind: TurnKind;
        question?: { id: string; text: string };
        patient: StructuredPatientInput;
        history: StoredTurn[];
        replacedAssistantId?: string;
        replacedIds?: string[];
      };

  let prepared: Prepared;
  try {
    prepared = await db.transaction(async (tx): Promise<Prepared> => {
      const [caseRecord] = await tx.select().from(cases).where(ownedCase(id, user.id)).for('update');
      if (!caseRecord) return { error: 'not_found' };

      const turns = await tx.query.caseTurns.findMany({
        where: eq(caseTurns.caseId, id),
        orderBy: [asc(caseTurns.createdAt)],
      });

      if (body.client_draft_id) {
        const duplicate = turns.find((turn) => contentOf(turn).client_draft_id === body.client_draft_id);
        if (duplicate) return { duplicate: duplicate as unknown as Record<string, unknown> };
      }

      const patient = caseRecord.structuredInput as StructuredPatientInput;

      // Regenerate: re-run a doctor turn. The target is either an assistant turn
      // (re-run the doctor turn before it) or a doctor turn whose reply failed.
      if (body.regenerate_of) {
        const index = turns.findIndex((turn) => turn.id === body.regenerate_of);
        if (index === -1) return { error: 'bad_target' };
        const target = turns[index];
        const doctor =
          target.role === 'doctor' ? target : [...turns.slice(0, index)].reverse().find((turn) => turn.role === 'doctor');
        if (!doctor || contentOf(doctor).superseded === true) return { error: 'bad_target' };
        const doctorIndex = turns.indexOf(doctor);
        const nextDoctor = turns.findIndex((turn, i) => i > doctorIndex && turn.role === 'doctor');
        const replies = turns
          .slice(doctorIndex + 1, nextDoctor === -1 ? undefined : nextDoctor)
          .filter((turn) => turn.role !== 'doctor' && contentOf(turn).superseded !== true);
        for (const reply of replies) {
          await tx.update(caseTurns).set({ content: supersede }).where(and(eq(caseTurns.id, reply.id), eq(caseTurns.caseId, id)));
        }
        const source = doctorTextOf(doctor);
        return {
          doctorTurn: null,
          doctorTurnId: doctor.id,
          engineText: source.text,
          kind: source.kind,
          question: source.questionId ? { id: source.questionId, text: source.question ?? '' } : undefined,
          patient,
          history: turns.slice(0, doctorIndex),
          replacedAssistantId: replies[replies.length - 1]?.id,
          replacedIds: replies.map((reply) => reply.id),
        };
      }

      // Edit: supersede the original doctor turn and the replies that followed it.
      let history: StoredTurn[] = turns;
      if (body.edit_of) {
        const index = turns.findIndex((turn) => turn.id === body.edit_of && turn.role === 'doctor');
        if (index === -1) return { error: 'bad_target' };
        const nextDoctor = turns.findIndex((turn, i) => i > index && turn.role === 'doctor');
        const affected = turns.slice(index, nextDoctor === -1 ? undefined : nextDoctor).map((turn) => turn.id);
        for (const turnId of affected) {
          await tx.update(caseTurns).set({ content: supersede }).where(and(eq(caseTurns.id, turnId), eq(caseTurns.caseId, id)));
        }
        history = turns.slice(0, index);
      }

      const text =
        body.text ||
        (body.locale === 'bn' ? 'এই কেসের জন্য লাইব্রেরি প্রমাণ পর্যালোচনা করুন' : 'Review the library evidence for this case');

      const content =
        body.kind === 'question_answer'
          ? {
              type: 'question_answer',
              question_id: body.question_id,
              question: body.question,
              answer: text,
              client_draft_id: body.client_draft_id,
              edited_from: body.edit_of,
            }
          : {
              type: 'doctor_observation',
              text,
              action: body.kind === 'evidence_review' ? 'evidence_review' : 'observation',
              auto: body.auto === true || undefined,
              client_draft_id: body.client_draft_id,
              edited_from: body.edit_of,
            };

      const [doctorTurn] = await tx.insert(caseTurns).values({ caseId: id, role: 'doctor', content }).returning();
      await tx.update(cases).set({ updatedAt: new Date() }).where(ownedCase(id, user.id));

      return {
        doctorTurn: doctorTurn as unknown as Record<string, unknown>,
        doctorTurnId: doctorTurn.id,
        engineText: text,
        kind: body.kind,
        question: body.kind === 'question_answer' ? { id: body.question_id!, text: body.question! } : undefined,
        patient,
        history,
      };
    });
  } catch (err) {
    console.error('[case chat] failed to record turn:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
  }

  if ('error' in prepared) {
    return NextResponse.json(
      { error: prepared.error === 'not_found' ? 'Case not found' : 'Message not found' },
      { status: 404 },
    );
  }
  if ('duplicate' in prepared) {
    return NextResponse.json({ duplicate: true, turn: prepared.duplicate });
  }

  const ready = prepared;
  const [prefs, languagePrefs, llm] = await Promise.all([
    db.query.userAssistantPrefs.findFirst({ where: eq(userAssistantPrefs.userId, user.id) }),
    db.query.userLanguagePrefs.findFirst({ where: eq(userLanguagePrefs.userId, user.id) }),
    getChatModel().catch(() => null),
  ]);

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener('abort', () => abort.abort(), { once: true });
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (payload: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          open = false;
        }
      };

      send({ type: 'doctor_turn', turn: ready.doctorTurn, doctor_turn_id: ready.doctorTurnId, replaced: ready.replacedIds });

      let reply: AssistantReply;
      try {
        reply = await runAssistantTurn(
          {
            sessionId: `case-${id}`,
            text: ready.engineText,
            kind: ready.kind,
            question: ready.question,
            patient: ready.patient,
            context: buildConversationContext(ready.history),
            replyLanguagePref: (body.reply_language ?? (languagePrefs?.replyLanguage as 'auto' | 'bn' | 'en' | undefined) ?? 'auto'),
            banglishReply: languagePrefs?.banglishReply ?? false,
            doctorTitle: formatDoctorTitle((prefs?.addressStyle as AddressStyle) || 'doctor', body.locale, user.name),
            tone: prefs?.tonePreset || 'friendly',
            verbosity: prefs?.verbosity || 'normal',
            signal: abort.signal,
          },
          { retrieve: hybridRetrieve, llm },
          (event: EngineEvent) => send(event as unknown as Record<string, unknown>),
        );
      } catch (err) {
        console.error('[case chat] engine failed:', err instanceof Error ? err.message : 'unknown');
        if (process.env.NODE_ENV === 'development') {
          send({ type: 'debug', message: err instanceof Error ? `${err.message} @ ${err.stack?.split('\n')[1]?.trim()}` : 'unknown' });
        }
        reply = {
          text: '',
          status: 'error',
          mode: 'deterministic',
          claims: [],
          followUp: null,
          missingInformation: [],
          proposedUpdates: [],
          safetyAlerts: [],
          droppedClaims: 0,
          replyLanguage: body.locale,
        };
      }

      // Phase 2: short transaction to persist the verified reply.
      try {
        const latencyMs = Date.now() - startedAt;
        const [assistantTurn] = await db
          .insert(caseTurns)
          .values({
            caseId: id,
            role: 'system',
            content: assistantContent(reply, {
              in_reply_to: ready.doctorTurnId,
              replaces: ready.replacedAssistantId,
              latency_ms: latencyMs,
            }),
          })
          .returning();

        await db.insert(auditLogs).values({
          caseId: id,
          userId: user.id,
          event: 'case_chat_turn',
          payload: {
            doctor_turn_id: ready.doctorTurnId,
            assistant_turn_id: assistantTurn.id,
            kind: ready.kind,
            status: reply.status,
            mode: reply.mode,
            model: reply.model,
            claims_count: reply.claims.length,
            dropped_claims: reply.droppedClaims,
            proposed_facts_count: reply.proposedUpdates.length,
            red_flags: reply.safetyAlerts.length,
            regenerated: Boolean(ready.replacedAssistantId),
            edited: Boolean(body.edit_of),
            latency_ms: latencyMs,
          },
        });

        send({ type: 'final', turn: assistantTurn });
      } catch (err) {
        console.error('[case chat] failed to save reply:', err instanceof Error ? err.message : 'unknown');
        send({ type: 'error', message: 'save_failed' });
      }

      if (open) {
        open = false;
        try {
          controller.close();
        } catch {
          // stream already closed by the client
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
