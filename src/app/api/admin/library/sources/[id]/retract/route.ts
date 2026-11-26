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
      return NextResponse.json({ error: 'Retraction reason or notice link is required' }, { status: 400 });
    }

    await sourceVersioningService.retractSource(sourceId, reason.trim(), auth.user.id);

    await recordAuditLog({
      userId: auth.user.id,
      event: 'LIBRARY_SOURCE_RETRACTED',
      payload: { sourceId, reason, retractedBy: auth.user.email },
    });

    return NextResponse.json({
      success: true,
      message: 'Source marked as retracted. Removed immediately from search.',
      messageBn: 'রিসোর্সটি প্রত্যাহার (Retracted) হিসেবে চিহ্নিত করা হয়েছে এবং অবিলম্বে অনুসন্ধান থেকে বাদ দেওয়া হয়েছে।',
    });
  } catch (error) {
    console.error('[admin/library/sources/[id]/retract] Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to retract source' }, { status: 500 });
  }
}
