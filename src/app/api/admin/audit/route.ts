import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { requireSuperAdmin } from '@/lib/permissions';
import { verifyAuditChain } from '@/lib/audit';
import { desc, ilike, eq, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '30', 10)));
  const offset = (page - 1) * limit;
  const event = searchParams.get('event');

  try {
    const condition = event ? ilike(auditLogs.event, `%${event}%`) : undefined;

    const [logs, [totalRow]] = await Promise.all([
      db
        .select({
          id: auditLogs.id,
          event: auditLogs.event,
          userId: auditLogs.userId,
          userEmail: users.email,
          userName: users.name,
          caseId: auditLogs.caseId,
          payload: auditLogs.payload,
          prevHash: auditLogs.prevHash,
          hash: auditLogs.hash,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(condition)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(auditLogs)
        .where(condition),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total: totalRow?.count || 0,
        totalPages: Math.ceil((totalRow?.count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('[admin/audit] Failed to fetch audit logs:', error);
    return NextResponse.json({ error: 'Failed to retrieve audit records' }, { status: 500 });
  }
}

export async function POST() {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await verifyAuditChain();
    return NextResponse.json({
      success: true,
      verification: result,
      verifiedAt: new Date().toISOString(),
      verifiedBy: auth.user.email,
    });
  } catch (error) {
    console.error('[admin/audit] Failed to verify audit chain:', error);
    return NextResponse.json({ error: 'Audit verification failed' }, { status: 500 });
  }
}
