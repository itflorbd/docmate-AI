import { db } from '../src/db';
import { users, patientAccounts, patientProfiles, cases } from '../src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createSessionToken } from '../src/lib/session';

interface BenchmarkResult {
  step: string;
  sampleCount: number;
  minMs: number;
  medianMs: number;
  slowestMs: number;
  meanMs: number;
}

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3125';

async function timeOperation(fn: () => Promise<Response>, iterations = 5): Promise<number[]> {
  const durations: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const res = await fn();
    const duration = performance.now() - start;
    if (!res.ok) {
      console.warn(`Warning: Operation returned status ${res.status}`);
    }
    await res.text(); // consume body
    durations.push(duration);
  }
  return durations;
}

function calculateStats(step: string, durations: number[]): BenchmarkResult {
  const sorted = [...durations].sort((a, b) => a - b);
  const minMs = Math.round(sorted[0]);
  const slowestMs = Math.round(sorted[sorted.length - 1]);
  const medianMs = Math.round(sorted[Math.floor(sorted.length / 2)]);
  const meanMs = Math.round(sorted.reduce((acc, v) => acc + v, 0) / sorted.length);

  return {
    step,
    sampleCount: durations.length,
    minMs,
    medianMs,
    slowestMs,
    meanMs,
  };
}

async function runProfiling() {
  console.log('========================================================================');
  console.log(`  DocMate AI — Production Workflow Profiling`);
  console.log(`  Target: ${BASE_URL}`);
  console.log('========================================================================\n');

  // 1. Get Doctor user for session token
  const [doc] = await db.select().from(users).where(eq(users.role, 'doctor')).limit(1);
  if (!doc) throw new Error('No doctor found in database');
  const doctorToken = await createSessionToken({
    id: doc.id,
    email: doc.email,
    role: 'doctor',
    name: doc.name,
  });
  const doctorHeaders = {
    'Content-Type': 'application/json',
    Cookie: `docmate_session=${doctorToken}`,
  };

  // 2. Get Patient user & account
  const [patientAcc] = await db.select().from(patientAccounts).limit(1);
  if (!patientAcc) throw new Error('No patient account found');
  const [patientProf] = await db.select().from(patientProfiles).where(eq(patientProfiles.accountId, patientAcc.id)).limit(1);
  if (!patientProf) throw new Error('No patient profile found');

  const [patientUser] = await db.select().from(users).where(eq(users.phone, patientAcc.phone)).limit(1);
  const patientToken = await createSessionToken({
    id: patientUser?.id || 'synthetic-patient-id',
    email: patientUser?.email || 'patient@example.com',
    role: 'patient',
    name: patientProf.name,
  });
  const patientHeaders = {
    'Content-Type': 'application/json',
    Cookie: `docmate_session=${patientToken}`,
  };

  // 3. Get an existing case
  const [existingCase] = await db.select().from(cases).where(eq(cases.doctorId, doc.id)).orderBy(desc(cases.updatedAt)).limit(1);
  const caseId = existingCase?.id;

  const results: BenchmarkResult[] = [];

  // Step 1: Doctor Patient Lookup
  console.log('1. Profiling Doctor Patient Lookup...');
  const lookupTimes = await timeOperation(() =>
    fetch(`${BASE_URL}/api/patient/search?phone=${encodeURIComponent(patientAcc.phone)}`, {
      headers: doctorHeaders,
    })
  );
  results.push(calculateStats('Doctor Patient Lookup (/api/patient/search)', lookupTimes));

  // Step 2: Intake Submission (Case Creation)
  console.log('2. Profiling Intake Submission...');
  const intakeTimes = await timeOperation(() => {
    const seq = Math.floor(100 + Math.random() * 900);
    return fetch(`${BASE_URL}/api/cases`, {
      method: 'POST',
      headers: doctorHeaders,
      body: JSON.stringify({
        patient_code: `P-${new Date().getFullYear()}-${seq}`,
        profile_id: patientProf.id,
        idempotency_key: `bench-${Date.now()}-${Math.random()}`,
        structured_input: {
          age: 35,
          gender: 'female',
          chief_complaint: 'Headache and fatigue',
          symptoms: ['Headache', 'Fatigue'],
          vitals: {},
        },
      }),
    });
  });
  results.push(calculateStats('Intake Submission (/api/cases)', intakeTimes));

  // Step 3: Opening a Case
  if (caseId) {
    console.log('3. Profiling Opening a Case...');
    const openCaseTimes = await timeOperation(() =>
      fetch(`${BASE_URL}/api/cases/${caseId}`, {
        headers: doctorHeaders,
      })
    );
    results.push(calculateStats('Opening a Case (/api/cases/[id])', openCaseTimes));

    // Step 4: Saving a Follow-up (Assistant Turn)
    console.log('4. Profiling Saving a Follow-up...');
    const turnTimes = await timeOperation(() =>
      fetch(`${BASE_URL}/api/cases/${caseId}/turns`, {
        method: 'POST',
        headers: doctorHeaders,
        body: JSON.stringify({
          query: 'What is the recommended paracetamol dose for this patient?',
          locale: 'en',
        }),
      })
    );
    results.push(calculateStats('Saving a Follow-up / Turn (/api/cases/[id]/turns)', turnTimes));
  }

  // Step 5: Patient OTP Sign-in (Send + Verify)
  console.log('5. Profiling Patient OTP Flow...');
  const otpTimes = await timeOperation(() =>
    fetch(`${BASE_URL}/api/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: patientAcc.phone, purpose: 'login' }),
    })
  );
  results.push(calculateStats('Patient OTP Send (/api/auth/otp/send)', otpTimes));

  // Step 6: Switching Portal Tabs / Loading Portal Data
  console.log('6. Profiling Portal Tab Data Fetch...');
  const portalTimes = await timeOperation(() =>
    fetch(`${BASE_URL}/api/patient/portal?profileId=${patientProf.id}`, {
      headers: patientHeaders,
    })
  );
  results.push(calculateStats('Portal Data / Tab Switch (/api/patient/portal)', portalTimes));

  // Step 7: Ask Library
  console.log('7. Profiling Ask Library Query...');
  const askTimes = await timeOperation(() =>
    fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: doctorHeaders,
      body: JSON.stringify({
        question: 'Cedar-17 persistent vomiting treatment protocol',
        locale: 'en',
      }),
    })
  );
  results.push(calculateStats('Ask Library Query (/api/ask)', askTimes));

  console.log('\n========================================================================');
  console.log('  Workflow Performance Benchmark Results (Production Build)');
  console.log('========================================================================\n');

  console.log('| Step | Samples | Median (ms) | Min (ms) | Slowest (ms) | Mean (ms) |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  for (const r of results) {
    console.log(`| ${r.step} | ${r.sampleCount} | ${r.medianMs}ms | ${r.minMs}ms | ${r.slowestMs}ms | ${r.meanMs}ms |`);
  }
}

runProfiling().catch((err) => {
  console.error('Profiling error:', err);
  process.exit(1);
});
