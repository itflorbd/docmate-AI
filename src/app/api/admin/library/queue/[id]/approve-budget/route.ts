import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { pool } from '@/db';
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
    const { rowCount } = await pool.query(
      `UPDATE ingest_jobs
       SET status = 'pending', stage = 'embedding'
       WHERE id = $1 AND status = 'awaiting_approval';`,
      [id]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Job not found or not in awaiting_approval status' }, { status: 400 });
    }

    await recordAuditLog({
      userId: auth.user.id,
      event: 'LIBRARY_JOB_BUDGET_APPROVED',
      payload: { jobId: id, approvedBy: auth.user.email },
    });

    return NextResponse.json({ success: true, message: 'Budget approved, job resuming' });
  } catch (error) {
    console.error('[admin/library/queue/approve-budget] Failed:', error);
    return NextResponse.json({ error: 'Failed to approve budget' }, { status: 500 });
  }
}
