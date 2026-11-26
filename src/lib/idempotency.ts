import { db } from '@/db';
import { idempotencyKeys } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Executes a mutation with guaranteed idempotency.
 * If the idempotency key was previously processed for this route, the cached result is returned
 * without re-executing side effects (e.g. creating duplicate cases or charges).
 */
export async function withIdempotency<T>(
  key: string | undefined | null,
  route: string,
  handler: () => Promise<T>
): Promise<T> {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    return await handler();
  }

  const cleanKey = `${route}:${key.trim()}`.slice(0, 100);

  // 1. Check if already recorded
  const [existing] = await db
    .select({ result: idempotencyKeys.result })
    .from(idempotencyKeys)
    .where(eq(idempotencyKeys.key, cleanKey))
    .limit(1);

  if (existing) {
    return existing.result as T;
  }

  // 2. Execute side effect
  const result = await handler();

  // 3. Persist output
  try {
    await db
      .insert(idempotencyKeys)
      .values({
        key: cleanKey,
        route,
        result: (result as unknown as Record<string, unknown>) || {},
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error('[idempotency] Failed to persist idempotency key:', err);
  }

  return result;
}
