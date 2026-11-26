import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings, voiceSessions, voiceTurns } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';

const configSchema = z.object({
  enabled: z.boolean().optional(),
  kill_switch: z.boolean().optional(),
  stt_provider: z.enum(['browser', 'openai', 'custom_stub']).optional(),
  tts_provider: z.enum(['browser', 'openai', 'custom_stub', 'maya', 'edge']).optional(),
  persona_name: z.string().min(1).max(100).optional(),
  persona_greeting_bn: z.string().min(1).max(500).optional(),
  persona_greeting_en: z.string().min(1).max(500).optional(),
  intro_disclaimer_bn: z.string().min(1).max(500).optional(),
  intro_disclaimer_en: z.string().min(1).max(500).optional(),
  default_voice_gender: z.enum(['male', 'female']).optional(),
  default_speed: z.number().min(0.8).max(1.2).optional(),
  private_mode_default: z.boolean().optional(),
  avatar_enabled_default: z.boolean().optional(),
  persona_preset: z.enum(['reserved', 'friendly']).optional(),
  default_greeting_morning_bn: z.string().min(1).max(500).optional(),
  default_greeting_afternoon_bn: z.string().min(1).max(500).optional(),
  default_greeting_evening_bn: z.string().min(1).max(500).optional(),
  default_greeting_morning_en: z.string().min(1).max(500).optional(),
  default_greeting_afternoon_en: z.string().min(1).max(500).optional(),
  default_greeting_evening_en: z.string().min(1).max(500).optional(),
  sounds_enabled: z.boolean().optional(),
  edge_voice_bn: z.string().max(100).optional(),
  edge_voice_en: z.string().max(100).optional(),
  vocal_reactions_enabled: z.boolean().optional(),
});

export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'voice:config'))
      .limit(1);

    // Aggregate high-level metrics for admin dashboard (strictly non-identifiable)
    const [sessionStats] = await db
      .select({
        totalSessions: sql<number>`count(*)::int`,
        totalSttSeconds: sql<number>`coalesce(sum(${voiceSessions.sttSeconds}), 0)::float`,
        totalTtsChars: sql<number>`coalesce(sum(${voiceSessions.ttsChars}), 0)::int`,
        totalCost: sql<number>`coalesce(sum(${voiceSessions.estimatedCost}), 0)::float`,
      })
      .from(voiceSessions);

    const [turnStats] = await db
      .select({
        totalTurns: sql<number>`count(*)::int`,
        avgLatencyMs: sql<number>`coalesce(avg(${voiceTurns.latencyMs}), 0)::int`,
        errorTurns: sql<number>`coalesce(sum(case when ${voiceTurns.status} = 'failed' then 1 else 0 end), 0)::int`,
      })
      .from(voiceTurns);

    return NextResponse.json({
      config: row?.value || null,
      metrics: {
        totalSessions: sessionStats?.totalSessions || 0,
        totalMinutes: Math.round(((sessionStats?.totalSttSeconds || 0) / 60) * 10) / 10,
        totalTtsChars: sessionStats?.totalTtsChars || 0,
        avgLatencyMs: turnStats?.avgLatencyMs || 0,
        errorRatePct: turnStats?.totalTurns
          ? Math.round(((turnStats.errorTurns || 0) / turnStats.totalTurns) * 1000) / 10
          : 0,
        estimatedCostBdt: Math.round((sessionStats?.totalCost || 0) * 120 * 100) / 100, // converted USD to BDT
      },
    });
  } catch (err) {
    console.error('[Voice Settings GET error]:', err);
    return NextResponse.json({ error: 'Failed to fetch voice settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const body = await boundedJson(request);
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid voice configuration' }, { status: 400 });
    }

    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'voice:config'))
      .limit(1);

    const updatedConfig = {
      ...((existing?.value as Record<string, unknown>) || {}),
      ...parsed.data,
    };

    await db
      .insert(systemSettings)
      .values({
        key: 'voice:config',
        value: updatedConfig,
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: updatedConfig,
          updatedBy: user.id,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (err) {
    console.error('[Voice Settings POST error]:', err);
    return NextResponse.json({ error: 'Failed to update voice configuration' }, { status: 500 });
  }
}
