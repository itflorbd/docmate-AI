import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { voiceSessions, voiceTurns } from '@/db/schema';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';

const metricSchema = z.object({
  sessionId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  intent: z.enum(['ask_library', 'dictate', 'answer_followup', 'navigate', 'read_aloud', 'blocked_action', 'other']),
  status: z.enum(['ok', 'low_confidence', 'failed', 'blocked']),
  latencyMs: z.number().int().min(0).max(60000).default(0),
  sttSeconds: z.number().min(0).max(3600).default(0),
  ttsChars: z.number().int().min(0).max(50000).default(0),
  sttProvider: z.string().max(50).default('browser'),
  ttsProvider: z.string().max(50).default('browser'),
  errorCode: z.string().max(50).optional(),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await boundedJson(request);
    const parsed = metricSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid metrics payload' }, { status: 400 });
    }

    const data = parsed.data;

    let sessionId = data.sessionId;
    if (!sessionId) {
      const [newSession] = await db
        .insert(voiceSessions)
        .values({
          userId: user.id,
          caseId: data.caseId,
          sttSeconds: data.sttSeconds.toFixed(2),
          ttsChars: data.ttsChars,
          sttProvider: data.sttProvider,
          ttsProvider: data.ttsProvider,
        })
        .returning({ id: voiceSessions.id });
      sessionId = newSession.id;
    }

    await db.insert(voiceTurns).values({
      sessionId,
      intent: data.intent,
      status: data.status,
      latencyMs: data.latencyMs,
      errorCode: data.errorCode,
    });

    return NextResponse.json({ success: true, sessionId });
  } catch (err) {
    console.error('[Voice Metrics Error]:', err);
    return NextResponse.json({ error: 'Failed to record voice metrics' }, { status: 500 });
  }
}
