import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Staff Login Form Security Regression Tests', () => {
  const loginPagePath = path.resolve(__dirname, '../src/app/[locale]/login/page.tsx');
  const loginContent = fs.readFileSync(loginPagePath, 'utf8');

  it('1. Login form specifies method="POST" to prevent URL credential exposure', () => {
    // Ensure form has method="POST"
    expect(loginContent).toMatch(/<form[^>]*method=["']POST["']/i);
  });

  it('2. Login form specifies action="/api/auth/login"', () => {
    // Ensure form directs native submission to POST API route
    expect(loginContent).toMatch(/<form[^>]*action=["']\/api\/auth\/login["']/i);
  });

  it('3. Form handler prevents default navigation when JS is active', () => {
    expect(loginContent).toContain('e.preventDefault()');
  });
});
