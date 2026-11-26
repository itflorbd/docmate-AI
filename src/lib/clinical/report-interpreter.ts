import type { LabItemInterpretation, LabInterpretationResult, LabAcuity, LabValue, PatientVitals } from '@/types';

interface ClinicalContext {
  chiefComplaint?: string;
  symptoms?: string[];
  vitals?: PatientVitals | Record<string, unknown>;
  age?: number;
  gender?: 'male' | 'female' | 'other';
}

/**
 * Parses free-form text or structured lab values into clinical interpretation items.
 */
export function interpretLabReport(
  rawInput: string | LabValue[],
  context: ClinicalContext = {}
): LabInterpretationResult {
  const items: LabItemInterpretation[] = [];

  const textToScan = typeof rawInput === 'string'
    ? rawInput
    : rawInput.map((lv) => `${lv.name}: ${lv.value} ${lv.unit}`).join(', ');

  const contextStr = `${context.chiefComplaint || ''} ${(context.symptoms || []).join(' ')}`.toLowerCase();
  const isRespiratory = /cough|breath|fever|chest|কাশি|শ্বাস|বুক|জ্বর|নিউমোনিয়া/i.test(contextStr);
  const isDengueSuspect = /dengue|fever|body ache|rash|ডেঙ্গু|ব্যথা/i.test(contextStr);

  // 1. WBC / TLC Scan
  const wbcMatch = textToScan.match(/(?:wbc|tlc|total\s*(?:leukocyte|count))\s*[:=]?\s*([0-9]+(?:,[0-9]+)?(?:\.[0-9]+)?)/i);
  if (wbcMatch) {
    const rawVal = parseFloat(wbcMatch[1].replace(/,/g, ''));
    // Normalize if entered in thousands (e.g., 14.5 -> 14,500)
    const val = rawVal < 100 ? rawVal * 1000 : rawVal;
    let acuity: LabAcuity = 'normal';
    let meaningBn = 'স্বাভাবিক শ্বেত রক্তকণিকা কাউন্ট (Normal TLC)।';
    let meaningEn = 'Total leukocyte count is within physiological baseline limits.';

    if (val > 11000) {
      acuity = val > 20000 ? 'critical' : 'abnormal';
      meaningBn = `লিউকোসাইটোসিস (Leukocytosis, ${val}/mm³): ${isRespiratory ? 'তীব্র ব্যাকটেরিয়াল শ্বাসতন্ত্রের সংক্রমণ (যেমন: লোবার নিউমোনিয়া)-এর প্রবল নির্দেশক।' : 'তীব্র সংক্রমণ বা ইনফ্ল্যামেশনের লক্ষণ।'}`;
      meaningEn = `Leukocytosis (${val}/mm³): ${isRespiratory ? 'Strongly correlates with acute bacterial lower respiratory tract infection (e.g. Lobar Pneumonia).' : 'Indicates active acute infection or severe inflammatory process.'}`;
    } else if (val < 4000) {
      acuity = val < 2500 ? 'critical' : 'abnormal';
      meaningBn = `লিউকোপেনিয়া (Leukopenia, ${val}/mm³): ভাইরাল সংক্রমণ (যেমন: ডেঙ্গু) অথবা ইমিউনোসাপ্রেশনের সম্ভাবনা।`;
      meaningEn = `Leukopenia (${val}/mm³): Suspicious for viral etiology (e.g. Dengue, Arboviral) or bone marrow suppression.`;
    }

    items.push({
      key: 'wbc',
      nameBn: 'মোট শ্বেত রক্তকণিকা (Total WBC/TLC)',
      nameEn: 'Total Leukocyte Count (TLC)',
      value: val,
      unit: '/mm³',
      referenceRange: '4,000 - 11,000 /mm³',
      acuity,
      clinicalMeaningBn: meaningBn,
      clinicalMeaningEn: meaningEn,
      physiologicalRoleBn: 'শরীরের প্রধান রোগ প্রতিরোধ ও ইনফেকশন ডিফেন্স সেল।',
      physiologicalRoleEn: 'Primary immune defense against pathogens and infection.',
    });
  }

  // 2. Neutrophil Percentage Scan
  const neutroMatch = textToScan.match(/(?:neutrophil|neutrophils|polymorphs?)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i);
  if (neutroMatch) {
    const val = parseFloat(neutroMatch[1]);
    let acuity: LabAcuity = 'normal';
    let meaningBn = 'স্বাভাবিক নিউট্রোফিল আনুপাতিক হার (Normal Differential)।';
    let meaningEn = 'Neutrophil relative proportion within expected range.';

    if (val > 75) {
      acuity = val > 85 ? 'critical' : 'abnormal';
      meaningBn = `নিউট্রোফিলিয়া (Neutrophilia ${val}%): একিউট ব্যাকটেরিয়াল পাইওজেনিক সংক্রমণের প্রতি শরীরের সেলুলার প্রতিক্রিয়া।`;
      meaningEn = `Neutrophilia (${val}%): Consistent with acute bacterial pyogenic shift in response to infectious stimulus.`;
    } else if (val < 40) {
      acuity = 'abnormal';
      meaningBn = `নিউট্রোপেনিয়া (${val}%): সম্ভাব্য ভাইরাল আক্রমণ বা ওষুধের পার্শ্বপ্রতিক্রিয়া।`;
      meaningEn = `Neutropenia (${val}%): Consider viral suppression or drug-induced marrow suppression.`;
    }

    items.push({
      key: 'neutrophils',
      nameBn: 'নিউট্রোফিল শতাংশ (Neutrophils %)',
      nameEn: 'Neutrophils (%)',
      value: `${val}%`,
      unit: '%',
      referenceRange: '40% - 75%',
      acuity,
      clinicalMeaningBn: meaningBn,
      clinicalMeaningEn: meaningEn,
    });
  }

  // 3. Platelet Count Scan
  const pltMatch = textToScan.match(/(?:platelet|platelets|plt)\s*[:=]?\s*([0-9]+(?:,[0-9]+)?(?:\.[0-9]+)?)/i);
  if (pltMatch) {
    const rawVal = parseFloat(pltMatch[1].replace(/,/g, ''));
    const val = rawVal < 1000 ? rawVal * 1000 : rawVal;
    let acuity: LabAcuity = 'normal';
    let meaningBn = 'প্লাটিলেট মাত্রা স্বাভাবিক রয়েছে।';
    let meaningEn = 'Platelet count is within physiological hemostatic limits.';

    if (val < 150000) {
      acuity = val < 50000 ? 'critical' : 'abnormal';
      meaningBn = `থ্রম্বোসাইটোপেনিয়া (Thrombocytopenia, ${val}/mm³): ${isDengueSuspect ? 'ডেঙ্গু ফিভার বা সেপসিসের গুরুত্বপূর্ণ সতর্কচিহ্ন। প্লাজমা লিকেজ ও রক্তক্ষরণের লক্ষণ পর্যবেক্ষণ করুন।' : 'রক্তজমাট বাধার ঝুঁকি ও প্লেটলেট ধ্বংসের সম্ভাবনা।'}`;
      meaningEn = `Thrombocytopenia (${val}/mm³): ${isDengueSuspect ? 'Critical warning marker in Dengue or Sepsis. Monitor serial hematocrit and signs of plasma leakage.' : 'Increased bleeding risk and potential peripheral destruction.'}`;
    }

    items.push({
      key: 'platelets',
      nameBn: 'প্লাটিলেট সংখ্যা (Platelets)',
      nameEn: 'Platelet Count (PLT)',
      value: val,
      unit: '/mm³',
      referenceRange: '150,000 - 450,000 /mm³',
      acuity,
      clinicalMeaningBn: meaningBn,
      clinicalMeaningEn: meaningEn,
    });
  }

  // 4. Hemoglobin (Hb) Scan
  const hbMatch = textToScan.match(/(?:hemoglobin|haemoglobin|hb)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (hbMatch) {
    const val = parseFloat(hbMatch[1]);
    let acuity: LabAcuity = 'normal';
    let meaningBn = 'হিমোগ্লোবিন লেভেল স্বাভাবিক।';
    let meaningEn = 'Hemoglobin oxygen-carrying capacity within reference limits.';

    if (val < 10.0) {
      acuity = val < 7.0 ? 'critical' : 'abnormal';
      meaningBn = `অ্যানিমিয়া (Anemia, Hb ${val} g/dL): টিস্যু অক্সিজেনেশনে ঘাটতি; ${val < 7.0 ? 'জরুরি রক্ত সঞ্চালন (Blood Transfusion) বিবেচনা প্রয়োজন।' : 'পুষ্টিজনিত বা দীর্ঘমেয়াদি রক্তক্ষরণের উৎস নির্ণয় করুন।'}`;
      meaningEn = `Anemia (Hb ${val} g/dL): Compromised oxygen transport. ${val < 7.0 ? 'Critical tier: urgent packed red cell transfusion evaluation indicated.' : 'Investigate chronic loss or nutritional deficiency.'}`;
    }

    items.push({
      key: 'hemoglobin',
      nameBn: 'হিমোগ্লোবিন (Hemoglobin / Hb)',
      nameEn: 'Hemoglobin (Hb)',
      value: val,
      unit: 'g/dL',
      referenceRange: '12.0 - 16.0 g/dL',
      acuity,
      clinicalMeaningBn: meaningBn,
      clinicalMeaningEn: meaningEn,
    });
  }

  // 5. Serum Creatinine Scan
  const creatMatch = textToScan.match(/(?:creatinine|s\.?\s*creat|serum\s*creat)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (creatMatch) {
    const val = parseFloat(creatMatch[1]);
    let acuity: LabAcuity = 'normal';
    let meaningBn = 'কিডনির কার্যকারিতা স্বাভাবিক নির্দেশ করছে।';
    let meaningEn = 'Renal clearance baseline is within normal parameters.';

    if (val > 1.3) {
      acuity = val > 3.0 ? 'critical' : 'abnormal';
      meaningBn = `এলিভেটেড ক্রিয়েটিনিন (${val} mg/dL): অ্যাকিউট কিডনি ইনজুরি (AKI) বা রেনাল বৈকল্য। নেফ্রোটক্সিক ড্রাগ পরিহার করুন এবং অ্যান্টিবায়োটিক ডোজ সমন্বয় (Renal Adjustment) করুন।`;
      meaningEn = `Elevated Serum Creatinine (${val} mg/dL): Indicates acute kidney injury or chronic impairment. Adjust renally cleared antibiotic dosing and avoid nephrotoxic NSAIDs.`;
    }

    items.push({
      key: 'creatinine',
      nameBn: 'সেরাম ক্রিয়েটিনিন (Serum Creatinine)',
      nameEn: 'Serum Creatinine (S.Cr)',
      value: val,
      unit: 'mg/dL',
      referenceRange: '0.6 - 1.2 mg/dL',
      acuity,
      clinicalMeaningBn: meaningBn,
      clinicalMeaningEn: meaningEn,
    });
  }

  // 6. Potassium (K+) Scan
  const kMatch = textToScan.match(/(?:potassium|serum\s*k\+?|s\.?\s*k\+?|\bk\+|\bk\b\s*[:=])\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]);
    let acuity: LabAcuity = 'normal';
    let meaningBn = 'ইলেক্ট্রোলাইট পটাশিয়াম স্বাভাবিক।';
    let meaningEn = 'Serum potassium within electrophysiological safety zone.';

    if (val > 5.2) {
      acuity = val > 6.0 ? 'critical' : 'abnormal';
      meaningBn = `হাইপারক্যালেমিয়া (Hyperkalemia ${val} mmol/L): কার্ডিয়াক অ্যারিদমিয়ার মারাত্মক ঝুঁকি! তাত্ক্ষণিক ১২-লিড ইসিজি নিশ্চিত করুন।`;
      meaningEn = `Hyperkalemia (${val} mmol/L): Significant cardiac arrhythmia risk. STAT 12-lead ECG and urgent stabilization protocol indicated.`;
    } else if (val < 3.5) {
      acuity = val < 2.8 ? 'critical' : 'abnormal';
      meaningBn = `হাইপোক্যালেমিয়া (Hypokalemia ${val} mmol/L): পেশীর দুর্বলতা ও ভেন্ট্রিকুলার বিরূপতার ঝুঁকি। পটাশিয়াম রিপ্লেসমেন্ট প্রয়োজন।`;
      meaningEn = `Hypokalemia (${val} mmol/L): Risk of muscle weakness, ileus, and ventricular irritability. Potassium replacement required.`;
    }

    items.push({
      key: 'potassium',
      nameBn: 'সেরাম পটাশিয়াম (Serum Potassium / K+)',
      nameEn: 'Serum Potassium (K+)',
      value: val,
      unit: 'mmol/L',
      referenceRange: '3.5 - 5.1 mmol/L',
      acuity,
      clinicalMeaningBn: meaningBn,
      clinicalMeaningEn: meaningEn,
    });
  }

  // 7. Chest Radiograph / CXR Scan
  const cxrMatch = textToScan.match(/(?:cxr|x-?ray|chest\s*radiograph|বুকের\s*এক্স-?রে)\s*[:=]?\s*([^,.\n]+)/i);
  if (cxrMatch || /consolidation|infiltrate|pleural\s*effusion|pneumothorax|কনসলিডেশন|ইনফিল্ট্রেট/i.test(textToScan)) {
    const findingsStr = cxrMatch ? cxrMatch[1].trim() : textToScan;
    let acuity: LabAcuity = 'normal';
    let meaningBn = 'বুকের এক্স-রেতে ফুসফুস ক্ষেত্র স্বাভাবিক।';
    let meaningEn = 'Chest radiograph demonstrates clear lung fields without acute focal opacity.';

    if (/consolidation|লোবার|কনসলিডেশন|ইনফিল্ট্রেট|infiltrat|patchy|opacity/i.test(findingsStr)) {
      acuity = 'abnormal';
      meaningBn = 'লোবার কনসোলিডেশন / অপাসিটি (Lobar Consolidation): ব্যাকটেরিয়াল নিউমোনিয়ার সুস্পষ্ট রেডিওলজিক্যাল প্রমাণ।';
      meaningEn = 'Lobar Consolidation / Infiltrate: Definitive radiological confirmation of Community-Acquired Pneumonia.';
    } else if (/effusion|fluid|পানি|প্লুরাল/i.test(findingsStr)) {
      acuity = 'critical';
      meaningBn = 'প্লুরাল ইফিউশন (Pleural Effusion): ফুসফুসের পর্দায় তরল সঞ্চয়ন; প্যারাপনিউমোনিক বা এক্সুডেটিভ জটিলতার ইঙ্গিত।';
      meaningEn = 'Pleural Effusion: Fluid accumulation in pleural space; points toward parapneumonic complication.';
    } else if (/pneumothorax|হাওয়া/i.test(findingsStr)) {
      acuity = 'critical';
      meaningBn = 'নিউমোথোরাক্স (Pneumothorax): প্লুরাল স্পেসে বাতাস প্রবেশের জরুরি সার্জিক্যাল সংকেত।';
      meaningEn = 'Pneumothorax: Air trapped in pleural space; immediate surgical/intercostal drain assessment.';
    }

    items.push({
      key: 'cxr',
      nameBn: 'বুকের এক্স-রে (Chest X-ray Findings)',
      nameEn: 'Chest Radiograph (CXR)',
      value: findingsStr.length > 50 ? `${findingsStr.slice(0, 50)}...` : findingsStr,
      unit: 'Imaging',
      referenceRange: 'Clear lung fields, normal cardiothoracic ratio',
      acuity,
      clinicalMeaningBn: meaningBn,
      clinicalMeaningEn: meaningEn,
    });
  }

  // 8. SpO2 Scan
  const spo2Match = textToScan.match(/(?:spo2|o2\s*sat|saturation)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*%?/i);
  if (spo2Match) {
    const val = parseFloat(spo2Match[1]);
    let acuity: LabAcuity = 'normal';
    let meaningBn = 'অক্সিজেন স্যাচুরেশন স্বাভাবিক রয়েছে।';
    let meaningEn = 'Peripheral arterial oxygen saturation is within physiological target.';

    if (val < 92) {
      acuity = val < 88 ? 'critical' : 'abnormal';
      meaningBn = `হাইপোক্সেমিয়া (Hypoxemia, SpO2 ${val}%): তাৎক্ষণিক সাপ্লিমেন্টাল অক্সিজেন থেরাপি এবং তীব্র নিউমোনিয়ার হাসপাতালে ভর্তির মাপকাঠি।`;
      meaningEn = `Hypoxemia (SpO2 ${val}%): Immediate supplemental oxygen indicated; major criterion for hospitalization in acute pneumonia.`;
    }

    items.push({
      key: 'spo2',
      nameBn: 'অক্সিজেন স্যাচুরেশন (SpO2)',
      nameEn: 'Pulse Oximetry (SpO2)',
      value: `${val}%`,
      unit: '%',
      referenceRange: '95% - 100%',
      acuity,
      clinicalMeaningBn: meaningBn,
      clinicalMeaningEn: meaningEn,
    });
  }

  const hasLabData = items.length > 0;
  const overallAcuity: LabAcuity = items.some((i) => i.acuity === 'critical')
    ? 'critical'
    : items.some((i) => i.acuity === 'abnormal')
    ? 'abnormal'
    : 'normal';

  const abnormalItems = items.filter((i) => i.acuity !== 'normal');
  const criticalItems = items.filter((i) => i.acuity === 'critical');

  let clinicalSummaryBn = 'প্রদত্ত ল্যাব বা ডায়াগনস্টিক পরীক্ষার মানসমূহ স্বাভাবিক সীমার মধ্যে রয়েছে।';
  let clinicalSummaryEn = 'All documented diagnostic laboratory parameters are currently within normal baseline ranges.';

  if (criticalItems.length > 0) {
    const names = criticalItems.map((c) => c.nameBn).join(', ');
    clinicalSummaryBn = `🚨 **জরুরি ক্লিনিকাল সংকেত**: ${names} ক্রিটিক্যাল পর্যায়ে রয়েছে। তাত্ক্ষণিক মেডিকেল হস্তক্ষেপ ও নিবিড় পর্যবেক্ষণ প্রয়োজন।`;
    clinicalSummaryEn = `🚨 **Critical Diagnostic Alert**: Elevated risk detected across ${criticalItems.map((c) => c.nameEn).join(', ')}. Immediate clinical intervention required.`;
  } else if (abnormalItems.length > 0) {
    const names = abnormalItems.map((c) => c.nameBn).join(', ');
    clinicalSummaryBn = `⚠️ **অস্বাভাবিক ফলাফল সনাক্ত**: ${names}-এ অস্বাভাবিক পরিবর্তন রোগীর বর্তমান উপসর্গের সাথে সংগতিপূর্ণ এবং নির্দিষ্ট প্যাথলজির দিকে নির্দেশ করছে।`;
    clinicalSummaryEn = `⚠️ **Abnormal Findings Identified**: Pathological shifts in ${abnormalItems.map((c) => c.nameEn).join(', ')} align with presenting clinical symptoms.`;
  }

  // Differential impact
  const differentialImpactBn: string[] = [];
  const differentialImpactEn: string[] = [];

  const hasPneumoniaLabs = items.some((i) => i.key === 'wbc' && (i.acuity === 'abnormal' || i.acuity === 'critical')) ||
    items.some((i) => i.key === 'cxr' && (i.acuity === 'abnormal' || i.acuity === 'critical'));

  if (hasPneumoniaLabs && isRespiratory) {
    differentialImpactBn.push('কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া (CAP)-এর সম্ভাবনাকে অত্যন্ত জোরালোভাবে সমর্থন করছে।');
    differentialImpactEn.push('Strongly elevates pre-test probability for Community-Acquired Pneumonia (CAP).');
  }

  const hasLowPlatelets = items.some((i) => i.key === 'platelets' && i.acuity !== 'normal');
  if (hasLowPlatelets) {
    differentialImpactBn.push('ডেঙ্গু শক সিন্ড্রোম / সেপসিস ডিসিমিনেটেড ইন্ট্রাভাসকুলার জমাটবদ্ধতার ঝুঁকি বিবেচনায় আনুন।');
    differentialImpactEn.push('Increases suspicion for Dengue warning signs or systemic consumptive coagulopathy.');
  }

  const actionableNextStepsBn: string[] = [];
  const actionableNextStepsEn: string[] = [];

  if (items.some((i) => i.key === 'creatinine' && i.acuity !== 'normal')) {
    actionableNextStepsBn.push('অ্যান্টিবায়োটিক বা নেফ্রোটক্সিক ড্রাগের ডোজ রেনাল ক্লিয়ারেন্স (eGFR) অনুযায়ী সমন্বয় করুন।');
    actionableNextStepsEn.push('Adjust dosage of renally cleared medications according to estimated GFR.');
  }
  if (items.some((i) => i.key === 'spo2' && i.acuity !== 'normal')) {
    actionableNextStepsBn.push('নাসাল ক্যানুলা বা ফেস মাস্ক দিয়ে টার্গেট SpO2 ৯৪-৯৮% নিশ্চিত করতে অক্সিজেন শুরু করুন।');
    actionableNextStepsEn.push('Initiate supplemental oxygen via nasal cannula targeting SpO2 94-98%.');
  }

  return {
    hasLabData,
    overallAcuity,
    items,
    clinicalSummaryBn,
    clinicalSummaryEn,
    differentialImpactBn,
    differentialImpactEn,
    actionableNextStepsBn,
    actionableNextStepsEn,
  };
}
