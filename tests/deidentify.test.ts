import { describe, it, expect } from 'vitest';
import { deidentifyClinicalText, sanitizeCasePayload } from '../src/lib/deidentify';

describe('Pre-LLM Clinical PHI De-Identification Pipeline', () => {
  it('redacts Bangladeshi mobile phone numbers (+880 and 01...) from clinical text', () => {
    const input = 'রোগী ফোন নম্বর +8801711223344 এবং বিকল্প নম্বর 01988776655 জানিয়েছেন।';
    const sanitized = deidentifyClinicalText(input);

    expect(sanitized).not.toContain('+8801711223344');
    expect(sanitized).not.toContain('01988776655');
    expect(sanitized).toContain('[PHONE_REDACTED]');
  });

  it('redacts patient name when provided in patient metadata', () => {
    const input = 'আজ মোসাম্মৎ রাশিদা বেগম (Rashida Begum) শ্বাসকষ্ট নিয়ে আউটডোরে এসেছেন।';
    const sanitized = deidentifyClinicalText(input, { fullName: 'Rashida Begum' });

    expect(sanitized).not.toContain('Rashida Begum');
    expect(sanitized).toContain('[PATIENT_NAME]');
  });

  it('redacts Bangladeshi National ID (NID) numbers (10, 13, and 17 digits)', () => {
    const input = 'NID: 19852691234567890 (স্মার্ট কার্ড: 1234567890) ভেরিফাই করা হয়েছে।';
    const sanitized = deidentifyClinicalText(input);

    expect(sanitized).not.toContain('19852691234567890');
    expect(sanitized).not.toContain('1234567890');
    expect(sanitized).toContain('[NID_REDACTED]');
  });

  it('redacts BMDC registration numbers and doctor credentials from untrusted notes', () => {
    const input = 'রেফারিং ফিজিশিয়ান Dr. Kabir (BMDC-45892, Reg: A-12345)।';
    const sanitized = deidentifyClinicalText(input);

    expect(sanitized).not.toContain('BMDC-45892');
    expect(sanitized).not.toContain('A-12345');
    expect(sanitized).toContain('[BMDC_REDACTED]');
  });

  it('redacts email addresses', () => {
    const input = 'যোগাযোগের জন্য patient.rashida@gmail.com ব্যবহার করুন।';
    const sanitized = deidentifyClinicalText(input);

    expect(sanitized).not.toContain('patient.rashida@gmail.com');
    expect(sanitized).toContain('[EMAIL_REDACTED]');
  });

  it('recursively scrubs structured case payloads and drops sensitive direct identifiers', () => {
    const caseData = {
      patientName: 'রহিম মিয়া',
      phone: '+8801812345678',
      chiefComplaint: 'জ্বর ও কাশি। যোগাযোগ 01711002233',
      vitals: {
        bp: '130/85',
        hr: 82,
        notes: 'NID 9876543210 সংগৃহীত হয়েছে।',
      },
      history: [
        { date: '2026-01-10', doctorNote: 'Dr. Hasan BMDC-88992 পরামর্শ দিয়েছেন।' },
      ],
    };

    const sanitized = sanitizeCasePayload(caseData, { fullName: 'রহিম মিয়া' });

    expect(sanitized.patientName).toBe('[REDACTED]');
    expect(sanitized.phone).toBe('[REDACTED]');
    expect(sanitized.chiefComplaint).toContain('[PHONE_REDACTED]');
    expect(sanitized.vitals.notes).toContain('[NID_REDACTED]');
    expect(sanitized.history[0].doctorNote).toContain('[BMDC_REDACTED]');
  });
});
