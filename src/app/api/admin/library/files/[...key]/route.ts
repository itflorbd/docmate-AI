import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { getStorageDriver } from '@/lib/storage';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const auth = await requireFeaturePermission('library.browse');
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { key: keyParts } = await params;
  const storageKey = keyParts.join('/');

  try {
    const storage = getStorageDriver();
    const buffer = await storage.get(storageKey);

    if (!buffer) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    let contentType = 'application/octet-stream';
    if (storageKey.endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (storageKey.endsWith('.docx')) {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (storageKey.endsWith('.html') || storageKey.endsWith('.htm')) {
      contentType = 'text/html; charset=utf-8';
    } else if (storageKey.endsWith('.txt') || storageKey.endsWith('.md')) {
      contentType = 'text/plain; charset=utf-8';
    } else if (storageKey.endsWith('.json')) {
      contentType = 'application/json; charset=utf-8';
    }

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', 'inline');
    // Uploaded files are untrusted: never let an HTML upload run scripts on this site.
    headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Cache-Control', 'private, max-age=3600');

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('[admin/library/files] Error reading file:', error);
    return NextResponse.json({ error: 'Failed to read file from storage' }, { status: 500 });
  }
}
