/**
 * DocMate AI — Migration Script for Patient-Centred Architecture Upgrade
 * 
 * Usage:
 *   pnpm exec tsx scripts/migrate-patient-centered.ts --dry-run
 *   pnpm exec tsx scripts/migrate-patient-centered.ts
 *   pnpm exec tsx scripts/migrate-patient-centered.ts --rollback
 */

import { pool } from '../src/db/index';
import { normalizeBangladeshiPhone } from '../src/lib/phone';
import { decryptPatientPii, encryptPatientPii } from '../src/lib/encryption';
import crypto from 'node:crypto';

const isDryRun = process.argv.includes('--dry-run');
const isRollback = process.argv.includes('--rollback');

async function main() {
  console.log('========================================================================');
  console.log('  DocMate AI — Patient-Centred Architecture Data Migration');
  console.log(`  Mode: ${isDryRun ? 'DRY-RUN (No changes applied)' : isRollback ? 'ROLLBACK' : 'LIVE MIGRATION'}`);
  console.log('========================================================================\n');

  const client = await pool.connect();

  try {
    if (isRollback) {
      console.log('>>> Rolling back patient-centred migration...');
      await client.query('BEGIN');
      
      // Nullify profile_id references
      await client.query('UPDATE cases SET profile_id = NULL');
      await client.query('UPDATE encounters SET profile_id = NULL');
      await client.query('UPDATE prescriptions SET profile_id = NULL');
      await client.query('UPDATE patient_schedules SET profile_id = NULL');
      await client.query('UPDATE patient_reports SET profile_id = NULL');
      await client.query('UPDATE patient_pre_visits SET profile_id = NULL');
      await client.query('UPDATE patient_consent_logs SET profile_id = NULL');

      // Delete demo patient accounts
      const demoPhones = [
        '+8801700000001',
        '+8801700000002',
        '+8801700000003',
        '+8801700000004',
        '+8801700000005',
      ];
      await client.query(
        'DELETE FROM patient_accounts WHERE phone = ANY($1)',
        [demoPhones]
      );

      await client.query('COMMIT');
      console.log('✅ Rollback complete. References cleared and demo accounts removed.\n');
      return;
    }

    // 1. Inspect existing patients
    const { rows: existingPatients } = await client.query(`
      SELECT id, doctor_id, patient_code, name_encrypted, phone_encrypted, age, gender, blood_group, created_at
      FROM patients
    `);

    console.log(`Found ${existingPatients.length} existing patient record(s) in patients table.`);

    const phoneGroups = new Map<string, typeof existingPatients>();
    const withoutPhone: typeof existingPatients = [];

    for (const p of existingPatients) {
      let phoneRaw = '';
      try {
        phoneRaw = decryptPatientPii(p.phone_encrypted);
      } catch {
        phoneRaw = p.phone_encrypted || '';
      }

      const norm = normalizeBangladeshiPhone(phoneRaw);
      if (norm.isValid) {
        const list = phoneGroups.get(norm.e164) || [];
        list.push(p);
        phoneGroups.set(norm.e164, list);
      } else {
        withoutPhone.push(p);
      }
    }

    console.log(`- Unique normalized phone numbers: ${phoneGroups.size}`);
    console.log(`- Patients without a valid phone number: ${withoutPhone.length} (will remain in doctor-only needs-phone queue)`);

    if (isDryRun) {
      console.log('\n[DRY RUN SUMMARY OF ACTIONS TO BE PERFORMED]');
      console.log(`1. Create or verify ${phoneGroups.size + 5} patient_accounts (existing + 5 demo accounts).`);
      console.log(`2. Create ${existingPatients.length - withoutPhone.length} initial patient_profiles (relation: 'self').`);
      console.log(`3. Create initial profile_health_summary records (version 1).`);
      console.log(`4. Create 'this_doctor_only' access_grants for each authoring doctor.`);
      console.log(`5. Link existing encounters, prescriptions, and schedules to profile_id.`);
      console.log(`6. Seed 5 demo accounts with multi-profile and cross-doctor consent scenarios:`);
      console.log(`   - 01700000001: কামাল হোসেন (Cross-doctor past history demo)`);
      console.log(`   - 01700000002: রফিকুল ইসলাম (Parent, 52) + সাদমান ইসলাম (Child, 8)`);
      console.log(`   - 01700000003: ফাতেমা বেগম (Hypertension & T2DM)`);
      console.log(`   - 01700000004: আনিসুর রহমান (COPD & Active Prescriptions)`);
      console.log(`   - 01700000005: নাসরিন সুলতানা (Allergies)`);
      console.log('\n✅ Dry run completed successfully. No database modifications made.');
      return;
    }

    // 2. Perform Live Migration
    await client.query('BEGIN');

    // Fetch primary doctor user for defaults
    const { rows: doctors } = await client.query(`
      SELECT id, email, name FROM users WHERE role = 'doctor' ORDER BY created_at ASC LIMIT 2
    `);
    const primaryDoctorId = doctors[0]?.id || null;
    const secondaryDoctorId = doctors[1]?.id || null;

    // Migrate existing patient records
    for (const [phoneE164, pList] of phoneGroups.entries()) {
      // Find or create patient_account
      let accountId: string;
      const { rows: accRows } = await client.query(
        'SELECT id FROM patient_accounts WHERE phone = $1',
        [phoneE164]
      );
      if (accRows.length > 0) {
        accountId = accRows[0].id;
      } else {
        const { rows: newAcc } = await client.query(
          `INSERT INTO patient_accounts (id, phone, phone_normalized, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $1, NOW(), NOW()) RETURNING id`,
          [phoneE164]
        );
        accountId = newAcc[0].id;
      }

      for (const p of pList) {
        let namePlain = 'Unknown Patient';
        try {
          namePlain = decryptPatientPii(p.name_encrypted);
        } catch {
          namePlain = p.name_encrypted || 'Unknown Patient';
        }

        // Insert patient profile
        const { rows: profRows } = await client.query(
          `INSERT INTO patient_profiles (
             id, account_id, relation, name, name_encrypted, age, sex, gender, blood_group, created_by, claimed, created_at, updated_at
           ) VALUES (gen_random_uuid(), $1, 'self', $2, $3, $4, $5, $5, $6, $7, false, $8, NOW())
           RETURNING id`,
          [
            accountId,
            namePlain,
            p.name_encrypted,
            p.age || 35,
            p.gender || 'male',
            p.blood_group || null,
            p.doctor_id || primaryDoctorId,
            p.created_at || new Date(),
          ]
        );
        const profileId = profRows[0].id;

        // Create health summary
        await client.query(
          `INSERT INTO profile_health_summary (
             id, profile_id, version, allergies, chronic_conditions, current_medicines, blood_group, updated_by, updated_at, change_reason
           ) VALUES (gen_random_uuid(), $1, 1, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $2, $3, NOW(), 'Initial migration from existing record')`,
          [profileId, p.blood_group || null, p.doctor_id || primaryDoctorId]
        );

        // Create initial access grant for authoring doctor
        if (p.doctor_id) {
          await client.query(
            `INSERT INTO access_grants (
               id, profile_id, doctor_id, scope, status, granted_via, created_at
             ) VALUES (gen_random_uuid(), $1, $2, 'this_doctor_only', 'active', 'created_profile', NOW())`,
            [profileId, p.doctor_id]
          );
        }

        // Link existing encounters
        await client.query(
          'UPDATE encounters SET profile_id = $1 WHERE patient_id = $2',
          [profileId, p.id]
        );

        // Link existing prescriptions
        await client.query(
          'UPDATE prescriptions SET profile_id = $1 WHERE patient_id = $2',
          [profileId, p.id]
        );

        // Link existing schedules
        await client.query(
          'UPDATE patient_schedules SET profile_id = $1 WHERE patient_id = $2',
          [profileId, p.id]
        );

        // Link existing reports
        await client.query(
          'UPDATE patient_reports SET profile_id = $1 WHERE patient_id = $2',
          [profileId, p.id]
        );

        // Link existing pre-visits
        await client.query(
          'UPDATE patient_pre_visits SET profile_id = $1 WHERE patient_id = $2',
          [profileId, p.id]
        );
      }
    }

    // 3. Seed 5 Rich Demo Accounts
    console.log('\n>>> Seeding 5 Demo Accounts & Multi-Profile Scenarios...');

    const demoAccountsData = [
      {
        phone: '+8801700000001',
        profiles: [
          {
            name: 'কামাল হোসেন (Kamal Hossain)',
            relation: 'self',
            age: 48,
            gender: 'male',
            bloodGroup: 'B+',
            allergies: ['Penicillin (পেনিসিলিন)'],
            conditions: ['উচ্চ রক্তচাপ (Hypertension)'],
            meds: [{ brand: 'Napa 500 mg', generic: 'Paracetamol' }],
            authorDoc: primaryDoctorId,
            grantOtherDoc: false, // For cross-doctor consent demo!
          },
        ],
      },
      {
        phone: '+8801700000002',
        profiles: [
          {
            name: 'রফিকুল ইসলাম (Rafiqul Islam)',
            relation: 'self',
            age: 52,
            gender: 'male',
            bloodGroup: 'O+',
            allergies: [],
            conditions: ['টাইপ ২ ডায়াবেটিস (Type 2 Diabetes)'],
            meds: [{ brand: 'Seclo 20 mg', generic: 'Omeprazole' }],
            authorDoc: primaryDoctorId,
            grantOtherDoc: true,
          },
          {
            name: 'সাদমান ইসলাম (Sadman Islam)',
            relation: 'child',
            age: 8,
            gender: 'male',
            bloodGroup: 'O+',
            allergies: ['ধূলোবালি (Dust allergy)'],
            conditions: ['শৈশব হাঁপানি (Childhood Asthma)'],
            meds: [],
            authorDoc: primaryDoctorId,
            grantOtherDoc: true,
          },
        ],
      },
      {
        phone: '+8801700000003',
        profiles: [
          {
            name: 'ফাতেমা বেগম (Fatema Begum)',
            relation: 'self',
            age: 45,
            gender: 'female',
            bloodGroup: 'A+',
            allergies: ['Sulfa Drugs (সালফা)'],
            conditions: ['উচ্চ রক্তচাপ (Hypertension)', 'ডিসপেপসিয়া (Dyspepsia)'],
            meds: [{ brand: 'Osartil 50 mg', generic: 'Losartan Potassium' }],
            authorDoc: primaryDoctorId,
            grantOtherDoc: true,
          },
        ],
      },
      {
        phone: '+8801700000004',
        profiles: [
          {
            name: 'আনিসুর রহমান (Anisur Rahman)',
            relation: 'self',
            age: 60,
            gender: 'male',
            bloodGroup: 'AB+',
            allergies: ['Aspirin (অ্যাসপিরিন)'],
            conditions: ['সিওপিডি (COPD)'],
            meds: [{ brand: 'Monas 10 mg', generic: 'Montelukast' }],
            authorDoc: primaryDoctorId,
            grantOtherDoc: true,
          },
        ],
      },
      {
        phone: '+8801700000005',
        profiles: [
          {
            name: 'নাসরিন সুলতানা (Nasrin Sultana)',
            relation: 'self',
            age: 28,
            gender: 'female',
            bloodGroup: 'B-',
            allergies: ['Ciprofloxacin (সিপ্রোফ্লক্সাসিন)'],
            conditions: ['মাইগ্রেন (Migraine)'],
            meds: [],
            authorDoc: primaryDoctorId,
            grantOtherDoc: true,
          },
        ],
      },
    ];

    for (const accData of demoAccountsData) {
      // Upsert account
      let accId: string;
      const { rows: existingAcc } = await client.query(
        'SELECT id FROM patient_accounts WHERE phone = $1',
        [accData.phone]
      );
      if (existingAcc.length > 0) {
        accId = existingAcc[0].id;
      } else {
        const { rows: newAcc } = await client.query(
          `INSERT INTO patient_accounts (id, phone, phone_normalized, created_at, updated_at)
           VALUES (gen_random_uuid(), $1, $1, NOW(), NOW()) RETURNING id`,
          [accData.phone]
        );
        accId = newAcc[0].id;
      }

      for (const prof of accData.profiles) {
        // Check if profile exists under this account
        const { rows: existingProf } = await client.query(
          `SELECT id FROM patient_profiles WHERE account_id = $1 AND name = $2`,
          [accId, prof.name]
        );

        let profId: string;
        if (existingProf.length > 0) {
          profId = existingProf[0].id;
        } else {
          const { rows: newProf } = await client.query(
            `INSERT INTO patient_profiles (
               id, account_id, relation, name, name_encrypted, age, sex, gender, blood_group, created_by, claimed, created_at, updated_at
             ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $6, $7, $8, true, NOW(), NOW())
             RETURNING id`,
            [
              accId,
              prof.relation,
              prof.name,
              encryptPatientPii(prof.name),
              prof.age,
              prof.gender,
              prof.bloodGroup,
              prof.authorDoc,
            ]
          );
          profId = newProf[0].id;

          // Health summary
          await client.query(
            `INSERT INTO profile_health_summary (
               id, profile_id, version, allergies, chronic_conditions, current_medicines, blood_group, updated_by, updated_at, change_reason
             ) VALUES (gen_random_uuid(), $1, 1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, NOW(), 'Initial onboarding baseline')`,
            [
              profId,
              JSON.stringify(prof.allergies),
              JSON.stringify(prof.conditions),
              JSON.stringify(prof.meds),
              prof.bloodGroup,
              prof.authorDoc,
            ]
          );

          // Authoring doctor grant
          if (prof.authorDoc) {
            await client.query(
              `INSERT INTO access_grants (
                 id, profile_id, doctor_id, scope, status, granted_via, created_at
               ) VALUES (gen_random_uuid(), $1, $2, 'this_doctor_only', 'active', 'created_profile', NOW())`,
              [profId, prof.authorDoc]
            );
          }

          // If grantOtherDoc is true and secondary doctor exists, grant full history
          if (prof.grantOtherDoc && secondaryDoctorId) {
            await client.query(
              `INSERT INTO access_grants (
                 id, profile_id, doctor_id, scope, status, granted_via, expires_at, created_at
               ) VALUES (gen_random_uuid(), $1, $2, 'full_history', 'active', 'otp', NOW() + INTERVAL '30 days', NOW())`,
              [profId, secondaryDoctorId]
            );
          }

          // Create a demo prescription for Kamal Hossain
          if (prof.name.startsWith('কামাল') && prof.authorDoc) {
            const rxHash = crypto.createHash('sha256').update(`RX-DEMO-${profId}`).digest('hex');
            const { rows: rxRows } = await client.query(
              `INSERT INTO prescriptions (
                 id, doctor_id, profile_id, patient_id, rx_number, diagnosis, investigations, general_advice, follow_up_text, status, qr_hash, finalized_at, created_at, updated_at
               ) VALUES (gen_random_uuid(), $1, $2, NULL, 'RX-2026-1001', 'প্রাথমিক উচ্চ রক্তচাপ (Essential Hypertension)', '["Serum Creatinine", "Lipid Profile"]'::jsonb, 'লবণ কম খাবেন, প্রতিদিন ৩০ মিনিট হাঁটবেন।', '১ মাস পর', 'finalized', $3, NOW(), NOW(), NOW())
               RETURNING id`,
              [prof.authorDoc, profId, rxHash]
            );
            const rxId = rxRows[0].id;

            // Prescription items
            const { rows: rxItemRows } = await client.query(
              `INSERT INTO prescription_items (
                 id, prescription_id, brand_name, generic_name, strength, form, dosing_schedule, meal_timing, duration_days, duration_text, instructions
               ) VALUES
                 (gen_random_uuid(), $1, 'Osartil 50 mg', 'Losartan Potassium', '50 mg', 'Tab', '1+0+0', 'সকালে খাবারের পর', 30, '৩০ দিন', 'নিয়মিত খাবেন'),
                 (gen_random_uuid(), $1, 'Napa Extra', 'Paracetamol + Caffeine', '500 mg + 65 mg', 'Tab', '1+0+1', 'খাবারের পর', 5, '৫ দিন', 'মাথা ব্যথা বা জ্বর হলে খাবেন')
               RETURNING id`,
              [rxId]
            );

            // Create patient schedule
            await client.query(
              `INSERT INTO patient_schedules (
                 id, patient_id, profile_id, prescription_item_id, medicine_name, dosage, slot, meal_relation, taken_today, instructions, created_at
               ) VALUES
                 (gen_random_uuid(), NULL, $1, $2, 'Osartil 50 mg', '1 Tab', 'morning', 'সকালে খাবারের পর', true, 'রক্তচাপ নিয়ন্ত্রণের জন্য', NOW()),
                 (gen_random_uuid(), NULL, $1, $3, 'Napa Extra', '1 Tab', 'night', 'রাতে খাবারের পর', false, 'ব্যথার জন্য', NOW())`,
              [profId, rxItemRows[0].id, rxItemRows[1].id]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    console.log('✅ Live migration and demo seeding completed successfully!\n');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed and was rolled back:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
