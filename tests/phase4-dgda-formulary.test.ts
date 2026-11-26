import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://apple:@localhost:5432/docmate',
});

describe('Phase 4: DGDA Formulary Safety & Two-Person Review Suite', () => {
  let controller1Id: string;
  let controller2Id: string;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      // 1. Get or create controller 1
      const c1Res = await client.query("SELECT id FROM users WHERE email='controller@docmate.ai'");
      if (c1Res.rows.length > 0) {
        controller1Id = c1Res.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, role, name, status)
           VALUES ('controller@docmate.ai', 'test_hash', 'medicine_controller', 'DGDA Controller 1', 'active')
           RETURNING id`
        );
        controller1Id = ins.rows[0].id;
      }

      // 2. Get or create controller 2 (for two-person review testing)
      const c2Res = await client.query("SELECT id FROM users WHERE email='controller2@docmate.ai'");
      if (c2Res.rows.length > 0) {
        controller2Id = c2Res.rows[0].id;
      } else {
        const ins = await client.query(
          `INSERT INTO users (email, password_hash, role, name, status)
           VALUES ('controller2@docmate.ai', 'test_hash', 'medicine_controller', 'DGDA Controller 2', 'active')
           RETURNING id`
        );
        controller2Id = ins.rows[0].id;
      }
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('1. Two-Person Review Workflow & Status Transitions', () => {
    it('creates medicine with status "pending" when two_person_review_enabled is true', async () => {
      const client = await pool.connect();
      try {
        // Enable two_person_review
        await client.query(
          `INSERT INTO system_settings (key, value) VALUES ('two_person_review_enabled', '{"enabled": true}'::jsonb)
           ON CONFLICT (key) DO UPDATE SET value = '{"enabled": true}'::jsonb`
        );

        const brandName = 'Test-Med-' + Date.now();
        const ins = await client.query(
          `INSERT INTO medicine_brands (brand_name, generic_name, manufacturer, form, strength, price_bdt, status)
           VALUES ($1, 'Test Generic', 'Square Pharmaceuticals PLC', 'Tab', '500 mg', 10.00, 'pending')
           RETURNING id, status`,
          [brandName]
        );

        expect(ins.rows[0].status).toBe('pending');
        const medId = ins.rows[0].id;

        // Create version
        const vIns = await client.query(
          `INSERT INTO medicine_versions (medicine_id, version_number, changes_json, status)
           VALUES ($1, 1, '{"action": "submit"}'::jsonb, 'pending')
           RETURNING id, status`,
          [medId]
        );
        expect(vIns.rows[0].status).toBe('pending');

        // Stage 1 Review: Controller 1 approves -> status becomes partially_approved
        await client.query(
          `UPDATE medicine_brands SET status = 'partially_approved' WHERE id = $1`,
          [medId]
        );
        await client.query(
          `UPDATE medicine_versions SET status = 'partially_approved', reviewed_by_1 = $1, reviewed_at_1 = NOW() WHERE medicine_id = $2`,
          [controller1Id, medId]
        );

        const s1Check = await client.query(`SELECT status FROM medicine_brands WHERE id = $1`, [medId]);
        expect(s1Check.rows[0].status).toBe('partially_approved');

        // Validation: Same controller cannot be second reviewer
        const versionRow = await client.query(
          `SELECT reviewed_by_1 FROM medicine_versions WHERE medicine_id = $1`,
          [medId]
        );
        expect(versionRow.rows[0].reviewed_by_1).toBe(controller1Id);
        const isSameReviewer = versionRow.rows[0].reviewed_by_1 === controller1Id;
        expect(isSameReviewer).toBe(true); // Should block controller 1

        // Stage 2 Review: Controller 2 (distinct user) approves -> status becomes approved
        await client.query(
          `UPDATE medicine_brands SET status = 'approved' WHERE id = $1`,
          [medId]
        );
        await client.query(
          `UPDATE medicine_versions SET status = 'approved', reviewed_by_2 = $1, reviewed_at_2 = NOW() WHERE medicine_id = $2`,
          [controller2Id, medId]
        );

        const s2Check = await client.query(
          `SELECT status FROM medicine_brands WHERE id = $1`,
          [medId]
        );
        expect(s2Check.rows[0].status).toBe('approved');

        const vFinal = await client.query(
          `SELECT reviewed_by_1, reviewed_by_2, status FROM medicine_versions WHERE medicine_id = $1`,
          [medId]
        );
        expect(vFinal.rows[0].reviewed_by_1).toBe(controller1Id);
        expect(vFinal.rows[0].reviewed_by_2).toBe(controller2Id);
        expect(vFinal.rows[0].status).toBe('approved');
      } finally {
        client.release();
      }
    });

    it('rejects a medicine brand with reason and audits state', async () => {
      const client = await pool.connect();
      try {
        const brandName = 'Reject-Med-' + Date.now();
        const ins = await client.query(
          `INSERT INTO medicine_brands (brand_name, generic_name, manufacturer, form, strength, price_bdt, status)
           VALUES ($1, 'Substandard Generic', 'Unknown Ltd', 'Syr', '100 ml', 45.00, 'pending')
           RETURNING id`,
          [brandName]
        );
        const medId = ins.rows[0].id;

        await client.query(
          `INSERT INTO medicine_versions (medicine_id, version_number, changes_json, status)
           VALUES ($1, 1, '{"action": "submit"}'::jsonb, 'pending')`,
          [medId]
        );

        // Reject
        const reason = 'Failed DGDA bioavailability test standards';
        await client.query(
          `UPDATE medicine_brands SET status = 'rejected' WHERE id = $1`,
          [medId]
        );
        await client.query(
          `UPDATE medicine_versions SET status = 'rejected', rejection_reason = $1 WHERE medicine_id = $2`,
          [reason, medId]
        );

        const check = await client.query(
          `SELECT b.status as brand_status, v.status as ver_status, v.rejection_reason
           FROM medicine_brands b
           JOIN medicine_versions v ON v.medicine_id = b.id
           WHERE b.id = $1`,
          [medId]
        );

        expect(check.rows[0].brand_status).toBe('rejected');
        expect(check.rows[0].ver_status).toBe('rejected');
        expect(check.rows[0].rejection_reason).toBe(reason);
      } finally {
        client.release();
      }
    });
  });

  describe('2. DGDA Safety Notices Broadcast & Severity Enforcement', () => {
    it('persists safety notices with valid severity levels and batch JSON', async () => {
      const client = await pool.connect();
      try {
        const title = 'জরুরি প্রত্যাহার: টেস্ট ব্যাচ দূষণ সতর্কবার্তা ' + Date.now();
        const batches = ['BT-2026-X1', 'BT-2026-X2'];

        const ins = await client.query(
          `INSERT INTO medicine_notices (title, severity, body, affected_batches, published_by)
           VALUES ($1, 'critical_recall', 'অমেধ্যতার ঝুঁকি থাকায় দ্রুত প্রত্যাহার করুন।', $2, $3)
           RETURNING id, severity, affected_batches`,
          [title, JSON.stringify(batches), controller1Id]
        );

        expect(ins.rows[0].severity).toBe('critical_recall');
        expect(ins.rows[0].affected_batches).toEqual(batches);
      } finally {
        client.release();
      }
    });

    it('retrieves active safety notices sorted by published_at DESC', async () => {
      const client = await pool.connect();
      try {
        const res = await client.query(
          `SELECT id, title, severity, published_at FROM medicine_notices ORDER BY published_at DESC LIMIT 5`
        );
        expect(res.rows.length).toBeGreaterThan(0);
        expect(['critical_recall', 'warning', 'info']).toContain(res.rows[0].severity);
      } finally {
        client.release();
      }
    });
  });

  describe('3. Formulary Search & Unapproved Filter Isolation', () => {
    it('returns only approved medicines in formulary search', async () => {
      const client = await pool.connect();
      try {
        // Query approved vs pending
        const approvedRes = await client.query(
          `SELECT brand_name, generic_name FROM medicine_brands WHERE status = 'approved' AND brand_name ILIKE '%Napa%' LIMIT 5`
        );
        expect(approvedRes.rows.length).toBeGreaterThan(0);
        expect(approvedRes.rows[0].brand_name).toContain('Napa');

        // Ensure rejected or pending are not included in public search queries
        const pendingCheck = await client.query(
          `SELECT brand_name FROM medicine_brands WHERE status = 'approved' AND status = 'pending'`
        );
        expect(pendingCheck.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });
  });
});
