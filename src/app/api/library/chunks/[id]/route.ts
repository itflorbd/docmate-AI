import { requireFeaturePermission } from '@/lib/permissions';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db, pool } from '@/db';
import { chunks, sources } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireFeaturePermission('library.browse');
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid chunk ID' }, { status: 400 });
    const chunkRecord = await db.query.chunks.findFirst({
      where: eq(chunks.id, id),
    });

    if (!chunkRecord) {
      return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
    }

    const sourceRecord = await db.query.sources.findFirst({
      where: eq(sources.id, chunkRecord.sourceId),
    });

    let storageKey: string | null = null;
    let fileMime: string | null = null;

    if (chunkRecord.sourceVersionId) {
      const versionRes = await pool.query(
        `SELECT sf.storage_key, sf.mime
         FROM source_versions sv
         JOIN source_files sf ON sf.id = sv.file_id
         WHERE sv.id = $1;`,
        [chunkRecord.sourceVersionId]
      );
      if (versionRes.rows.length > 0) {
        storageKey = versionRes.rows[0].storage_key;
        fileMime = versionRes.rows[0].mime;
      }
    }

    return NextResponse.json({
      chunk: {
        ...chunkRecord,
        source_title: sourceRecord?.title,
        source_year: sourceRecord?.year,
        source_license: sourceRecord?.license,
        source_doi: sourceRecord?.doi,
        source_url: sourceRecord?.canonicalUrl,
        source_lifecycle: sourceRecord?.lifecycle,
        is_retired: sourceRecord?.lifecycle === 'retired',
        is_retracted: sourceRecord?.lifecycle === 'retracted',
        storage_key: storageKey,
        file_mime: fileMime,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chunk' }, { status: 500 });
  }
}
