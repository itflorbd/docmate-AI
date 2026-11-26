import { z } from 'zod';
import { requireFeaturePermission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { studentCases } from '@/db/schema';
import { eq } from 'drizzle-orm';

const answerSchema = z.object({ caseId: z.uuid(), selectedOption: z.string().trim().min(1).max(500) });

export async function GET() {
  try {
    // Role check from the feature matrix (study.tools), not just sign-in.
    const auth = await requireFeaturePermission('study.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // Return practice cases (without giving away the correct answer directly in initial payload)
    const cases = await db.select().from(studentCases).orderBy(studentCases.createdAt);

    const sanitizedCases = cases.map((c) => ({
      id: c.id,
      title: c.title,
      specialty: c.specialty,
      difficulty: c.difficulty,
      vignette: c.vignette,
      vitals: c.vitals,
      options: c.options,
    }));

    return NextResponse.json({ cases: sanitizedCases });
  } catch (error) {
    console.error('Student cases fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Role check from the feature matrix (study.tools), not just sign-in.
    const auth = await requireFeaturePermission('study.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const parsed = answerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { caseId, selectedOption } = parsed.data;

    if (!caseId || !selectedOption) {
      return NextResponse.json({ error: 'caseId and selectedOption are required' }, { status: 400 });
    }

    const [practiceCase] = await db.select().from(studentCases).where(eq(studentCases.id, caseId));
    if (!practiceCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const isCorrect = practiceCase.correctOption.trim().toLowerCase() === selectedOption.trim().toLowerCase();

    return NextResponse.json({
      isCorrect,
      selectedOption,
      correctOption: practiceCase.correctOption,
      clinicalExplanation: practiceCase.clinicalExplanation,
      citations: practiceCase.citations,
    });
  } catch (error) {
    console.error('Student case evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
