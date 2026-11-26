import { requireFeaturePermission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { medicineNotices } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    // Role check from the feature matrix (medicine.notices), not just sign-in.
    const auth = await requireFeaturePermission('medicine.notices');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const notices = await db
      .select({
        id: medicineNotices.id,
        title: medicineNotices.title,
        severity: medicineNotices.severity,
        body: medicineNotices.body,
        affectedBatches: medicineNotices.affectedBatches,
        publishedAt: medicineNotices.publishedAt,
      })
      .from(medicineNotices)
      .orderBy(desc(medicineNotices.publishedAt))
      .limit(10);

    return NextResponse.json({ notices });
  } catch (error) {
    console.error('[medicines/notices/active] error:', error);
    return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 500 });
  }
}
