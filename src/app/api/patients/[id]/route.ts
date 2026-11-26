import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  patients,
  patientProfiles,
  patientAccounts,
  profileHealthSummary,
  accessGrants,
  encounters,
  prescriptions,
  prescriptionItems,
  patientReports,
  cases,
  users,
} from '@/db/schema';
import { desc, eq, and, or, gt, isNull, ne, count } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { assertPatientDataScope, canUse } from '@/lib/permissions';
import { decryptPatientPii } from '@/lib/encryption';
import { maskPhoneNumber } from '@/lib/phone';
import { recordAccessLog } from '@/lib/access-log';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: paramId } = await params;

    // Check if user has permission to manage or view patients
    const featureCheck = await canUse(user, 'patients.manage');
    if (!featureCheck.allowed && user.role !== 'patient' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 1. Try to find patientProfile first
    const [profile] = await db
      .select({
        id: patientProfiles.id,
        accountId: patientProfiles.accountId,
        relation: patientProfiles.relation,
        name: patientProfiles.name,
        nameEncrypted: patientProfiles.nameEncrypted,
        age: patientProfiles.age,
        gender: patientProfiles.gender,
        bloodGroup: patientProfiles.bloodGroup,
        createdBy: patientProfiles.createdBy,
        claimed: patientProfiles.claimed,
        createdAt: patientProfiles.createdAt,
      })
      .from(patientProfiles)
      .where(eq(patientProfiles.id, paramId))
      .limit(1);

    if (profile) {
      // It is a patient profile
      // Fetch account for phone
      const [account] = await db
        .select({ phone: patientAccounts.phone })
        .from(patientAccounts)
        .where(eq(patientAccounts.id, profile.accountId))
        .limit(1);

      const phoneRaw = account?.phone || '';
      const phoneDisplay = user.role === 'doctor' || user.role === 'patient' || user.role === 'super_admin'
        ? phoneRaw
        : maskPhoneNumber(phoneRaw);

      // Check active grant for doctor
      const now = new Date();
      let hasGrant = false;
      let grantScope: 'this_doctor_only' | 'full_history' = 'this_doctor_only';
      let grantExpiresAt: Date | null = null;
      let daysRemaining: number | null = null;

      if (user.role === 'doctor') {
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
              eq(accessGrants.profileId, profile.id),
              eq(accessGrants.doctorId, user.id),
              eq(accessGrants.status, 'active'),
              or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, now))
            )
          )
          .limit(1);

        if (activeGrant) {
          hasGrant = true;
          grantScope = activeGrant.scope as 'this_doctor_only' | 'full_history';
          grantExpiresAt = activeGrant.expiresAt;
          if (activeGrant.expiresAt) {
            daysRemaining = Math.max(
              0,
              Math.ceil((activeGrant.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            );
          }
        }
      } else if (user.role === 'patient' || user.role === 'super_admin') {
        hasGrant = true;
        grantScope = 'full_history';
      }

      // Check if other doctors have authored records
      let otherDoctorRecordsExist = false;
      if (user.role === 'doctor') {
        const [otherRx] = await db
          .select({ val: count() })
          .from(prescriptions)
          .where(
            and(
              eq(prescriptions.profileId, profile.id),
              ne(prescriptions.doctorId, user.id)
            )
          );
        const [otherCases] = await db
          .select({ val: count() })
          .from(cases)
          .where(
            and(
              eq(cases.profileId, profile.id),
              ne(cases.doctorId, user.id)
            )
          );
        if ((otherRx?.val ?? 0) > 0 || (otherCases?.val ?? 0) > 0) {
          otherDoctorRecordsExist = true;
        }
      }

      // Fetch latest Health Summary
      const [healthSummary] = await db
        .select()
        .from(profileHealthSummary)
        .where(eq(profileHealthSummary.profileId, profile.id))
        .orderBy(desc(profileHealthSummary.version))
        .limit(1);

      // Fetch Cases
      const profileCasesQuery = db
        .select({
          id: cases.id,
          doctorId: cases.doctorId,
          patientCode: cases.patientCode,
          status: cases.status,
          structuredInput: cases.structuredInput,
          confirmedDiagnosis: cases.confirmedDiagnosis,
          createdAt: cases.createdAt,
          updatedAt: cases.updatedAt,
          doctorName: users.name,
        })
        .from(cases)
        .leftJoin(users, eq(cases.doctorId, users.id))
        .where(eq(cases.profileId, profile.id))
        .orderBy(desc(cases.createdAt));

      const rawCases = await profileCasesQuery;
      // Filter cases if doctor has no full_history grant
      const filteredCases = rawCases.filter((c) => {
        if (user.role !== 'doctor') return true;
        if (hasGrant && grantScope === 'full_history') return true;
        return c.doctorId === user.id;
      });

      // Fetch Prescriptions
      const rawPrescriptions = await db
        .select({
          id: prescriptions.id,
          doctorId: prescriptions.doctorId,
          rxNumber: prescriptions.rxNumber,
          diagnosis: prescriptions.diagnosis,
          investigations: prescriptions.investigations,
          generalAdvice: prescriptions.generalAdvice,
          followUpText: prescriptions.followUpText,
          status: prescriptions.status,
          qrHash: prescriptions.qrHash,
          finalizedAt: prescriptions.finalizedAt,
          createdAt: prescriptions.createdAt,
          doctorName: users.name,
        })
        .from(prescriptions)
        .leftJoin(users, eq(prescriptions.doctorId, users.id))
        .where(eq(prescriptions.profileId, profile.id))
        .orderBy(desc(prescriptions.createdAt));

      const filteredPrescriptions = rawPrescriptions.filter((rx) => {
        if (user.role !== 'doctor') return true;
        if (hasGrant && grantScope === 'full_history') return true;
        return rx.doctorId === user.id;
      });

      // Fetch prescription items
      const prescriptionsWithItems = await Promise.all(
        filteredPrescriptions.map(async (rx) => {
          const items = await db
            .select()
            .from(prescriptionItems)
            .where(eq(prescriptionItems.prescriptionId, rx.id));
          return {
            ...rx,
            items: items.map((it) => ({
              id: it.id,
              brand_name: it.brandName,
              generic_name: it.genericName,
              strength: it.strength,
              form: it.form,
              dosing_schedule: it.dosingSchedule,
              meal_timing: it.mealTiming,
              duration_days: it.durationDays,
              duration_text: it.durationText,
              instructions: it.instructions,
            })),
          };
        })
      );

      // Fetch Patient Reports
      const rawReports = await db
        .select()
        .from(patientReports)
        .where(eq(patientReports.profileId, profile.id))
        .orderBy(desc(patientReports.uploadedAt));

      const filteredReports = rawReports.filter((rep) => {
        if (user.role === 'patient') return true;
        if (rep.isShared) return true;
        return hasGrant && grantScope === 'full_history';
      });

      // Unified Timeline Builder
      const timeline: Array<{
        id: string;
        type: 'visit' | 'prescription' | 'report';
        date: string;
        doctorId?: string | null;
        doctorName: string;
        isOwnRecord: boolean;
        title: string;
        summary: string;
        details: Record<string, unknown>;
      }> = [];

      for (const c of filteredCases) {
        const input = (c.structuredInput || {}) as Record<string, unknown>;
        const complaint = (input.chief_complaint as string) || 'নিয়মিত চেকআপ';
        const vitals = (input.vitals || {}) as Record<string, unknown>;
        timeline.push({
          id: c.id,
          type: 'visit',
          date: c.createdAt.toISOString(),
          doctorId: c.doctorId,
          doctorName: c.doctorName || 'DocMate Doctor',
          isOwnRecord: c.doctorId === user.id,
          title: `ভিজিট / চেকআপ: ${complaint}`,
          summary: c.confirmedDiagnosis ? `নির্ণয়: ${c.confirmedDiagnosis}` : `স্ট্যাটাস: ${c.status}`,
          details: {
            caseId: c.id,
            status: c.status,
            patientCode: c.patientCode,
            complaint,
            vitals,
            symptoms: input.symptoms || [],
            confirmedDiagnosis: c.confirmedDiagnosis,
          },
        });
      }

      for (const rx of prescriptionsWithItems) {
        timeline.push({
          id: rx.id,
          type: 'prescription',
          date: rx.createdAt.toISOString(),
          doctorId: rx.doctorId,
          doctorName: rx.doctorName || 'Prescribing Doctor',
          isOwnRecord: rx.doctorId === user.id,
          title: `প্রেসক্রিপশন #${rx.rxNumber}`,
          summary: rx.diagnosis ? `রোগ: ${rx.diagnosis} (${rx.items.length} টি ওষুধ)` : `${rx.items.length} টি ওষুধ`,
          details: {
            prescriptionId: rx.id,
            rxNumber: rx.rxNumber,
            status: rx.status,
            diagnosis: rx.diagnosis,
            itemCount: rx.items.length,
            items: rx.items,
            generalAdvice: rx.generalAdvice,
            followUpText: rx.followUpText,
          },
        });
      }

      for (const rep of filteredReports) {
        timeline.push({
          id: rep.id,
          type: 'report',
          date: rep.uploadedAt.toISOString(),
          doctorId: null,
          doctorName: 'ডায়াগনস্টিক রিপোর্ট / ল্যাব',
          isOwnRecord: false,
          title: `ল্যাব রিপোর্ট: ${rep.title}`,
          summary: `ধরন: ${rep.reportType} ${rep.notes ? `• ${rep.notes}` : ''}`,
          details: {
            reportId: rep.id,
            fileUrl: rep.fileUrl,
            fileName: rep.fileName,
            reportType: rep.reportType,
            notes: rep.notes,
          },
        });
      }

      // Sort timeline descending by date
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Record access log
      await recordAccessLog({
        userId: user.id,
        profileId: profile.id,
        userRole: user.role,
        action: 'history_view',
        recordType: 'timeline',
        reason: 'Doctor viewed patient clinical history timeline',
      });

      const plainName = profile.name || (profile.nameEncrypted ? decryptPatientPii(profile.nameEncrypted) : 'Patient');

      return NextResponse.json({
        isProfile: true,
        patient: {
          id: profile.id,
          name: plainName,
          phone: phoneDisplay,
          age: profile.age,
          gender: profile.gender,
          blood_group: profile.bloodGroup || healthSummary?.bloodGroup || null,
          relation: profile.relation,
          created_at: profile.createdAt.toISOString(),
        },
        healthSummary: {
          allergies: (healthSummary?.allergies as string[]) || [],
          chronicConditions: (healthSummary?.chronicConditions as string[]) || [],
          currentMedicines: (healthSummary?.currentMedicines as Array<{ brand: string; generic: string; dose?: string }>) || [],
          bloodGroup: healthSummary?.bloodGroup || profile.bloodGroup || null,
          version: healthSummary?.version || 1,
          updatedAt: healthSummary?.updatedAt || profile.createdAt,
        },
        grant: {
          hasGrant,
          scope: grantScope,
          expiresAt: grantExpiresAt?.toISOString() || null,
          daysRemaining,
        },
        otherDoctorRecordsExist,
        cases: filteredCases,
        prescriptions: prescriptionsWithItems,
        reports: filteredReports,
        timeline,
      });
    }

    // 2. Fallback to legacy patients table
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, paramId))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Assert data-scope policy for legacy patient
    const scopeCheck = await assertPatientDataScope({
      user,
      caseDoctorId: patient.doctorId,
      patientId: patient.id,
    });

    if (!scopeCheck.allowed) {
      return NextResponse.json(
        { error: `Data-scope boundary violation: ${scopeCheck.reason}` },
        { status: 403 }
      );
    }

    const patientEncounters = await db.query.encounters.findMany({
      where: eq(encounters.patientId, paramId),
      orderBy: [desc(encounters.visitDate)],
    });

    const patientPrescriptions = await db.query.prescriptions.findMany({
      where: eq(prescriptions.patientId, paramId),
      orderBy: [desc(prescriptions.createdAt)],
    });

    const prescriptionsWithItems = await Promise.all(
      patientPrescriptions.map(async (rx) => {
        const items = await db.query.prescriptionItems.findMany({
          where: eq(prescriptionItems.prescriptionId, rx.id),
        });
        return {
          ...rx,
          rx_number: rx.rxNumber,
          investigations: rx.investigations,
          general_advice: rx.generalAdvice,
          follow_up_text: rx.followUpText,
          qr_hash: rx.qrHash,
          finalized_at: rx.finalizedAt,
          items: items.map((it) => ({
            id: it.id,
            brand_name: it.brandName,
            generic_name: it.genericName,
            strength: it.strength,
            form: it.form,
            dosing_schedule: it.dosingSchedule,
            meal_timing: it.mealTiming,
            duration_days: it.durationDays,
            duration_text: it.durationText,
            instructions: it.instructions,
          })),
        };
      })
    );

    return NextResponse.json({
      isProfile: false,
      patient: {
        id: patient.id,
        patient_code: patient.patientCode,
        name: decryptPatientPii(patient.nameEncrypted),
        phone: decryptPatientPii(patient.phoneEncrypted),
        age: patient.age,
        gender: patient.gender,
        blood_group: patient.bloodGroup,
        emergency_contact: patient.emergencyContact ? decryptPatientPii(patient.emergencyContact) : undefined,
        created_at: patient.createdAt,
      },
      encounters: patientEncounters,
      prescriptions: prescriptionsWithItems,
    });
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
