import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { caseInput } from '@/lib/case-input';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cases, auditLogs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { requirePhysician } from '@/lib/case-access';
import { withIdempotency } from '@/lib/idempotency';

export async function GET(request: Request) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    if (!z.object({ status: z.string().max(30).nullable(), search: z.string().max(250).nullable() }).safeParse({ status, search }).success) {
      return NextResponse.json({ error: 'Invalid case filters' }, { status: 400 });
    }

    const doctorFilter = eq(cases.doctorId, user.id);

    const all = await db.query.cases.findMany({
      where: doctorFilter,
      orderBy: [desc(cases.updatedAt)],
    });

    const RUNNING_STATUSES = ['draft', 'analyzed', 'insufficient_evidence', 'red_flag'];
    const SOLVED_STATUSES = ['confirmed', 'treated', 'closed'];

    const runningCount = all.filter((c) => RUNNING_STATUSES.includes(c.status)).length;
    const solvedCount = all.filter((c) => SOLVED_STATUSES.includes(c.status)).length;

    let filtered = all;
    if (status && status !== 'all') {
      if (status === 'running') {
        filtered = filtered.filter((c) => RUNNING_STATUSES.includes(c.status));
      } else if (status === 'solved') {
        filtered = filtered.filter((c) => SOLVED_STATUSES.includes(c.status));
      } else {
        filtered = filtered.filter((c) => c.status === status);
      }
    }
    if (search && search.trim().length > 0) {
      const q = search.toLowerCase();
      filtered = filtered.filter((c) => {
        const pCode = c.patientCode.toLowerCase();
        const input = c.structuredInput as Record<string, unknown>;
        const complaint = String(input.chief_complaint || '').toLowerCase();
        const dx = String(c.confirmedDiagnosis || '').toLowerCase();
        return pCode.includes(q) || complaint.includes(q) || dx.includes(q);
      });
    }

    const mapped = filtered.map((c) => ({
      ...c,
      patient_code: c.patientCode,
      structured_input: c.structuredInput,
      confirmed_diagnosis: c.confirmedDiagnosis,
      doctor_id: c.doctorId,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      is_running: RUNNING_STATUSES.includes(c.status),
      is_solved: SOLVED_STATUSES.includes(c.status),
    }));

    return NextResponse.json({
      cases: mapped,
      counts: {
        all: all.length,
        running: runningCount,
        solved: solvedCount,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;

    const input = caseInput.safeParse(await boundedJson(request));
    if (!input.success) {
      console.error('[API /api/cases Validation Error]:', input.error.format());
      return NextResponse.json(
        {
          error: 'Invalid synthetic case input',
          details: input.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        },
        { status: 400 }
      );
    }
    const { patient_code, structured_input, profile_id, idempotency_key } = input.data;

    const isValidUuid = (val: string | null | undefined): val is string =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const safeProfileId = isValidUuid(profile_id) ? profile_id : null;

    return await withIdempotency(idempotency_key, '/api/cases', async () => {
      const newCase = await db.transaction(async (tx) => {
        const [record] = await tx.insert(cases).values({
          doctorId: user.id,
          profileId: safeProfileId,
          patientCode: patient_code,
          status: 'draft',
          structuredInput: structured_input,
        }).returning();
        await tx.insert(auditLogs).values({
          caseId: record.id,
          userId: user.id,
          event: 'case_created',
          payload: { profileId: safeProfileId },
        });
        return record;
      });

      return NextResponse.json({ case: newCase });
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
