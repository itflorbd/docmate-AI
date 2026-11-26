import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { testAiConnection } from '@/lib/ai-credentials';

const testSchema = z.object({
  provider: z.string(),
  apiKey: z.string().optional(),
  model: z.string(),
  baseUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only super_admins can test AI connections
  if (user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden: Admin privileges required to test AI credentials' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = testSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid test payload' }, { status: 400 });
    }

    const result = await testAiConnection(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to test AI connection:', error);
    return NextResponse.json({
      success: false,
      latencyMs: 0,
      message: 'Connection test failed',
      error: error instanceof Error ? error.message : 'Unknown connection error',
    });
  }
}
