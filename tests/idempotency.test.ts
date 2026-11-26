import { describe, it, expect, beforeEach } from 'vitest';
import { withIdempotency } from '@/lib/idempotency';
import { db } from '@/db';
import { idempotencyKeys } from '@/db/schema';
import { eq } from 'drizzle-orm';

describe('Idempotency Engine', () => {
  const testKey = `test-key-${Date.now()}`;
  const testRoute = '/api/cases';

  beforeEach(async () => {
    // clean up any test key if exists
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.key, `${testRoute}:${testKey}`.slice(0, 100)));
  });

  it('executes handler and saves output on first invocation', async () => {
    let executionCount = 0;
    const result = await withIdempotency(testKey, testRoute, async () => {
      executionCount++;
      return { success: true, caseId: 'case-123' };
    });

    expect(result).toEqual({ success: true, caseId: 'case-123' });
    expect(executionCount).toBe(1);

    // Verify stored in DB
    const [saved] = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, `${testRoute}:${testKey}`.slice(0, 100)));
    expect(saved).toBeDefined();
    expect(saved?.result).toEqual({ success: true, caseId: 'case-123' });
  });

  it('returns cached result and does not re-execute handler on duplicate invocation', async () => {
    let executionCount = 0;
    const handler = async () => {
      executionCount++;
      return { success: true, caseId: 'case-abc' };
    };

    const firstResult = await withIdempotency(testKey, testRoute, handler);
    expect(firstResult).toEqual({ success: true, caseId: 'case-abc' });
    expect(executionCount).toBe(1);

    // Call again with the exact same key
    const secondResult = await withIdempotency(testKey, testRoute, handler);
    expect(secondResult).toEqual({ success: true, caseId: 'case-abc' });
    expect(executionCount).toBe(1); // handler was NOT invoked a second time!
  });

  it('bypasses caching when key is null or empty', async () => {
    let count = 0;
    const res1 = await withIdempotency('', testRoute, async () => {
      count++;
      return { run: count };
    });
    const res2 = await withIdempotency(null, testRoute, async () => {
      count++;
      return { run: count };
    });

    expect(res1.run).toBe(1);
    expect(res2.run).toBe(2);
    expect(count).toBe(2);
  });
});
