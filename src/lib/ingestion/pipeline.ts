import { pool } from '@/db';
import { jobQueue } from '../queue/job-queue';
import { getStorageDriver } from '../storage';
import { validateFileSignature, computeBufferSha256, NoOpAntivirusScanner, ExtractedDocument } from './extractors';
import { PdfExtractor } from './extractors/pdf-extractor';
import { DocxExtractor } from './extractors/docx-extractor';
import { HtmlExtractor } from './extractors/html-extractor';
import { TextExtractor } from './extractors/text-extractor';
import { JsonExtractor } from './extractors/json-extractor';
import { cleanDocumentPages } from './cleaner';
import { assessExtractionQuality } from './quality';
import { structureAwareChunk, getChunkingStats, ChunkOutput, InsufficientTextError } from './chunker';
import { deduplicationEngine } from './deduplication';
import { ingestionBudgetManager } from './budget';
import { CachedEmbeddingService } from './embedding-provider';
import { scanChunksForPromptInjection } from './safety-scanner';
import { computeSimhash64 } from './simhash';
import { linkAndDoiConnector } from './connectors';
import { runOcrOnPdfBuffer } from './ocr';
import { recordAuditLog } from '@/lib/audit';
import { IngestJobStage } from '@/types';

export interface IngestionInput {
  jobId: string;
  userId: string;
  fileBuffer?: Buffer;
  fileStorageKey?: string;
  fileName?: string;
  url?: string;
  doi?: string;
  pmid?: string;
  jsonPayload?: unknown;
  prefilledMetadata?: {
    title?: string;
    authors?: string[];
    year?: number;
    sourceType?: 'textbook' | 'guideline' | 'journal_article' | 'review' | 'case_report' | 'other';
    license?: string;
    evidenceLevel?: string;
  };
  rightsConfirmed: boolean;
}

interface LogEntry {
  timestamp: string;
  stage: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export function resolvePublicationYear(params: {
  prefilledYear?: number;
  docYear?: number;
  docYearVerified?: boolean;
  pdfMetadataYear?: number;
  title?: string;
  text?: string;
}): { year: number; yearVerified: boolean; source: 'prefilled' | 'text' | 'title' | 'pdf_metadata' | 'extractor' | 'unverified_fallback' } {
  const maxYear = new Date().getFullYear() + 1;
  const isValid = (y: number | undefined): y is number =>
    typeof y === 'number' && Number.isInteger(y) && y >= 1900 && y <= maxYear;

  if (isValid(params.prefilledYear)) {
    return { year: params.prefilledYear, yearVerified: true, source: 'prefilled' };
  }

  // 1. Explicit publication year stated in document text (first 4000 chars)
  const sample = (params.text || '').slice(0, 4000);
  const explicitMatch =
    /\b(?:publication\s+year|published(?:\s+in)?|year\s+of\s+publication)\s*[:\-]?\s*((?:19|20)\d{2})\b/i.exec(sample) ??
    /©\s*((?:19|20)\d{2})\b/.exec(sample);
  if (explicitMatch) {
    const parsed = Number(explicitMatch[1]);
    if (isValid(parsed)) return { year: parsed, yearVerified: true, source: 'text' };
  }

  // 2. Parenthesized year in title, e.g. "Guideline A (2025)"
  const titleMatch = /\(((?:19|20)\d{2})\)/.exec(params.title || '');
  if (titleMatch) {
    const parsed = Number(titleMatch[1]);
    if (isValid(parsed)) return { year: parsed, yearVerified: true, source: 'title' };
  }

  // 3. PDF metadata year (CreationDate / PublicationYear)
  if (isValid(params.pdfMetadataYear)) {
    return { year: params.pdfMetadataYear, yearVerified: true, source: 'pdf_metadata' };
  }

  // 4. Extractor-verified year (e.g. DOI / PMID / JSON)
  if (params.docYearVerified && isValid(params.docYear)) {
    return { year: params.docYear, yearVerified: true, source: 'extractor' };
  }

  // 5. No year found: keep NOT NULL column fallback but explicitly mark unverified.
  return { year: new Date().getFullYear(), yearVerified: false, source: 'unverified_fallback' };
}

export class IngestionPipeline {
  private storage = getStorageDriver();
  private antivirus = new NoOpAntivirusScanner();
  private embeddingService = new CachedEmbeddingService();

  private pdfExtractor = new PdfExtractor();
  private docxExtractor = new DocxExtractor();
  private htmlExtractor = new HtmlExtractor();
  private textExtractor = new TextExtractor();
  private jsonExtractor = new JsonExtractor();

  async process(input: IngestionInput): Promise<{ sourceId: string; versionId: string; status: string }> {
    const { jobId, userId, rightsConfirmed } = input;

    if (!rightsConfirmed) {
      await jobQueue.failJob(jobId, 'Rights confirmation is required: user must confirm rights to ingest content.', 'receiving');
      throw new Error('Rights confirmation required.');
    }

    let currentStage: IngestJobStage = 'receiving';
    const logs: LogEntry[] = [];

    // Helper to log and update progress concurrently
    const logStage = async (
      stage: IngestJobStage,
      message: string,
      level: 'info' | 'warn' | 'error' = 'info',
      progress?: number,
      metadataUpdates?: Record<string, unknown>
    ) => {
      currentStage = stage;
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        stage,
        message,
        level,
      };
      logs.push(entry);
      if (progress !== undefined) {
        await jobQueue.updateProgress(jobId, stage, progress, {
          logs,
          currentStage: stage,
          ...metadataUpdates,
        });
      }
    };

    try {
      // Fetch existing job record to check for stage caches (retry resumption)
      const existingJob = await jobQueue.getJob(jobId);
      if (existingJob?.metadata && Array.isArray(existingJob.metadata.logs)) {
        // Carry forward previous logs
        for (const pastEntry of existingJob.metadata.logs as LogEntry[]) {
          logs.push(pastEntry);
        }
      }

      const cachedDoc = existingJob?.metadata?.cached_doc as ExtractedDocument | undefined;
      const cachedChunks = existingJob?.metadata?.cached_chunks as ChunkOutput[] | undefined;

      // =========================================================================
      // Stage 1: Receive & Validate Signature + Compute SHA256
      // =========================================================================
      await logStage('receiving', 'Validating file signature, security scan, and computing cryptographic hash...', 'info', 5);
      let buffer: Buffer;
      let originalName = input.fileName || 'document';
      let mime = 'text/plain';

      if (input.fileBuffer || input.fileStorageKey) {
        if (input.fileBuffer) {
          buffer = input.fileBuffer;
        } else {
          const loaded = await this.storage.get(input.fileStorageKey!);
          if (!loaded) {
            throw new Error(`File not found in storage: ${input.fileStorageKey}`);
          }
          buffer = loaded;
        }
        const sig = validateFileSignature(buffer, originalName);
        if (!sig.isValid) {
          throw new Error(`Unsupported or unverified file format: ${sig.detectedMime}`);
        }
        mime = sig.detectedMime;
        originalName = sig.safeName;
      } else if (input.url) {
        const resolved = await linkAndDoiConnector.fetchAndExtractUrl(input.url);
        buffer = Buffer.from(resolved.document.fullText, 'utf-8');
        mime = 'text/html';
        originalName = `${resolved.title.slice(0, 30)}.html`;
      } else if (input.doi) {
        const meta = await linkAndDoiConnector.resolveDoi(input.doi);
        const text = [meta.title, meta.authors?.join(', '), meta.abstract].filter(Boolean).join('\n\n');
        buffer = Buffer.from(text, 'utf-8');
        mime = 'text/plain';
        originalName = `doi-${input.doi.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      } else if (input.pmid) {
        const meta = await linkAndDoiConnector.resolvePmid(input.pmid);
        const text = [meta.title, meta.authors?.join(', ')].filter(Boolean).join('\n\n');
        buffer = Buffer.from(text, 'utf-8');
        mime = 'text/plain';
        originalName = `pmid-${input.pmid}.txt`;
      } else if (input.jsonPayload) {
        buffer = Buffer.from(JSON.stringify(input.jsonPayload), 'utf-8');
        mime = 'application/json';
        originalName = 'import.json';
      } else {
        throw new Error('No input file, link, DOI, or JSON provided.');
      }

      // Antivirus Hook
      const avCheck = await this.antivirus.scan(buffer, originalName);
      if (!avCheck.clean) {
        throw new Error(`Antivirus scan failed: ${avCheck.reason || 'Malicious pattern detected'}`);
      }

      const sha256 = computeBufferSha256(buffer);

      // Save raw file into storage driver
      const storageKey = `sources/${sha256}-${originalName}`;
      await this.storage.save(storageKey, buffer, mime);

      // Record source_files row
      const fileRes = await pool.query<{ id: string }>(
        `INSERT INTO source_files (storage_key, sha256, mime, size, original_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id;`,
        [storageKey, sha256, mime, buffer.length, originalName]
      );
      const fileId = fileRes.rows[0].id;

      // =========================================================================
      // Stage 2: Deduplication Check (File SHA256 & Canonical Identifiers)
      // Level 1 & 2 deduplication: Graceful reuse instead of failure!
      // =========================================================================
      await logStage('deduping_file', `Checking SHA256 hash ${sha256.slice(0, 16)}... for existing duplicates`, 'info', 15);
      const hashMatch = await deduplicationEngine.checkFileHash(sha256);
      if (hashMatch.isDuplicate && hashMatch.existingSourceId) {
        await logStage(
          'deduping_file',
          `Identical file previously ingested: Reusing existing library resource "${hashMatch.existingTitle}" (v${hashMatch.existingVersionNo || 1}).`,
          'info',
          100,
          {
            isDuplicate: true,
            duplicateReused: true,
            duplicateLevel: 'file_hash',
            existingSourceId: hashMatch.existingSourceId,
            existingTitle: hashMatch.existingTitle,
            existingVersionNo: hashMatch.existingVersionNo,
            duplicateMessage: hashMatch.message,
            extractedChars: 0,
            extractedPages: 0,
            chunksCount: 0,
            ocrStatus: 'not_needed',
            embeddingStatus: 'reused',
          }
        );

        await jobQueue.completeJob(jobId, {
          sourceId: hashMatch.existingSourceId,
          isDuplicate: true,
          duplicateReused: true,
          duplicateLevel: 'file_hash',
          existingSourceId: hashMatch.existingSourceId,
          existingTitle: hashMatch.existingTitle,
          existingVersionNo: hashMatch.existingVersionNo,
          duplicateMessage: hashMatch.message,
          logs,
        });

        return {
          sourceId: hashMatch.existingSourceId,
          versionId: '',
          status: 'duplicate_reused',
        };
      }

      const idMatch = await deduplicationEngine.checkIdentifiers({
        doi: input.doi,
        pmid: input.pmid,
        url: input.url,
      });
      if (idMatch.isDuplicate && idMatch.existingSourceId) {
        await logStage(
          'deduping_file',
          `Canonical identifier match: Reusing existing library resource "${idMatch.existingTitle}".`,
          'info',
          100,
          {
            isDuplicate: true,
            duplicateReused: true,
            duplicateLevel: 'doi_url',
            existingSourceId: idMatch.existingSourceId,
            existingTitle: idMatch.existingTitle,
            duplicateMessage: idMatch.message,
            extractedChars: 0,
            extractedPages: 0,
            chunksCount: 0,
            ocrStatus: 'not_needed',
            embeddingStatus: 'reused',
          }
        );

        await jobQueue.completeJob(jobId, {
          sourceId: idMatch.existingSourceId,
          isDuplicate: true,
          duplicateReused: true,
          duplicateLevel: 'doi_url',
          existingSourceId: idMatch.existingSourceId,
          existingTitle: idMatch.existingTitle,
          duplicateMessage: idMatch.message,
          logs,
        });

        return {
          sourceId: idMatch.existingSourceId,
          versionId: '',
          status: 'duplicate_reused',
        };
      }

      // =========================================================================
      // Stage 3 & 4: Extraction + Robust OCR Fallback
      // Supports retry resumption: if cached_doc exists, skip re-extracting
      // =========================================================================
      let doc: ExtractedDocument;
      let ocrStatus: 'native' | 'ocr_applied' | 'not_needed' = 'native';

      if (cachedDoc && cachedDoc.fullText && cachedDoc.fullText.length > 50) {
        await logStage(
          'extracting',
          `Resuming from cached text extraction (${cachedDoc.fullText.length} characters, ${cachedDoc.pageCount} pages).`,
          'info',
          35
        );
        doc = cachedDoc;
        ocrStatus = doc.ocrApplied ? 'ocr_applied' : 'native';
      } else {
        await logStage('extracting', `Extracting text with ${mime} document parser...`, 'info', 25);
        if (mime === 'application/pdf') {
          doc = await this.pdfExtractor.extract(buffer, originalName);
        } else if (mime.includes('wordprocessingml') || mime.includes('msword')) {
          doc = await this.docxExtractor.extract(buffer, originalName);
        } else if (mime === 'text/html' || mime === 'application/xhtml+xml') {
          doc = await this.htmlExtractor.extract(buffer, originalName);
        } else if (mime === 'application/json') {
          doc = await this.jsonExtractor.extract(buffer, originalName);
        } else {
          doc = await this.textExtractor.extract(buffer, originalName);
        }

        // Check if scanned PDF or insufficient text layer
        const needsOcr =
          mime === 'application/pdf' &&
          (doc.isScanned || doc.fullText.trim().length < 50 || doc.pages.every((p) => p.text.trim().length === 0));

        if (needsOcr) {
          await logStage(
            'ocring',
            `Scanned / image-based PDF detected with insufficient text (${doc.fullText.trim().length} chars). Initializing cross-platform OCR fallback (Bengali + English)...`,
            'info',
            35
          );

          try {
            const ocrPages = await runOcrOnPdfBuffer(buffer, {
              jobId,
              onProgress: async (current, total) => {
                const pct = Math.min(44, Math.round(35 + (current / total) * 9));
                await logStage('ocring', `Running OCR on page ${current} of ${total}...`, 'info', pct);
              },
            });

            if (ocrPages.length > 0 && ocrPages.some((p) => p.text.trim().length > 0)) {
              doc = {
                ...doc,
                pages: ocrPages,
                pageCount: ocrPages.length,
                fullText: ocrPages.map((p) => p.text).join('\n\n'),
                isScanned: false,
                ocrApplied: true,
              };
              ocrStatus = 'ocr_applied';
              await logStage(
                'ocring',
                `OCR fallback succeeded: Recognized ${doc.fullText.length} characters across ${ocrPages.length} pages.`,
                'info',
                44
              );
            } else {
              await logStage('ocring', 'OCR produced zero recognized characters from document pages.', 'warn', 44);
            }
          } catch (ocrErr) {
            console.warn('[IngestionPipeline] OCR fallback encountered error:', ocrErr);
            await logStage('ocring', `OCR fallback attempt note: ${ocrErr instanceof Error ? ocrErr.message : String(ocrErr)}`, 'warn', 44);
          }
        }

        // Cache extracted doc for subsequent retries
        await jobQueue.updateProgress(jobId, 'cleaning', 45, {
          cached_doc: doc,
          extractedChars: doc.fullText.length,
          extractedPages: doc.pageCount,
          ocrStatus,
        });
      }

      // =========================================================================
      // Stage 5: Clean Document Pages
      // =========================================================================
      await logStage('cleaning', `Cleaning ${doc.pages.length} document pages, removing running headers and boilerplate...`, 'info', 45);
      const cleanedPages = cleanDocumentPages(doc.pages);

      // =========================================================================
      // Stage 6: Quality Assessment
      // =========================================================================
      await logStage('quality_check', 'Assessing extraction quality, Bengali script parity, and symbol ratios...', 'info', 55);
      const qualityReport = assessExtractionQuality(cleanedPages);

      // =========================================================================
      // Stage 7: Metadata Harmonization
      // =========================================================================
      await logStage('extracting_metadata', 'Harmonizing title, authors, publication year, and evidence levels...', 'info', 60);
      const title = input.prefilledMetadata?.title || doc.title;
      const authors = input.prefilledMetadata?.authors || doc.authors;
      const resolvedYear = resolvePublicationYear({
        prefilledYear: input.prefilledMetadata?.year,
        docYear: doc.year,
        docYearVerified: doc.yearVerified,
        pdfMetadataYear: doc.pdfMetadataYear,
        title,
        text: doc.fullText,
      });
      const year = resolvedYear.year;
      const yearVerified = resolvedYear.yearVerified;
      const sourceType = input.prefilledMetadata?.sourceType || doc.sourceType || 'guideline';
      const license = input.prefilledMetadata?.license || doc.license || 'Open Access / Academic Demo';
      const evidenceLevel = input.prefilledMetadata?.evidenceLevel || doc.evidenceLevel || 'Ia';

      // =========================================================================
      // Stage 8: Dedupe Level 3 & 4 (Fuzzy Title & Simhash Fingerprint)
      // =========================================================================
      await logStage('deduping_metadata', 'Checking Simhash-64 fingerprint and title similarity against existing library...', 'info', 65);
      const metaMatch = await deduplicationEngine.checkContentFingerprint({
        title,
        authors,
        year,
        fullText: doc.fullText,
      });

      // =========================================================================
      // Stage 9 & 10: Structure-Aware Smart Chunking & Dedupe Level 5
      // Supports retry resumption: if cached_chunks exists, skip re-chunking
      // =========================================================================
      let chunksList: ChunkOutput[];
      if (cachedChunks && cachedChunks.length > 0) {
        await logStage('chunking', `Resuming from cached chunking stage (${cachedChunks.length} chunks).`, 'info', 70);
        chunksList = cachedChunks;
      } else {
        await logStage('chunking', 'Performing structure-aware chunking with clinical entity tagging...', 'info', 70);
        try {
          chunksList = structureAwareChunk(title, cleanedPages, {
            publicationYear: year,
            targetTokens: 500,
            minTokens: 250,
            maxTokens: 750,
            overlapRatio: 0.12,
          });
        } catch (chunkErr) {
          if (chunkErr instanceof InsufficientTextError) {
            await logStage(
              'chunking',
              `Chunking validation error: Document contains only ${chunkErr.totalChars} characters.`,
              'error',
              70
            );
          }
          throw chunkErr;
        }

        const chunkStats = getChunkingStats(chunksList);
        await jobQueue.updateProgress(jobId, 'chunking', 72, {
          cached_chunks: chunksList,
          chunksCount: chunksList.length,
          chunkStats,
        });

        await logStage(
          'chunking',
          `Created ${chunksList.length} chunks (avg ${chunkStats.avgTokensPerChunk} tokens). Entities: ${JSON.stringify(chunkStats.entityCounts)}`,
          'info',
          74
        );
      }

      // Total token estimation
      const totalTokens = chunksList.reduce((acc, c) => acc + c.tokenCount, 0);

      // =========================================================================
      // Stage 11: Cost Estimation & Daily Budget
      // =========================================================================
      await logStage('cost_estimation', `Estimating embedding cost for ${totalTokens.toLocaleString()} tokens...`, 'info', 75);
      const costEstimate = await ingestionBudgetManager.estimateCost(totalTokens);
      const budgetCheck = await ingestionBudgetManager.checkDailyBudget(costEstimate.estimatedCost);

      if (!budgetCheck.withinBudget) {
        throw new Error(
          `Daily ingestion budget exceeded. Remaining budget: $${budgetCheck.remainingBudget}, Job requires: $${costEstimate.estimatedCost}.`
        );
      }

      if (costEstimate.requiresApproval) {
        await logStage('cost_estimation', `Job cost ($${costEstimate.estimatedCost}) exceeds threshold. Awaiting administrator approval.`, 'warn', 75);
        await jobQueue.pauseForApproval(jobId, costEstimate.estimatedCost, totalTokens);
        return {
          sourceId: '',
          versionId: '',
          status: 'awaiting_approval',
        };
      }

      // =========================================================================
      // Stage 12: Embeddings & Cache Storage
      // =========================================================================
      await logStage('embedding', `Generating embeddings for ${chunksList.length} chunks via CachedEmbeddingService...`, 'info', 80);
      const chunksToEmbed = chunksList.filter((c) => c.kind !== 'skip' && c.kind !== 'references');
      const embeddingsMap = await this.embeddingService.getOrComputeEmbeddings(
        chunksToEmbed.map((c) => ({ contentHash: c.contentHash, text: c.embeddingText }))
      );
      await jobQueue.updateProgress(jobId, 'embedding', 88, { embeddingStatus: 'completed' });

      // =========================================================================
      // Stage 13: Database Transaction & Indexing
      // =========================================================================
      await logStage('indexing', 'Persisting source record, versioning, and chunk vectors in database...', 'info', 90);
      const client = await pool.connect();
      let sourceId: string;
      let versionId: string;

      try {
        await client.query('BEGIN');

        // Verify that userId exists in users table, else fallback to super_admin or null
        let confirmedByUserId: string | null = userId;
        if (confirmedByUserId) {
          const userCheck = await client.query('SELECT id FROM users WHERE id = $1;', [confirmedByUserId]);
          if (userCheck.rows.length === 0) {
            const fallbackAdmin = await client.query(
              "SELECT id FROM users WHERE role = 'super_admin' ORDER BY created_at ASC LIMIT 1;"
            );
            confirmedByUserId = fallbackAdmin.rows[0]?.id || null;
          }
        }

        // Insert or find source
        const sourceRes = await client.query<{ id: string }>(
          `INSERT INTO sources (
             title, authors, type, source_type, year, year_verified, journal_or_publisher,
             doi, pmid, canonical_url, language, evidence_level, license,
             rights_confirmed_by, rights_confirmed_at, lifecycle, status
           )
           VALUES ($1, $2::jsonb, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), 'published', 'active')
           RETURNING id;`,
          [
            title,
            JSON.stringify(authors),
            sourceType,
            year,
            yearVerified,
            doc.journalOrPublisher || null,
            input.doi || doc.doi || null,
            input.pmid || doc.pmid || null,
            input.url || doc.canonicalUrl || null,
            chunksList[0]?.language || 'mixed',
            evidenceLevel,
            license,
            confirmedByUserId,
          ]
        );
        sourceId = sourceRes.rows[0].id;

        // If metadata match was found at level 3 or 4, record duplicate candidate for admin review
        if (metaMatch.isDuplicate && metaMatch.existingSourceId) {
          await client.query(
            `INSERT INTO duplicate_candidates (new_source_id, existing_source_id, level, score, reason)
             VALUES ($1, $2, $3, $4, $5);`,
            [sourceId, metaMatch.existingSourceId, metaMatch.level, metaMatch.score, metaMatch.message]
          );
        }

        // Insert source_versions (Version 1)
        const textFingerprint = computeSimhash64(doc.fullText);
        const versionRes = await client.query<{ id: string }>(
          `INSERT INTO source_versions (
             source_id, version_no, change_note, file_id, text_fingerprint,
             extraction_quality, page_count, token_count, created_by
           )
           VALUES ($1, 1, 'Initial ingestion upload', $2, $3, $4, $5, $6, $7)
           RETURNING id;`,
          [sourceId, fileId, textFingerprint, qualityReport.score, doc.pageCount, totalTokens, confirmedByUserId]
        );
        versionId = versionRes.rows[0].id;

        await client.query(
          `UPDATE sources SET current_version_id = $1 WHERE id = $2;`,
          [versionId, sourceId]
        );

        // Stage 14: Safety Scan (Prompt Injection Defense)
        await logStage('safety_scanning', 'Scanning chunks for prompt injection attempts...', 'info', 95);
        const safetyReport = scanChunksForPromptInjection(
          chunksList.map((c) => ({ ordinal: c.ordinal, text: c.text }))
        );

        // Insert Chunks with English and Simple TSV configs
        for (const c of chunksList) {
          const vec = embeddingsMap.get(c.contentHash);
          const vecStr = vec ? `[${vec.join(',')}]` : null;
          const tsvConfig = c.language === 'bn' ? 'simple' : 'english';

          await client.query(
            `INSERT INTO chunks (
               source_id, source_version_id, ordinal, heading_path, page_start, page_end,
               page, section, kind, text, embedding_text, content_hash, token_count,
               language, embedding, tsv, evidence_level, status
             )
             VALUES (
               $1, $2, $3, $4, $5, $6,
               $5, $4, $7, $8, $9, $10, $11,
               $12, $13::vector, to_tsvector($14, $8), $15, 'active'
             );`,
            [
              sourceId,
              versionId,
              c.ordinal,
              c.headingPath,
              c.pageStart,
              c.pageEnd,
              c.kind,
              c.text,
              c.embeddingText,
              c.contentHash,
              c.tokenCount,
              c.language,
              vecStr,
              tsvConfig,
              evidenceLevel,
            ]
          );
        }

        // Stage 15: Finish & Mark in_review
        await recordAuditLog({
          userId: confirmedByUserId || userId,
          event: 'SOURCE_INGESTION_COMPLETED',
          payload: {
            sourceId,
            versionId,
            title,
            chunkCount: chunksList.length,
            qualityScore: qualityReport.score,
            hasPromptInjection: safetyReport.hasPromptInjection,
          },
        });

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      await logStage('completed', `Ingestion completed successfully. ${chunksList.length} verified chunks indexed.`, 'info', 100);

      await jobQueue.completeJob(jobId, {
        sourceId,
        versionId,
        qualityScore: qualityReport.score,
        warnings: qualityReport.warnings,
        warningsBn: qualityReport.warningsBn,
        needsReview: qualityReport.needsReview,
        totalTokens,
        estimatedCost: costEstimate.estimatedCost,
        extractedChars: doc.fullText.length,
        extractedPages: doc.pageCount,
        chunksCount: chunksList.length,
        ocrStatus,
        embeddingStatus: 'completed',
        isDuplicate: false,
        logs,
      });

      return {
        sourceId,
        versionId,
        status: 'published',
      };
    } catch (err: unknown) {
      console.error(`[IngestionPipeline] Job ${jobId} failed at stage [${currentStage}]:`, err);
      const msg = err instanceof Error ? err.message : 'Unknown ingestion pipeline error';
      logs.push({
        timestamp: new Date().toISOString(),
        stage: currentStage,
        message: `Pipeline failure at stage [${currentStage}]: ${msg}`,
        level: 'error',
      });
      await jobQueue.failJob(jobId, msg, currentStage, { logs, lastFailedStage: currentStage });
      throw err;
    }
  }
}

export const ingestionPipeline = new IngestionPipeline();
