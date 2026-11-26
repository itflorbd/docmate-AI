import { requireFeaturePermission } from '@/lib/permissions';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { medicineBrands } from '@/db/schema';
import { and, eq, ilike, or } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    // Role check from the feature matrix (medicine.search), not just sign-in.
    const auth = await requireFeaturePermission('medicine.search');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';

    if (!query) {
      return NextResponse.json({ medicines: [] });
    }

    const matches = await db
      .select({
        id: medicineBrands.id,
        brandName: medicineBrands.brandName,
        genericName: medicineBrands.genericName,
        manufacturer: medicineBrands.manufacturer,
        form: medicineBrands.form,
        strength: medicineBrands.strength,
        packSize: medicineBrands.packSize,
        priceBdt: medicineBrands.priceBdt,
        dgdaRegNum: medicineBrands.dgdaRegNum,
      })
      .from(medicineBrands)
      .where(
        and(
          eq(medicineBrands.status, 'approved'),
          or(
            ilike(medicineBrands.brandName, `%${query}%`),
            ilike(medicineBrands.genericName, `%${query}%`)
          )
        )
      )
      .limit(30);

    return NextResponse.json({ medicines: matches });
  } catch (error) {
    console.error('[medicines/search] error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
