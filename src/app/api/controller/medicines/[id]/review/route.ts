import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { medicineBrands, medicineVersions, systemSettings } from '@/db/schema';
import { requireMedicineControllerOrAdmin } from '@/lib/permissions';
import { createAuditLogEntry } from '@/lib/audit';
import { desc, eq } from 'drizzle-orm';

const reviewActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional().default(''),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMedicineControllerOrAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, reason } = reviewActionSchema.parse(body);

    const [med] = await db
      .select()
      .from(medicineBrands)
      .where(eq(medicineBrands.id, id))
      .limit(1);

    if (!med) {
      return NextResponse.json({ error: 'Medicine not found' }, { status: 404 });
    }

    // Fetch the latest version entry
    const [latestVersion] = await db
      .select()
      .from(medicineVersions)
      .where(eq(medicineVersions.medicineId, id))
      .orderBy(desc(medicineVersions.versionNumber))
      .limit(1);

    if (action === 'reject') {
      await db
        .update(medicineBrands)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(medicineBrands.id, id));

      if (latestVersion) {
        await db
          .update(medicineVersions)
          .set({
            status: 'rejected',
            rejectionReason: reason || 'Regulatory criteria not met',
          })
          .where(eq(medicineVersions.id, latestVersion.id));
      }

      await createAuditLogEntry({
        userId: auth.user.id,
        event: 'medicine.review.rejected',
        payload: {
          medicineId: id,
          brandName: med.brandName,
          reason,
        },
      });

      return NextResponse.json({
        message: 'Medicine brand rejected',
        status: 'rejected',
      });
    }

    // Action === 'approve'
    // Check if two_person_review_enabled
    const [twoPersonSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'two_person_review_enabled'))
      .limit(1);

    const twoPersonEnabled =
      Boolean((twoPersonSetting?.value as { enabled?: boolean })?.enabled);

    if (twoPersonEnabled) {
      if (med.status === 'pending') {
        // Stage 1 approval
        await db
          .update(medicineBrands)
          .set({ status: 'partially_approved', updatedAt: new Date() })
          .where(eq(medicineBrands.id, id));

        if (latestVersion) {
          await db
            .update(medicineVersions)
            .set({
              reviewedBy1: auth.user.id,
              reviewedAt1: new Date(),
              status: 'partially_approved',
            })
            .where(eq(medicineVersions.id, latestVersion.id));
        }

        await createAuditLogEntry({
          userId: auth.user.id,
          event: 'medicine.review.stage1_approved',
          payload: {
            medicineId: id,
            brandName: med.brandName,
            reviewer1: auth.user.id,
          },
        });

        return NextResponse.json({
          message: 'Stage 1 approval granted. Awaiting second reviewer approval.',
          status: 'partially_approved',
        });
      }

      if (med.status === 'partially_approved') {
        // Enforce two distinct reviewers
        if (latestVersion?.reviewedBy1 === auth.user.id) {
          return NextResponse.json(
            {
              error:
                'Two-person review requires a different reviewer for final approval.',
            },
            { status: 400 }
          );
        }

        // Stage 2 final approval
        await db
          .update(medicineBrands)
          .set({ status: 'approved', updatedAt: new Date() })
          .where(eq(medicineBrands.id, id));

        if (latestVersion) {
          await db
            .update(medicineVersions)
            .set({
              reviewedBy2: auth.user.id,
              reviewedAt2: new Date(),
              status: 'approved',
            })
            .where(eq(medicineVersions.id, latestVersion.id));
        }

        await createAuditLogEntry({
          userId: auth.user.id,
          event: 'medicine.review.final_approved',
          payload: {
            medicineId: id,
            brandName: med.brandName,
            reviewer1: latestVersion?.reviewedBy1,
            reviewer2: auth.user.id,
          },
        });

        return NextResponse.json({
          message:
            'Final review approved. Medicine is now published to live DGDA formulary.',
          status: 'approved',
        });
      }
    }

    // Single reviewer approval (when twoPersonEnabled is false)
    await db
      .update(medicineBrands)
      .set({ status: 'approved', updatedAt: new Date() })
      .where(eq(medicineBrands.id, id));

    if (latestVersion) {
      await db
        .update(medicineVersions)
        .set({
          reviewedBy1: auth.user.id,
          reviewedAt1: new Date(),
          status: 'approved',
        })
        .where(eq(medicineVersions.id, latestVersion.id));
    }

    await createAuditLogEntry({
      userId: auth.user.id,
      event: 'medicine.review.approved',
      payload: {
        medicineId: id,
        brandName: med.brandName,
        reviewer: auth.user.id,
      },
    });

    return NextResponse.json({
      message: 'Medicine approved and published to live DGDA formulary.',
      status: 'approved',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('[controller/medicines/review] error:', error);
    return NextResponse.json({ error: 'Failed to process review' }, { status: 500 });
  }
}
