import { z } from 'zod';

export const COOKIE_NAME = 'docmate_session';

const sessionSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: z.enum(['super_admin', 'doctor', 'student', 'researcher', 'patient', 'medicine_controller', 'admin']).transform(r => r === 'admin' ? 'super_admin' : r),
  name: z.string().min(1),
  exp: z.number().int().positive(),
});

type Session = z.infer<typeof sessionSchema>;

export function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  const isDemoDefault = secret && /demo|hackathon|change.?me|replace|^docmate_production_secure_signing_key/i.test(secret);
  if (!secret || secret.length < 32 || isDemoDefault) {
    throw new Error('Set a deployment-specific AUTH_SECRET of at least 32 characters.');
  }
  return secret;
}

async function sessionKey() {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(requireAuthSecret()), { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify'],
  );
}

export async function createSessionToken(user: Omit<Session, 'exp'>): Promise<string> {
  const data = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = await crypto.subtle.sign('HMAC', await sessionKey(), new TextEncoder().encode(data));
  return `${data}.${Buffer.from(signature).toString('base64url')}`;
}

export async function verifySessionToken(token: string): Promise<Session | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const validSignature = await crypto.subtle.verify(
      'HMAC', await sessionKey(), Buffer.from(signature, 'base64url'), new TextEncoder().encode(data),
    );
    if (!validSignature) return null;
    const result = sessionSchema.safeParse(JSON.parse(Buffer.from(data, 'base64url').toString('utf8')));
    return result.success && result.data.exp > Date.now() ? result.data : null;
  } catch (err) {
    console.error('[verifySessionToken FAILED]', err);
    return null;
  }
}
