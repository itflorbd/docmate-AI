import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  patientProfiles,
  profileHealthSummary,
  patientSchedules,
  prescriptions,
  prescriptionItems,
  patientReports,
  accessGrants,
  accessLogs,
  medicineIntakeLogs,
  users,
} from '@/db/schema';
import { eq, and, desc, gte, lt } from 'drizzle-orm';
import { requirePatientScope } from '@/lib/patient-scope';
import { decryptPatientPii } from '@/lib/encryption';

export async function GET(req: Request) {
  try {
    // Only the signed-in patient's own account; never another patient's.
    const scope = await requirePatientScope();
    if (scope instanceof NextResponse) return scope;
    const { account } = scope;

    // Fetch all profiles for this account
    const rawProfiles = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.accountId, account.id))
      .orderBy(patientProfiles.createdAt);

    if (rawProfiles.length === 0) {
      return NextResponse.json({
        account: { id: account.id, phone: account.phone },
        profiles: [],
        activeProfile: null,
      });
    }

    // Resolve requested or default profile
    const url = new URL(req.url);
    const requestedProfileId = url.searchParams.get('profileId');
    const activeProfileRaw =
      rawProfiles.find((p) => p.id === requestedProfileId) || rawProfiles[0];

    // Decrypt names
    const profiles = rawProfiles.map((p) => ({
      id: p.id,
      relation: p.relation,
      name: p.name || (p.nameEncrypted ? decryptPatientPii(p.nameEncrypted) : 'Patient'),
      age: p.age,
      gender: p.gender || p.sex || 'male',
      bloodGroup: p.bloodGroup,
      claimed: p.claimed,
      createdAt: p.createdAt.toISOString(),
    }));

    const activeProfile = {
      id: activeProfileRaw.id,
      relation: activeProfileRaw.relation,
      name: activeProfileRaw.name || (activeProfileRaw.nameEncrypted ? decryptPatientPii(activeProfileRaw.nameEncrypted) : 'Patient'),
      age: activeProfileRaw.age,
      gender: activeProfileRaw.gender || activeProfileRaw.sex || 'male',
      bloodGroup: activeProfileRaw.bloodGroup,
      claimed: activeProfileRaw.claimed,
      createdAt: activeProfileRaw.createdAt.toISOString(),
    };

    // 1. Fetch latest Health Summary for active profile
    const [healthSummaryRaw] = await db
      .select()
      .from(profileHealthSummary)
      .where(eq(profileHealthSummary.profileId, activeProfile.id))
      .orderBy(desc(profileHealthSummary.version))
      .limit(1);

    const healthSummary = healthSummaryRaw
      ? {
          allergies: (healthSummaryRaw.allergies as string[]) || [],
          chronicConditions: (healthSummaryRaw.chronicConditions as string[]) || [],
          currentMedicines: (healthSummaryRaw.currentMedicines as Array<{ brand: string; generic: string; dose?: string }>) || [],
          bloodGroup: healthSummaryRaw.bloodGroup || activeProfile.bloodGroup,
          version: healthSummaryRaw.version,
          updatedAt: healthSummaryRaw.updatedAt.toISOString(),
        }
      : null;

    // 2. Fetch today's medicine schedule & intake logs
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    // Get today's intake logs for active profile
    const todayIntakes = await db
      .select()
      .from(medicineIntakeLogs)
      .where(
        and(
          eq(medicineIntakeLogs.profileId, activeProfile.id),
          gte(medicineIntakeLogs.takenAt, startOfToday),
          lt(medicineIntakeLogs.takenAt, endOfToday)
        )
      );

    // Get custom patientSchedules if any
    const customSchedules = await db
      .select()
      .from(patientSchedules)
      .where(eq(patientSchedules.profileId, activeProfile.id))
      .orderBy(patientSchedules.createdAt);

    // Also parse active prescriptions items
    const activePrescriptions = await db
      .select({
        id: prescriptions.id,
        rxNumber: prescriptions.rxNumber,
        status: prescriptions.status,
      })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.profileId, activeProfile.id),
          eq(prescriptions.status, 'finalized')
        )
      );

    const schedulesList: Array<{
      id: string;
      prescriptionItemId?: string;
      medicineName: string;
      dosage: string;
      slot: 'morning' | 'noon' | 'night';
      mealRelation: string;
      takenToday: boolean;
      lastTakenAt: string | null;
      instructions: string | null;
    }> = [];

    // Add items from custom schedules
    for (const cs of customSchedules) {
      const takenLog = todayIntakes.find(
        (ti) => ti.slot === cs.slot || ti.prescriptionItemId === cs.id
      );
      schedulesList.push({
        id: cs.id,
        medicineName: cs.medicineName,
        dosage: cs.dosage,
        slot: cs.slot as 'morning' | 'noon' | 'night',
        mealRelation: cs.mealRelation,
        takenToday: Boolean(cs.takenToday || takenLog),
        lastTakenAt: cs.lastTakenAt?.toISOString() || takenLog?.takenAt.toISOString() || null,
        instructions: cs.instructions,
      });
    }

    // Add items from active finalized prescriptions
    for (const rx of activePrescriptions) {
      const items = await db
        .select()
        .from(prescriptionItems)
        .where(eq(prescriptionItems.prescriptionId, rx.id));

      for (const item of items) {
        const sched = item.dosingSchedule; // e.g. "1+0+1" or "1+1+1"
        const parts = sched.split('+').map((s) => s.trim());
        const morningDose = parts[0] && parts[0] !== '0';
        const noonDose = parts[1] && parts[1] !== '0';
        const nightDose = parts[2] && parts[2] !== '0';

        if (morningDose) {
          const taken = todayIntakes.some(
            (ti) => ti.prescriptionItemId === item.id && ti.slot === 'morning'
          );
          schedulesList.push({
            id: `rx-${item.id}-morning`,
            prescriptionItemId: item.id,
            medicineName: item.brandName,
            dosage: `${item.strength} (${parts[0]} dose)`,
            slot: 'morning',
            mealRelation: item.mealTiming || 'খাবারের পর',
            takenToday: taken,
            lastTakenAt: null,
            instructions: item.instructions,
          });
        }
        if (noonDose) {
          const taken = todayIntakes.some(
            (ti) => ti.prescriptionItemId === item.id && ti.slot === 'noon'
          );
          schedulesList.push({
            id: `rx-${item.id}-noon`,
            prescriptionItemId: item.id,
            medicineName: item.brandName,
            dosage: `${item.strength} (${parts[1]} dose)`,
            slot: 'noon',
            mealRelation: item.mealTiming || 'খাবারের পর',
            takenToday: taken,
            lastTakenAt: null,
            instructions: item.instructions,
          });
        }
        if (nightDose) {
          const taken = todayIntakes.some(
            (ti) => ti.prescriptionItemId === item.id && ti.slot === 'night'
          );
          schedulesList.push({
            id: `rx-${item.id}-night`,
            prescriptionItemId: item.id,
            medicineName: item.brandName,
            dosage: `${item.strength} (${parts[2]} dose)`,
            slot: 'night',
            mealRelation: item.mealTiming || 'খাবারের পর',
            takenToday: taken,
            lastTakenAt: null,
            instructions: item.instructions,
          });
        }
      }
    }

    // 3. Fetch Prescriptions for active profile
    const rawPrescriptions = await db
      .select({
        id: prescriptions.id,
        rxNumber: prescriptions.rxNumber,
        diagnosis: prescriptions.diagnosis,
        investigations: prescriptions.investigations,
        generalAdvice: prescriptions.generalAdvice,
        followUpText: prescriptions.followUpText,
        status: prescriptions.status,
        qrHash: prescriptions.qrHash,
        finalizedAt: prescriptions.finalizedAt,
        doctorName: users.name,
        doctorBmdc: users.bmdcNumber,
      })
      .from(prescriptions)
      .leftJoin(users, eq(prescriptions.doctorId, users.id))
      .where(eq(prescriptions.profileId, activeProfile.id))
      .orderBy(desc(prescriptions.createdAt));

    const prescriptionsWithItems = await Promise.all(
      rawPrescriptions.map(async (rx) => {
        const items = await db
          .select()
          .from(prescriptionItems)
          .where(eq(prescriptionItems.prescriptionId, rx.id));
        return {
          id: rx.id,
          rxNumber: rx.rxNumber,
          diagnosis: rx.diagnosis,
          investigations: (rx.investigations as string[]) || [],
          generalAdvice: rx.generalAdvice,
          followUpText: rx.followUpText,
          status: rx.status,
          qrHash: rx.qrHash,
          finalizedAt: rx.finalizedAt?.toISOString() || null,
          doctorName: rx.doctorName || 'DocMate Specialist',
          doctorBmdc: rx.doctorBmdc || 'BMDC-Registered',
          items: items.map((it) => ({
            id: it.id,
            brandName: it.brandName,
            genericName: it.genericName,
            strength: it.strength,
            form: it.form,
            dosingSchedule: it.dosingSchedule,
            mealTiming: it.mealTiming,
            durationText: it.durationText,
            instructions: it.instructions,
          })),
        };
      })
    );

    // 4. Fetch Patient Reports for active profile
    const reports = await db
      .select({
        id: patientReports.id,
        title: patientReports.title,
        reportType: patientReports.reportType,
        fileUrl: patientReports.fileUrl,
        fileName: patientReports.fileName,
        notes: patientReports.notes,
        isShared: patientReports.isShared,
        uploadedAt: patientReports.uploadedAt,
      })
      .from(patientReports)
      .where(eq(patientReports.profileId, activeProfile.id))
      .orderBy(desc(patientReports.uploadedAt));

    // 5. Fetch Access Grants for active profile
    const rawGrants = await db
      .select({
        id: accessGrants.id,
        doctorId: accessGrants.doctorId,
        scope: accessGrants.scope,
        status: accessGrants.status,
        grantedVia: accessGrants.grantedVia,
        expiresAt: accessGrants.expiresAt,
        createdAt: accessGrants.createdAt,
        revokedAt: accessGrants.revokedAt,
        doctorName: users.name,
        doctorBmdc: users.bmdcNumber,
      })
      .from(accessGrants)
      .leftJoin(users, eq(accessGrants.doctorId, users.id))
      .where(eq(accessGrants.profileId, activeProfile.id))
      .orderBy(desc(accessGrants.createdAt));

    const grants = rawGrants.map((g) => {
      let isExpired = false;
      let daysRemaining: number | null = null;
      if (g.expiresAt) {
        if (g.expiresAt <= now) {
          isExpired = true;
        } else {
          daysRemaining = Math.max(
            0,
            Math.ceil((g.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          );
        }
      }
      return {
        id: g.id,
        doctorId: g.doctorId,
        doctorName: g.doctorName || 'Dr. Verified Specialist',
        doctorBmdc: g.doctorBmdc || 'BMDC-A-00000',
        scope: g.scope,
        status: isExpired && g.status === 'active' ? 'expired' : g.status,
        grantedVia: g.grantedVia,
        expiresAt: g.expiresAt?.toISOString() || null,
        daysRemaining,
        createdAt: g.createdAt.toISOString(),
        revokedAt: g.revokedAt?.toISOString() || null,
      };
    });

    // 6. Fetch Access Logs (Who viewed my data) for active profile
    const rawLogs = await db
      .select({
        id: accessLogs.id,
        action: accessLogs.action,
        recordType: accessLogs.recordType,
        reason: accessLogs.reason,
        createdAt: accessLogs.createdAt,
        accessorName: users.name,
        accessorRole: accessLogs.userRole,
      })
      .from(accessLogs)
      .leftJoin(users, eq(accessLogs.userId, users.id))
      .where(eq(accessLogs.profileId, activeProfile.id))
      .orderBy(desc(accessLogs.createdAt))
      .limit(50);

    const logs = rawLogs.map((l) => ({
      id: l.id,
      action: l.action,
      recordType: l.recordType,
      reason: l.reason,
      createdAt: l.createdAt.toISOString(),
      accessorName: l.accessorName || 'Clinical Doctor',
      accessorRole: l.accessorRole || 'doctor',
    }));

    return NextResponse.json({
      account: {
        id: account.id,
        phone: account.phone,
      },
      profiles,
      activeProfile,
      healthSummary,
      schedules: schedulesList,
      prescriptions: prescriptionsWithItems,
      reports: reports.map((r) => ({
        ...r,
        uploadedAt: r.uploadedAt.toISOString(),
      })),
      grants,
      accessLogs: logs,
    });
  } catch (error) {
    console.error('Patient portal fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
