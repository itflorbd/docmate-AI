import crypto from 'node:crypto';

function getKey(): Buffer {
  const secret =
    process.env.PATIENT_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_SECRET ||
    process.env.JWT_SECRET ||
    'docmate-ai-secure-patient-phi-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypt sensitive patient PII using AES-256-GCM.
 * Output format: iv:authTag:ciphertext (hex encoded)
 */
export function encryptPatientPii(text: string | null | undefined): string {
  if (!text || text.trim() === '') return '';
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (err) {
    console.error('Failed to encrypt patient PII:', err);
    throw new Error('Encryption error: could not secure patient PII');
  }
}

/**
 * Decrypt sensitive patient PII from AES-256-GCM format.
 * If data is not formatted with 3 colon-separated segments, returns data as-is for backward compatibility.
 */
export function decryptPatientPii(cipherText: string | null | undefined): string {
  if (!cipherText || cipherText.trim() === '') return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // Legacy or unencrypted plain text fallback
    return cipherText;
  }

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    if (ivHex.length !== 24 || authTagHex.length !== 32 || encryptedHex.length % 2 !== 0) {
      return '[Decryption Error]';
    }
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '[Decryption Error]';
  }
}
