import { and, desc, eq, ilike } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { cases, sources } from '@/db/schema';
import { boundedJson, rateLimit } from '@/lib/api-input';
import { getCurrentUser } from '@/lib/auth';

const inputSchema = z.object({ query: z.string().trim().min(2).max(100) });

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const limited = rateLimit(`search:${user.id}`, 60);
    if (limited) return limited;
    const input = inputSchema.safeParse(await boundedJson(request, 1024));
    if (!input.success) return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });

    const pattern = `%${input.data.query.replace(/[\\%_]/g, '\\$&')}%`;
    const [caseMatches, sourceMatches] = await Promise.all([
      user.role === 'doctor' || user.role === 'super_admin'
        ? db.query.cases.findMany({
          columns: { id: true, patientCode: true },
          where: and(eq(cases.doctorId, user.id), ilike(cases.patientCode, pattern)),
          orderBy: [desc(cases.updatedAt), cases.id],
          limit: 6,
        })
        : [],
      db.query.sources.findMany({
        columns: { id: true, title: true },
        where: and(eq(sources.status, 'active'), ilike(sources.title, pattern)),
        orderBy: [sources.title, sources.id],
        limit: 6,
      }),
    ]);
    return NextResponse.json({ cases: caseMatches, sources: sourceMatches });
  } catch {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
