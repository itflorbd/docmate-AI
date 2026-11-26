import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { jobQueue } from '@/lib/queue/job-queue';
import { recordAuditLog } from '@/lib/audit';
import { ingestionWorker } from '@/workers/ingestion-worker';

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
    await jobQueue.retryJob(id);
    await recordAuditLog({
      userId: auth.user.id,
      event: 'LIBRARY_JOB_RETRY',
      payload: { jobId: id, userEmail: auth.user.email },
    });
    ingestionWorker.triggerProcessing();
    return NextResponse.json({ success: true, message: 'Job re-enqueued for retry' });
  } catch (error) {
    console.error('[admin/library/queue/retry] Failed:', error);
    return NextResponse.json({ error: 'Failed to retry job' }, { status: 500 });
  }
}
