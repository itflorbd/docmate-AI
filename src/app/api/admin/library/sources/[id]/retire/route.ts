import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { sourceVersioningService } from '@/lib/ingestion/versioning';
import { recordAuditLog } from '@/lib/audit';

const reasonSchema = z.object({ reason: z.string().trim().min(5).max(1000) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFeaturePermission('library.retire');
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: sourceId } = await params;

  try {
    const parsed = reasonSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Please check the form and try again.', details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { reason } = parsed.data;

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Retirement reason is required' }, { status: 400 });
    }

    await sourceVersioningService.retireSource(sourceId, reason.trim(), auth.user.id);

    await recordAuditLog({
      userId: auth.user.id,
      event: 'LIBRARY_SOURCE_RETIRED',
      payload: { sourceId, reason, retiredBy: auth.user.email },
    });

    return NextResponse.json({
      success: true,
      message: 'Source retired successfully. Chunks excluded from active search but preserved for existing citations.',
      messageBn: 'রিসোর্সটি সফলভাবে অবসর (Retire) করা হয়েছে। এটি সক্রিয় অনুসন্ধান থেকে সরানো হলেও পুরাতন রেফারেন্সের জন্য সংরক্ষিত থাকবে।',
    });
  } catch (error) {
    console.error('[admin/library/sources/[id]/retire] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to retire source' }, { status: 500 });
  }
}
