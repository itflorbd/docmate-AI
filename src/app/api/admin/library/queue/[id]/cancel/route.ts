import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { jobQueue } from '@/lib/queue/job-queue';
import { recordAuditLog } from '@/lib/audit';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFeaturePermission('library.ingest');
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  try {
    await jobQueue.cancelJob(id);
    await recordAuditLog({
      userId: auth.user.id,
      event: 'LIBRARY_JOB_CANCELLED',
      payload: { jobId: id, userEmail: auth.user.email },
    });
    return NextResponse.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    console.error('[admin/library/queue/cancel] Failed:', error);
    return NextResponse.json({ error: 'Failed to cancel job' }, { status: 500 });
  }
}
