import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from './lib/session';

const intlMiddleware = createMiddleware(routing);

/**
 * Returns the primary landing panel path for each role.
 */
export function getRoleDefaultPath(role: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
      return '/admin';
    case 'doctor':
      return '/dashboard';
    case 'student':
      return '/study';
    case 'researcher':
      return '/research';
    case 'medicine_controller':
      return '/controller';
    case 'patient':
      return '/portal';
    default:
      return '/dashboard';
  }
}

/**
 * Evaluates whether a role is authorized to access a given subPath.
 *
 * Pages per role are listed in `allowed` below and match the API checks.
 */
export function isRouteAllowedForRole(subPath: string, role: string): boolean {
  const rootSegment = subPath.split('/')[0];
  // Pages each role may open. Kept in line with the API permission checks so a
  // role never lands on a page whose data it is not allowed to load.
  const allowed: Record<string, string[]> = {
    // Admins run the system; they do not treat patients or prescribe.
    super_admin: ['admin', 'controller', 'library', 'ask', 'settings'],
    admin: ['admin', 'controller', 'library', 'ask', 'settings'],
    doctor: ['dashboard', 'cases', 'patients', 'prescriptions', 'library', 'ask', 'settings'],
    // No patient data for students, researchers or medicine controllers.
    student: ['study', 'library', 'ask', 'settings'],
    researcher: ['research', 'library', 'ask', 'settings'],
    medicine_controller: ['controller', 'library', 'ask', 'settings'],
    // Patients see their own records, including prescriptions, in the portal.
    patient: ['portal', 'settings'],
  };
  return allowed[role]?.includes(rootSegment) ?? false;
}

/**
 * Helper to create a redirect response while preserving cookies set by next-intl
 * and enforcing strict no-cache headers to prevent Safari and browsers from caching 307 redirects.
 */
function createRedirect(url: URL | string, intlResponse?: NextResponse): NextResponse {
  const redirectResponse = NextResponse.redirect(url, 307);
  redirectResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  redirectResponse.headers.set('Pragma', 'no-cache');
  redirectResponse.headers.set('Expires', '0');
  if (intlResponse) {
    intlResponse.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c);
    });
  }
  return redirectResponse;
}

export default async function proxy(request: NextRequest) {
  // 1. Run next-intl middleware first to resolve locale redirects (e.g. / -> /bn or cookie detection)
  const intlResponse = intlMiddleware(request);

  // If next-intl generated a redirect, return immediately
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  const { pathname } = request.nextUrl;

  // Extract locale and subpath from pathname, e.g. /bn/cases/new -> locale: 'bn', subPath: 'cases/new'
  const segments = pathname.split('/').filter(Boolean);
  const hasLocale = segments.length > 0 && (segments[0] === 'bn' || segments[0] === 'en');
  const locale = hasLocale ? segments[0] : 'bn';
  const subPath = hasLocale ? segments.slice(1).join('/') : segments.join('/');

  // Session verification
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // 2. Check login page access for already authenticated users
  if (subPath === 'login') {
    const isSwitching = request.nextUrl.searchParams.has('switch') || request.nextUrl.searchParams.has('logout');
    if (request.nextUrl.searchParams.has('logout')) {
      intlResponse.cookies.delete(COOKIE_NAME);
    }
    if (session && !isSwitching) {
      // Redirect already logged in users directly to their designated role panel
      const targetUrl = new URL(`/${locale}${getRoleDefaultPath(session.role)}`, request.url);
      return createRedirect(targetUrl, intlResponse);
    }
    return intlResponse;
  }

  // Protected paths requiring active session
  const rootSegment = subPath.split('/')[0];
  const protectedSegments = [
    'dashboard',
    'patients',
    'prescriptions',
    'cases',
    'library',
    'ask',
    'settings',
    'admin',
    'controller',
    'portal',
    'study',
    'research',
  ];
  const isProtectedPath = protectedSegments.includes(rootSegment);

  // 3. Unauthenticated check for protected routes
  if (isProtectedPath && !session) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return createRedirect(loginUrl, intlResponse);
  }

  // 4. Authenticated RBAC checks: redirect unauthorized roles to their primary panel
  if (isProtectedPath && session) {
    const isAllowed = isRouteAllowedForRole(subPath, session.role);
    if (!isAllowed) {
      const fallbackUrl = new URL(`/${locale}${getRoleDefaultPath(session.role)}`, request.url);
      return createRedirect(fallbackUrl, intlResponse);
    }
  }

  return intlResponse;
}

export const config = {
  // Match only internationalized pathnames, skipping api, _next, static assets
  matcher: ['/', '/(bn|en)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
