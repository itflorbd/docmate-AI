import { Pool } from 'pg';
import { recordAuditLog } from '@/lib/audit';
import { clearRetrievalCache } from '@/lib/retrieval';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export class SourceVersioningService {
  /**
   * Promotes and publishes a specific version of a source.
   * Atomically retires the previous active version's chunks so search never returns duplicates.
   */
  async publishVersion(sourceId: string, versionId: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get current active version of this source
      const { rows: currentRows } = await client.query<{ current_version_id: string }>(
        `SELECT current_version_id FROM sources WHERE id = $1 FOR UPDATE;`,
        [sourceId]
      );

      const oldVersionId = currentRows[0]?.current_version_id;

      // 2. Retire old version's chunks if different
      if (oldVersionId && oldVersionId !== versionId) {
        await client.query(
          `UPDATE chunks SET status = 'retired' WHERE source_version_id = $1;`,
          [oldVersionId]
        );
      }

      // 3. Activate new version's chunks
      await client.query(
        `UPDATE chunks SET status = 'active' WHERE source_version_id = $1;`,
        [versionId]
      );

      // 4. Update source pointer and lifecycle
      await client.query(
        `UPDATE sources
         SET current_version_id = $1,
             lifecycle = 'published',
             status = 'active'
         WHERE id = $2;`,
        [versionId, sourceId]
      );

      // 5. Audit log
      await recordAuditLog({
        userId,
        event: 'SOURCE_VERSION_PUBLISHED',
        payload: {
          sourceId,
          versionId,
          replacedVersionId: oldVersionId,
        },
      });

      await client.query('COMMIT');
      clearRetrievalCache();
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retires a source (e.g. superseded or archived).
   * Immediately withdraws all chunks from search without deleting any citations.
   */
  async retireSource(sourceId: string, reason: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE sources
         SET lifecycle = 'retired',
             status = 'archived'
         WHERE id = $1;`,
        [sourceId]
      );

      await client.query(
        `UPDATE chunks
         SET status = 'retired'
         WHERE source_id = $1;`,
        [sourceId]
      );

      await recordAuditLog({
        userId,
        event: 'SOURCE_RETIRED',
        payload: { sourceId, reason },
      });

      await client.query('COMMIT');
      clearRetrievalCache();
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Retracts a source (e.g. copyright takedown or severe medical publisher retraction notice).
   */
  async retractSource(sourceId: string, reason: string, userId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE sources
         SET lifecycle = 'retracted',
             status = 'archived'
         WHERE id = $1;`,
        [sourceId]
      );

      await client.query(
        `UPDATE chunks
         SET status = 'retired'
         WHERE source_id = $1;`,
        [sourceId]
      );

      await recordAuditLog({
        userId,
        event: 'SOURCE_RETRACTED_TAKEDOWN',
        payload: { sourceId, reason },
      });

      await client.query('COMMIT');
      clearRetrievalCache();
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const sourceVersioningService = new SourceVersioningService();
