import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { pool } from '@/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFeaturePermission('library.browse');
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const sourceRes = await pool.query(
      `SELECT * FROM sources WHERE id = $1;`,
      [id]
    );

    if (sourceRes.rows.length === 0) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    const source = sourceRes.rows[0];

    // Fetch versions
    const versionsRes = await pool.query(
      `SELECT sv.*, sf.original_name, sf.mime, sf.size, sf.storage_key
       FROM source_versions sv
       LEFT JOIN source_files sf ON sf.id = sv.file_id
       WHERE sv.source_id = $1
       ORDER BY sv.version_no DESC;`,
      [id]
    );

    // Fetch chunk statistics
    const chunkStatsRes = await pool.query(
      `SELECT 
         count(*)::int as total_chunks,
         count(*) FILTER (WHERE status = 'active')::int as active_chunks,
         count(*) FILTER (WHERE status = 'retired')::int as retired_chunks,
         coalesce(sum(token_count), 0)::int as total_tokens,
         count(*) FILTER (WHERE kind = 'table')::int as table_chunks,
         count(*) FILTER (WHERE kind = 'references')::int as reference_chunks
       FROM chunks
       WHERE source_id = $1;`,
      [id]
    );

    // Fetch sample chunks for current version
    const sampleChunksRes = await pool.query(
      `SELECT id, ordinal, heading_path, page_start, page_end, kind, text, token_count, language, status
       FROM chunks
       WHERE source_id = $1
       ORDER BY ordinal ASC
       LIMIT 50;`,
      [id]
    );

    // Check usage/citation count in student notes & quizzes
    const citationRes = await pool.query(
      `SELECT 
         (SELECT count(*)::int FROM student_notes sn JOIN chunks c ON c.id = sn.chunk_id WHERE c.source_id = $1) as notes_citations,
         (SELECT count(*)::int FROM student_quizzes sq JOIN chunks c ON c.id = sq.citation_chunk_id WHERE c.source_id = $1) as quiz_citations;`,
      [id]
    );

    // Check duplicate candidates
    const dupsRes = await pool.query(
      `SELECT * FROM duplicate_candidates
       WHERE new_source_id = $1 OR existing_source_id = $1;`,
      [id]
    );

    return NextResponse.json({
      source,
      versions: versionsRes.rows,
      chunkStats: chunkStatsRes.rows[0],
      sampleChunks: sampleChunksRes.rows,
      citations: citationRes.rows[0],
      duplicates: dupsRes.rows,
    });
  } catch (error) {
    console.error('[admin/library/sources/[id]] Error fetching source detail:', error);
    return NextResponse.json({ error: 'Failed to retrieve source details' }, { status: 500 });
  }
}
