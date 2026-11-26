import { cookies } from 'next/headers';
import crypto from 'crypto';
import argon2 from 'argon2';
import { User, UserRole, UserStatus } from '@/types';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { promisify } from 'node:util';
import { COOKIE_NAME, createSessionToken, requireAuthSecret, verifySessionToken } from '@/lib/session';

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456, // 19 MiB
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // 1. Argon2id hash
  if (stored.startsWith('$argon2') || stored.startsWith('argon2:')) {
    const raw = stored.startsWith('argon2:') ? stored.slice(7) : stored;
    try {
      return await argon2.verify(raw, password);
    } catch {
      return false;
    }
  }

  // 2. Legacy 64-char HMAC
  if (/^[a-f0-9]{64}$/.test(stored)) {
    const legacy = crypto.createHmac('sha256', requireAuthSecret()).update(password).digest();
    return crypto.timingSafeEqual(legacy, Buffer.from(stored, 'hex'));
  }

  // 3. Scrypt hash
  const format = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored);
  if (!format) return false;
  const key = await scrypt(password, format[1], 64) as Buffer;
  return crypto.timingSafeEqual(key, Buffer.from(format[2], 'hex'));
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const record = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!record) return null;
  return {
    id: record.id,
    email: record.email,
    role: (record.role === 'admin' ? 'super_admin' : record.role) as UserRole,
    name: record.name,
    status: (record.status || 'active') as UserStatus,
    phone: record.phone || undefined,
    bmdc_number: record.bmdcNumber || undefined,
    org_id: record.orgId || undefined,
    mfa_enabled: record.mfaEnabled || false,
    created_at: record.createdAt.toISOString(),
  };
}

export async function setAuthCookie(user: { id: string; email: string; role: UserRole; name: string }, forceHttps?: boolean) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  const isHttps = forceHttps !== undefined 
    ? forceHttps 
    : (process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') || false);
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
