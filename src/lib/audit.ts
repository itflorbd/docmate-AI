import crypto from 'crypto';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { desc, asc, isNotNull, sql } from 'drizzle-orm';

const GENESIS_PREV_HASH = '0'.repeat(64);

/**
 * Canonically serializes any JSON object with deterministically sorted keys
 * to ensure cryptographic hashes are identical before and after JSONB database storage.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalJsonStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs: string[] = [];
  for (const k of keys) {
    if (obj[k] !== undefined) {
      pairs.push(`${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);
    }
  }
  return '{' + pairs.join(',') + '}';
}

export function computeAuditHash(
  prevHash: string,
  event: string,
  userId: string | null,
  caseId: string | null,
  payload: Record<string, unknown>,
  timestampIso: string
): string {
  const content = `${prevHash}|${event}|${userId || ''}|${caseId || ''}|${canonicalJsonStringify(payload)}|${timestampIso}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function recordAuditLog({
  userId,
  caseId,
  event,
  payload,
}: {
  userId?: string | null;
  caseId?: string | null;
  event: string;
  payload: Record<string, unknown>;
}): Promise<string> {
  return await db.transaction(async (tx) => {
    // Acquire PostgreSQL transaction-level advisory lock to serialize audit log insertions cleanly
    await tx.execute(sql`SELECT pg_advisory_xact_lock(424242)`);

    // Fetch latest audit row with a hash to chain sequentially
    const latestHashed = await tx
      .select({ hash: auditLogs.hash, createdAt: auditLogs.createdAt })
      .from(auditLogs)
      .where(isNotNull(auditLogs.hash))
      .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
      .limit(1);

    const prevHash = latestHashed[0]?.hash || GENESIS_PREV_HASH;

    // Ensure monotonic timestamp ordering
    let now = new Date();
    if (latestHashed[0]?.createdAt && now <= latestHashed[0].createdAt) {
      now = new Date(latestHashed[0].createdAt.getTime() + 1);
    }

    const hash = computeAuditHash(
      prevHash,
      event,
      userId || null,
      caseId || null,
      payload,
      now.toISOString()
    );

    const [inserted] = await tx
      .insert(auditLogs)
      .values({
        userId: userId || null,
        caseId: caseId || null,
        event,
        payload,
        prevHash,
        hash,
        createdAt: now,
      })
      .returning({ id: auditLogs.id, hash: auditLogs.hash });

    return inserted.hash || hash;
  });
}

export async function verifyAuditChain(): Promise<{
  valid: boolean;
  totalChecked: number;
  brokenAtId?: string;
  error?: string;
}> {
  const logs = await db
    .select()
    .from(auditLogs)
    .where(isNotNull(auditLogs.hash))
    .orderBy(asc(auditLogs.createdAt), asc(auditLogs.id));

  if (logs.length === 0) {
    return { valid: true, totalChecked: 0 };
  }

  let expectedPrevHash = GENESIS_PREV_HASH;

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];

    if (!entry.hash || !entry.prevHash) {
      continue;
    }

    if (entry.prevHash !== expectedPrevHash) {
      return {
        valid: false,
        totalChecked: i,
        brokenAtId: entry.id,
        error: `Broken link at log ID ${entry.id}: expected prev_hash ${expectedPrevHash}, found ${entry.prevHash}`,
      };
    }

    const recomputedHash = computeAuditHash(
      entry.prevHash,
      entry.event,
      entry.userId,
      entry.caseId,
      entry.payload as Record<string, unknown>,
      entry.createdAt.toISOString()
    );

    if (entry.hash !== recomputedHash) {
      return {
        valid: false,
        totalChecked: i,
        brokenAtId: entry.id,
        error: `Tampered hash at log ID ${entry.id}: expected ${recomputedHash}, stored ${entry.hash}`,
      };
    }

    expectedPrevHash = entry.hash;
  }

  return { valid: true, totalChecked: logs.length };
}

export const createAuditLogEntry = recordAuditLog;
