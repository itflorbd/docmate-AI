import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Permanent Free Edge Neural TTS & Instant Human Vocal Reactions', () => {
  describe('1. Static Human Vocal Reactions Audio Bank', () => {
    const reactionsDir = path.join(process.cwd(), 'public', 'voice', 'reactions');

    it('has all required Bangla human vocal reaction audio files in public directory', () => {
      const requiredBn = [
        'bn-understood-1.mp3',
        'bn-understood-2.mp3',
        'bn-thinking-1.mp3',
        'bn-thinking-2.mp3',
        'bn-thinking-3.mp3',
        'bn-success-1.mp3',
        'bn-success-2.mp3',
        'bn-alert-1.mp3',
        'bn-clarify-1.mp3',
        'bn-apology-1.mp3',
      ];

      for (const file of requiredBn) {
        const filePath = path.join(reactionsDir, file);
        expect(fs.existsSync(filePath), `File should exist: ${file}`).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(1000); // Valid MP3 audio
      }
    });

    it('has all required English human vocal reaction audio files in public directory', () => {
      const requiredEn = [
        'en-understood-1.mp3',
        'en-understood-2.mp3',
        'en-thinking-1.mp3',
        'en-thinking-2.mp3',
        'en-thinking-3.mp3',
        'en-success-1.mp3',
        'en-success-2.mp3',
        'en-alert-1.mp3',
        'en-clarify-1.mp3',
        'en-apology-1.mp3',
      ];

      for (const file of requiredEn) {
        const filePath = path.join(reactionsDir, file);
        expect(fs.existsSync(filePath), `File should exist: ${file}`).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(1000); // Valid MP3 audio
      }
    });
  });

  describe('2. Client TTS Provider Routing', () => {
    it('creates ServerSpeechTTS for edge provider type', async () => {
      const { createTtsProvider } = await import('../src/lib/voice/tts-provider');
      const provider = createTtsProvider('edge');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('edge_tts');
      expect(provider.capabilities.supports_rate).toBe(true);
    });

    it('creates BrowserSpeechSynthesisTTS for fallback', async () => {
      const { createTtsProvider } = await import('../src/lib/voice/tts-provider');
      const provider = createTtsProvider('browser');
      expect(provider).toBeDefined();
      expect(provider.name).toBe('browser_speech_synthesis');
    });
  });
});
