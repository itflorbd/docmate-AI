/**
 * DocMate AI - Pre-LLM Clinical PHI De-Identification Pipeline
 * 
 * Complies with Bangladesh Data Protection principles and DGHS clinical safety standards.
 * Strips identifiable patient data (names, phone numbers, NID, BMDC numbers)
 * BEFORE text is formatted or passed into any model reasoning engine.
 */

// Regex patterns for Bangladeshi PII / PHI identifiers
const BD_PHONE_REGEX = /(?:\+?880\s?1[3-9]\d{8}|01[3-9]\d{8})/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const NID_REGEX = /\b(?:\d{10}|\d{13}|\d{17})\b/g;
const BMDC_REGEX = /\b(?:BMDC|A|DS|D)-?\d{4,6}\b/gi;

export interface PatientMeta {
  fullName?: string;
  phone?: string;
  nid?: string;
  bmdcNumber?: string;
}

/**
 * Scans clinical notes, symptoms, and chief complaints, redacting sensitive personal health identifiers.
 */
export function deidentifyClinicalText(text: string, meta?: PatientMeta): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Redact specific patient name if provided
  if (meta?.fullName && meta.fullName.trim().length > 2) {
    const namePattern = new RegExp(escapeRegex(meta.fullName.trim()), 'gi');
    sanitized = sanitized.replace(namePattern, '[PATIENT_NAME]');
  }

  // 2. Redact specific phone number if provided
  if (meta?.phone && meta.phone.trim().length > 5) {
    const phonePattern = new RegExp(escapeRegex(meta.phone.trim()), 'gi');
    sanitized = sanitized.replace(phonePattern, '[PHONE_REDACTED]');
  }

  // 3. Redact Bangladeshi phone numbers (e.g. +8801711223344 or 01711223344)
  sanitized = sanitized.replace(BD_PHONE_REGEX, '[PHONE_REDACTED]');

  // 4. Redact Email addresses
  sanitized = sanitized.replace(EMAIL_REGEX, '[EMAIL_REDACTED]');

  // 5. Redact National ID numbers (10, 13, or 17 digits)
  sanitized = sanitized.replace(NID_REGEX, '[NID_REDACTED]');

  // 6. Redact BMDC registration numbers
  sanitized = sanitized.replace(BMDC_REGEX, '[BMDC_REDACTED]');

  return sanitized;
}

/**
 * Recursively scrubs structured case inputs before submitting to reasoning context.
 */
export function sanitizeCasePayload<T>(payload: T, meta?: PatientMeta): T {
  if (typeof payload === 'string') {
    return deidentifyClinicalText(payload, meta) as unknown as T;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeCasePayload(item, meta)) as unknown as T;
  }

  if (payload !== null && typeof payload === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      // Exclude direct identifier keys
      if (['phone', 'email', 'nid', 'bmdcNumber', 'fullName', 'patientName'].includes(key)) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeCasePayload(value, meta);
      }
    }
    return sanitizedObj as T;
  }

  return payload;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
