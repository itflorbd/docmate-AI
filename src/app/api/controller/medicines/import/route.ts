import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { medicineBrands, medicineVersions, systemSettings } from '@/db/schema';
import { requireMedicineControllerOrAdmin } from '@/lib/permissions';
import { createAuditLogEntry } from '@/lib/audit';
import { eq } from 'drizzle-orm';

interface CsvRow {
  brand_name: string;
  generic_name: string;
  manufacturer: string;
  form?: string;
  strength: string;
  pack_size?: string;
  price_bdt?: number | string;
  dgda_reg_num?: string;
}

// Bounds only; required fields and formats are checked per row below so the
// controller gets a list of row errors instead of one rejection.
const cell = z.string().max(200).optional();
const required = z.string().max(200).default('');
const importSchema = z.object({
  rows: z
    .array(
      z.object({
        brand_name: required,
        generic_name: required,
        manufacturer: required,
        form: cell,
        strength: required,
        pack_size: cell,
        price_bdt: z.union([z.string().max(20), z.number()]).optional(),
        dgda_reg_num: cell,
      }),
    )
    .max(5000)
    .default([]),
});

export async function POST(request: Request) {
  const auth = await requireMedicineControllerOrAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = importSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Upload at most 5,000 rows with text fields under 200 characters.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const rows: CsvRow[] = parsed.data.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows provided for import' },
        { status: 400 }
      );
    }

    // Check system setting: two_person_review_enabled
    const [twoPersonSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'two_person_review_enabled'))
      .limit(1);

    const twoPersonEnabled =
      Boolean((twoPersonSetting?.value as { enabled?: boolean })?.enabled);
    const initialStatus = twoPersonEnabled ? 'pending' : 'approved';

    const errors: { row: number; error: string }[] = [];
    const validRecords = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.brand_name || row.brand_name.trim().length === 0) {
        errors.push({ row: rowNum, error: 'Missing Brand Name' });
        continue;
      }
      if (!row.generic_name || row.generic_name.trim().length === 0) {
        errors.push({ row: rowNum, error: 'Missing Generic Name' });
        continue;
      }
      if (!row.manufacturer || row.manufacturer.trim().length === 0) {
        errors.push({ row: rowNum, error: 'Missing Manufacturer' });
        continue;
      }
      if (!row.strength || row.strength.trim().length === 0) {
        errors.push({ row: rowNum, error: 'Missing Strength' });
        continue;
      }

      const price = Number(row.price_bdt);
      if (row.price_bdt !== undefined && isNaN(price)) {
        errors.push({ row: rowNum, error: 'Invalid Price BDT format' });
        continue;
      }

      validRecords.push({
        brandName: row.brand_name.trim(),
        genericName: row.generic_name.trim(),
        manufacturer: row.manufacturer.trim(),
        form: (row.form || 'Tab').trim(),
        strength: row.strength.trim(),
        packSize: (row.pack_size || '10x10').trim(),
        priceBdt: (price >= 0 ? price : 0).toFixed(2),
        dgdaRegNum: (row.dgda_reg_num || '').trim(),
        status: initialStatus,
      });
    }

    if (validRecords.length === 0) {
      return NextResponse.json(
        {
          error: 'All rows failed validation',
          errors,
        },
        { status: 400 }
      );
    }

    // Bulk insert valid records
    let importedCount = 0;
    for (const record of validRecords) {
      const [inserted] = await db
        .insert(medicineBrands)
        .values(record)
        .returning();

      await db.insert(medicineVersions).values({
        medicineId: inserted.id,
        versionNumber: 1,
        changesJson: {
          action: 'csv_bulk_import',
          importedBy: auth.user.email,
        },
        reviewedBy1: twoPersonEnabled ? null : auth.user.id,
        reviewedAt1: twoPersonEnabled ? null : new Date(),
        status: initialStatus,
      });
      importedCount++;
    }

    // Record audit
    await createAuditLogEntry({
      userId: auth.user.id,
      event: 'medicine.csv_imported',
      payload: {
        totalRows: rows.length,
        importedCount,
        errorsCount: errors.length,
        status: initialStatus,
      },
    });

    return NextResponse.json({
      success: true,
      importedCount,
      errors,
      status: initialStatus,
    });
  } catch (error) {
    console.error('[controller/medicines/import] error:', error);
    return NextResponse.json({ error: 'Failed to process CSV import' }, { status: 500 });
  }
}
