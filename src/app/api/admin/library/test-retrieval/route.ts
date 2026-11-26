import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { pool } from '@/db';

export async function GET(request: NextRequest) {
  const auth = await requireFeaturePermission('library.review');
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get('sourceId');
  const versionId = searchParams.get('versionId');
  const query = searchParams.get('q');

  if (!query || !query.trim()) {
    return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
  }

  try {
    let sql: string;
    let params: unknown[];

    if (versionId) {
      sql = `
        SELECT c.id, c.source_id, c.ordinal, c.heading_path, c.page_start, c.page_end,
               c.kind, c.text, c.token_count, c.language, c.status,
               ts_rank(c.tsv, plainto_tsquery('simple', $1)) as text_rank
        FROM chunks c
        WHERE c.source_version_id = $2
          AND (c.tsv @@ plainto_tsquery('simple', $1) OR c.text ILIKE '%' || $1 || '%')
        ORDER BY text_rank DESC, c.ordinal ASC
        LIMIT 10;
      `;
      params = [query.trim(), versionId];
    } else if (sourceId) {
      sql = `
        SELECT c.id, c.source_id, c.ordinal, c.heading_path, c.page_start, c.page_end,
               c.kind, c.text, c.token_count, c.language, c.status,
               ts_rank(c.tsv, plainto_tsquery('simple', $1)) as text_rank
        FROM chunks c
        WHERE c.source_id = $2
          AND (c.tsv @@ plainto_tsquery('simple', $1) OR c.text ILIKE '%' || $1 || '%')
        ORDER BY text_rank DESC, c.ordinal ASC
        LIMIT 10;
      `;
      params = [query.trim(), sourceId];
    } else {
      return NextResponse.json({ error: 'Either sourceId or versionId must be provided' }, { status: 400 });
    }

    const { rows } = await pool.query(sql, params);
    return NextResponse.json({ results: rows, count: rows.length, query: query.trim() });
  } catch (error) {
    console.error('[admin/library/test-retrieval] Error executing test retrieval:', error);
    return NextResponse.json({ error: 'Test retrieval query failed' }, { status: 500 });
  }
}
