import { SttProvider, SttListenOptions, SttTranscriptionResult } from './types';
import { restoreTransliteratedTerms } from '../language/term-matcher';

// Declare Web Speech API types for TypeScript
interface IWindowSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

/**
 * Browser Web Speech API implementation of SttProvider
 */
export class BrowserWebSpeechSTT implements SttProvider {
  public name = 'browser_web_speech';
  private recognition: IWindowSpeechRecognition | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private isListening = false;

  public isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as unknown as {
      SpeechRecognition?: new () => IWindowSpeechRecognition;
      webkitSpeechRecognition?: new () => IWindowSpeechRecognition;
    };
    return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public async startListening(options: SttListenOptions): Promise<void> {
    if (typeof window === 'undefined') return;
    if (this.isListening) {
      this.abortListening();
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => IWindowSpeechRecognition;
      webkitSpeechRecognition?: new () => IWindowSpeechRecognition;
    };
    const SpeechRecClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecClass) {
      options.onError('browser_unsupported');
      return;
    }

    try {
      this.recognition = new SpeechRecClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = options.locale === 'bn' ? 'bn-BD' : 'en-US';

      // Attach audio analyzer for volume amplitude if requested
      if (options.onVolume && navigator.mediaDevices?.getUserMedia) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtx) {
            this.audioContext = new AudioCtx();
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            source.connect(this.analyser);

            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            const checkVolume = () => {
              if (!this.analyser || !this.isListening) return;
              this.analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              const normalized = Math.min(1.0, Math.max(0.0, avg / 128.0));
              options.onVolume?.(normalized);
              this.animFrameId = requestAnimationFrame(checkVolume);
            };
            this.animFrameId = requestAnimationFrame(checkVolume);
          }
        } catch {
          // Fallback if media stream fails or permission already denied
        }
      }

      this.recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';
        let lowestConfidence = 1.0;

        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0].transcript;
          const conf = item[0].confidence || 0.9;
          if (conf < lowestConfidence && conf > 0) lowestConfidence = conf;

          if (item.isFinal) {
            finalTranscript += ` ${text.trim()}`;
          } else {
            interimTranscript += ` ${text.trim()}`;
          }
        }

        const currentText = (finalTranscript || interimTranscript).trim();
        if (currentText) {
          const lowConfidenceWords: string[] = [];
          if (lowestConfidence < 0.65) {
            // Pick potential uncertain words
            const words = currentText.split(/\s+/);
            if (words.length > 0) lowConfidenceWords.push(words[words.length - 1]);
          }

          const processedText = finalTranscript ? restoreTransliteratedTerms(currentText) : currentText;
          const result: SttTranscriptionResult = {
            text: processedText,
            confidence: lowestConfidence,
            lowConfidenceWords,
            isFinal: Boolean(finalTranscript),
          };
          options.onResult(result);
        }
      };

      this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'no-speech') {
          return; // Ignore silence
        }
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          options.onError('permission_denied');
        } else {
          options.onError(event.error || 'speech_recognition_error');
        }
      };

      this.recognition.onend = () => {
        this.cleanupAudio();
        this.isListening = false;
        options.onEnd?.();
      };

      this.isListening = true;
      this.recognition.start();
    } catch (err: unknown) {
      this.cleanupAudio();
      this.isListening = false;
      const msg = err instanceof Error ? err.message : 'failed_to_start_stt';
      options.onError(msg);
    }
  }

  public async stopListening(): Promise<void> {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop errors if already stopped
      }
    }
    this.cleanupAudio();
    this.isListening = false;
  }

  public abortListening(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore
      }
    }
    this.cleanupAudio();
    this.isListening = false;
  }

  private cleanupAudio() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
  }
}

/**
 * OpenAI Whisper STT implementation of SttProvider
 * Records audio in-memory and sends to /api/voice/transcribe
 */
export class OpenAiWhisperSTT implements SttProvider {
  public name = 'openai_whisper';
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && Boolean(window.MediaRecorder);
  }

  public async startListening(options: SttListenOptions): Promise<void> {
    if (!this.isAvailable()) {
      options.onError('browser_unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.isRecording = true;

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        this.isRecording = false;

        if (audioBlob.size === 0) {
          options.onEnd?.();
          return;
        }

        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'speech.webm');
          formData.append('locale', options.locale);
          if (options.hints && options.hints.length > 0) {
            formData.append('hints', options.hints.join(', '));
          }

          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) {
            options.onError('whisper_transcription_failed');
            return;
          }

          const data = await res.json();
          options.onResult({
            text: data.text || '',
            confidence: 0.95,
            isFinal: true,
          });
        } catch {
          options.onError('network_error');
        } finally {
          options.onEnd?.();
        }
      };

      this.mediaRecorder.start(250);
    } catch {
      options.onError('permission_denied');
    }
  }

  public async stopListening(): Promise<void> {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
  }

  public abortListening(): void {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.audioChunks = [];
      this.isRecording = false;
    }
  }
}

/**
 * Stub STT Provider for offline or unit tests
 */
export class StubSTT implements SttProvider {
  public name = 'stub_stt';
  private stubTranscript = '';

  constructor(mockText = '') {
    this.stubTranscript = mockText;
  }

  public setMockTranscript(text: string) {
    this.stubTranscript = text;
  }

  public isAvailable(): boolean {
    return true;
  }

  public async startListening(options: SttListenOptions): Promise<void> {
    setTimeout(() => {
      options.onResult({
        text: this.stubTranscript || 'লক্ষণসমূহ ও রোগীর ইতিহাস',
        confidence: 0.98,
        isFinal: true,
      });
      options.onEnd?.();
    }, 100);
  }

  public async stopListening(): Promise<void> {}
  public abortListening(): void {}
}

export function createSttProvider(type: 'browser' | 'openai' | 'custom_stub' = 'browser'): SttProvider {
  if (type === 'openai') return new OpenAiWhisperSTT();
  if (type === 'custom_stub') return new StubSTT();
  return new BrowserWebSpeechSTT();
}
