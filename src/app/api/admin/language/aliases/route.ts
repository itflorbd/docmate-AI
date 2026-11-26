// src/app/api/admin/language/aliases/route.ts
// DocMate AI - Term Aliases Management API

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { termAliases } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/permissions';
import { boundedJson } from '@/lib/api-input';
import { desc, ilike, eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { initTermMatcher } from '@/lib/language/term-matcher';
import { TermAliasRecord } from '@/lib/language/types';

const aliasCreateSchema = z.object({
  canonicalEn: z.string().trim().min(1).max(150),
  category: z.string().trim().min(1).max(50),
  variants: z.object({
    bn: z.array(z.string()).optional(),
    banglish: z.array(z.string()).optional(),
    en: z.array(z.string()).optional(),
    bn_translit_en: z.array(z.string()).optional(),
  }),
  status: z.enum(['active', 'pending']).default('active'),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const status = searchParams.get('status') || '';

  try {
    const conditions = [];
    if (search) conditions.push(ilike(termAliases.canonicalEn, `%${search}%`));
    if (category) conditions.push(eq(termAliases.category, category));
    if (status) conditions.push(eq(termAliases.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const list = await db
      .select()
      .from(termAliases)
      .where(whereClause)
      .orderBy(desc(termAliases.updatedAt))
      .limit(100);

    return NextResponse.json({ aliases: list });
  } catch (error) {
    console.error('Error fetching term aliases:', error);
    return NextResponse.json({ error: 'Failed to fetch aliases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await boundedJson(request);
    const parsed = aliasCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid alias payload' }, { status: 400 });
    }

    const data = parsed.data;

    const [saved] = await db
      .insert(termAliases)
      .values({
        canonicalEn: data.canonicalEn,
        category: data.category,
        variants: data.variants,
        status: data.status,
        notes: data.notes,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [termAliases.canonicalEn, termAliases.category],
        set: {
          variants: data.variants,
          status: data.status,
          notes: data.notes,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Re-initialize in-memory matcher with updated data
    try {
      const allActive = await db
        .select()
        .from(termAliases)
        .where(eq(termAliases.status, 'active'));
      initTermMatcher(allActive as unknown as TermAliasRecord[]);
    } catch {}

    return NextResponse.json({ success: true, alias: saved });
  } catch (error) {
    console.error('Error saving alias:', error);
    return NextResponse.json({ error: 'Failed to save alias' }, { status: 500 });
  }
}
