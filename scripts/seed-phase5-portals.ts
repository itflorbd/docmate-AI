import { db } from '../src/db';
import {
  users,
  patients,
  patientSchedules,
  patientReports,
  patientPreVisits,
  studentCases,
  studentQuizzes,
  studentNotes,
  researcherCollections,
  chunks,
} from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function seedPhase5() {
  console.log('Seeding Phase 5: Patient Portal, Student & Researcher Workspaces...');

  // 1. Find patient user or first patient record
  const allPatients = await db.select().from(patients).limit(1);
  if (allPatients.length === 0) {
    console.error('No patients found in DB. Run Phase 3 seed first.');
    return;
  }
  const patient = allPatients[0];
  console.log(`Linking sample patient portal data to Patient Code: ${patient.patientCode} (ID: ${patient.id})`);

  // Link student & researcher users
  const studentUsers = await db.select().from(users).where(eq(users.role, 'student'));
  const researcherUsers = await db.select().from(users).where(eq(users.role, 'researcher'));

  const studentUser = studentUsers[0];
  const researcherUser = researcherUsers[0];

  // 2. Clear previous Phase 5 seed data if any
  await db.delete(patientSchedules).where(eq(patientSchedules.patientId, patient.id));
  await db.delete(patientReports).where(eq(patientReports.patientId, patient.id));
  await db.delete(patientPreVisits).where(eq(patientPreVisits.patientId, patient.id));

  // 3. Seed Patient Schedules (Bangladeshi morning/noon/night slots)
  await db.insert(patientSchedules).values([
    {
      patientId: patient.id,
      medicineName: 'Napa Extend 665 mg',
      dosage: '১টি ট্যাবলেট',
      slot: 'morning',
      mealRelation: 'খাবারের পর',
      takenToday: true,
      lastTakenAt: new Date(),
      instructions: 'জ্বর বা শরীর ব্যথায় ভরা পেটে সেব্য।',
    },
    {
      patientId: patient.id,
      medicineName: 'Seclo 20 mg',
      dosage: '১টি ক্যাপসুল',
      slot: 'morning',
      mealRelation: 'খাবারের ২০ মিনিট আগে',
      takenToday: true,
      lastTakenAt: new Date(),
      instructions: 'গ্যাস্ট্রিকের জন্য সকালে খালি পেটে খাবেন।',
    },
    {
      patientId: patient.id,
      medicineName: 'Monas 10 mg',
      dosage: '১টি ট্যাবলেট',
      slot: 'night',
      mealRelation: 'খাবারের পর',
      takenToday: false,
      instructions: 'শ্বাসকষ্ট ও অ্যালার্জি নিয়ন্ত্রণে রাতে ঘুমানোর আগে।',
    },
    {
      patientId: patient.id,
      medicineName: 'Napa Extend 665 mg',
      dosage: '১টি ট্যাবলেট',
      slot: 'night',
      mealRelation: 'খাবারের পর',
      takenToday: false,
      instructions: 'রাতে খাবারের পর গ্রহণ করুন।',
    },
  ]);

  // 4. Seed Patient Reports
  await db.insert(patientReports).values([
    {
      patientId: patient.id,
      title: 'কমপ্লিট ব্লাড কাউন্ট (CBC) ও সিরাম ক্রিয়েটিনিন',
      reportType: 'lab_test',
      fileUrl: '/uploads/reports/cbc_nov_2026.pdf',
      fileName: 'CBC_Report_Nov2026.pdf',
      notes: 'হিমোগ্লোবিন ১১.২ g/dL, ডব্লিউবিসি স্বাভাবিক। ল্যাব রেফারেন্স পপুলার ডায়াগনস্টিক।',
    },
    {
      patientId: patient.id,
      title: 'চেস্ট এক্স-রে (Chest X-Ray P/A View)',
      reportType: 'imaging',
      fileUrl: '/uploads/reports/cxr_nov_2026.pdf',
      fileName: 'CXR_PA_Nov2026.pdf',
      notes: 'উভয় ফুসফুসে মৃদু ব্রঙ্কোভাস্কুলার মার্কিং। কোনো কনসলিডেশন নেই।',
    },
    {
      patientId: patient.id,
      title: 'বিএসএমএমইউ পূর্ববর্তী প্রেসক্রিপশন কপি',
      reportType: 'prior_prescription',
      fileUrl: '/uploads/reports/rx_bsmmu_prev.pdf',
      fileName: 'BSMMU_Rx_Copy.pdf',
      notes: 'পূর্ববর্তী অ্যাজমা ফলোআপ পরামর্শ ও ইনহেলার নির্দেশিকা।',
    },
  ]);

  // 5. Seed Patient Pre-Visit Request
  await db.insert(patientPreVisits).values([
    {
      patientId: patient.id,
      chiefComplaint: 'গত দুই দিন যাবৎ শুকনো কাশি ও রাতে বুক চেপে আসা অনুভূতি।',
      symptoms: ['কাশি (Cough)', 'শ্বাসকষ্ট (Shortness of Breath)', 'গলা খুসখুস'],
      duration: '২ দিন',
      notes: 'ইনহেলার ব্যবহারের পরও কাশি কমছে না। চিকিৎসকের পরবর্তী সাক্ষাতে আলোচনা করতে চাই।',
      status: 'pending',
    },
  ]);

  // 6. Seed Student Practice Cases
  await db.delete(studentCases);
  await db.insert(studentCases).values([
    {
      title: 'কেস ১: ৪৫ বছর বয়সী রোগীর ক্রনিক কাশি ও সান্ধ্য জ্বর (Pulmonology)',
      specialty: 'পালমোনোলজি (Pulmonology)',
      difficulty: 'intermediate',
      vignette: 'একজন ৪৫ বছর বয়সী ধূমপায়ী পুরুষ গত ৩ সপ্তাহ ধরে সান্ধ্যকালীন হালকা জ্বর, শুকনো কাশি ও ওজন হ্রাসের অভিযোগ নিয়ে এসেছেন। কোনো রক্তবমি বা বুকে ব্যথা নেই।',
      vitals: {
        bp: '120/75 mmHg',
        pulse: '84 bpm',
        temp: '99.4 °F',
        respRate: '18 /min',
        spo2: '97% on room air',
      },
      options: [
        'পালমোনারি টিউবারকিউলোসিস (Pulmonary Tuberculosis)',
        'কমিউনিটি একোয়ার্ড নিউমোনিয়া (Community Acquired Pneumonia)',
        'ক্রনিক ব্রঙ্কাইটিস (Chronic Bronchitis)',
        'গ্যাস্ট্রোইসোফেজিয়াল রিফ্লাক্স ডিজিজ (GERD)',
      ],
      correctOption: 'পালমোনারি টিউবারকিউলোসিস (Pulmonary Tuberculosis)',
      clinicalExplanation: 'বাংলাদেশে ৩ সপ্তাহের অধিক সান্ধ্যকালীন জ্বর, কফসহ কাশি ও ওজন হ্রাস জাতীয় যক্ষ্মা নিয়ন্ত্রণ গাইডলাইন (NTP) অনুসারে পালমোনারি যক্ষ্মার প্রধান ক্লাসিক্যাল লক্ষণ। প্রথম পদক্ষেপ হিসেবে জিনএক্সপার্ট (GeneXpert MTB/RIF) এবং চেস্ট এক্স-রে আবশ্যক।',
      citations: [
        {
          source: 'Bangladesh National Tuberculosis Control Programme (NTP) Guidelines',
          chunk_id: 'guideline-tb-bd-2024',
          quote: 'Patients presenting with cough lasting more than 2 weeks, low-grade evening fever, and night sweats should be prioritized for sputum GeneXpert testing.',
        },
      ],
    },
    {
      title: 'কেস ২: ৫৫ বছর বয়সী ডায়াবেটিক রোগীর তীব্র বুক চাপ ও শ্বাসকষ্ট (Cardiology)',
      specialty: 'কার্ডিওলজি (Cardiology)',
      difficulty: 'advanced',
      vignette: '৫৫ বছর বয়সী অনিয়ন্ত্রিত টাইপ-২ ডায়াবেটিসে আক্রান্ত নারী বুকে হঠাৎ মৃদু অস্বস্তি ও তীব্র শ্বাসকষ্ট, ঘাম ও বমি বমি ভাব নিয়ে জরুরি বিভাগে এসেছেন। ক্লাসিক্যাল তীব্র বুকে ব্যথা নেই।',
      vitals: {
        bp: '90/60 mmHg',
        pulse: '106 bpm',
        temp: '98.6 °F',
        respRate: '24 /min',
        spo2: '93% on room air',
      },
      options: [
        'অ্যাকিউট করোনারি সিন্ড্রোম / সাইলেন্ট এমআই (Silent Myocardial Infarction)',
        'তীব্র প্যানক্রিয়াটাইটিস (Acute Pancreatitis)',
        'অ্যাকিউট অ্যাজমা অ্যাটাক (Acute Asthma Attack)',
        'গ্যাস্ট্রিক আলসার পারফোরেশন (Perforated Peptic Ulcer)',
      ],
      correctOption: 'অ্যাকিউট করোনারি সিন্ড্রোম / সাইলেন্ট এমআই (Silent Myocardial Infarction)',
      clinicalExplanation: 'ডায়াবেটিক নিউরোপ্যাথির কারণে প্রায় এক-তৃতীয়াংশ ডায়াবেটিক রোগীর মায়োকার্ডিয়াল ইনফার্কশন ব্যথাযুক্ত না হয়ে শ্বাসকষ্ট, বমিভাব ও হাইপোটেনশন হিসেবে প্রকাশ পায় (Atypical / Silent MI)। অবিলম্বে ইসিজি ও কার্ডিয়াক ট্রপোনিন-আই (Troponin-I) করা আবশ্যক।',
      citations: [
        {
          source: 'Cardiological Society of India & BSCD Guidelines',
          chunk_id: 'cardio-silent-mi-2025',
          quote: 'Diabetic individuals often present with atypical anginal equivalents such as sudden diaphoresis, unprovoked dyspnea, and hypotension rather than retrosternal crushing pain.',
        },
      ],
    },
    {
      title: 'কেস ৩: ২৮ বছর বয়সী যুবকের পেটের উপরিভাগে জ্বালাপোড়া ও ক্ষুধামন্দা (Gastroenterology)',
      specialty: 'গ্যাস্ট্রোএন্টারোলজি (Gastroenterology)',
      difficulty: 'beginner',
      vignette: '২৮ বছর বয়সী বিশ্ববিদ্যালয়ের শিক্ষার্থী অনিয়মিত খাওয়া ও দীর্ঘ সময় খালি পেটে থাকার পর পেটের উপরিভাগে কামড়ানো ও জ্বালাপোড়ার অভিযোগ করছেন। অ্যান্টাসিড খেলে কিছুটা আরাম বোধ হয়।',
      vitals: {
        bp: '115/70 mmHg',
        pulse: '76 bpm',
        temp: '98.4 °F',
        respRate: '16 /min',
        spo2: '99% on room air',
      },
      options: [
        'পেপটিক আলসার ডিজিজ / ডায়োডেনাল আলসার (Peptic Ulcer Disease / Duodenal Ulcer)',
        'অ্যাকিউট অ্যাপেন্ডিসাইটিস (Acute Appendicitis)',
        'বিলিয়ারি কলিক (Biliary Colic)',
        'ইরিটেবল বাওয়েল সিন্ড্রোম (IBS)',
      ],
      correctOption: 'পেপটিক আলসার ডিজিজ / ডায়োডেনাল আলসার (Peptic Ulcer Disease / Duodenal Ulcer)',
      clinicalExplanation: 'খালি পেটে এপিগ্যাস্ট্রিক জ্বালাপোড়া যা খাদ্য বা অ্যান্টাসিড গ্রহণের পর উপশম হয় তা ডায়োডেনাল আলসারের ক্লাসিক লক্ষণ। রেড ফ্ল্যাগ সিম্পটম (রক্তবমি, মেলিনা, ওজন হ্রাস) অনুপস্থিত থাকলে পিআই (PPI) থেরাপি এবং জীবনযাত্রা সংশোধন প্রথম পদক্ষেপ।',
      citations: [
        {
          source: 'Bangladesh Gastroenterology Society Clinical Consensus',
          chunk_id: 'gastro-pud-bd-2024',
          quote: 'Epigastric hunger pain relieved by food ingestion is highly predictive of peptic ulcer disease in young adults without alarm features.',
        },
      ],
    },
  ]);

  // 7. Seed Student Medical Quizzes
  const sampleChunks = await db.select().from(chunks).limit(1);
  const chunkId = sampleChunks[0]?.id;

  await db.delete(studentQuizzes);
  await db.insert(studentQuizzes).values([
    {
      title: 'হাইপারটেনশন ড্রাগ চয়েস কুইজ',
      topic: 'কার্ডিওলজি (Cardiology)',
      question: 'ডায়াবেটিস মেলিটাস এবং মাইক্রোঅ্যালবুমিনুরিয়া সহ উচ্চ রক্তচাপের রোগীর প্রথম সারির অ্যান্টিহাইপারটেনসিভ ওষুধ কোনটি?',
      options: [
        { key: 'A', text: 'অ্যামলোডিপিন (CCB)' },
        { key: 'B', text: 'লসারটান বা র‍্যামিপ্রিল (ACEi / ARB)' },
        { key: 'C', text: 'অ্যাটেনোলল (Beta Blocker)' },
        { key: 'D', text: 'হাইড্রো Gordon ক্লোরোথায়াজাইড (Diuretic)' },
      ],
      correctAnswer: 'B',
      explanation: 'ডায়াবেটিক নেফ্রোপ্যাথি ও অ্যালবুমিনুরিয়ার ক্ষেত্রে ACE ইনহিবিটর বা ARB রেনোপ্রোটেক্টিভ ভূমিকা পালন করে এবং কিডনি বিকল হওয়ার অগ্রগতি ধীর করে।',
      citationChunkId: chunkId,
    },
    {
      title: 'গর্ভকালীন উচ্চ রক্তচাপ চিকিৎসা কুইজ',
      topic: 'অবস্টেট্রিক্স ও ফারমাকোলজি',
      question: 'গর্ভবতী নারীর ক্ষেত্রে নিচের কোন অ্যান্টিহাইপারটেনসিভ ওষুধটি সম্পূর্ণ বিপরীত নির্দেশিত (Category X / Teratogenic)?',
      options: [
        { key: 'A', text: 'ল্যাবেটালল (Labetalol)' },
        { key: 'B', text: 'মিথাইলডোপা (Methyldopa)' },
        { key: 'C', text: 'এনালাপ্রিল / লসারটান (ACEi / ARB)' },
        { key: 'D', text: 'নিফেডিপিন (Nifedipine)' },
      ],
      correctAnswer: 'C',
      explanation: 'ACEi এবং ARB গর্ভকালীন ভ্রূণের কিডনি বিকলতা, অলিগোহাইড্রামনিওস ও খুলির ত্রুটি ঘটায়। এটি গর্ভাবস্থায় সম্পূর্ণ নিষিদ্ধ।',
      citationChunkId: chunkId,
    },
    {
      title: 'অ্যাজমা অ্যাকিউট ম্যানেজমেন্ট কুইজ',
      topic: 'রেসপিরেটরি মেডিসিন',
      question: 'তীব্র অ্যাজমা অ্যাটাকে তাৎক্ষণিক ব্রঙ্কোডাইলেটেশনের জন্য প্রথম পদক্ষেপের ওষুধ কোনটি?',
      options: [
        { key: 'A', text: 'ইনহেলড স্যালবিউটামল (SABA)' },
        { key: 'B', text: 'ওরাল ডক্সাফিলিন' },
        { key: 'C', text: 'আইভি সিপ্রোফ্লক্সাসিন' },
        { key: 'D', text: 'ইনহেলড স্টেরয়েড ফ্লুটিকাসোন দীর্ঘমেয়াদী ডোজ' },
      ],
      correctAnswer: 'A',
      explanation: 'তীব্র হাঁপানিতে তাৎক্ষণিক দ্রুত ব্রঙ্কোস্পাজম দূর করার জন্য শর্ট অ্যাক্টিং বিটা-২ অ্যাগনিস্ট (যেমন স্যালবিউটামল) নেবুলাইজার বা স্পেসারের মাধ্যমে প্রথম পছন্দ।',
      citationChunkId: chunkId,
    },
  ]);

  // 8. Seed Student Notes if user exists
  if (studentUser) {
    await db.delete(studentNotes).where(eq(studentNotes.userId, studentUser.id));
    await db.insert(studentNotes).values([
      {
        userId: studentUser.id,
        chunkId: chunkId,
        title: 'উচ্চ রক্তচাপের স্টেজিং ও ফার্স্ট লাইন কম্বিনেশন নোট',
        content: '১ম ধাপ: লাইফস্টাইল মডিফিকেশন (লবণ গ্রহণ < ৫ গ্রাম/দিন)। স্টেজ ২ (>১৪০/৯০) হলে ডুয়াল থেরাপি শুরু করতে হবে (ACEi/ARB + CCB)।',
        tags: ['কার্ডিওলজি', 'ফারমাকোলজি', 'গাইডলাইন'],
      },
    ]);
  }

  // 9. Seed Researcher Collections if user exists
  if (researcherUser) {
    await db.delete(researcherCollections).where(eq(researcherCollections.userId, researcherUser.id));
    await db.insert(researcherCollections).values([
      {
        userId: researcherUser.id,
        title: 'জাতীয় সংক্রামক ব্যাধি ও অ্যান্টিবায়োটিক রেজিস্ট্যান্স গাইডলাইন ২০২৬',
        description: 'বাংলাদেশে সিউডোমোনাস ও ই. কোলাই-এর অ্যান্টিবায়োটিক সংবেদনশীলতা ও প্রথম সারির গাইডলাইনসমূহের তুলনামূলক সংকলন।',
        items: [
          {
            title: 'National Antimicrobial Resistance Guidelines Bangladesh',
            year: 2024,
            evidenceLevel: 'Ia',
            notes: 'DGHS endorsed protocol for empirical antibiotic selection',
          },
          {
            title: 'BSMMU Internal Medicine Clinical Protocols',
            year: 2025,
            evidenceLevel: 'Ib',
            notes: 'Hospital-acquired infection control measures',
          },
        ],
        tags: ['AMR', 'Epidemiology', 'Bangladesh'],
      },
      {
        userId: researcherUser.id,
        title: 'অসংক্রামক রোগ (NCD): উচ্চ রক্তচাপ ও ডায়াবেটিস প্রটোকল',
        description: 'গ্রামাঞ্চল ও নগর জনপদে এনসিডি নিয়ন্ত্রণের প্রমিত ক্লিনিকাল ব্যবস্থাপনা নির্দেশিকা।',
        items: [
          {
            title: 'WHO South-East Asia Regional NCD Framework',
            year: 2024,
            evidenceLevel: 'Ia',
            notes: 'Salt reduction & cardiovascular risk assessment charts',
          },
        ],
        tags: ['NCD', 'Hypertension', 'Diabetes'],
      },
    ]);
  }

  console.log('✅ Phase 5 Seeding Complete!');
}

seedPhase5()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Phase 5 seeding error:', err);
    process.exit(1);
  });
