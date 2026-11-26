import { jobQueue } from '../lib/queue/job-queue';
import { ingestionPipeline, IngestionInput } from '../lib/ingestion/pipeline';

export class IngestionWorker {
  private isRunning = false;
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private isProcessingAsync = false;

  constructor(pollIntervalMs = 2000) {
    this.pollIntervalMs = pollIntervalMs;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[IngestionWorker] Started ingestion background worker (polling every ${this.pollIntervalMs}ms)`);

    this.loop();
  }

  stop(): void {
    console.log('[IngestionWorker] Stopping ingestion background worker...');
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async processNextAvailableJob(): Promise<boolean> {
    try {
      const job = await jobQueue.fetchNextJob();
      if (!job) return false;

      console.log(`[IngestionWorker] Processing job ${job.id} (type: ${job.input_type})...`);
      const meta = (job.metadata || {}) as Record<string, unknown>;

      const input: IngestionInput = {
        jobId: job.id,
        userId: (meta.userId as string) || '00000000-0000-0000-0000-000000000001',
        fileStorageKey: meta.fileStorageKey as string | undefined,
        fileName: meta.fileName as string | undefined,
        url: meta.url as string | undefined,
        doi: meta.doi as string | undefined,
        pmid: meta.pmid as string | undefined,
        jsonPayload: meta.jsonPayload,
        prefilledMetadata: meta.prefilledMetadata as IngestionInput['prefilledMetadata'],
        rightsConfirmed: !!meta.rightsConfirmed,
      };

      const result = await ingestionPipeline.process(input);
      console.log(`[IngestionWorker] Job ${job.id} completed successfully! Source: ${result.sourceId}, Version: ${result.versionId}`);
      return true;
    } catch (err) {
      console.error('[IngestionWorker] Error processing job:', err);
      return false;
    }
  }

  private async loop(): Promise<void> {
    if (!this.isRunning) return;

    await this.processNextAvailableJob();

    if (this.isRunning) {
      this.timer = setTimeout(() => this.loop(), this.pollIntervalMs);
    }
  }

  triggerProcessing(): void {
    if (this.isProcessingAsync) return;
    this.isProcessingAsync = true;

    setTimeout(async () => {
      try {
        let processed = true;
        while (processed) {
          processed = await this.processNextAvailableJob();
        }
      } catch (err) {
        console.error('[IngestionWorker] Error in background triggerProcessing:', err);
      } finally {
        this.isProcessingAsync = false;
      }
    }, 50);
  }
}

export const ingestionWorker = new IngestionWorker();
