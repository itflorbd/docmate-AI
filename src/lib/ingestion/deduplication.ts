import { Pool } from 'pg';
import { computeSimhash64, simhashSimilarity } from './simhash';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export interface DuplicateMatch {
  isDuplicate: boolean;
  level: 'file_hash' | 'doi_url' | 'metadata' | 'fingerprint' | null;
  score: number; // 0 to 1
  existingSourceId: string | null;
  existingTitle: string | null;
  existingVersionNo?: number;
  message: string;
}

export function canonicalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    // Strip UTM and tracking parameters
    const searchParams = new URLSearchParams(parsed.search);
    const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'];
    for (const key of trackingKeys) {
      searchParams.delete(key);
    }
    parsed.search = searchParams.toString();
    parsed.hash = ''; // strip fragment
    let clean = parsed.toString();
    if (clean.endsWith('/')) {
      clean = clean.slice(0, -1);
    }
    return clean;
  } catch {
    return urlStr.trim();
  }
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class DeduplicationEngine {
  // Level 1: File Hash Deduplication
  async checkFileHash(sha256: string): Promise<DuplicateMatch> {
    const { rows } = await pool.query<{ source_id: string; title: string; version_no: number }>(
      `SELECT s.id AS source_id, s.title, v.version_no
       FROM source_files f
       JOIN source_versions v ON v.file_id = f.id
       JOIN sources s ON s.id = v.source_id
       WHERE f.sha256 = $1
       ORDER BY v.created_at DESC
       LIMIT 1;`,
      [sha256]
    );

    if (rows.length > 0) {
      return {
        isDuplicate: true,
        level: 'file_hash',
        score: 1.0,
        existingSourceId: rows[0].source_id,
        existingTitle: rows[0].title,
        existingVersionNo: rows[0].version_no,
        message: `Identical file (SHA256 match) was previously ingested as "${rows[0].title}" (v${rows[0].version_no}).`,
      };
    }

    return { isDuplicate: false, level: null, score: 0, existingSourceId: null, existingTitle: null, message: '' };
  }

  // Level 2: Canonical Identifier Deduplication (DOI, PMID, URL)
  async checkIdentifiers(params: { doi?: string; pmid?: string; url?: string }): Promise<DuplicateMatch> {
    const client = await pool.connect();
    try {
      if (params.doi && params.doi.trim()) {
        const cleanDoi = params.doi.trim().toLowerCase();
        const { rows } = await client.query<{ id: string; title: string }>(
          `SELECT id, title FROM sources WHERE LOWER(doi) = $1 LIMIT 1;`,
          [cleanDoi]
        );
        if (rows.length > 0) {
          return {
            isDuplicate: true,
            level: 'doi_url',
            score: 1.0,
            existingSourceId: rows[0].id,
            existingTitle: rows[0].title,
            message: `Exact DOI match (${cleanDoi}) found in library source "${rows[0].title}".`,
          };
        }
      }

      if (params.pmid && params.pmid.trim()) {
        const cleanPmid = params.pmid.trim();
        const { rows } = await client.query<{ id: string; title: string }>(
          `SELECT id, title FROM sources WHERE pmid = $1 LIMIT 1;`,
          [cleanPmid]
        );
        if (rows.length > 0) {
          return {
            isDuplicate: true,
            level: 'doi_url',
            score: 1.0,
            existingSourceId: rows[0].id,
            existingTitle: rows[0].title,
            message: `Exact PMID match (${cleanPmid}) found in library source "${rows[0].title}".`,
          };
        }
      }

      if (params.url && params.url.trim()) {
        const canonical = canonicalizeUrl(params.url);
        const { rows } = await client.query<{ id: string; title: string }>(
          `SELECT id, title FROM sources WHERE canonical_url = $1 OR url = $1 LIMIT 1;`,
          [canonical]
        );
        if (rows.length > 0) {
          return {
            isDuplicate: true,
            level: 'doi_url',
            score: 1.0,
            existingSourceId: rows[0].id,
            existingTitle: rows[0].title,
            message: `Exact Canonical URL match found in library source "${rows[0].title}".`,
          };
        }
      }

      return { isDuplicate: false, level: null, score: 0, existingSourceId: null, existingTitle: null, message: '' };
    } finally {
      client.release();
    }
  }

  // Level 3 & Level 4: Metadata & Text Fingerprint (Simhash) Deduplication
  async checkContentFingerprint(params: {
    title: string;
    authors?: string[];
    year?: number;
    fullText: string;
  }): Promise<DuplicateMatch> {
    const client = await pool.connect();
    try {
      const normInputTitle = normalizeTitle(params.title);

      // Level 3: Fuzzy Title & Year Match
      const { rows: metaRows } = await client.query<{ id: string; title: string; year: number }>(
        `SELECT id, title, year FROM sources WHERE year = $1 OR year IS NULL;`,
        [params.year || new Date().getFullYear()]
      );

      for (const row of metaRows) {
        const normExisting = normalizeTitle(row.title);
        if (normInputTitle.length > 8 && normExisting === normInputTitle) {
          return {
            isDuplicate: true,
            level: 'metadata',
            score: 0.95,
            existingSourceId: row.id,
            existingTitle: row.title,
            message: `Title and publication year match existing source "${row.title}".`,
          };
        }
      }

      // Level 4: Simhash Text Fingerprint Check
      if (params.fullText && params.fullText.length > 100) {
        const inputFingerprint = computeSimhash64(params.fullText);
        const { rows: fpRows } = await client.query<{ source_id: string; title: string; text_fingerprint: string }>(
          `SELECT v.source_id, s.title, v.text_fingerprint
           FROM source_versions v
           JOIN sources s ON s.id = v.source_id
           WHERE v.text_fingerprint IS NOT NULL;`
        );

        for (const fpRow of fpRows) {
          const sim = simhashSimilarity(inputFingerprint, fpRow.text_fingerprint);
          if (sim >= 0.85) {
            return {
              isDuplicate: true,
              level: 'fingerprint',
              score: Math.round(sim * 100) / 100,
              existingSourceId: fpRow.source_id,
              existingTitle: fpRow.title,
              message: `High text fingerprint similarity (${Math.round(sim * 100)}%) with source "${fpRow.title}".`,
            };
          }
        }
      }

      return { isDuplicate: false, level: null, score: 0, existingSourceId: null, existingTitle: null, message: '' };
    } finally {
      client.release();
    }
  }

  // Record candidate in duplicate_candidates table
  async recordDuplicateCandidate(params: {
    newSourceId: string;
    existingSourceId: string;
    level: 'file_hash' | 'doi_url' | 'metadata' | 'fingerprint';
    score: number;
    reason: string;
  }): Promise<string> {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO duplicate_candidates (new_source_id, existing_source_id, level, score, reason)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id;`,
      [params.newSourceId, params.existingSourceId, params.level, params.score, params.reason]
    );
    return rows[0].id;
  }
}

export const deduplicationEngine = new DeduplicationEngine();
