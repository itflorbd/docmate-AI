import { NextResponse } from 'next/server';
import { db } from '@/db';
import { userAssistantPrefs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';

const assistantPrefsSchema = z.object({
  address_style: z.enum(['doctor', 'doctor_sahib', 'doctor_madam', 'name']).optional(),
  tone_preset: z.enum(['reserved', 'friendly']).optional(),
  verbosity: z.enum(['brief', 'normal', 'detailed']).optional(),
  sounds_enabled: z.boolean().optional(),
  hints_enabled: z.boolean().optional(),
  avatar_enabled: z.boolean().optional(),
  speech_rate: z.number().min(0.8).max(1.2).optional(),
  voice_id: z.string().max(100).optional(),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [row] = await db
      .select()
      .from(userAssistantPrefs)
      .where(eq(userAssistantPrefs.userId, user.id))
      .limit(1);

    if (!row) {
      return NextResponse.json({
        persisted: false,
        preferences: {
          address_style: 'doctor',
          tone_preset: 'friendly',
          verbosity: 'normal',
          sounds_enabled: true,
          hints_enabled: true,
          avatar_enabled: true,
          speech_rate: 1.0,
          voice_id: 'default',
        },
      });
    }

    return NextResponse.json({
      persisted: true,
      preferences: {
        address_style: row.addressStyle,
        tone_preset: row.tonePreset,
        verbosity: row.verbosity,
        sounds_enabled: row.soundsEnabled,
        hints_enabled: row.hintsEnabled,
        avatar_enabled: row.avatarEnabled,
        speech_rate: row.speechRate,
        voice_id: row.voiceId || 'default',
      },
    });
  } catch (err) {
    console.error('[Assistant Prefs GET error]:', err);
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await boundedJson(request);
    const parsed = assistantPrefsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid assistant preferences' }, { status: 400 });
    }

    const data = parsed.data;

    const [existing] = await db
      .select()
      .from(userAssistantPrefs)
      .where(eq(userAssistantPrefs.userId, user.id))
      .limit(1);

    if (existing) {
      await db
        .update(userAssistantPrefs)
        .set({
          addressStyle: data.address_style ?? existing.addressStyle,
          tonePreset: data.tone_preset ?? existing.tonePreset,
          verbosity: data.verbosity ?? existing.verbosity,
          soundsEnabled: data.sounds_enabled ?? existing.soundsEnabled,
          hintsEnabled: data.hints_enabled ?? existing.hintsEnabled,
          avatarEnabled: data.avatar_enabled ?? existing.avatarEnabled,
          speechRate: data.speech_rate ?? existing.speechRate,
          voiceId: data.voice_id ?? existing.voiceId,
          updatedAt: new Date(),
        })
        .where(eq(userAssistantPrefs.userId, user.id));
    } else {
      await db.insert(userAssistantPrefs).values({
        userId: user.id,
        addressStyle: data.address_style || 'doctor',
        tonePreset: data.tone_preset || 'friendly',
        verbosity: data.verbosity || 'normal',
        soundsEnabled: data.sounds_enabled ?? true,
        hintsEnabled: data.hints_enabled ?? true,
        avatarEnabled: data.avatar_enabled ?? true,
        speechRate: data.speech_rate || 1.0,
        voiceId: data.voice_id || 'default',
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Assistant Prefs POST error]:', err);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
