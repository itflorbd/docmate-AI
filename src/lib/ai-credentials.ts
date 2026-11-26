import { db } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

export function syncKeyToEnvFile(key: string, model?: string) {
  if (!key) return;
  process.env.OPENAI_API_KEY = key;
  if (model) process.env.OPENAI_CHAT_MODEL = model;

  try {
    const envLocalPath = path.join(process.cwd(), '.env.local');
    let content = fs.existsSync(envLocalPath) ? fs.readFileSync(envLocalPath, 'utf8') : '';
    if (content.includes('OPENAI_API_KEY=')) {
      content = content.replace(/OPENAI_API_KEY=.*/g, `OPENAI_API_KEY=${key}`);
    } else {
      content += `\nOPENAI_API_KEY=${key}\n`;
    }
    if (model) {
      if (content.includes('OPENAI_CHAT_MODEL=')) {
        content = content.replace(/OPENAI_CHAT_MODEL=.*/g, `OPENAI_CHAT_MODEL=${model}`);
      } else {
        content += `OPENAI_CHAT_MODEL=${model}\n`;
      }
    }
    fs.writeFileSync(envLocalPath, content, 'utf8');
  } catch (err) {
    console.error('[syncKeyToEnvFile] Failed to sync .env.local:', err);
  }
}

export interface AiCredentialsConfig {
  provider: 'openai' | 'gemini' | 'anthropic' | 'custom';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  organizationId?: string;
  lastTestedAt?: string | null;
  testStatus?: 'success' | 'failed' | 'untested';
}

const SETTINGS_KEY = 'ai:credentials';

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  const prefix = key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

export async function getStoredAiCredentials(): Promise<{
  provider: string;
  model: string;
  baseUrl: string;
  organizationId: string;
  hasKey: boolean;
  maskedKey: string;
  lastTestedAt: string | null;
  testStatus: 'success' | 'failed' | 'untested';
}> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY))
      .limit(1);

    const data = row?.value as AiCredentialsConfig | undefined;

    if (data && data.apiKey) {
      return {
        provider: data.provider || 'openai',
        model: data.model || 'gpt-4o-mini',
        baseUrl: data.baseUrl || '',
        organizationId: data.organizationId || '',
        hasKey: true,
        maskedKey: maskApiKey(data.apiKey),
        lastTestedAt: data.lastTestedAt || null,
        testStatus: data.testStatus || 'untested',
      };
    }
  } catch (err) {
    console.error('[getStoredAiCredentials] DB lookup failed:', err);
  }

  // Fallback to environment variable if set
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) {
    return {
      provider: 'openai',
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL || '',
      organizationId: '',
      hasKey: true,
      maskedKey: maskApiKey(envKey),
      lastTestedAt: null,
      testStatus: 'untested',
    };
  }

  return {
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: '',
    organizationId: '',
    hasKey: false,
    maskedKey: '',
    lastTestedAt: null,
    testStatus: 'untested',
  };
}

export async function saveAiCredentials(
  config: {
    provider: 'openai' | 'gemini' | 'anthropic' | 'custom';
    apiKey?: string;
    model: string;
    baseUrl?: string;
    organizationId?: string;
  },
  userId?: string
): Promise<void> {
  // Read existing to preserve existing API key if not supplied
  const [existing] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, SETTINGS_KEY))
    .limit(1);

  const existingConfig = existing?.value as AiCredentialsConfig | undefined;
  const finalApiKey = config.apiKey ? config.apiKey.trim() : (existingConfig?.apiKey || process.env.OPENAI_API_KEY || '');

  const payload: AiCredentialsConfig = {
    provider: config.provider,
    apiKey: finalApiKey,
    model: config.model.trim() || 'gpt-4o-mini',
    baseUrl: config.baseUrl ? config.baseUrl.trim() : undefined,
    organizationId: config.organizationId ? config.organizationId.trim() : undefined,
    lastTestedAt: existingConfig?.lastTestedAt || null,
    testStatus: existingConfig?.testStatus || 'untested',
  };

  await db
    .insert(systemSettings)
    .values({
      key: SETTINGS_KEY,
      value: payload,
      updatedBy: userId || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: {
        value: payload,
        updatedBy: userId || null,
        updatedAt: new Date(),
      },
    });

  // Automatically sync to .env.local so environment variables match DB immediately
  syncKeyToEnvFile(finalApiKey, payload.model);
}

export async function testAiConnection(params: {
  provider: string;
  apiKey?: string;
  model: string;
  baseUrl?: string;
}): Promise<{ success: boolean; latencyMs: number; message: string; error?: string }> {
  const startTime = Date.now();

  let effectiveKey = params.apiKey ? params.apiKey.trim() : '';
  if (!effectiveKey) {
    // Read from DB or ENV
    const [existing] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY))
      .limit(1);
    const existingConfig = existing?.value as AiCredentialsConfig | undefined;
    effectiveKey = existingConfig?.apiKey || process.env.OPENAI_API_KEY || '';
  }

  if (!effectiveKey) {
    return {
      success: false,
      latencyMs: 0,
      message: 'API Key is missing',
      error: 'Please provide an API key before testing connection.',
    };
  }

  try {
    if (params.provider === 'openai' || params.provider === 'custom') {
      const client = new OpenAI({
        apiKey: effectiveKey,
        baseURL: params.baseUrl ? params.baseUrl.trim() : undefined,
      });

      // Quick models list verification
      await client.models.list();
      const latencyMs = Date.now() - startTime;

      // Update test status in DB if existing row
      await db
        .update(systemSettings)
        .set({
          value: sql`jsonb_set(jsonb_set(${systemSettings.value}, '{lastTestedAt}', to_jsonb(${new Date().toISOString()}::text)), '{testStatus}', '"success"')`,
          updatedAt: new Date(),
        })
        .where(eq(systemSettings.key, SETTINGS_KEY))
        .catch(() => {});

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to ${params.provider.toUpperCase()} (${params.model}). Latency: ${latencyMs}ms`,
      };
    }

    if (params.provider === 'gemini') {
      // Gemini verification ping
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${effectiveKey}`;
      const res = await fetch(url, { method: 'GET' });
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Gemini API returned status ${res.status}`);
      }

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to Google Gemini. Latency: ${latencyMs}ms`,
      };
    }

    if (params.provider === 'anthropic') {
      // Anthropic ping test
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': effectiveKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: params.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      const latencyMs = Date.now() - startTime;

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Anthropic API returned status ${res.status}`);
      }

      return {
        success: true,
        latencyMs,
        message: `Successfully connected to Anthropic Claude. Latency: ${latencyMs}ms`,
      };
    }

    return {
      success: true,
      latencyMs: Date.now() - startTime,
      message: `Configured provider ${params.provider} ready.`,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Update test status in DB to failed
    await db
      .update(systemSettings)
      .set({
        value: sql`jsonb_set(jsonb_set(${systemSettings.value}, '{lastTestedAt}', to_jsonb(${new Date().toISOString()}::text)), '{testStatus}', '"failed"')`,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.key, SETTINGS_KEY))
      .catch(() => {});

    return {
      success: false,
      latencyMs,
      message: 'Connection failed',
      error: errorMsg,
    };
  }
}

export async function getRawAiCredentials(): Promise<AiCredentialsConfig | null> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, SETTINGS_KEY))
      .limit(1);

    const data = row?.value as AiCredentialsConfig | undefined;
    if (data && data.apiKey) {
      if (!process.env.OPENAI_API_KEY) {
        process.env.OPENAI_API_KEY = data.apiKey;
      }
      return data;
    }
  } catch (err) {
    console.error('[getRawAiCredentials] DB lookup failed:', err);
  }

  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) {
    return {
      provider: 'openai',
      apiKey: envKey,
      model: process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL || undefined,
      testStatus: 'untested',
    };
  }

  return null;
}
