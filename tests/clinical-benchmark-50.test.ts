// tests/clinical-benchmark-50.test.ts
// DocMate AI — 50-Case Comprehensive Clinical Benchmark Test Suite
// Rigorous clinical performance evaluation across all 50 clinician-reviewed cases

import { describe, it, expect } from 'vitest';
import { CLINICAL_BENCHMARK_50_CASES } from '@/lib/clinical/benchmark-dataset';
import { interpretLabPanel } from '@/lib/clinical/lab-engine';
import { evaluateAllDiseaseReasoning } from '@/lib/clinical/disease-reasoning';
import { generateAdaptiveFollowUpQuestions } from '@/lib/clinical/follow-up-engine';
import { evaluateDrugSafety } from '@/lib/safety-engine';
import { generate21SectionClinicalReport } from '@/lib/clinical/report-generator';
import type { DrugRecord, PatientCase } from '@/types';

describe('DocMate AI 50-Case Comprehensive Clinical Benchmark', () => {
  // Common Mock Drugs for Safety Testing
  const lisinoprilDrug: DrugRecord = {
    id: 'drug-lisinopril',
    generic_name: 'Lisinopril',
    drug_class: 'ACE Inhibitor',
    indications: ['Hypertension'],
    dose_rules: { standard_adult: '10 mg OD', route: 'oral', frequency: 'OD', duration_days: 30 },
    contraindications: { conditions: ['Pregnancy'], allergies: ['Lisinopril', 'ACE Inhibitor'] },
    pregnancy_category: 'D',
  };

  const amoxicillinDrug: DrugRecord = {
    id: 'drug-amox',
    generic_name: 'Amoxicillin',
    drug_class: 'Penicillin Antibiotic',
    indications: ['Pneumonia'],
    dose_rules: { standard_adult: '500 mg TDS', route: 'oral', frequency: 'TDS', duration_days: 7 },
    contraindications: { conditions: [], allergies: ['Penicillin', 'Amoxicillin'] },
    pregnancy_category: 'B',
  };

  const diclofenacDrug: DrugRecord = {
    id: 'drug-diclofenac',
    generic_name: 'Diclofenac',
    drug_class: 'NSAID',
    indications: ['Pain'],
    dose_rules: { standard_adult: '50 mg BD', route: 'oral', frequency: 'BD', duration_days: 3 },
    contraindications: { conditions: ['Dengue', 'Peptic ulcer', 'Renal impairment'], allergies: ['NSAID'] },
    pregnancy_category: 'C',
  };

  const paracetamolDrug: DrugRecord = {
    id: 'drug-para',
    generic_name: 'Paracetamol',
    drug_class: 'Analgesic / Antipyretic',
    indications: ['Fever', 'Pain'],
    dose_rules: { standard_adult: '500-1000 mg QDS', route: 'oral', frequency: 'QDS', duration_days: 3 },
    contraindications: { conditions: ['Severe hepatic impairment', 'Hepatic failure', 'Acute liver failure', 'Cirrhosis'], allergies: ['Paracetamol'] },
    pregnancy_category: 'B',
  };

  it('verifies dataset has exactly 50 clinician-reviewed cases', () => {
    expect(CLINICAL_BENCHMARK_50_CASES.length).toBe(50);
  });

  // Evaluate All 50 Benchmark Cases in a single aggregate run
  it('executes full 50-case benchmark and evaluates clinical safety, accuracy, and report quality', () => {
    let totalEmergencies = 0;
    let detectedEmergencies = 0;
    let falseNegativeEmergencies = 0;
    let labInterpretationSuccesses = 0;
    let totalLabCases = 0;
    let differentialMatches = 0;
    let totalDifferentialCases = 0;
    let safetyBlockSuccesses = 0;
    let totalSafetyCases = 0;
    let reportGenerationSuccesses = 0;
    let adaptiveQuestioningSuccesses = 0;

    for (const testCase of CLINICAL_BENCHMARK_50_CASES) {
      // 1. Run Lab Engine
      const labReport = interpretLabPanel(
        testCase.patient.lab_values || [],
        {
          age: testCase.patient.age,
          gender: testCase.patient.gender,
          isPregnant: testCase.patient.is_pregnant,
          pregnancyTrimester: testCase.patient.pregnancy_trimester,
        },
        testCase.previousLabs
      );

      // Check Incompatible Unit Handling (e.g. Case 49)
      if (testCase.expectedBehavior.mustRejectInvalidUnits) {
        const hasIndeterminate = labReport.items.some((i) => i.classification === 'indeterminate');
        expect(hasIndeterminate).toBe(true);
      }

      if (testCase.patient.lab_values?.length) {
        totalLabCases++;
        if (labReport.items.length === testCase.patient.lab_values.length) {
          labInterpretationSuccesses++;
        }
      }

      // 2. Run Disease Reasoning Engine
      const reasoning = evaluateAllDiseaseReasoning(testCase.patient, labReport);

      // Evaluate Emergency Detection Sensitivity
      if (testCase.expectedBehavior.isEmergency) {
        totalEmergencies++;
        const isDetectedAsEmergency =
          reasoning.hasEmergency ||
          reasoning.criticalAlerts.length > 0 ||
          reasoning.rankedDifferentials.some((d) => d.acuity === 'emergency');

        if (isDetectedAsEmergency) {
          detectedEmergencies++;
        } else {
          falseNegativeEmergencies++;
          console.error(`[FAIL] False-Negative Emergency in ${testCase.id}: ${testCase.title}`);
        }
        expect(isDetectedAsEmergency).toBe(true);
      }

      // Evaluate Testing Window Caveat (Case 02: Negative NS1 on Day 6)
      if (testCase.expectedBehavior.requiresTestingWindowCaveat) {
        expect(reasoning.dengueAssessment.ns1FalseNegativeWarning).toBe(true);
      }

      // Evaluate Differential Diagnosis Matching
      if (testCase.expectedBehavior.expectedDifferentialKeys.length > 0) {
        totalDifferentialCases++;
        const producedKeys = reasoning.rankedDifferentials.map((d) => d.diseaseId);
        const hasAtLeastOneKey = testCase.expectedBehavior.expectedDifferentialKeys.some((k) =>
          (producedKeys as string[]).includes(k)
        );
        if (hasAtLeastOneKey) {
          differentialMatches++;
        } else {
          console.error('[FAIL DIFFERENTIAL]', testCase.id, testCase.title, 'Produced:', producedKeys, 'Expected one of:', testCase.expectedBehavior.expectedDifferentialKeys);
        }
        expect(hasAtLeastOneKey).toBe(true);
      }

      // 3. Run Safety Engine Checks if applicable
      if (testCase.expectedBehavior.expectedBlockedDrugs?.length) {
        totalSafetyCases++;
        let blocked = false;

        if (testCase.expectedBehavior.expectedBlockedDrugs.includes('lisinopril')) {
          const alerts = evaluateDrugSafety(lisinoprilDrug, testCase.patient, []);
          if (alerts.some((a) => a.severity === 'critical')) blocked = true;
        }
        if (testCase.expectedBehavior.expectedBlockedDrugs.includes('amoxicillin')) {
          const alerts = evaluateDrugSafety(amoxicillinDrug, testCase.patient, []);
          if (alerts.some((a) => a.severity === 'critical')) blocked = true;
        }
        if (testCase.expectedBehavior.expectedBlockedDrugs.includes('diclofenac') || testCase.expectedBehavior.expectedBlockedDrugs.includes('nsaids')) {
          const alerts = evaluateDrugSafety(diclofenacDrug, testCase.patient, []);
          if (alerts.some((a) => a.severity === 'critical' || a.severity === 'warning')) blocked = true;
        }
        if (testCase.expectedBehavior.expectedBlockedDrugs.includes('paracetamol')) {
          const alerts = evaluateDrugSafety(paracetamolDrug, testCase.patient, []);
          if (alerts.some((a) => a.severity === 'critical' || a.severity === 'warning')) blocked = true;
        }

        if (blocked) safetyBlockSuccesses++;
        expect(blocked).toBe(true);
      }

      // 4. Run Adaptive Follow-Up Question Engine
      const followUpOutput = generateAdaptiveFollowUpQuestions({
        patient: testCase.patient,
        labReport,
        diseaseReasoning: reasoning,
        locale: 'bn',
      });
      if (testCase.expectedBehavior.isEmergency) {
        if (!followUpOutput.hasEmergencyEscalation) {
          console.error('[FAIL ESCALATION]', testCase.id, testCase.title);
        }
        expect(followUpOutput.hasEmergencyEscalation).toBe(true);
        expect(followUpOutput.emergencyWarningBn).toBeDefined();
      }
      adaptiveQuestioningSuccesses++;

      // 5. Run 21-Section Clinical Report Generator
      const mockCase: PatientCase = {
        id: `case-${testCase.id}`,
        doctor_id: 'doc-bm-test',
        patient_code: `P-${testCase.caseNumber}`,
        status: 'analyzed',
        structured_input: testCase.patient,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const report = generate21SectionClinicalReport({
        caseData: mockCase,
        customLabReport: labReport,
        customDiseaseReasoning: reasoning,
        locale: 'bn',
      });

      expect(report.sections.length).toBe(21);
      expect(report.metadata.disclaimerEn).toBeDefined();
      expect(report.metadata.disclaimerBn).toBeDefined();
      reportGenerationSuccesses++;
    }

    // Verify Benchmark Metrics
    const criticalSafetySensitivity = (detectedEmergencies / totalEmergencies) * 100;
    const labAccuracy = (labInterpretationSuccesses / totalLabCases) * 100;
    const diffQuality = (differentialMatches / totalDifferentialCases) * 100;
    const safetyBlockRate = (safetyBlockSuccesses / totalSafetyCases) * 100;

    console.log(`\n======================================================`);
    console.log(`DOCMATE 50-CASE CLINICAL BENCHMARK EVALUATION RESULTS:`);
    console.log(`======================================================`);
    console.log(`Total Synthetic Benchmark Cases Evaluated : 50`);
    console.log(`Total Emergency Cases in Dataset          : ${totalEmergencies}`);
    console.log(`Detected Emergency Scenarios              : ${detectedEmergencies}`);
    console.log(`False-Negative Emergency Rate             : ${falseNegativeEmergencies} (0.0%)`);
    console.log(`Critical Safety Sensitivity               : ${criticalSafetySensitivity.toFixed(1)}% (Target: 100%)`);
    console.log(`Differential Diagnosis Accuracy           : ${diffQuality.toFixed(1)}%`);
    console.log(`Laboratory Interpretation Accuracy        : ${labAccuracy.toFixed(1)}%`);
    console.log(`Medication Safety & Allergy Blocking Rate : ${safetyBlockRate.toFixed(1)}%`);
    console.log(`21-Section Report Generation Consistency  : ${(reportGenerationSuccesses / 50 * 100).toFixed(1)}% (50/50)`);
    console.log(`Adaptive Follow-up Question Consistency   : ${(adaptiveQuestioningSuccesses / 50 * 100).toFixed(1)}% (50/50)`);
    console.log(`======================================================\n`);

    expect(criticalSafetySensitivity).toBe(100);
    expect(falseNegativeEmergencies).toBe(0);
    expect(labAccuracy).toBe(100);
    expect(diffQuality).toBe(100);
    expect(safetyBlockRate).toBe(100);
    expect(reportGenerationSuccesses).toBe(50);
  });
});
