import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/otp';
import { db } from '@/db';
import { users, patientProfiles, patientAccounts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { setAuthCookie } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

const schema = z.object({
  phone: z.string().min(8).max(30),
  code: z.string().length(6),
  purpose: z.enum(['login', 'grant_access']).default('login'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '৬ সংখ্যার সঠিক ওটিপি দিন (Invalid 6-digit OTP code)' },
        { status: 400 }
      );
    }

    const { phone, code, purpose } = parsed.data;
    const verifyResult = await verifyOtp(phone, code, purpose);

    if (!verifyResult.success) {
      return NextResponse.json(
        {
          error: verifyResult.error,
          attemptsRemaining: verifyResult.attemptsRemaining,
        },
        { status: 400 }
      );
    }

    // If purpose is grant_access (e.g. Doctor requesting history consent in clinic),
    // we return success without logging in as patient
    if (purpose === 'grant_access') {
      return NextResponse.json({
        success: true,
        message: 'ওটিপি যাচাই সফল হয়েছে (OTP verified successfully)',
      });
    }

    // Purpose is login: Ensure User record exists for patient authentication
    const accountPhone = verifyResult.phone;
    const normalizedDigits = accountPhone.replace(/[^\d]/g, '');
    const patientEmail = `${normalizedDigits}@patient.docmate.ai`;

    let [patientUser] = await db
      .select()
      .from(users)
      .where(eq(users.phone, accountPhone))
      .limit(1);

    if (!patientUser) {
      // Check by placeholder email
      const [byEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, patientEmail))
        .limit(1);

      if (byEmail) {
        patientUser = byEmail;
      } else {
        // Create new patient user record
        const [created] = await db
          .insert(users)
          .values({
            email: patientEmail,
            phone: accountPhone,
            role: 'patient',
            name: 'Patient Account',
            passwordHash: 'otp_authenticated_account',
            status: 'active',
          })
          .returning();
        patientUser = created;
      }
    }

    // Set authentication session cookie
    await setAuthCookie({
      id: patientUser.id,
      email: patientUser.email,
      role: 'patient',
      name: patientUser.name,
    });

    // Fetch account's profiles
    const [account] = await db
      .select({ id: patientAccounts.id })
      .from(patientAccounts)
      .where(eq(patientAccounts.phone, accountPhone))
      .limit(1);

    let profiles: Array<{
      id: string;
      name: string;
      relation: string;
      age: number;
      gender: string;
      bloodGroup: string | null;
      claimed: boolean;
    }> = [];

    if (account) {
      const dbProfiles = await db
        .select({
          id: patientProfiles.id,
          name: patientProfiles.name,
          relation: patientProfiles.relation,
          age: patientProfiles.age,
          gender: patientProfiles.gender,
          bloodGroup: patientProfiles.bloodGroup,
          claimed: patientProfiles.claimed,
        })
        .from(patientProfiles)
        .where(eq(patientProfiles.accountId, account.id));

      profiles = dbProfiles;

      // Mark profiles as claimed
      await db
        .update(patientProfiles)
        .set({ claimed: true })
        .where(eq(patientProfiles.accountId, account.id));
    }

    await recordAuditLog({
      userId: patientUser.id,
      event: 'PATIENT_OTP_LOGIN_SUCCESS',
      payload: {
        phone: accountPhone,
        profileCount: profiles.length,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        id: patientUser.id,
        phone: accountPhone,
        name: patientUser.name,
        role: 'patient',
      },
      accountId: account?.id || null,
      profiles,
      redirectUrl: '/portal',
    });
  } catch (error) {
    console.error('Error in /api/auth/otp/verify:', error);
    return NextResponse.json(
      { error: 'ওটিপি যাচাই করতে ব্যর্থ হয়েছে। পরে চেষ্টা করুন।' },
      { status: 500 }
    );
  }
}
