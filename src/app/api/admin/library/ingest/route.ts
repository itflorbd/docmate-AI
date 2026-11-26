import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { jobQueue } from '@/lib/queue/job-queue';
import { getStorageDriver } from '@/lib/storage';
import { recordAuditLog } from '@/lib/audit';
import { ingestionWorker } from '@/workers/ingestion-worker';
import AdmZip from 'adm-zip';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'library-ingest',
    supportedMimes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/html',
      'application/json',
      'application/zip',
    ],
  });
}

// Helper to detect medicine-like payload
function isMedicinePayload(data: unknown): boolean {
  if (!data) return false;
  if (Array.isArray(data)) {
    if (data.length === 0) return false;
    const first = data[0];
    if (typeof first === 'object' && first !== null) {
      const keys = Object.keys(first).map((k) => k.toLowerCase());
      return keys.some((k) =>
        ['brand_name', 'generic_name', 'dosage_form', 'strength', 'manufacturer', 'dgda', 'contraindication'].includes(k)
      );
    }
  } else if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data).map((k) => k.toLowerCase());
    return keys.some((k) =>
      ['brands', 'generics', 'drugs', 'medicines', 'contraindications', 'interactions'].includes(k)
    );
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireFeaturePermission('library.ingest');
    if (auth.error) {
      return NextResponse.json(
        {
          error: auth.error,
          message: auth.error,
          messageBn: 'রিসোর্স ইনজেশন সম্পন্ন করার প্রয়োজনীয় পারমিশন নেই।',
        },
        { status: auth.status }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    const createdJobIds: string[] = [];

    if (contentType.includes('multipart/form-data')) {
      const storage = getStorageDriver();
      const formData = await request.formData();
      const files = formData.getAll('files') as File[];
      const rightsConfirmed = formData.get('rightsConfirmed') === 'true';
      const metadataStr = formData.get('prefilledMetadata') as string | null;
      let prefilledMetadata: Record<string, unknown> | undefined;

      if (metadataStr) {
        try {
          prefilledMetadata = JSON.parse(metadataStr);
        } catch {
          // ignore parsing error
        }
      }

      if (!rightsConfirmed) {
        return NextResponse.json(
          {
            error: 'rights_confirmation_required',
            message: 'You must confirm that this institution has the legal rights or an open license to ingest this document.',
            messageBn: 'ডকুমেন্টটি সংযুক্ত করার কপিরাইট বা আইনি অধিকার নিশ্চিত করা বাধ্যতামূলক।',
          },
          { status: 400 }
        );
      }

      if (!files || files.length === 0) {
        return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
      }

      for (const file of files) {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const originalName = file.name;
        const ext = path.extname(originalName).toLowerCase();

        // Check if ZIP archive
        if (ext === '.zip' || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
          try {
            const zip = new AdmZip(fileBuffer);
            const zipEntries = zip.getEntries();

            for (const entry of zipEntries) {
              if (entry.isDirectory || entry.entryName.startsWith('__MACOSX/') || path.basename(entry.entryName).startsWith('.')) {
                continue;
              }
              const entryExt = path.extname(entry.entryName).toLowerCase();
              if (!['.pdf', '.docx', '.txt', '.md', '.html', '.htm', '.json'].includes(entryExt)) {
                continue;
              }

              const entryBuffer = entry.getData();
              const entryName = path.basename(entry.entryName);

              // Check for medicine json inside zip
              if (entryExt === '.json') {
                try {
                  const parsed = JSON.parse(entryBuffer.toString('utf-8'));
                  if (isMedicinePayload(parsed)) {
                    continue; // Skip medicine files in zip
                  }
                } catch {
                  // ignore
                }
              }

              const storageKey = `sources/zip-${Date.now()}-${entryName}`;
              await storage.save(storageKey, entryBuffer, 'application/octet-stream');

              const jobId = await jobQueue.enqueue({
                inputType: 'file',
                metadata: {
                  fileStorageKey: storageKey,
                  fileName: entryName,
                  rightsConfirmed,
                  prefilledMetadata,
                  userId: auth.user.id,
                },
              });
              createdJobIds.push(jobId);
            }
          } catch (zipErr) {
            console.error('[admin/library/ingest] Failed to unpack zip:', zipErr);
            return NextResponse.json({ error: 'Failed to process ZIP archive' }, { status: 400 });
          }
        } else {
          // Check for medicine JSON
          if (ext === '.json') {
            try {
              const parsed = JSON.parse(fileBuffer.toString('utf-8'));
              if (isMedicinePayload(parsed)) {
                return NextResponse.json(
                  {
                    error: 'medicine_data_rejected',
                    message: 'Medicine/drug formulary data must be imported via the Medicine Controller (/controller), not the clinical literature library.',
                    messageBn: 'ওষুধের তথ্য মেডিকেল লাইব্রেরির পরিবর্তে /controller এ DGDA নির্দেশিকা ইম্পোর্টার ব্যবহার করে ইম্পোর্ট করতে হবে।',
                    redirectUrl: '/controller',
                  },
                  { status: 400 }
                );
              }
            } catch {
              // Not valid json, pipeline will handle
            }
          }

          const storageKey = `sources/${Date.now()}-${originalName}`;
          await storage.save(storageKey, fileBuffer, file.type || 'application/octet-stream');

          const jobId = await jobQueue.enqueue({
            inputType: 'file',
            metadata: {
              fileStorageKey: storageKey,
              fileName: originalName,
              rightsConfirmed,
              prefilledMetadata,
              userId: auth.user.id,
            },
          });
          createdJobIds.push(jobId);
        }
      }
    } else {
      // JSON body request (URL, DOI, PMID, JSON payload)
      const body = await request.json();
      const { inputType, url, doi, pmid, jsonPayload, prefilledMetadata, rightsConfirmed } = body;

      if (!rightsConfirmed) {
        return NextResponse.json(
          {
            error: 'rights_confirmation_required',
            message: 'You must confirm that this institution has the legal rights or an open license to ingest this document.',
            messageBn: 'ডকুমেন্টটি সংযুক্ত করার কপিরাইট বা আইনি অধিকার নিশ্চিত করা বাধ্যতামূলক।',
          },
          { status: 400 }
        );
      }

      if (inputType === 'json' && isMedicinePayload(jsonPayload)) {
        return NextResponse.json(
          {
            error: 'medicine_data_rejected',
            message: 'Medicine/drug formulary data must be imported via the Medicine Controller (/controller), not the clinical literature library.',
            messageBn: 'ওষুধের তথ্য মেডিকেল লাইব্রেরির পরিবর্তে /controller এ DGDA নির্দেশিকা ইম্পোর্টার ব্যবহার করে ইম্পোর্ট করতে হবে।',
            redirectUrl: '/controller',
          },
          { status: 400 }
        );
      }

      const jobId = await jobQueue.enqueue({
        inputType: inputType || 'url',
        metadata: {
          url,
          doi,
          pmid,
          jsonPayload,
          prefilledMetadata,
          rightsConfirmed,
          userId: auth.user.id,
        },
      });
      createdJobIds.push(jobId);
    }

    await recordAuditLog({
      userId: auth.user.id,
      event: 'LIBRARY_INGEST_ENQUEUED',
      payload: {
        jobCount: createdJobIds.length,
        jobIds: createdJobIds,
        userEmail: auth.user.email,
      },
    });

    // Trigger immediate background worker processing
    ingestionWorker.triggerProcessing();

    return NextResponse.json({
      success: true,
      message: `Enqueued ${createdJobIds.length} ingestion job(s)`,
      messageBn: `${createdJobIds.length} টি রিসোর্স ইনজেশন কিউতে যোগ করা হয়েছে।`,
      jobIds: createdJobIds,
    });
  } catch (error) {
    console.error('[admin/library/ingest] Error enqueuing ingestion:', error);
    const msg = error instanceof Error ? error.message : 'Failed to enqueue ingestion jobs';
    return NextResponse.json(
      {
        error: msg,
        message: msg,
        messageBn: 'রিসোর্স ইনজেশন প্রসেস শুরু করতে সার্ভারে ত্রুটি হয়েছে।',
      },
      { status: 500 }
    );
  }
}
