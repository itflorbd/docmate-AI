import crypto from 'crypto';

// Base32 alphabet according to RFC 4648
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(length = 20): string {
  const buffer = crypto.randomBytes(length);
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function generateTotpUri(
  emailOrOptions: string | { email: string; secret: string; issuer?: string },
  secretParam?: string,
  issuerParam = 'DocMate AI'
): string {
  let email = '';
  let secret = '';
  let issuer = issuerParam;

  if (typeof emailOrOptions === 'object') {
    email = emailOrOptions.email;
    secret = emailOrOptions.secret;
    if (emailOrOptions.issuer) issuer = emailOrOptions.issuer;
  } else {
    email = emailOrOptions;
    secret = secretParam || '';
  }

  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

function base32ToBuffer(base32: string): Buffer {
  const cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function computeTotp(
  secret: string,
  timeStepOrSeconds: number = Math.floor(Date.now() / 1000 / 30)
): string {
  // If a Unix timestamp in seconds (> 1_000_000_000) was passed instead of step, convert to 30s step
  const timeStep = timeStepOrSeconds > 1_000_000_000
    ? Math.floor(timeStepOrSeconds / 30)
    : timeStepOrSeconds;

  const key = base32ToBuffer(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep), 0);

  const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export const generateTotpCodeForTesting = computeTotp;

export function verifyTotp(
  tokenOrOptions: string | { secret: string; code: string; window?: number },
  secretParam?: string,
  windowParam = 1
): boolean {
  let token = '';
  let secret = '';
  let window = windowParam;

  if (typeof tokenOrOptions === 'object') {
    token = tokenOrOptions.code;
    secret = tokenOrOptions.secret;
    if (tokenOrOptions.window !== undefined) window = tokenOrOptions.window;
  } else {
    token = tokenOrOptions;
    secret = secretParam || '';
  }

  if (!token || !secret) return false;
  const trimmed = token.trim();
  if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) return false;

  const currentStep = Math.floor(Date.now() / 1000 / 30);

  for (let step = currentStep - window; step <= currentStep + window; step++) {
    const expected = computeTotp(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(trimmed), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

export const verifyTotpCode = verifyTotp;
