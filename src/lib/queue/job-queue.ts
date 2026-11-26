import { pool } from '@/db';
import { IngestJobStage, IngestJobStatus } from '@/types';

export interface IngestJobRecord {
  id: string;
  source_id: string | null;
  source_version_id: string | null;
  input_type: string;
  status: IngestJobStatus;
  stage: IngestJobStage;
  progress: number;
  error: string | null;
  attempts: number;
  estimated_tokens: number;
  estimated_cost: string;
  tokens_used: number;
  metadata: Record<string, unknown>;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface EnqueueJobParams {
  sourceId?: string;
  sourceVersionId?: string;
  inputType: 'file' | 'url' | 'doi' | 'json' | 'zip';
  metadata?: Record<string, unknown>;
}

export class JobQueue {
  async enqueue(params: EnqueueJobParams): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO ingest_jobs (source_id, source_version_id, input_type, status, stage, progress, metadata)
       VALUES ($1, $2, $3, 'pending', 'queued', 0, $4)
       RETURNING id;`,
      [params.sourceId || null, params.sourceVersionId || null, params.inputType, JSON.stringify(params.metadata || {})]
    );
    return rows[0].id;
  }

  async fetchNextJob(): Promise<IngestJobRecord | null> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<IngestJobRecord>(
        `SELECT * FROM ingest_jobs
         WHERE status = 'pending'
         ORDER BY created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1;`
      );

      if (rows.length === 0) {
        await client.query('COMMIT');
        return null;
      }

      const job = rows[0];
      await client.query(
        `UPDATE ingest_jobs
         SET status = 'processing',
             stage = 'receiving',
             attempts = attempts + 1,
             started_at = COALESCE(started_at, NOW())
         WHERE id = $1;`,
        [job.id]
      );
      await client.query('COMMIT');
      return { ...job, status: 'processing', stage: 'receiving', attempts: job.attempts + 1 };
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[JobQueue] Error fetching next job:', err);
      return null;
    } finally {
      client.release();
    }
  }

  async updateProgress(jobId: string, stage: IngestJobStage, progress: number, metadataUpdates?: Record<string, unknown>): Promise<void> {
    if (metadataUpdates) {
      await pool.query(
        `UPDATE ingest_jobs
         SET stage = $2, progress = $3, metadata = metadata || $4::jsonb
         WHERE id = $1;`,
        [jobId, stage, progress, JSON.stringify(metadataUpdates)]
      );
    } else {
      await pool.query(
        `UPDATE ingest_jobs
         SET stage = $2, progress = $3
         WHERE id = $1;`,
        [jobId, stage, progress]
      );
    }
  }

  async completeJob(jobId: string, metadataUpdates?: Record<string, unknown>): Promise<void> {
    const sourceId = metadataUpdates?.sourceId as string | undefined;
    const versionId = metadataUpdates?.versionId as string | undefined;
    await pool.query(
      `UPDATE ingest_jobs
       SET status = 'completed', stage = 'completed', progress = 100, finished_at = NOW(),
           source_id = COALESCE($3, source_id),
           source_version_id = COALESCE($4, source_version_id),
           metadata = CASE WHEN $2::jsonb IS NOT NULL THEN metadata || $2::jsonb ELSE metadata END
       WHERE id = $1;`,
      [jobId, metadataUpdates ? JSON.stringify(metadataUpdates) : null, sourceId || null, versionId || null]
    );
  }

  async failJob(jobId: string, errorMessage: string, failedStage?: IngestJobStage, extraMetadata?: Record<string, unknown>): Promise<void> {
    const metaUpdates: Record<string, unknown> = {
      ...extraMetadata,
      failedStage: failedStage || 'unknown',
      failedAt: new Date().toISOString(),
      lastError: errorMessage,
    };
    await pool.query(
      `UPDATE ingest_jobs
       SET status = 'failed', error = $2, finished_at = NOW(),
           metadata = metadata || $3::jsonb
       WHERE id = $1;`,
      [jobId, errorMessage, JSON.stringify(metaUpdates)]
    );
  }

  async pauseForApproval(jobId: string, estimatedCost: number, estimatedTokens: number): Promise<void> {
    await pool.query(
      `UPDATE ingest_jobs
       SET status = 'awaiting_approval', stage = 'cost_estimation',
           estimated_cost = $2, estimated_tokens = $3
       WHERE id = $1;`,
      [jobId, estimatedCost, estimatedTokens]
    );
  }

  async retryJob(jobId: string): Promise<void> {
    const existing = await this.getJob(jobId);
    const existingLogs = Array.isArray(existing?.metadata?.logs) ? (existing!.metadata.logs as Record<string, unknown>[]) : [];
    const retryLog = {
      timestamp: new Date().toISOString(),
      stage: 'queued',
      message: `Job retry triggered (Attempt ${(existing?.attempts || 0) + 1}). Resuming from cached stages where available.`,
      level: 'info',
    };

    const retryMetadata = {
      isRetry: true,
      lastRetriedAt: new Date().toISOString(),
      logs: [...existingLogs, retryLog],
    };

    await pool.query(
      `UPDATE ingest_jobs
       SET status = 'pending', stage = 'queued', progress = 0, error = NULL,
           metadata = metadata || $2::jsonb
       WHERE id = $1;`,
      [jobId, JSON.stringify(retryMetadata)]
    );
  }

  async cancelJob(jobId: string): Promise<void> {
    await pool.query(
      `UPDATE ingest_jobs
       SET status = 'cancelled', finished_at = NOW()
       WHERE id = $1;`,
      [jobId]
    );
  }

  async getJob(jobId: string): Promise<IngestJobRecord | null> {
    const { rows } = await pool.query<IngestJobRecord>(
      `SELECT * FROM ingest_jobs WHERE id = $1;`,
      [jobId]
    );
    return rows[0] || null;
  }

  async listRecentJobs(limit = 50): Promise<IngestJobRecord[]> {
    const { rows } = await pool.query<IngestJobRecord>(
      `SELECT * FROM ingest_jobs ORDER BY created_at DESC LIMIT $1;`,
      [limit]
    );
    return rows;
  }
}

export const jobQueue = new JobQueue();
