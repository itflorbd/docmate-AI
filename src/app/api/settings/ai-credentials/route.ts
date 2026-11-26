import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { getStoredAiCredentials, saveAiCredentials } from '@/lib/ai-credentials';
import { recordAuditLog } from '@/lib/audit';

const saveCredentialsSchema = z.object({
  provider: z.enum(['openai', 'gemini', 'anthropic', 'custom']),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  baseUrl: z.string().optional(),
  organizationId: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only super_admins can view AI credentials
  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Admin privileges required to view AI credentials' }, { status: 403 });
  }

  try {
    const config = await getStoredAiCredentials();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to get AI credentials:', error);
    return NextResponse.json({ error: 'Failed to retrieve AI credentials' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only super_admins can alter AI credentials
  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Admin privileges required to update AI credentials' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = saveCredentialsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid configuration payload', details: parsed.error.issues }, { status: 400 });
    }

    await saveAiCredentials(parsed.data, user.id);

    // Audit log
    await recordAuditLog({
      userId: user.id,
      event: 'update_ai_credentials',
      payload: {
        provider: parsed.data.provider,
        model: parsed.data.model,
        hasCustomBaseUrl: Boolean(parsed.data.baseUrl),
        hasApiKeySupplied: Boolean(parsed.data.apiKey),
        userRole: user.role,
      },
    }).catch(() => {});

    const updated = await getStoredAiCredentials();
    return NextResponse.json({ success: true, ...updated });
  } catch (error) {
    console.error('Failed to save AI credentials:', error);
    return NextResponse.json({ error: 'Failed to save AI credentials' }, { status: 500 });
  }
}
