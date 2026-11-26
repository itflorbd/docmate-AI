import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import {
  features,
  roleFeatures,
  userFeatureOverrides,
  users,
} from '@/db/schema';
import { requireSuperAdmin, invalidateFeatureCache } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const [allFeatures, allRoleFeatures, allOverrides] = await Promise.all([
      db.select().from(features),
      db.select().from(roleFeatures),
      db
        .select({
          id: userFeatureOverrides.id,
          userId: userFeatureOverrides.userId,
          userEmail: users.email,
          userName: users.name,
          userRole: users.role,
          featureKey: userFeatureOverrides.featureKey,
          enabled: userFeatureOverrides.enabled,
          dailyLimit: userFeatureOverrides.dailyLimit,
          expiresAt: userFeatureOverrides.expiresAt,
          reason: userFeatureOverrides.reason,
          createdAt: userFeatureOverrides.createdAt,
        })
        .from(userFeatureOverrides)
        .leftJoin(users, eq(userFeatureOverrides.userId, users.id)),
    ]);

    return NextResponse.json({
      features: allFeatures,
      roleFeatures: allRoleFeatures,
      overrides: allOverrides,
    });
  } catch (error) {
    console.error('[admin/access] Failed to load access matrix:', error);
    return NextResponse.json({ error: 'Failed to retrieve access matrix' }, { status: 500 });
  }
}

const updateRoleFeatureSchema = z.object({
  action: z.literal('update_role_feature'),
  role: z.string(),
  featureKey: z.string(),
  enabled: z.boolean(),
  dailyLimit: z.number().nullable().optional(),
});

const setUserOverrideSchema = z.object({
  action: z.literal('set_user_override'),
  userId: z.string().uuid(),
  featureKey: z.string(),
  enabled: z.boolean(),
  dailyLimit: z.number().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  reason: z.string().min(3),
});

const removeUserOverrideSchema = z.object({
  action: z.literal('remove_user_override'),
  overrideId: z.string().uuid(),
});

const accessActionSchema = z.discriminatedUnion('action', [
  updateRoleFeatureSchema,
  setUserOverrideSchema,
  removeUserOverrideSchema,
]);

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = accessActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;

    if (data.action === 'update_role_feature') {
      const [existing] = await db
        .select()
        .from(roleFeatures)
        .where(
          and(
            eq(roleFeatures.role, data.role),
            eq(roleFeatures.featureKey, data.featureKey)
          )
        )
        .limit(1);

      const before = existing
        ? { enabled: existing.enabled, dailyLimit: existing.dailyLimit }
        : null;

      const after = {
        enabled: data.enabled,
        dailyLimit: data.dailyLimit ?? null,
      };

      if (existing) {
        await db
          .update(roleFeatures)
          .set({
            enabled: data.enabled,
            dailyLimit: data.dailyLimit ?? null,
            updatedAt: new Date(),
          })
          .where(eq(roleFeatures.id, existing.id));
      } else {
        await db.insert(roleFeatures).values({
          role: data.role,
          featureKey: data.featureKey,
          enabled: data.enabled,
          dailyLimit: data.dailyLimit ?? null,
        });
      }

      await recordAuditLog({
        userId: auth.user.id,
        event: 'ROLE_FEATURE_UPDATED',
        payload: {
          role: data.role,
          featureKey: data.featureKey,
          before,
          after,
        },
      });

      invalidateFeatureCache();
      return NextResponse.json({ success: true, updated: true });
    }

    if (data.action === 'set_user_override') {
      const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

      const [existing] = await db
        .select()
        .from(userFeatureOverrides)
        .where(
          and(
            eq(userFeatureOverrides.userId, data.userId),
            eq(userFeatureOverrides.featureKey, data.featureKey)
          )
        )
        .limit(1);

      const before = existing
        ? {
            enabled: existing.enabled,
            dailyLimit: existing.dailyLimit,
            expiresAt: existing.expiresAt,
            reason: existing.reason,
          }
        : null;

      const after = {
        enabled: data.enabled,
        dailyLimit: data.dailyLimit ?? null,
        expiresAt: expiresAt?.toISOString() || null,
        reason: data.reason,
      };

      if (existing) {
        await db
          .update(userFeatureOverrides)
          .set({
            enabled: data.enabled,
            dailyLimit: data.dailyLimit ?? null,
            expiresAt,
            reason: data.reason,
            createdBy: auth.user.id,
          })
          .where(eq(userFeatureOverrides.id, existing.id));
      } else {
        await db.insert(userFeatureOverrides).values({
          userId: data.userId,
          featureKey: data.featureKey,
          enabled: data.enabled,
          dailyLimit: data.dailyLimit ?? null,
          expiresAt,
          reason: data.reason,
          createdBy: auth.user.id,
        });
      }

      await recordAuditLog({
        userId: auth.user.id,
        event: 'USER_FEATURE_OVERRIDE_SET',
        payload: {
          targetUserId: data.userId,
          featureKey: data.featureKey,
          before,
          after,
        },
      });

      invalidateFeatureCache(data.userId);
      return NextResponse.json({ success: true, overrideSet: true });
    }

    if (data.action === 'remove_user_override') {
      const [existing] = await db
        .select()
        .from(userFeatureOverrides)
        .where(eq(userFeatureOverrides.id, data.overrideId))
        .limit(1);

      if (existing) {
        await db
          .delete(userFeatureOverrides)
          .where(eq(userFeatureOverrides.id, data.overrideId));

        await recordAuditLog({
          userId: auth.user.id,
          event: 'USER_FEATURE_OVERRIDE_REMOVED',
          payload: {
            overrideId: data.overrideId,
            targetUserId: existing.userId,
            featureKey: existing.featureKey,
            removedOverride: {
              enabled: existing.enabled,
              reason: existing.reason,
            },
          },
        });

        invalidateFeatureCache(existing.userId);
      }

      return NextResponse.json({ success: true, removed: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[admin/access] Action failed:', error);
    return NextResponse.json({ error: 'Failed to process access action' }, { status: 500 });
  }
}
