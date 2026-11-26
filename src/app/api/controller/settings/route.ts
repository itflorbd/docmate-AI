import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { requireMedicineControllerOrAdmin } from '@/lib/permissions';
import { createAuditLogEntry } from '@/lib/audit';
import { eq } from 'drizzle-orm';

const updateSettingSchema = z.object({
  twoPersonReviewEnabled: z.boolean(),
});

export async function GET() {
  const auth = await requireMedicineControllerOrAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'two_person_review_enabled'))
      .limit(1);

    const enabled = Boolean(
      (setting?.value as { enabled?: boolean })?.enabled
    );

    return NextResponse.json({ twoPersonReviewEnabled: enabled });
  } catch (error) {
    console.error('[controller/settings] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireMedicineControllerOrAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { twoPersonReviewEnabled } = updateSettingSchema.parse(body);

    await db
      .insert(systemSettings)
      .values({
        key: 'two_person_review_enabled',
        value: { enabled: twoPersonReviewEnabled },
        updatedBy: auth.user.id,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: { enabled: twoPersonReviewEnabled },
          updatedBy: auth.user.id,
          updatedAt: new Date(),
        },
      });

    await createAuditLogEntry({
      userId: auth.user.id,
      event: 'settings.two_person_review_toggled',
      payload: {
        twoPersonReviewEnabled,
        updatedBy: auth.user.email,
      },
    });

    return NextResponse.json({
      success: true,
      twoPersonReviewEnabled,
      message: `Two-person review is now ${twoPersonReviewEnabled ? 'Enabled' : 'Disabled'}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('[controller/settings] POST error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
