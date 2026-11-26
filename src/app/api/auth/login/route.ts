import { boundedJson, rateLimit } from '@/lib/api-input';
import { isDemoMode } from '@/lib/demo-mode';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, setAuthCookie, verifyPassword } from '@/lib/auth';
import { UserRole } from '@/types';
import { getRoleDefaultPath, isRouteAllowedForRole } from '@/proxy';

export async function POST(request: Request) {
  try {
    const demo = isDemoMode();
    const isSyntheticTest = process.env.DOCMATE_QA_SYNTHETIC === '1' || demo;
    const globalLimit = rateLimit('login', isSyntheticTest ? 500 : 60);
    if (globalLimit) return globalLimit;

    const contentType = request.headers.get('content-type') || '';
    const isFormSubmit = contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');

    let email = '';
    let password = '';
    let callbackUrl = '';

    if (isFormSubmit) {
      const formData = await request.formData();
      email = String(formData.get('email') || '').trim().toLowerCase();
      password = String(formData.get('password') || '');
      callbackUrl = String(formData.get('callbackUrl') || '');
    } else {
      const rawBody = await boundedJson(request, 2048);
      const input = z.object({
        email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
        password: z.string().min(1).max(256),
        callbackUrl: z.string().optional(),
      }).safeParse(rawBody);

      if (!input.success) return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
      email = input.data.email;
      password = input.data.password;
      callbackUrl = input.data.callbackUrl || '';
    }

    const accountLimit = rateLimit(`login:${email}`, isSyntheticTest ? 200 : 10);
    if (accountLimit) return accountLimit;
    if (/^(doctor|student|researcher|admin)@docmate\.ai$/.test(email) && !demo) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const isDemoAccount = /^(doctor|student|researcher|admin)@docmate\.ai$/.test(email);
    const isDemoPassword = password === 'demo123' || password === 'demo';
    const isPasswordValid = (await verifyPassword(password, user.passwordHash)) || (isDemoAccount && isDemoPassword);

    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.passwordHash.startsWith('scrypt:')) {
      await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    };

    const proto = request.headers.get('x-forwarded-proto') || (request.url.startsWith('https') ? 'https' : 'http');
    const isHttps = proto === 'https' || (process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://') ?? false);
    await setAuthCookie(safeUser, isHttps);

    const defaultTarget = getRoleDefaultPath(safeUser.role);
    let resolvedTarget = defaultTarget;
    if (callbackUrl && callbackUrl.startsWith('/')) {
      const cleanSubPath = callbackUrl.replace(/^\/(?:bn|en)\/?/, '');
      if (isRouteAllowedForRole(cleanSubPath, safeUser.role)) {
        resolvedTarget = callbackUrl;
      }
    }

    if (isFormSubmit) {
      const redirectUrl = new URL(resolvedTarget, request.url);
      return NextResponse.redirect(redirectUrl, 303);
    }

    return NextResponse.json(
      {
        user: safeUser,
        redirectUrl: resolvedTarget,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err) {
    console.error('[API /api/auth/login Error]:', err);
    const errorMessage = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json({ error: 'Login failed', details: errorMessage }, { status: 500 });
  }
}
