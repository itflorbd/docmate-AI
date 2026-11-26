import { NextResponse } from 'next/server';

export async function boundedJson(request: Request, maximum = 32_768): Promise<unknown> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

const counters = new Map<string, { count: number; expires: number }>();

export function rateLimit(key: string, maximum: number, durationMs = 60_000) {
  const now = Date.now();
  const counter = counters.get(key);
  if (counter && counter.expires > now) {
    if (counter.count < maximum) {
      counter.count++;
      return null;
    }
    return NextResponse.json({ error: 'Request limit exceeded' }, {
      status: 429, headers: { 'Retry-After': String(Math.ceil((counter.expires - now) / 1000)) },
    });
  }
  if (counters.size >= 2048) {
    for (const [id, entry] of counters) {
      if (entry.expires <= now) counters.delete(id);
    }
    if (counters.size >= 2048) {
      return NextResponse.json({ error: 'Request limit exceeded' }, { status: 429, headers: { 'Retry-After': '60' } });
    }
  }
  counters.set(key, { count: 1, expires: now + durationMs });
  return null;
}
