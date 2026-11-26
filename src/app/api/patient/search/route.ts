import { isDemoMode } from '@/lib/demo-mode';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  patientAccounts,
  patientProfiles,
  accessGrants,
  accessLogs,
  prescriptions,
  encounters,
  patients,
} from '@/db/schema';
import { eq, and, gt, or, count, gte, ne, isNull } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { canUse } from '@/lib/permissions';
import { normalizeBangladeshiPhone, maskPhoneNumber } from '@/lib/phone';
import { decryptPatientPii } from '@/lib/encryption';


function maskProfileName(fullName: string): string {
  if (!fullName) return 'Patient';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    const first = parts[0];
    return first.length > 2 ? `${first.slice(0, 2)}***` : `${first}*`;
  }
  // Show first name + initial of second
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only doctors or super_admin can search patients
    if (user.role !== 'doctor' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
    }

    // Check capability
    const permission = await canUse(user, 'patients.manage');
    if (!permission.allowed && user.role !== 'super_admin') {
      return NextResponse.json({ error: `Access denied: ${permission.reason}` }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawPhone = searchParams.get('phone')?.trim() || '';

    const norm = normalizeBangladeshiPhone(rawPhone);
    if (!norm.isValid) {
      return NextResponse.json(
        { error: norm.error || 'সঠিক ফোন নম্বর প্রদান করুন (Invalid phone number)' },
        { status: 400 }
      );
    }

    // Anti-enumeration rate limit
    const isSyntheticTest =
      process.env.DOCMATE_QA_SYNTHETIC === '1' ||
      isDemoMode() ||
      process.env.NODE_ENV === 'test';
    const hourlyLimit = isSyntheticTest ? 1000 : 60;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [searchCountRow] = await db
      .select({ val: count() })
      .from(accessLogs)
      .where(
        and(
          eq(accessLogs.userId, user.id),
          eq(accessLogs.action, 'PHONE_SEARCH'),
          gte(accessLogs.createdAt, oneHourAgo)
        )
      );


    if (searchCountRow && searchCountRow.val >= hourlyLimit) {
      return NextResponse.json(
        {
          error:
            'অনুসন্ধান সীমা অতিক্রান্ত (Search rate limit exceeded)',
        },
        { status: 429 }
      );
    }

    // 1. Lookup patient_account by normalized E.164 phone or national local
    let [account] = await db
      .select({ id: patientAccounts.id, phone: patientAccounts.phone, phoneNormalized: patientAccounts.phoneNormalized })
      .from(patientAccounts)
      .where(
        or(
          eq(patientAccounts.phone, norm.e164),
          eq(patientAccounts.phoneNormalized, norm.e164),
          eq(patientAccounts.phone, norm.national),
          eq(patientAccounts.phoneNormalized, norm.national)
        )
      )
      .limit(1);

    let rawProfiles = account
      ? await db
          .select()
          .from(patientProfiles)
          .where(eq(patientProfiles.accountId, account.id))
      : [];

    // 2. Only if account is missing or has no profiles, scan clinical patients table (AES-encrypted phones)
    if (!account || rawProfiles.length === 0) {
      const allDbPatients = await db.select().from(patients);
      const matchingPatients = allDbPatients.filter((p) => {
        if (!p.phoneEncrypted) return false;
        try {
          const decryptedPhone = decryptPatientPii(p.phoneEncrypted);
          const pNorm = normalizeBangladeshiPhone(decryptedPhone);
          return (
            pNorm.e164 === norm.e164 ||
            decryptedPhone.replace(/\D/g, '') === norm.national ||
            decryptedPhone.trim() === rawPhone.trim()
          );
        } catch {
          return false;
        }
      });

      // 3. If account does not exist, but matching patient(s) exist in patients table: auto-create patient_account
      if (!account && matchingPatients.length > 0) {
        const [newAcc] = await db
          .insert(patientAccounts)
          .values({
            phone: norm.e164,
            phoneNormalized: norm.e164,
          })
          .returning();
        account = newAcc;
      }

      // 4. If account exists, ensure each matching patient from patients table has a profile in patientProfiles
      if (account && matchingPatients.length > 0) {
        const existingProfs = await db
          .select()
          .from(patientProfiles)
          .where(eq(patientProfiles.accountId, account.id));

        for (const mp of matchingPatients) {
          let plainName = '';
          try {
            plainName = mp.nameEncrypted ? decryptPatientPii(mp.nameEncrypted) : 'Patient';
          } catch {
            plainName = 'Patient';
          }

          const alreadyExists = existingProfs.some(
            (pr) => pr.name === plainName || (pr.name && pr.name.includes(plainName))
          );

          if (!alreadyExists) {
            const [newProf] = await db
              .insert(patientProfiles)
              .values({
                accountId: account.id,
                relation: 'self',
                name: plainName,
                nameEncrypted: mp.nameEncrypted,
                age: mp.age,
                gender: mp.gender,
                sex: mp.gender,
                bloodGroup: mp.bloodGroup || null,
                createdBy: mp.doctorId || user.id,
                claimed: false,
              })
              .returning();

            // Auto-grant access to the searching doctor
            await db
              .insert(accessGrants)
              .values({
                profileId: newProf.id,
                doctorId: user.id,
                scope: 'this_doctor_only',
                status: 'active',
                grantedVia: 'created_profile',
              })
              .catch(() => {});
          }
        }

        rawProfiles = await db
          .select()
          .from(patientProfiles)
          .where(eq(patientProfiles.accountId, account.id));
      }
    }

    if (!account) {
      return NextResponse.json({
        found: false,
        phone: norm.e164,
        phoneMasked: maskPhoneNumber(norm.e164),
        phoneLocal: norm.formattedLocal,
        profiles: [],
      });
    }

    if (rawProfiles.length === 0) {
      return NextResponse.json({
        found: false,
        phone: norm.e164,
        phoneMasked: maskPhoneNumber(norm.e164),
        phoneLocal: norm.formattedLocal,
        profiles: [],
      });
    }

    const now = new Date();

    const profilesWithGrants = await Promise.all(
      rawProfiles.map(async (prof) => {
        let plainName = prof.name;
        if (!plainName && prof.nameEncrypted) {
          try {
            plainName = decryptPatientPii(prof.nameEncrypted);
          } catch {
            plainName = 'Patient Profile';
          }
        }
        if (!plainName) {
          plainName = 'Patient';
        }

        // Check if current doctor has active grant
        const [activeGrant] = await db
          .select({
            id: accessGrants.id,
            scope: accessGrants.scope,
            status: accessGrants.status,
            expiresAt: accessGrants.expiresAt,
          })
          .from(accessGrants)
          .where(
            and(
              eq(accessGrants.profileId, prof.id),
              eq(accessGrants.doctorId, user.id),
              eq(accessGrants.status, 'active'),
              or(
                isNull(accessGrants.expiresAt),
                gt(accessGrants.expiresAt, now)
              )
            )
          )
          .limit(1);

        // Check if other doctors have authored records for this profile
        const [otherDocRx] = await db
          .select({ val: count() })
          .from(prescriptions)
          .where(
            and(
              eq(prescriptions.profileId, prof.id),
              ne(prescriptions.doctorId, user.id)
            )
          );

        const [otherDocEnc] = await db
          .select({ val: count() })
          .from(encounters)
          .where(
            and(
              eq(encounters.profileId, prof.id),
              ne(encounters.doctorId, user.id)
            )
          );

        const hasOtherDoctorRecords = (otherDocRx?.val || 0) > 0 || (otherDocEnc?.val || 0) > 0;
        const isAuthor = prof.createdBy === user.id;
        const hasAccess = Boolean(activeGrant) || isAuthor || user.role === 'super_admin';
        const grantScope = activeGrant ? activeGrant.scope : isAuthor ? 'this_doctor_only' : null;

        // Display full unmasked name if doctor has active grant, is author, or super admin
        const displayName = hasAccess ? plainName : maskProfileName(plainName);

        // Audit log search view
        await db.insert(accessLogs).values({
          userId: user.id,
          profileId: prof.id,
          userRole: user.role,
          action: 'PHONE_SEARCH',
          recordType: 'patient_profile',
          recordId: prof.id,
          reason: 'Doctor patient search by mobile phone',
        }).catch(() => {});

        return {
          id: prof.id,
          name: displayName,
          nameMasked: maskProfileName(plainName),
          relation: prof.relation,
          age: prof.age,
          gender: prof.gender || prof.sex || 'male',
          bloodGroup: prof.bloodGroup,
          hasOtherDoctorRecords,
          hasActiveGrant: hasAccess,
          grantScope,
          expiresAt: activeGrant?.expiresAt || null,
        };
      })
    );

    const seen = new Set<string>();
    const uniqueProfiles = profilesWithGrants.filter((p) => {
      const key = `${p.name.trim().toLowerCase()}_${p.relation}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      found: true,
      phone: norm.e164,
      phoneMasked: maskPhoneNumber(norm.e164),
      phoneLocal: norm.formattedLocal,
      profiles: uniqueProfiles,
    });
  } catch (error) {
    console.error('Error in /api/patient/search:', error);
    return NextResponse.json({ error: 'Failed to search patients' }, { status: 500 });
  }
}
