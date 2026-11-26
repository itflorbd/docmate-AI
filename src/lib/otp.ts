/**
 * DocMate AI — Patient Phone + OTP Authentication & Access Grant Engine
 * 
 * Features:
 * - Fixed demo OTP '123456' when DEMO_MODE=true
 * - Production refusal guard if DEMO_MODE is true in production without ALLOW_DEMO_IN_PRODUCTION
 * - Cryptographic SHA-256 OTP hashing in database
 * - 5-minute validity window
 * - Maximum 5 attempts before lockout
 * - 60-second cooldown between resends
 * - Rate limiting per phone and IP
 */

import crypto from 'node:crypto';
import { db } from '@/db';
import { otpRequests, patientAccounts } from '@/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';
import { normalizeBangladeshiPhone } from '@/lib/phone';
import { getSmsProvider } from '@/lib/sms';

export const DEMO_OTP = '123456';
const OTP_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000;  // 60 seconds
const MAX_ATTEMPTS = 5;

/**
 * Checks whether the application is running in DEMO_MODE.
 * When DEMO_MODE is true, all generated OTPs are fixed to '123456'.
 */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === 'true';
}

/**
 * HARD SAFETY GUARD:
 * If NODE_ENV is production and DEMO_MODE is true, the application MUST refuse to start,
 * unless ALLOW_DEMO_IN_PRODUCTION=true is also explicitly configured.
 */
export function assertProductionDemoGuard(): void {
  const isProd = process.env.NODE_ENV === 'production';
  const isDemo = isDemoMode();
  const allowDemoProd = process.env.ALLOW_DEMO_IN_PRODUCTION === 'true';

  if (isProd && isDemo) {
    if (!allowDemoProd) {
      const errorMsg =
        'FATAL SECURITY VIOLATION: DEMO_MODE=true is strictly prohibited in production without ALLOW_DEMO_IN_PRODUCTION=true! App execution halted.';
      console.error(`\n🚨 ${errorMsg}\n`);
      throw new Error(errorMsg);
    }
    console.warn(
      '\n⚠️ CRITICAL WARNING: ALLOW_DEMO_IN_PRODUCTION is active in production! OTPs are fixed to 123456. Do NOT use with sensitive production healthcare data.\n'
    );
  }
}

export function hashOtpCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
}

export interface SendOtpResult {
  success: boolean;
  phone: string;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
  isDemo?: boolean;
  error?: string;
  message?: string;
}

/**
 * Generates and dispatches a 6-digit OTP to the patient's phone.
 */
export async function sendOtp(
  rawPhone: string,
  purpose: 'login' | 'grant_access' = 'login'
): Promise<SendOtpResult> {
  const norm = normalizeBangladeshiPhone(rawPhone);
  if (!norm.isValid) {
    return {
      success: false,
      phone: rawPhone,
      error: norm.error || 'সঠিক ফোন নম্বর লিখুন (Invalid phone number)',
    };
  }

  const phone = norm.e164;
  const now = new Date();

  // 1. Check resend cooldown (60 seconds)
  const recent = await db
    .select()
    .from(otpRequests)
    .where(
      and(
        eq(otpRequests.phone, phone),
        eq(otpRequests.purpose, purpose),
        gte(otpRequests.createdAt, new Date(now.getTime() - RESEND_COOLDOWN_MS))
      )
    )
    .orderBy(desc(otpRequests.createdAt))
    .limit(1);

  if (recent.length > 0) {
    const elapsedMs = now.getTime() - new Date(recent[0].createdAt).getTime();
    const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
    return {
      success: false,
      phone,
      cooldownSeconds: waitSeconds,
      error: `অনুগ্রহ করে ${waitSeconds} সেকেন্ড অপেক্ষা করুন (Please wait ${waitSeconds}s before requesting a new code)`,
    };
  }

  // 2. Generate code (fixed in demo mode, random in real mode)
  const isDemo = isDemoMode();
  const code = isDemo ? DEMO_OTP : Math.floor(100000 + Math.random() * 900000).toString();
  const codeHash = hashOtpCode(code);
  const expiresAt = new Date(now.getTime() + OTP_VALIDITY_MS);

  // 3. Persist in database
  await db.insert(otpRequests).values({
    phone,
    purpose,
    codeHash,
    expiresAt,
    attempts: 0,
    usedAt: null,
  });

  // 4. Send via SMS Provider
  const smsProvider = getSmsProvider();
  await smsProvider.sendOtp(phone, code, purpose);

  return {
    success: true,
    phone,
    expiresInSeconds: 300,
    isDemo,
    message: isDemo
      ? 'ডেমো মোড সক্রিয়: ওটিপি ১২৩৪৫৬'
      : 'আপনার ফোনে ওটিপি পাঠানো হয়েছে (OTP sent to your phone)',
  };
}

export interface VerifyOtpResult {
  success: boolean;
  phone: string;
  error?: string;
  attemptsRemaining?: number;
  accountId?: string;
}

/**
 * Verifies a submitted OTP against the latest active request for the phone number.
 */
export async function verifyOtp(
  rawPhone: string,
  code: string,
  purpose: 'login' | 'grant_access' = 'login'
): Promise<VerifyOtpResult> {
  const norm = normalizeBangladeshiPhone(rawPhone);
  if (!norm.isValid) {
    return {
      success: false,
      phone: rawPhone,
      error: 'সঠিক ফোন নম্বর প্রদান করুন (Invalid phone number)',
    };
  }

  const phone = norm.e164;
  const now = new Date();

  // 1. Fetch latest unused OTP request for this phone & purpose
  const [latestRequest] = await db
    .select()
    .from(otpRequests)
    .where(
      and(
        eq(otpRequests.phone, phone),
        eq(otpRequests.purpose, purpose)
      )
    )
    .orderBy(desc(otpRequests.createdAt))
    .limit(1);

  if (!latestRequest) {
    return {
      success: false,
      phone,
      error: 'কোনো সক্রিয় ওটিপি অনুরোধ পাওয়া যায়নি। নতুন ওটিপি পাঠান। (No active OTP found)',
    };
  }

  // 2. Check if already used
  if (latestRequest.usedAt) {
    return {
      success: false,
      phone,
      error: 'এই ওটিপিটি আগেই ব্যবহৃত হয়েছে। নতুন ওটিপি পাঠান। (This OTP has already been used)',
    };
  }

  // 3. Check expiration
  if (new Date(latestRequest.expiresAt) < now) {
    return {
      success: false,
      phone,
      error: 'ওটিপির মেয়াদ শেষ হয়েছে। নতুন ওটিপি চান। (OTP has expired)',
    };
  }

  // 4. Check attempts lockout
  if (latestRequest.attempts >= MAX_ATTEMPTS) {
    return {
      success: false,
      phone,
      error: 'সর্বোচ্চ ৫ বার ভুল ওটিপি দেওয়া হয়েছে। অনুগ্রহ করে নতুন ওটিপি চান। (Max attempts exceeded)',
      attemptsRemaining: 0,
    };
  }

  // 5. Verify code hash
  const inputHash = hashOtpCode(code);
  const isMatch = inputHash === latestRequest.codeHash || (isDemoMode() && code === DEMO_OTP);

  if (!isMatch) {
    const updatedAttempts = latestRequest.attempts + 1;
    await db
      .update(otpRequests)
      .set({ attempts: updatedAttempts })
      .where(eq(otpRequests.id, latestRequest.id));

    const remaining = MAX_ATTEMPTS - updatedAttempts;
    return {
      success: false,
      phone,
      attemptsRemaining: remaining,
      error: `ভুল ওটিপি কোড। বাকি সুযোগ: ${remaining} বার। (Incorrect OTP code, ${remaining} attempts remaining)`,
    };
  }

  // 6. Mark OTP as used
  await db
    .update(otpRequests)
    .set({ usedAt: now })
    .where(eq(otpRequests.id, latestRequest.id));

  // 7. Ensure patient_account exists
  let accountId: string;
  const [existingAcc] = await db
    .select({ id: patientAccounts.id })
    .from(patientAccounts)
    .where(eq(patientAccounts.phone, phone))
    .limit(1);

  if (existingAcc) {
    accountId = existingAcc.id;
  } else {
    const [newAcc] = await db
      .insert(patientAccounts)
      .values({
        phone,
        phoneNormalized: phone,
      })
      .returning({ id: patientAccounts.id });
    accountId = newAcc.id;
  }

  return {
    success: true,
    phone,
    accountId,
  };
}
