import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { jobQueue } from '@/lib/queue/job-queue';

export async function GET(request: NextRequest) {
  const auth = await requireFeaturePermission('library.ingest');
  if (auth.error) {
    const reviewAuth = await requireFeaturePermission('library.review');
    if (reviewAuth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  try {
    const jobs = await jobQueue.listRecentJobs(limit);
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error('[admin/library/queue] Failed to list jobs:', error);
    return NextResponse.json({ error: 'Failed to retrieve ingestion queue' }, { status: 500 });
  }
}
