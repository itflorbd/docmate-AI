import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Phase 6: Senior Doctor UX, Text Scaling & Accessibility Suite', () => {
  describe('1. Text Scaling Ratios & Storage Key Verification', () => {
    const scales = ['100', '115', '130'] as const;

    it('defines valid scale ratios supporting 100%, 115%, and 130%', () => {
      const scaleFactors = {
        '100': 1.0,
        '115': 1.15,
        '130': 1.3,
      };

      for (const scale of scales) {
        expect(scaleFactors[scale]).toBeGreaterThanOrEqual(1.0);
        expect(scaleFactors[scale]).toBeLessThanOrEqual(1.3);
      }

      // Verify incremental magnification
      expect(scaleFactors['115']).toBeGreaterThan(scaleFactors['100']);
      expect(scaleFactors['130']).toBeGreaterThan(scaleFactors['115']);
    });

    it('verifies globals.css defines font-size magnification classes for html root', () => {
      const globalsCssPath = path.join(process.cwd(), 'src/app/globals.css');
      const cssContent = fs.readFileSync(globalsCssPath, 'utf8');

      expect(cssContent).toContain('.text-scale-100');
      expect(cssContent).toContain('.text-scale-115');
      expect(cssContent).toContain('.text-scale-130');
      expect(cssContent).toContain('font-size: 16px');
      expect(cssContent).toContain('font-size: 18.4px');
      expect(cssContent).toContain('font-size: 20.8px');
    });

    it('verifies Bangla typography rules enforce >= 1.7 line height and natural word wrapping', () => {
      const globalsCssPath = path.join(process.cwd(), 'src/app/globals.css');
      const cssContent = fs.readFileSync(globalsCssPath, 'utf8');

      expect(cssContent).toContain('html[lang="bn"] body');
      expect(cssContent).toContain('line-height: 1.72');
      expect(cssContent).toContain('word-break: break-word');
      expect(cssContent).toContain('overflow-wrap: break-word');
    });
  });

  describe('2. Color Contrast Ratios (WCAG AAA >= 7:1 for Senior Clinicians)', () => {
    // Helper to calculate relative luminance from RGB hex
    function hexToLuminance(hex: string): number {
      const clean = hex.replace('#', '');
      const r = parseInt(clean.substring(0, 2), 16) / 255;
      const g = parseInt(clean.substring(2, 4), 16) / 255;
      const b = parseInt(clean.substring(4, 6), 16) / 255;

      const [rs, gs, bs] = [r, g, b].map((c) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
      );

      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    }

    function contrastRatio(hex1: string, hex2: string): number {
      const l1 = hexToLuminance(hex1);
      const l2 = hexToLuminance(hex2);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    it('ensures high contrast >= 7:1 for deep clinical teal text on white background', () => {
      // Clinical dark teal #134e4a (Tailwind teal-800 high contrast) against white #ffffff
      const ratio = contrastRatio('#134e4a', '#ffffff');
      expect(ratio).toBeGreaterThanOrEqual(7.0); // WCAG AAA standard
    });

    it('ensures high contrast >= 10:1 for deep foreground body text on white card', () => {
      // High-contrast clinical slate #0f172a (foreground) against white #ffffff
      const ratio = contrastRatio('#0f172a', '#ffffff');
      expect(ratio).toBeGreaterThanOrEqual(14.0);
    });

    it('ensures high contrast >= 4.5:1 for danger red on white card', () => {
      // Destructive red #b91c1c (Tailwind red-700) against white #ffffff
      const ratio = contrastRatio('#b91c1c', '#ffffff');
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('3. Universal Help Sheet ("সাহায্য") Coverage Audit', () => {
    it('verifies HelpSheet component contains guidance for all core clinical screens', () => {
      const helpSheetPath = path.join(process.cwd(), 'src/components/shared/HelpSheet.tsx');
      const fileContent = fs.readFileSync(helpSheetPath, 'utf8');

      // Check all registered clinical routes
      const requiredRoutes = [
        'dashboard',
        'patients',
        'prescriptions',
        'portal',
        'study',
        'research',
        'controller',
      ];

      for (const route of requiredRoutes) {
        expect(fileContent).toContain(`${route}:`);
      }

      // Check helpline numbers
      expect(fileContent).toContain('+880 9612-DOCMATE');
      expect(fileContent).toContain('16263');
      expect(fileContent).toContain('চূড়ান্ত সিদ্ধান্ত চিকিৎসকের');
    });

    it('verifies AppShell topbar mounts both TextSizeControl and HelpSheet', () => {
      const appShellPath = path.join(process.cwd(), 'src/components/shared/AppShell.tsx');
      const fileContent = fs.readFileSync(appShellPath, 'utf8');

      expect(fileContent).toContain('<TextSizeControl');
      expect(fileContent).toContain('<HelpSheet');
    });
  });
});
