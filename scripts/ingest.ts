import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';
config();

import { ingestionPipeline, IngestionInput } from '../src/lib/ingestion/pipeline';
import { jobQueue } from '../src/lib/queue/job-queue';

async function main() {
  const args = process.argv.slice(2);
  const directMode = args.includes('--direct');
  const fileArgs = args.filter((a) => !a.startsWith('--'));

  const targetPath = fileArgs[0] || path.join(process.cwd(), 'data', 'sources');

  if (!fs.existsSync(targetPath)) {
    console.error(`[Ingest CLI] Target path does not exist: ${targetPath}`);
    process.exit(1);
  }

  const stat = fs.statSync(targetPath);
  const filesToProcess: string[] = [];

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(targetPath);
    for (const entry of entries) {
      if (entry.startsWith('.')) continue;
      const full = path.join(targetPath, entry);
      if (fs.statSync(full).isFile()) {
        filesToProcess.push(full);
      }
    }
  } else {
    filesToProcess.push(targetPath);
  }

  console.log(`[Ingest CLI] Found ${filesToProcess.length} file(s) to process.`);

  for (const filePath of filesToProcess) {
    const fileName = path.basename(filePath);
    const buffer = fs.readFileSync(filePath);
    console.log(`[Ingest CLI] Processing file: ${fileName} (${buffer.length} bytes)...`);

    if (directMode) {
      // Direct pipeline execution
      const jobId = await jobQueue.enqueue({
        inputType: 'file',
        metadata: { fileName, direct: true },
      });

      const input: IngestionInput = {
        jobId,
        userId: '00000000-0000-0000-0000-000000000001',
        fileBuffer: buffer,
        fileName,
        rightsConfirmed: true,
      };

      try {
        const res = await ingestionPipeline.process(input);
        console.log(`[Ingest CLI] Done! Source: ${res.sourceId}, Version: ${res.versionId}, Status: ${res.status}`);
      } catch (err) {
        console.error(`[Ingest CLI] Error processing ${fileName}:`, err);
      }
    } else {
      // Enqueue job for background worker
      const storageKey = `sources/cli-${Date.now()}-${fileName}`;
      const { getStorageDriver } = await import('../src/lib/storage');
      const storage = getStorageDriver();
      await storage.save(storageKey, buffer, 'application/octet-stream');

      const jobId = await jobQueue.enqueue({
        inputType: 'file',
        metadata: {
          fileStorageKey: storageKey,
          fileName,
          rightsConfirmed: true,
          userId: '00000000-0000-0000-0000-000000000001',
        },
      });
      console.log(`[Ingest CLI] Enqueued job: ${jobId}`);
    }
  }

  console.log('[Ingest CLI] Ingestion task completed.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Ingest CLI] Fatal error:', err);
  process.exit(1);
});
