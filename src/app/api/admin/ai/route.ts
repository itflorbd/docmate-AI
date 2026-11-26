import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { requireSuperAdmin, invalidateFeatureCache } from '@/lib/permissions';
import { recordAuditLog } from '@/lib/audit';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const DEFAULT_PROMPT = `You are DocMate AI, a clinical decision support assistant for licensed physicians in Bangladesh.
You have no outside knowledge. Answer strictly using only the provided library excerpts. If the excerpts do not contain the answer, declare insufficient evidence.
Every clinical claim must carry a citation with chunk_id and verbatim quote.
The physician makes all final clinical decisions.`;

const DEFAULT_PROMPT_VERSIONS = [
  {
    id: 'v1.0.0',
    name: 'Clinical Pilot Closed-Library Baseline',
    systemPrompt: DEFAULT_PROMPT,
    versionNumber: 1,
    createdAt: new Date().toISOString(),
    createdBy: 'system',
    isActive: true,
  },
];

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // 1. Prompt versions
    const [versionSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'ai:prompt_versions'))
      .limit(1);

    const versions = (versionSetting?.value as Array<Record<string, unknown>>) || DEFAULT_PROMPT_VERSIONS;

    // 2. Active version
    const [activeSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'ai:active_prompt_version'))
      .limit(1);

    const activeVersionId = (activeSetting?.value as { versionId?: string })?.versionId || 'v1.0.0';

    // 3. AI configuration (model, threshold)
    const [configSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'ai:config'))
      .limit(1);

    const config = (configSetting?.value as { model?: string; abstainThreshold?: number }) || {
      model: 'gpt-4o-mini',
      abstainThreshold: 0.70,
    };

    // 4. Kill switches
    const killswitchRows = await db
      .select()
      .from(systemSettings)
      .where(sql`${systemSettings.key} LIKE 'killswitch:%'`);

    const killswitches: Record<string, { disabled: boolean; reason?: string }> = {};
    for (const row of killswitchRows) {
      const featureKey = row.key.replace('killswitch:', '');
      killswitches[featureKey] = row.value as { disabled: boolean; reason?: string };
    }

    return NextResponse.json({
      versions,
      activeVersionId,
      config,
      killswitches,
    });
  } catch (error) {
    console.error('[admin/ai] Failed to fetch AI settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve AI settings' }, { status: 500 });
  }
}

const aiActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create_prompt_version'),
    name: z.string().min(3),
    systemPrompt: z.string().min(10),
  }),
  z.object({
    action: z.literal('activate_prompt_version'),
    versionId: z.string(),
  }),
  z.object({
    action: z.literal('update_ai_config'),
    model: z.string(),
    abstainThreshold: z.number().min(0.1).max(1.0),
  }),
  z.object({
    action: z.literal('toggle_killswitch'),
    featureKey: z.string(),
    disabled: z.boolean(),
    reason: z.string().optional(),
  }),
]);

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const parsed = aiActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 });
    }

    const data = parsed.data;

    if (data.action === 'create_prompt_version') {
      const [versionSetting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, 'ai:prompt_versions'))
        .limit(1);

      const versions = (versionSetting?.value as Array<Record<string, unknown>>) || [...DEFAULT_PROMPT_VERSIONS];
      const newVersionId = `v${versions.length + 1}.0.0`;

      const newVersion = {
        id: newVersionId,
        name: data.name,
        systemPrompt: data.systemPrompt,
        versionNumber: versions.length + 1,
        createdAt: new Date().toISOString(),
        createdBy: auth.user.email,
        isActive: false,
      };

      versions.unshift(newVersion);

      await db
        .insert(systemSettings)
        .values({
          key: 'ai:prompt_versions',
          value: versions,
          updatedBy: auth.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: versions, updatedBy: auth.user.id, updatedAt: new Date() },
        });

      await recordAuditLog({
        userId: auth.user.id,
        event: 'AI_PROMPT_VERSION_CREATED',
        payload: {
          versionId: newVersionId,
          name: data.name,
          createdBy: auth.user.email,
        },
      });

      return NextResponse.json({ success: true, version: newVersion });
    }

    if (data.action === 'activate_prompt_version') {
      await db
        .insert(systemSettings)
        .values({
          key: 'ai:active_prompt_version',
          value: { versionId: data.versionId },
          updatedBy: auth.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: { versionId: data.versionId }, updatedBy: auth.user.id, updatedAt: new Date() },
        });

      await recordAuditLog({
        userId: auth.user.id,
        event: 'AI_PROMPT_VERSION_ACTIVATED',
        payload: {
          activatedVersionId: data.versionId,
          activatedBy: auth.user.email,
        },
      });

      return NextResponse.json({ success: true, activeVersionId: data.versionId });
    }

    if (data.action === 'update_ai_config') {
      const newConfig = {
        model: data.model,
        abstainThreshold: data.abstainThreshold,
      };

      await db
        .insert(systemSettings)
        .values({
          key: 'ai:config',
          value: newConfig,
          updatedBy: auth.user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: { value: newConfig, updatedBy: auth.user.id, updatedAt: new Date() },
        });

      await recordAuditLog({
        userId: auth.user.id,
        event: 'AI_CONFIG_UPDATED',
        payload: {
          newConfig,
          updatedBy: auth.user.email,
        },
      });

      return NextResponse.json({ success: true, config: newConfig });
    }

    if (data.action === 'toggle_killswitch') {
      const settingKey = `killswitch:${data.featureKey}`;

      if (data.disabled) {
        await db
          .insert(systemSettings)
          .values({
            key: settingKey,
            value: { disabled: true, reason: data.reason || 'Admin killswitch engaged' },
            updatedBy: auth.user.id,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: {
              value: { disabled: true, reason: data.reason || 'Admin killswitch engaged' },
              updatedBy: auth.user.id,
              updatedAt: new Date(),
            },
          });
      } else {
        await db.delete(systemSettings).where(eq(systemSettings.key, settingKey));
      }

      await recordAuditLog({
        userId: auth.user.id,
        event: 'KILLSWITCH_TOGGLED',
        payload: {
          featureKey: data.featureKey,
          disabled: data.disabled,
          reason: data.reason,
          toggledBy: auth.user.email,
        },
      });

      invalidateFeatureCache();
      return NextResponse.json({ success: true, featureKey: data.featureKey, disabled: data.disabled });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[admin/ai] Action failed:', error);
    return NextResponse.json({ error: 'Failed to execute AI action' }, { status: 500 });
  }
}
