import { z } from 'zod';
import { requireFeaturePermission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { studentQuizzes } from '@/db/schema';
import { eq } from 'drizzle-orm';

const quizAnswerSchema = z.object({ quizId: z.uuid(), selectedAnswer: z.string().trim().min(1).max(10) });

export async function GET() {
  try {
    // Role check from the feature matrix (study.tools), not just sign-in.
    const auth = await requireFeaturePermission('study.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const quizzes = await db.select().from(studentQuizzes).orderBy(studentQuizzes.createdAt);

    const sanitizedQuizzes = quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      topic: q.topic,
      question: q.question,
      options: q.options,
    }));

    return NextResponse.json({ quizzes: sanitizedQuizzes });
  } catch (error) {
    console.error('Student quizzes fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Role check from the feature matrix (study.tools), not just sign-in.
    const auth = await requireFeaturePermission('study.tools');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const parsed = quizAnswerSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { quizId, selectedAnswer } = parsed.data;

    if (!quizId || !selectedAnswer) {
      return NextResponse.json({ error: 'quizId and selectedAnswer are required' }, { status: 400 });
    }

    const [quiz] = await db.select().from(studentQuizzes).where(eq(studentQuizzes.id, quizId));
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const isCorrect = quiz.correctAnswer.trim().toUpperCase() === selectedAnswer.trim().toUpperCase();

    return NextResponse.json({
      isCorrect,
      selectedAnswer,
      correctAnswer: quiz.correctAnswer,
      explanation: quiz.explanation,
    });
  } catch (error) {
    console.error('Student quiz evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
