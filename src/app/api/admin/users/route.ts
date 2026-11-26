import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  users,
  doctorVerifications,
  studentVerifications,
  researcherVerifications,
} from '@/db/schema';
import { requireSuperAdmin, invalidateFeatureCache } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';
import { eq, and, ilike, desc, or } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('q') || '';
  const role = searchParams.get('role');
  const status = searchParams.get('status');

  try {
    const conditions = [];

    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(users.email, pattern),
          ilike(users.name, pattern),
          ilike(users.bmdcNumber, pattern),
          ilike(users.phone, pattern)
        )
      );
    }

    if (role && role !== 'all') {
      conditions.push(eq(users.role, role));
    }

    if (status && status !== 'all') {
      conditions.push(eq(users.status, status));
    }

    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        status: users.status,
        mfaEnabled: users.mfaEnabled,
        phone: users.phone,
        bmdcNumber: users.bmdcNumber,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(users.createdAt))
      .limit(100);

    // Fetch verification data for users who have pending/reviewed verifications
    const [docVerifs, stuVerifs, resVerifs] = await Promise.all([
      db.select().from(doctorVerifications),
      db.select().from(studentVerifications),
      db.select().from(researcherVerifications),
    ]);

    const docMap = new Map(docVerifs.map((v) => [v.doctorId, v]));
    const stuMap = new Map(stuVerifs.map((v) => [v.studentId, v]));
    const resMap = new Map(resVerifs.map((v) => [v.researcherId, v]));

    const usersWithVerification = userList.map((u) => ({
      ...u,
      doctorVerification: docMap.get(u.id) || null,
      studentVerification: stuMap.get(u.id) || null,
      researcherVerification: resMap.get(u.id) || null,
    }));

    return NextResponse.json({ users: usersWithVerification });
  } catch (error) {
    console.error('[admin/users] Failed to query users:', error);
    return NextResponse.json({ error: 'Failed to retrieve users' }, { status: 500 });
  }
}

const userActionSchema = z.object({
  action: z.enum([
    'approve_verification',
    'reject_verification',
    'suspend_user',
    'activate_user',
    'reset_mfa',
  ]),
  userId: z.string().uuid(),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = userActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const { action, userId, reason } = parsed.data;

    // Fetch target user
    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const beforeState = {
      status: targetUser.status,
      mfaEnabled: targetUser.mfaEnabled,
    };

    if (action === 'suspend_user') {
      await db
        .update(users)
        .set({ status: 'suspended' })
        .where(eq(users.id, userId));

      await recordAuditLog({
        userId: auth.user.id,
        event: 'USER_SUSPENDED',
        payload: {
          targetUserId: userId,
          targetEmail: targetUser.email,
          reason: reason || 'Suspended by super_admin',
          before: beforeState,
          after: { status: 'suspended' },
        },
      });

      invalidateFeatureCache(userId);
      return NextResponse.json({ success: true, status: 'suspended' });
    }

    if (action === 'activate_user') {
      await db
        .update(users)
        .set({ status: 'active' })
        .where(eq(users.id, userId));

      await recordAuditLog({
        userId: auth.user.id,
        event: 'USER_ACTIVATED',
        payload: {
          targetUserId: userId,
          targetEmail: targetUser.email,
          reason: reason || 'Activated by super_admin',
          before: beforeState,
          after: { status: 'active' },
        },
      });

      invalidateFeatureCache(userId);
      return NextResponse.json({ success: true, status: 'active' });
    }

    if (action === 'reset_mfa') {
      await db
        .update(users)
        .set({ mfaEnabled: false, mfaSecret: null })
        .where(eq(users.id, userId));

      await recordAuditLog({
        userId: auth.user.id,
        event: 'USER_MFA_RESET',
        payload: {
          targetUserId: userId,
          targetEmail: targetUser.email,
          reason: reason || 'MFA reset by super_admin',
        },
      });

      return NextResponse.json({ success: true, mfaReset: true });
    }

    if (action === 'approve_verification') {
      const now = new Date();

      if (targetUser.role === 'doctor') {
        await db
          .update(doctorVerifications)
          .set({
            status: 'approved',
            reviewedBy: auth.user.id,
            reviewedAt: now,
          })
          .where(eq(doctorVerifications.doctorId, userId));
      } else if (targetUser.role === 'student') {
        await db
          .update(studentVerifications)
          .set({
            status: 'approved',
            reviewedBy: auth.user.id,
            reviewedAt: now,
          })
          .where(eq(studentVerifications.studentId, userId));
      } else if (targetUser.role === 'researcher') {
        await db
          .update(researcherVerifications)
          .set({
            status: 'approved',
            reviewedBy: auth.user.id,
            reviewedAt: now,
          })
          .where(eq(researcherVerifications.researcherId, userId));
      }

      await db
        .update(users)
        .set({ status: 'active' })
        .where(eq(users.id, userId));

      await recordAuditLog({
        userId: auth.user.id,
        event: 'VERIFICATION_APPROVED',
        payload: {
          targetUserId: userId,
          targetRole: targetUser.role,
          targetEmail: targetUser.email,
          reviewedBy: auth.user.id,
        },
      });

      invalidateFeatureCache(userId);
      return NextResponse.json({ success: true, verified: true, status: 'active' });
    }

    if (action === 'reject_verification') {
      if (!reason || reason.trim().length < 3) {
        return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
      }

      const now = new Date();
      if (targetUser.role === 'doctor') {
        await db
          .update(doctorVerifications)
          .set({
            status: 'rejected',
            rejectionReason: reason.trim(),
            reviewedBy: auth.user.id,
            reviewedAt: now,
          })
          .where(eq(doctorVerifications.doctorId, userId));
      } else if (targetUser.role === 'student') {
        await db
          .update(studentVerifications)
          .set({
            status: 'rejected',
            rejectionReason: reason.trim(),
            reviewedBy: auth.user.id,
            reviewedAt: now,
          })
          .where(eq(studentVerifications.studentId, userId));
      } else if (targetUser.role === 'researcher') {
        await db
          .update(researcherVerifications)
          .set({
            status: 'rejected',
            rejectionReason: reason.trim(),
            reviewedBy: auth.user.id,
            reviewedAt: now,
          })
          .where(eq(researcherVerifications.researcherId, userId));
      }

      await recordAuditLog({
        userId: auth.user.id,
        event: 'VERIFICATION_REJECTED',
        payload: {
          targetUserId: userId,
          targetRole: targetUser.role,
          targetEmail: targetUser.email,
          rejectionReason: reason.trim(),
          reviewedBy: auth.user.id,
        },
      });

      invalidateFeatureCache(userId);
      return NextResponse.json({ success: true, rejected: true });
    }

    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 });
  } catch (error) {
    console.error('[admin/users] Action failed:', error);
    return NextResponse.json({ error: 'Failed to execute user action' }, { status: 500 });
  }
}
