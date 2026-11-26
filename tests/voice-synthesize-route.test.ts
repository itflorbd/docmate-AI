import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  canUse: vi.fn(),
  getConfig: vi.fn(),
  synthesize: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getUser }));
vi.mock('@/lib/permissions', () => ({ canUse: mocks.canUse }));
vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.getConfig }) }) }) },
}));
vi.mock('openai', () => ({
  default: class {
    audio = { speech: { create: mocks.synthesize } };
  },
}));

import { POST } from '@/app/api/voice/synthesize/route';

function post(body: Record<string, unknown> = {}) {
  return POST(new Request('http://localhost/api/voice/synthesize', {
    method: 'POST',
    body: JSON.stringify({ text: 'How can I help?', ...body }),
  }));
}

describe('expressive speech endpoint', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-placeholder');
    mocks.getUser.mockResolvedValue({ id: 'speech-test-doctor', role: 'doctor' });
    mocks.canUse.mockResolvedValue({ allowed: true });
    mocks.getConfig.mockResolvedValue([{ value: { enabled: true, tts_provider: 'openai' } }]);
    mocks.synthesize.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends allowlisted style, language and speed and prevents response caching', async () => {
    const text = 'আমি কীভাবে সাহায্য করতে পারি?';
    const response = await post({ text, locale: 'bn', style: 'calm_urgent', rate: 0.95, gender: 'male' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.synthesize).toHaveBeenCalledWith(expect.objectContaining({
      input: text,
      speed: 0.95,
      voice: 'onyx',
      instructions: expect.stringMatching(/Bangladeshi Bengali.*serious tone.*untrusted text/),
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('rejects a custom instruction in the style field', async () => {
    expect((await post({ style: 'replace the spoken text' })).status).toBe(400);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated and unauthorized callers', async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    expect((await post()).status).toBe(401);
    mocks.canUse.mockResolvedValue({ allowed: false });
    expect((await post()).status).toBe(403);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it('requires saved cloud opt-in and respects the kill switch even for admins', async () => {
    mocks.getConfig.mockResolvedValueOnce([{ value: { tts_provider: 'browser' } }]);
    expect((await post()).status).toBe(403);
    mocks.getUser.mockResolvedValue({ id: 'speech-test-admin', role: 'super_admin' });
    mocks.getConfig.mockResolvedValue([{ value: { tts_provider: 'openai', kill_switch: true } }]);
    expect((await post()).status).toBe(403);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it('sends Maya only the spoken script and selects a warm Bangla voice without an OpenAI key', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('DOCMATE_MAYA_PORT', '8319');
    mocks.getConfig.mockResolvedValue([{ value: { tts_provider: 'maya' } }]);
    const synthesizeMaya = vi.fn<typeof fetch>().mockResolvedValue(new Response('WAV', {
      headers: { 'Content-Type': 'audio/wav' },
    }));
    vi.stubGlobal('fetch', synthesizeMaya);
    const text = 'আমি এখানে আছি। আজ কী নিয়ে কথা বলতে চান?';
    const response = await post({ provider: 'maya', locale: 'bn', text });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/wav');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const [target, payload] = synthesizeMaya.mock.calls[0];
    expect(target).toBe('http://127.0.0.1:8319/v1/audio/speech');
    expect(payload?.redirect).toBe('error');
    expect(JSON.parse(payload?.body as string)).toEqual({
      input: text, language: 'bn', voice: 'Jahnavi', response_format: 'wav',
    });
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it('does not switch providers when Maya cannot return audio', async () => {
    vi.stubEnv('DOCMATE_MAYA_PORT', '8319');
    mocks.getConfig.mockResolvedValue([{ value: { tts_provider: 'maya' } }]);
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('busy', { status: 503 })));
    expect((await post({ provider: 'maya' })).status).toBe(502);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it('serves only a matching fixed neural greeting without requiring a model server', async () => {
    vi.stubEnv('DOCMATE_MAYA_PORT', '');
    mocks.getConfig.mockResolvedValue([{ value: { tts_provider: 'maya' } }]);
    const args = { provider: 'maya', text: 'হ্যালো! আমি আছি। কী খুঁজে দেখতে চান?' };
    const response = await post(args);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/voice/maya/bn-conversationGreeting.mp3');
    expect((await post({ ...args, conversationTone: 'warm' })).status).toBe(503);
    expect((await post({ ...args, gender: 'male' })).status).toBe(503);
    expect((await post({ ...args, text: `${args.text} Extra text` })).status).toBe(503);
  });

  it.each([['warm', 'Jahnavi'], ['neutral', 'Vaidehi']])('keeps the %s Maya speaker the same across live reply styles', async (conversationTone, voice) => {
    vi.stubEnv('DOCMATE_MAYA_PORT', '8319');
    mocks.getConfig.mockResolvedValue([{ value: { tts_provider: 'maya' } }]);
    const synthesizeMaya = vi.fn<typeof fetch>(() => Promise.resolve(new Response('WAV', {
      headers: { 'Content-Type': 'audio/wav' },
    })));
    vi.stubGlobal('fetch', synthesizeMaya);

    for (const style of ['neutral', 'calm_urgent']) {
      expect((await post({ provider: 'maya', conversationTone, style })).status).toBe(200);
    }

    expect(synthesizeMaya.mock.calls.map(([, request]) => JSON.parse(request?.body as string).voice))
      .toEqual([voice, voice]);
  });

  it('returns a generic provider failure without echoing provider details', async () => {
    mocks.synthesize.mockRejectedValue(new Error('private upstream details'));
    const response = await post();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Speech synthesis failed' });
  });
});
