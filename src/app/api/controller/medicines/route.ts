import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { medicineBrands, medicineVersions, systemSettings } from '@/db/schema';
import { requireMedicineControllerOrAdmin } from '@/lib/permissions';
import { createAuditLogEntry } from '@/lib/audit';
import { and, desc, eq, ilike, or } from 'drizzle-orm';

const createMedicineSchema = z.object({
  brandName: z.string().min(1).max(150),
  genericName: z.string().min(1).max(150),
  manufacturer: z.string().min(1).max(150),
  form: z.string().max(50).default('Tab'),
  strength: z.string().min(1).max(50),
  packSize: z.string().max(50).default('10x10'),
  priceBdt: z.number().min(0).default(0),
  dgdaRegNum: z.string().max(50).optional().default(''),
});

export async function GET(request: Request) {
  const auth = await requireMedicineControllerOrAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const manufacturer = searchParams.get('manufacturer')?.trim() || '';
    const status = searchParams.get('status')?.trim() || '';

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(medicineBrands.brandName, `%${search}%`),
          ilike(medicineBrands.genericName, `%${search}%`),
          ilike(medicineBrands.dgdaRegNum, `%${search}%`)
        )
      );
    }

    if (manufacturer && manufacturer !== 'all') {
      conditions.push(ilike(medicineBrands.manufacturer, `%${manufacturer}%`));
    }

    if (status && status !== 'all') {
      conditions.push(eq(medicineBrands.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const medicines = await db
      .select()
      .from(medicineBrands)
      .where(whereClause)
      .orderBy(desc(medicineBrands.createdAt))
      .limit(100);

    return NextResponse.json({ medicines });
  } catch (error) {
    console.error('[controller/medicines] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch medicines' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireMedicineControllerOrAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = createMedicineSchema.parse(body);

    // Check system setting: two_person_review_enabled
    const [twoPersonSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'two_person_review_enabled'))
      .limit(1);

    const twoPersonEnabled =
      Boolean((twoPersonSetting?.value as { enabled?: boolean })?.enabled);

    const initialStatus = twoPersonEnabled ? 'pending' : 'approved';

    const [created] = await db
      .insert(medicineBrands)
      .values({
        brandName: parsed.brandName,
        genericName: parsed.genericName,
        manufacturer: parsed.manufacturer,
        form: parsed.form,
        strength: parsed.strength,
        packSize: parsed.packSize,
        priceBdt: parsed.priceBdt.toFixed(2),
        dgdaRegNum: parsed.dgdaRegNum,
        status: initialStatus,
      })
      .returning();

    // Create version record
    await db.insert(medicineVersions).values({
      medicineId: created.id,
      versionNumber: 1,
      changesJson: {
        action: 'initial_submission',
        data: parsed,
      },
      reviewedBy1: twoPersonEnabled ? null : auth.user.id,
      reviewedAt1: twoPersonEnabled ? null : new Date(),
      status: initialStatus,
    });

    // Record cryptographic audit
    await createAuditLogEntry({
      userId: auth.user.id,
      event: 'medicine.created',
      payload: {
        medicineId: created.id,
        brandName: created.brandName,
        genericName: created.genericName,
        status: initialStatus,
        twoPersonReviewEnabled: twoPersonEnabled,
      },
    });

    return NextResponse.json(
      {
        message: twoPersonEnabled
          ? 'Medicine submitted for multi-step regulatory review'
          : 'Medicine registered and approved in DGDA formulary',
        medicine: created,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('[controller/medicines] POST error:', error);
    return NextResponse.json({ error: 'Failed to create medicine' }, { status: 500 });
  }
}
