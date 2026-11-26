// src/app/api/settings/language/route.ts
// DocMate AI - User Language Preferences API

import { NextResponse } from 'next/server';
import { boundedJson } from '@/lib/api-input';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { userLanguagePrefs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const prefsSchema = z.object({
  replyLanguage: z.enum(['auto', 'bn', 'en']).default('auto'),
  banglishReply: z.boolean().default(false),
  sttMode: z.enum(['auto', 'bn', 'en']).default('auto'),
  showUnderstanding: z.boolean().default(true),
  phoneticTyping: z.boolean().default(false),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [pref] = await db
      .select()
      .from(userLanguagePrefs)
      .where(eq(userLanguagePrefs.userId, user.id));

    if (!pref) {
      return NextResponse.json({
        prefs: {
          replyLanguage: 'auto',
          banglishReply: false,
          sttMode: 'auto',
          showUnderstanding: true,
          phoneticTyping: false,
        },
      });
    }

    return NextResponse.json({
      prefs: {
        replyLanguage: pref.replyLanguage,
        banglishReply: pref.banglishReply,
        sttMode: pref.sttMode,
        showUnderstanding: pref.showUnderstanding,
        phoneticTyping: pref.phoneticTyping,
      },
    });
  } catch (error) {
    console.error('Error fetching language prefs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await boundedJson(request);
    const parsed = prefsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid preferences payload' }, { status: 400 });
    }

    const data = parsed.data;

    const [updated] = await db
      .insert(userLanguagePrefs)
      .values({
        userId: user.id,
        replyLanguage: data.replyLanguage,
        banglishReply: data.banglishReply,
        sttMode: data.sttMode,
        showUnderstanding: data.showUnderstanding,
        phoneticTyping: data.phoneticTyping,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userLanguagePrefs.userId,
        set: {
          replyLanguage: data.replyLanguage,
          banglishReply: data.banglishReply,
          sttMode: data.sttMode,
          showUnderstanding: data.showUnderstanding,
          phoneticTyping: data.phoneticTyping,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ success: true, prefs: updated });
  } catch (error) {
    console.error('Error saving language prefs:', error);
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
  }
}
