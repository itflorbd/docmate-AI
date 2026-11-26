import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { pool } from '@/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET() {
  const auth = await requireFeaturePermission('library.manage');
  if (auth.error) {
    const ingestAuth = await requireFeaturePermission('library.ingest');
    if (ingestAuth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM system_settings WHERE key LIKE 'ingest%' OR key LIKE 'ingestion%';`
    );

    const settingsMap: Record<string, string> = {
      'ingestion.daily_budget_usd': '10.00',
      'ingestion.approval_threshold_usd': '2.00',
      'ingest.ocr_enabled': 'false',
    };

    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error('[admin/library/settings] Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

// Only ingestion settings can be changed here; other system settings have their own pages.
const money = z.union([z.string(), z.number()]).transform(String).refine((value) => /^\d{1,6}(\.\d{1,2})?$/.test(value), 'Enter an amount like 10.00');
const settingsSchema = z.object({
  settings: z
    .object({
      'ingestion.daily_budget_usd': money.optional(),
      'ingestion.approval_threshold_usd': money.optional(),
      'ingest.ocr_enabled': z.enum(['true', 'false']).optional(),
    })
    .strict(),
});

export async function POST(request: NextRequest) {
  const auth = await requireFeaturePermission('library.manage');
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid settings payload', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { settings } = parsed.data;

    for (const [key, val] of Object.entries(settings).filter(([, value]) => value !== undefined)) {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW();`,
        [key, String(val)]
      );
    }

    await recordAuditLog({
      userId: auth.user.id,
      event: 'SYSTEM_SETTINGS_UPDATED',
      payload: { updatedKeys: Object.keys(settings), updatedBy: auth.user.email },
    });

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('[admin/library/settings] Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
