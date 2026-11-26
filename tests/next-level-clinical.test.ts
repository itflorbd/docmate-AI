import { describe, it, expect } from 'vitest';
import { interpretLabReport } from '@/lib/clinical/report-interpreter';
import { calculateCurb65, assessDengueProtocol } from '@/lib/clinical/calculators';
import { synthesizeConsensus } from '@/lib/clinical/consensus-engine';
import type { ScoredChunk } from '@/lib/retrieval';

describe('Next-Level Clinical AI Co-Pilot Suite', () => {
  describe('1. Smart Lab & Diagnostic Report Interpreter', () => {
    it('accurately parses elevated WBC and neutrophilia with respiratory correlation', () => {
      const input = 'WBC 14500, Neutrophils 82%, Platelets 220000, Hb 12.5';
      const result = interpretLabReport(input, {
        chiefComplaint: 'fever and cough for 3 days',
        symptoms: ['fever', 'cough'],
      });

      expect(result.hasLabData).toBe(true);
      expect(result.overallAcuity).toBe('abnormal');
      expect(result.items.length).toBe(4);

      const wbc = result.items.find((i) => i.key === 'wbc');
      expect(wbc).toBeDefined();
      expect(wbc?.value).toBe(14500);
      expect(wbc?.acuity).toBe('abnormal');
      expect(wbc?.clinicalMeaningBn).toContain('লোবার নিউমোনিয়া');

      const neutro = result.items.find((i) => i.key === 'neutrophils');
      expect(neutro).toBeDefined();
      expect(neutro?.value).toBe('82%');
      expect(neutro?.acuity).toBe('abnormal');

      expect(result.differentialImpactBn.length).toBeGreaterThanOrEqual(1);
      expect(result.differentialImpactBn[0]).toContain('কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া');
    });

    it('flags critical thrombocytopenia and prompts for plasma leakage in dengue suspect', () => {
      const input = 'PLT 42000, Hb 14.8, WBC 3200';
      const result = interpretLabReport(input, {
        chiefComplaint: 'high fever and retro-orbital pain',
        symptoms: ['fever', 'headache', 'dengue suspect'],
      });

      expect(result.hasLabData).toBe(true);
      expect(result.overallAcuity).toBe('critical');

      const plt = result.items.find((i) => i.key === 'platelets');
      expect(plt).toBeDefined();
      expect(plt?.acuity).toBe('critical');
      expect(plt?.clinicalMeaningBn).toContain('প্লাজমা লিকেজ');

      const wbc = result.items.find((i) => i.key === 'wbc');
      expect(wbc).toBeDefined();
      expect(wbc?.acuity).toBe('abnormal');
      expect(wbc?.clinicalMeaningBn).toContain('লিউকোপেনিয়া');
    });

    it('identifies renal impairment and highlights drug dosage adjustment', () => {
      const input = 'Serum Creatinine 2.4 mg/dL, K+ 5.8 mmol/L';
      const result = interpretLabReport(input, {});

      expect(result.hasLabData).toBe(true);
      const creat = result.items.find((i) => i.key === 'creatinine');
      expect(creat).toBeDefined();
      expect(creat?.acuity).toBe('abnormal');
      expect(creat?.clinicalMeaningBn).toContain('রেনাল');

      const k = result.items.find((i) => i.key === 'potassium');
      expect(k).toBeDefined();
      expect(k?.acuity).toBe('abnormal');
      expect(k?.clinicalMeaningBn).toContain('হাইপারক্যালেমিয়া');

      expect(result.actionableNextStepsBn.some((s) => s.includes('ডোজ'))).toBe(true);
    });

    it('interprets chest X-ray findings for lobar consolidation', () => {
      const input = 'CXR: Right lower zone consolidation present';
      const result = interpretLabReport(input, { chiefComplaint: 'cough and fever' });

      expect(result.hasLabData).toBe(true);
      const cxr = result.items.find((i) => i.key === 'cxr');
      expect(cxr).toBeDefined();
      expect(cxr?.acuity).toBe('abnormal');
      expect(cxr?.clinicalMeaningBn).toContain('লোবার কনসোলিডেশন');
    });
  });

  describe('2. Automated Clinical Severity & Risk Scoring', () => {
    it('calculates CURB-65 correctly for low-risk outpatient pneumonia', () => {
      const score = calculateCurb65({
        age: 45,
        confusion: false,
        respiratory_rate: 22,
        systolic_bp: 120,
        diastolic_bp: 80,
      });

      expect(score.calculatorId).toBe('crb65');
      expect(score.score).toBe(0);
      expect(score.riskTier).toBe('low');
      expect(score.recommendationBn).toContain('বাসায় রেখে চিকিৎসা');
    });

    it('calculates CURB-65 correctly for high-risk elderly pneumonia requiring admission', () => {
      const score = calculateCurb65({
        age: 72, // 1 pt
        confusion: true, // 1 pt
        urea_mmol_per_l: 8.5, // 1 pt
        respiratory_rate: 34, // 1 pt
        systolic_bp: 85, // 1 pt
        diastolic_bp: 55,
      });

      expect(score.calculatorId).toBe('curb65');
      expect(score.score).toBe(5);
      expect(score.riskTier).toBe('critical');
      expect(score.recommendationBn).toContain('হাসপাতালে ভর্তি');
    });

    it('assesses Dengue protocol for Group B with warning signs', () => {
      const score = assessDengueProtocol({
        hasWarningSigns: true,
        warningSignsList: ['Persistent vomiting', 'Abdominal tenderness'],
        plateletCount: 85000,
        systolicBp: 110,
        diastolicBp: 75,
      });

      expect(score.calculatorId).toBe('dengue_warning');
      expect(score.riskTier).toBe('high');
      expect(score.riskDescriptionBn).toContain('গ্রুপ বি');
      expect(score.recommendationBn).toContain('হাসপাতালে ভর্তি');
    });
  });

  describe('3. Multi-Document Cross-Library Consensus Engine', () => {
    it('synthesizes consensus between multiple guidelines and preserves verbatim quotes', () => {
      const mockChunks: ScoredChunk[] = [
        {
          id: 'chunk-who-1',
          source_id: 'src-who',
          source_title: 'WHO Lower Respiratory Tract Infection Guidelines',
          source_year: 2024,
          page: 12,
          section: '1.2',
          headingPath: 'Treatment',
          ordinal: 1,
          contentHash: 'hash-1',
          text: 'First-line empirical antibiotic for community-acquired pneumonia in adults is oral amoxicillin 500mg TDS.',
          evidence_level: 'Ia',
          created_at: new Date().toISOString(),
          rrfScore: 0.95,
          textRank: 1,
          textScore: 0.9,
        },
        {
          id: 'chunk-dghs-1',
          source_id: 'src-dghs',
          source_title: 'DGHS Bangladesh National Clinical Management Protocol',
          source_year: 2024,
          page: 25,
          section: '2.1',
          headingPath: 'Management',
          ordinal: 1,
          contentHash: 'hash-2',
          text: 'Amoxicillin is recommended for mild to moderate CAP in accordance with national antibiotic guidelines.',
          evidence_level: 'Ib',
          created_at: new Date().toISOString(),
          rrfScore: 0.88,
          textRank: 2,
          textScore: 0.85,
        },
      ];

      const consensus = synthesizeConsensus(mockChunks, {
        chiefComplaint: 'fever and cough',
        symptoms: ['cough', 'fever', 'crackles'],
        locale: 'bn',
      });

      expect(consensus).not.toBeNull();
      expect(consensus?.consensusStatus).toBe('strong_consensus');
      expect(consensus?.sourceItems.length).toBe(2);
      expect(consensus?.agreementsBn.length).toBeGreaterThanOrEqual(1);

      // Verbatim quotes verification
      expect(consensus?.sourceItems[0].verbatimQuote).toBe(mockChunks[0].text);
      expect(consensus?.sourceItems[1].verbatimQuote).toBe(mockChunks[1].text);
    });
  });
});
