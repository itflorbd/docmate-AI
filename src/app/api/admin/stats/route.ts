import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  users,
  cases,
  sources,
  auditLogs,
  doctorVerifications,
  studentVerifications,
  researcherVerifications,
  systemSettings,
} from '@/db/schema';
import { requireSuperAdmin } from '@/lib/permissions';
import { count, eq, sql, gte } from 'drizzle-orm';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // 1. Users by role
    const userRoleCounts = await db
      .select({
        role: users.role,
        status: users.status,
        count: count(),
      })
      .from(users)
      .groupBy(users.role, users.status);

    // 2. Pending verifications
    const [pendingDoctors] = await db
      .select({ count: count() })
      .from(doctorVerifications)
      .where(eq(doctorVerifications.status, 'pending'));

    const [pendingStudents] = await db
      .select({ count: count() })
      .from(studentVerifications)
      .where(eq(studentVerifications.status, 'pending'));

    const [pendingResearchers] = await db
      .select({ count: count() })
      .from(researcherVerifications)
      .where(eq(researcherVerifications.status, 'pending'));

    // 3. Active cases created today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [casesToday] = await db
      .select({ count: count() })
      .from(cases)
      .where(gte(cases.createdAt, startOfToday));

    const [totalCases] = await db
      .select({ count: count() })
      .from(cases);

    // 4. Sources count
    const [totalSources] = await db
      .select({ count: count() })
      .from(sources);

    // 5. Total audit logs
    const [totalAudit] = await db
      .select({ count: count() })
      .from(auditLogs);

    // 6. Killswitches active
    const activeKillswitches = await db
      .select()
      .from(systemSettings)
      .where(sql`${systemSettings.key} LIKE 'killswitch:%'`);

    return NextResponse.json({
      userRoleCounts,
      pendingVerifications: {
        doctors: pendingDoctors?.count || 0,
        students: pendingStudents?.count || 0,
        researchers: pendingResearchers?.count || 0,
        total:
          (pendingDoctors?.count || 0) +
          (pendingStudents?.count || 0) +
          (pendingResearchers?.count || 0),
      },
      cases: {
        today: casesToday?.count || 0,
        total: totalCases?.count || 0,
      },
      library: {
        sources: totalSources?.count || 0,
      },
      audit: {
        totalLogs: totalAudit?.count || 0,
      },
      activeKillswitches: activeKillswitches.length,
    });
  } catch (error) {
    console.error('[admin/stats] Failed to fetch admin stats:', error);
    return NextResponse.json({ error: 'Failed to retrieve admin metrics' }, { status: 500 });
  }
}
