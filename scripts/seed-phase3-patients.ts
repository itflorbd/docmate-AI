import { Pool } from 'pg';
import crypto from 'node:crypto';
import { encryptPatientPii } from '../src/lib/encryption';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple:@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function seedPhase3() {
  const client = await pool.connect();
  try {
    console.log('--- Seeding Phase 3 Bangladeshi Demo Patients and Prescriptions ---');

    // Get doctor user
    const docRes = await client.query("SELECT id FROM users WHERE email='doctor@docmate.ai'");
    if (docRes.rows.length === 0) {
      throw new Error('doctor@docmate.ai not found. Please run seed.ts first.');
    }
    const doctorId = docRes.rows[0].id;

    // Clean existing phase 3 demo data
    await client.query("DELETE FROM patients WHERE doctor_id = $1", [doctorId]);

    // 1. Patient P-101
    const p1Res = await client.query(
      `INSERT INTO patients (doctor_id, patient_code, name_encrypted, phone_encrypted, age, gender, blood_group, emergency_contact, consent_obtained)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        doctorId,
        'P-101',
        encryptPatientPii('মোসাম্মৎ আয়েশা বেগম'),
        encryptPatientPii('+8801711223344'),
        42,
        'female',
        'B+',
        'স্বামী: রফিকুল ইসলাম (+8801711998877)',
        true,
      ]
    );
    const p1Id = p1Res.rows[0].id;

    const enc1Res = await client.query(
      `INSERT INTO encounters (patient_id, doctor_id, chief_complaint, symptoms, vitals, allergies, current_medications, past_history, clinical_notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        p1Id,
        doctorId,
        'জ্বর (Fever) ও শ্বাসকষ্ট (Dyspnea) ৪ দিন যাবত',
        JSON.stringify(['জ্বর (Fever)', 'কাশি (Cough)', 'শ্বাসকষ্ট (Shortness of breath)']),
        JSON.stringify({ bpSystolic: 130, bpDiastolic: 85, pulse: 88, tempF: 101.4, spo2: 96, weightKg: 62 }),
        JSON.stringify(['Ciprofloxacin']),
        JSON.stringify([{ brand: 'Napa', generic: 'Paracetamol', dose: '500mg' }]),
        'ব্রঙ্কিয়াল অ্যাজমা (Asthma) ৫ বছর যাবত',
        'শ্বাসকষ্টের তীব্রতা মৃদু থেকে মাঝারি। ফুসফুসে রঙ্কাই (Rhonchi) বিদ্যমান।',
        'completed',
      ]
    );
    const enc1Id = enc1Res.rows[0].id;

    const qrHash1 = crypto.createHash('sha256').update(`RX-2026-0001-${p1Id}-${doctorId}`).digest('hex');
    const rx1Res = await client.query(
      `INSERT INTO prescriptions (encounter_id, patient_id, doctor_id, rx_number, diagnosis, investigations, general_advice, follow_up_text, status, qr_hash, finalized_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now()) RETURNING id`,
      [
        enc1Id,
        p1Id,
        doctorId,
        'RX-2026-0001',
        'Acute Exacerbation of Bronchial Asthma with Upper Respiratory Tract Infection (URTI)',
        JSON.stringify(['CBC with ESR', 'CXR P/A view', 'Serum Creatinine']),
        'পর্যাপ্ত কুসুম গরম পানি ও তরল খাবার গ্রহণ করুন। ধূমপান ও ধুলাবালি এড়িয়ে চলুন। শ্বাসকষ্ট বৃদ্ধি পেলে দ্রুত হাসপাতালে যোগাযোগ করুন।',
        '৭ দিন পর এক্স-রে রিপোর্ট সহ আসবেন',
        'finalized',
        qrHash1,
      ]
    );
    const rx1Id = rx1Res.rows[0].id;

    await client.query(
      `INSERT INTO prescription_items (prescription_id, brand_name, generic_name, strength, form, dosing_schedule, meal_timing, duration_days, duration_text, instructions) VALUES
       ($1, 'Napa Extend', 'Paracetamol', '665 mg', 'Tab', '১+০+১', 'খাবারের পর', 5, '৫ দিন', 'জ্বর বা ব্যথা থাকলে খাবেন'),
       ($1, 'Seclo', 'Omeprazole', '20 mg', 'Cap', '১+০+১', 'খাবারের আগে', 14, '১৪ দিন', 'প্রতিদিন সকাল ও রাতে খাবারের ২০ মিনিট আগে'),
       ($1, 'Adrylex', 'Dextromethorphan + Pseudoephedrine', '100 ml', 'Syr', '২ চামচ করে ৩ বার', 'খাবারের পর', 7, '৭ দিন', 'কাশি তীব্র হলে নিয়মিত খাবেন'),
       ($1, 'Montene', 'Montelukast', '10 mg', 'Tab', '০+০+১', 'খাবারের পর', 30, '১ মাস', 'প্রতিদিন রাতে শোবার পূর্বে নিয়মিত')`,
      [rx1Id]
    );

    // 2. Patient P-102
    const p2Res = await client.query(
      `INSERT INTO patients (doctor_id, patient_code, name_encrypted, phone_encrypted, age, gender, blood_group, emergency_contact, consent_obtained)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        doctorId,
        'P-102',
        encryptPatientPii('কাজী মোহাম্মদ রফিকুল ইসলাম'),
        encryptPatientPii('+8801819554433'),
        58,
        'male',
        'O+',
        'ছেলে: কাজী আসিফ (+8801819112233)',
        true,
      ]
    );
    const p2Id = p2Res.rows[0].id;

    const enc2Res = await client.query(
      `INSERT INTO encounters (patient_id, doctor_id, chief_complaint, symptoms, vitals, allergies, current_medications, past_history, clinical_notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        p2Id,
        doctorId,
        'মাথা ঘোরা ও ঘাড়ের পেছনের অংশে তীব্র ব্যথা (Occipital Headache & Dizziness)',
        JSON.stringify(['মাথা ব্যথা (Headache)', 'মাথা ঘোরা (Dizziness)', 'দুর্বলতা (Fatigue)']),
        JSON.stringify({ bpSystolic: 160, bpDiastolic: 100, pulse: 78, tempF: 98.4, spo2: 98, weightKg: 78 }),
        JSON.stringify([]),
        JSON.stringify([]),
        'উচ্চ রক্তচাপ (Hypertension) ও ডিসলিপিডেমিয়া (Dyslipidemia)',
        'রক্তচাপ অনিয়ন্ত্রিত। ফান্ডোস্কোপিক পরিবর্তন নেই। কার্ডিয়াক শব্দ স্বাভাবিক।',
        'completed',
      ]
    );
    const enc2Id = enc2Res.rows[0].id;

    const qrHash2 = crypto.createHash('sha256').update(`RX-2026-0002-${p2Id}-${doctorId}`).digest('hex');
    const rx2Res = await client.query(
      `INSERT INTO prescriptions (encounter_id, patient_id, doctor_id, rx_number, diagnosis, investigations, general_advice, follow_up_text, status, qr_hash, finalized_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now()) RETURNING id`,
      [
        enc2Id,
        p2Id,
        doctorId,
        'RX-2026-0002',
        'Essential Stage 2 Hypertension with Hypercholesterolemia',
        JSON.stringify(['Fasting Lipid Profile', 'Serum Electrolytes', 'Serum Creatinine', 'ECG', 'RBS']),
        'খাবারে বাড়তি কাঁচা লবণ সম্পূর্ণ বর্জন করুন। অতিরিক্ত চর্বিযুক্ত ও ভাজাপোড়া খাবার পরিহার করুন। প্রতিদিন অন্তত ৩০ মিনিট মুক্ত বাতাসে হাঁটুন।',
        '১৪ দিন পর প্রাত্যহিক রক্তচাপের রেকর্ড সহ দেখা করবেন',
        'finalized',
        qrHash2,
      ]
    );
    const rx2Id = rx2Res.rows[0].id;

    await client.query(
      `INSERT INTO prescription_items (prescription_id, brand_name, generic_name, strength, form, dosing_schedule, meal_timing, duration_days, duration_text, instructions) VALUES
       ($1, 'Camlosart', 'Amlodipine + Olmesartan', '5/20 mg', 'Tab', '১+০+০', 'খাবারের পর', 30, '১ মাস', 'প্রতিদিন সকালে নাস্তার পর নিয়মিত খাবেন'),
       ($1, 'Rosuva', 'Rosuvastatin', '10 mg', 'Tab', '০+০+১', 'খাবারের পর', 30, '১ মাস', 'প্রতিদিন রাতে খাবারের পর খাবেন')`,
      [rx2Id]
    );

    // 3. Patient P-103
    const p3Res = await client.query(
      `INSERT INTO patients (doctor_id, patient_code, name_encrypted, phone_encrypted, age, gender, blood_group, emergency_contact, consent_obtained)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        doctorId,
        'P-103',
        encryptPatientPii('তানিয়া সুলতানা'),
        encryptPatientPii('+8801912445566'),
        26,
        'female',
        'A+',
        'মা: ফরিদা বেগম (+8801912778899)',
        true,
      ]
    );
    const p3Id = p3Res.rows[0].id;

    const enc3Res = await client.query(
      `INSERT INTO encounters (patient_id, doctor_id, chief_complaint, symptoms, vitals, allergies, current_medications, past_history, clinical_notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [
        p3Id,
        doctorId,
        'তীব্র পেটে ব্যথা ও বমি ভাব (Abdominal Pain & Nausea)',
        JSON.stringify(['পেট ব্যথা (Abdominal pain)', 'বমি ভাব (Nausea)']),
        JSON.stringify({ bpSystolic: 110, bpDiastolic: 70, pulse: 92, tempF: 99.1, spo2: 99, weightKg: 54 }),
        JSON.stringify(['Penicillin']),
        JSON.stringify([]),
        'গ্যাস্ট্রোইসোফেজিয়াল রিফ্লাক্স (GERD)',
        'এপিগ্যাস্ট্রিক অঞ্চলে চাপ দিলে ব্যথা অনুভূত হয়।',
        'in_progress',
      ]
    );
    const enc3Id = enc3Res.rows[0].id;

    const qrHash3 = crypto.createHash('sha256').update(`RX-2026-0003-${p3Id}-${doctorId}`).digest('hex');
    await client.query(
      `INSERT INTO prescriptions (encounter_id, patient_id, doctor_id, rx_number, diagnosis, investigations, general_advice, follow_up_text, status, qr_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        enc3Id,
        p3Id,
        doctorId,
        'RX-2026-0003',
        'Acute Peptic Ulcer Disease (PUD) / Acute Gastritis',
        JSON.stringify(['Ultrasonography of Whole Abdomen (USG)', 'Serum Amylase']),
        'ঝাল, মশলাদার ও তৈলাক্ত খাবার সম্পূর্ণরূপে পরিহার করুন। একবারে বেশি না খেয়ে অল্প অল্প করে বারে বারে খাবার খান।',
        '৭ দিন পর আল্ট্রাসনোগ্রাম রিপোর্ট সহ আসবেন',
        'draft',
        qrHash3,
      ]
    );

    console.log('✓ Successfully seeded 3 Bangladeshi demo patients, 3 encounters, and 2 finalized + 1 draft prescriptions.');
  } finally {
    client.release();
    await pool.end();
  }
}

seedPhase3().catch((err) => {
  console.error('Failed to seed Phase 3 data:', err);
  process.exit(1);
});
