import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  patientAccounts,
  patientProfiles,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { maskPhoneNumber } from '@/lib/phone';
import { decryptPatientPii } from '@/lib/encryption';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    // 1. Fetch accounts with profile count
    const allAccounts = await db
      .select({
        id: patientAccounts.id,
        phone: patientAccounts.phone,
        createdAt: patientAccounts.createdAt,
      })
      .from(patientAccounts)
      .orderBy(desc(patientAccounts.createdAt));

    // 2. Fetch all profiles metadata (Strictly no clinical records/PHI)
    const allProfiles = await db
      .select({
        id: patientProfiles.id,
        accountId: patientProfiles.accountId,
        relation: patientProfiles.relation,
        name: patientProfiles.name,
        nameEncrypted: patientProfiles.nameEncrypted,
        age: patientProfiles.age,
        gender: patientProfiles.gender,
        bloodGroup: patientProfiles.bloodGroup,
        claimed: patientProfiles.claimed,
        createdAt: patientProfiles.createdAt,
        phone: patientAccounts.phone,
      })
      .from(patientProfiles)
      .leftJoin(patientAccounts, eq(patientProfiles.accountId, patientAccounts.id))
      .orderBy(desc(patientProfiles.createdAt));

    const cleanProfiles = allProfiles.map((p) => {
      const plainName = p.name || (p.nameEncrypted ? decryptPatientPii(p.nameEncrypted) : 'Patient');
      return {
        id: p.id,
        accountId: p.accountId,
        name: plainName,
        phoneMasked: p.phone ? maskPhoneNumber(p.phone) : '—',
        phoneRaw: p.phone || '',
        relation: p.relation,
        age: p.age,
        gender: p.gender,
        bloodGroup: p.bloodGroup,
        claimed: p.claimed,
        createdAt: p.createdAt.toISOString(),
      };
    });

    // 3. Find duplicate candidates across all profiles (similarity matching)
    const duplicateCandidates: Array<{
      profileA: typeof cleanProfiles[0];
      profileB: typeof cleanProfiles[0];
      confidence: string;
      reason: string;
    }> = [];

    for (let i = 0; i < cleanProfiles.length; i++) {
      for (let j = i + 1; j < cleanProfiles.length; j++) {
        const a = cleanProfiles[i];
        const b = cleanProfiles[j];

        if (a.id === b.id) continue;

        const nameA = a.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const nameB = b.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (!nameA || !nameB) continue;

        const nameMatch = nameA.includes(nameB) || nameB.includes(nameA) || nameA === nameB;
        const ageDiff = Math.abs(a.age - b.age);

        if (nameMatch && ageDiff <= 2) {
          const samePhone = a.phoneRaw === b.phoneRaw;
          duplicateCandidates.push({
            profileA: a,
            profileB: b,
            confidence: samePhone ? 'High (একই ফোন নম্বর)' : 'Moderate (বিভিন্ন ফোন)',
            reason: samePhone
              ? `একই ফোন নম্বরে কাছাকাছি নাম ও বয়স (${a.name} v ${b.name}, বয়স: ${a.age} v ${b.age})`
              : `আলাদা ফোন নম্বরে অভিন্ন নাম ও কাছাকাছি বয়স (${a.name} v ${b.name})`,
          });
        }
      }
    }

    const accountsSummary = allAccounts.map((acc) => {
      const count = cleanProfiles.filter((p) => p.accountId === acc.id).length;
      return {
        id: acc.id,
        phoneMasked: maskPhoneNumber(acc.phone),
        profileCount: count,
        createdAt: acc.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      accounts: accountsSummary,
      profiles: cleanProfiles,
      duplicateCandidates,
      totalAccounts: accountsSummary.length,
      totalProfiles: cleanProfiles.length,
    });
  } catch (error) {
    console.error('Admin patient governance fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
