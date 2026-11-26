import { db } from '@/db';
import { accessLogs } from '@/db/schema';

export interface AccessLogParams {
  userId?: string | null;
  profileId: string;
  userRole?: string | null;
  action: string;
  recordType?: string | null;
  recordId?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Persists an access log entry for auditing who accessed which patient profile/record and why.
 * This log is tamper-evident and readable by patients in their portal.
 */
export async function recordAccessLog(params: AccessLogParams): Promise<void> {
  try {
    await db.insert(accessLogs).values({
      userId: params.userId || null,
      profileId: params.profileId,
      userRole: params.userRole || null,
      action: params.action,
      recordType: params.recordType || null,
      recordId: params.recordId || null,
      reason: params.reason || null,
      ipAddress: params.ipAddress || null,
      userAgent: params.userAgent || null,
    });
  } catch (err) {
    console.error('[access-log] Failed to persist access log:', err);
  }
}
