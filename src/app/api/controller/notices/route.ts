import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { medicineNotices } from '@/db/schema';
import { requireMedicineControllerOrAdmin } from '@/lib/permissions';
import { createAuditLogEntry } from '@/lib/audit';
import { desc } from 'drizzle-orm';

const createNoticeSchema = z.object({
  title: z.string().min(5).max(300),
  severity: z.enum(['info', 'warning', 'critical_recall']),
  body: z.string().min(10).max(5000),
  affectedBatches: z.array(z.string().max(100)).optional().default([]),
});

export async function GET() {
  const auth = await requireMedicineControllerOrAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const notices = await db
      .select()
      .from(medicineNotices)
      .orderBy(desc(medicineNotices.publishedAt))
      .limit(50);

    return NextResponse.json({ notices });
  } catch (error) {
    console.error('[controller/notices] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch safety notices' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireMedicineControllerOrAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = createNoticeSchema.parse(body);

    const [created] = await db
      .insert(medicineNotices)
      .values({
        title: parsed.title,
        severity: parsed.severity,
        body: parsed.body,
        affectedBatches: parsed.affectedBatches,
        publishedBy: auth.user.id,
      })
      .returning();

    // Record cryptographic audit
    await createAuditLogEntry({
      userId: auth.user.id,
      event: 'medicine.notice.broadcast',
      payload: {
        noticeId: created.id,
        title: created.title,
        severity: created.severity,
        affectedBatches: created.affectedBatches,
      },
    });

    return NextResponse.json({ success: true, notice: created }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('[controller/notices] POST error:', error);
    return NextResponse.json({ error: 'Failed to broadcast safety notice' }, { status: 500 });
  }
}
