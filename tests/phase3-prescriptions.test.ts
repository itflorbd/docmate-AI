import { describe, it, expect } from 'vitest';
import { assertPatientDataScope } from '../src/lib/permissions';
import { checkAllergies, checkInteractions } from '../src/lib/safety-engine';
import { DrugRecord, DrugInteractionRecord } from '../src/types';

describe('Phase 3: Clinical Data-Scope & Safety Engine Verification', () => {
  const doc1 = {
    id: '43eb5601-471a-49ad-84e9-c298591deea7',
    email: 'doctor1@docmate.ai',
    role: 'doctor' as const,
    name: 'Dr. Farhana',
    status: 'active' as const,
  };

  const doc2 = {
    id: '99999999-9999-9999-9999-999999999999',
    email: 'other_doctor@docmate.ai',
    role: 'doctor' as const,
    name: 'Dr. Karim',
    status: 'active' as const,
  };

  const student = {
    id: '77777777-7777-7777-7777-777777777777',
    email: 'student@docmate.ai',
    role: 'student' as const,
    name: 'Tanvir Ahmed',
    status: 'active' as const,
  };

  const researcher = {
    id: '88888888-8888-8888-8888-888888888888',
    email: 'researcher@docmate.ai',
    role: 'researcher' as const,
    name: 'Dr. Shamim',
    status: 'active' as const,
  };

  const controller = {
    id: '66666666-6666-6666-6666-666666666666',
    email: 'controller@docmate.ai',
    role: 'medicine_controller' as const,
    name: 'DGDA Controller',
    status: 'active' as const,
  };

  const patientUser = {
    id: '55555555-5555-5555-5555-555555555555',
    email: 'patient@docmate.ai',
    role: 'patient' as const,
    name: 'Abdur Rahim',
    status: 'active' as const,
  };

  describe('Non-Negotiable Data-Scope Boundaries', () => {
    it('allows a doctor to view their own patient records', async () => {
      const check = await assertPatientDataScope({
        user: doc1,
        caseDoctorId: doc1.id,
        patientId: 'patient-uuid-1',
      });
      expect(check.allowed).toBe(true);
      expect(check.reason).toBe('doctor_case_owner');
    });

    it('strictly forbids a doctor from viewing another doctor’s patient records', async () => {
      const check = await assertPatientDataScope({
        user: doc2,
        caseDoctorId: doc1.id,
        patientId: 'patient-uuid-1',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('cross_doctor_access_prohibited');
    });

    it('strictly blocks medical students from accessing patient clinical records', async () => {
      const check = await assertPatientDataScope({
        user: student,
        caseDoctorId: doc1.id,
        patientId: 'patient-uuid-1',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('role_student_forbidden_from_patient_data');
    });

    it('strictly blocks researchers from accessing patient clinical records', async () => {
      const check = await assertPatientDataScope({
        user: researcher,
        caseDoctorId: doc1.id,
        patientId: 'patient-uuid-1',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('role_researcher_forbidden_from_patient_data');
    });

    it('strictly blocks medicine controllers from accessing patient clinical records', async () => {
      const check = await assertPatientDataScope({
        user: controller,
        caseDoctorId: doc1.id,
        patientId: 'patient-uuid-1',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('role_medicine_controller_forbidden_from_patient_data');
    });

    it('allows a patient to view only their own shared patient record', async () => {
      const ownCheck = await assertPatientDataScope({
        user: patientUser,
        patientId: patientUser.id,
      });
      expect(ownCheck.allowed).toBe(true);
      expect(ownCheck.reason).toBe('own_patient_record');

      const otherCheck = await assertPatientDataScope({
        user: patientUser,
        patientId: 'different-patient-uuid',
      });
      expect(otherCheck.allowed).toBe(false);
      expect(otherCheck.reason).toBe('cross_patient_access_prohibited');
    });
  });

  describe('Deterministic Prescription Safety Engine', () => {
    const mockDrug: DrugRecord = {
      id: 'd-cipro',
      generic_name: 'Ciprofloxacin',
      drug_class: 'Fluoroquinolone',
      indications: ['UTI', 'Infection'],
      dose_rules: {
        standard_adult: '500 mg BD',
        route: 'oral',
        frequency: '1+0+1',
        duration_days: 7,
      },
      contraindications: {
        conditions: [],
        allergies: ['ciprofloxacin', 'fluoroquinolone'],
      },
      pregnancy_category: 'C',
    };

    it('flags critical alert when prescribing drug to patient with documented allergy', () => {
      const patientAllergies = ['Ciprofloxacin', 'Dust'];
      const alerts = checkAllergies(mockDrug, patientAllergies);

      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].type).toBe('allergy');
      expect(alerts[0].title).toContain('Documented Hypersensitivity');
    });

    it('does not flag allergy alert when patient has no matching allergies', () => {
      const patientAllergies = ['Penicillin', 'Sulfa'];
      const alerts = checkAllergies(mockDrug, patientAllergies);
      expect(alerts).toHaveLength(0);
    });

    it('flags drug interaction from interaction database', () => {
      const interactionsDb: DrugInteractionRecord[] = [
        {
          id: 'int-1',
          drug_a: 'Ciprofloxacin',
          drug_b: 'Theophylline',
          severity: 'critical',
          note: 'Ciprofloxacin significantly increases theophylline plasma concentrations, risking acute toxicity.',
        },
      ];

      const currentMeds = ['Theophylline 300mg'];
      const alerts = checkInteractions(mockDrug, currentMeds, interactionsDb);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].type).toBe('drug_interaction');
      expect(alerts[0].description).toContain('significantly increases theophylline');
    });
  });
});
