import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendOtp } from '@/lib/otp';

const schema = z.object({
  phone: z.string().min(8).max(30),
  purpose: z.enum(['login', 'grant_access']).default('login'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'সঠিক ফোন নম্বর প্রদান করুন (Invalid phone format)' },
        { status: 400 }
      );
    }

    const { phone, purpose } = parsed.data;
    const result = await sendOtp(phone, purpose);

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          cooldownSeconds: result.cooldownSeconds,
        },
        { status: 429 }
      );
    }

    return NextResponse.json({
      success: true,
      phone: result.phone,
      expiresInSeconds: result.expiresInSeconds,
      isDemo: result.isDemo,
      message: result.message,
    });
  } catch (error) {
    console.error('Error in /api/auth/otp/send:', error);
    return NextResponse.json(
      { error: 'ওটিপি পাঠাতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।' },
      { status: 500 }
    );
  }
}
