/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- one-off generator script for an untyped optional dependency.
/* eslint-disable @typescript-eslint/no-explicit-any */
import msedgeTts from 'msedge-tts';
const { MsEdgeTTS, OUTPUT_FORMAT } = msedgeTts as any;
import fs from 'fs';
import path from 'path';

const targetDir = path.join(process.cwd(), 'public', 'voice', 'reactions');
fs.mkdirSync(targetDir, { recursive: true });

const clips: Array<{ filename: string; text: string; voice: string }> = [
  // Bangla reactions
  { filename: 'bn-understood-1.mp3', text: 'জি, বুঝেছি।', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-understood-2.mp3', text: 'ঠিক আছে।', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-thinking-1.mp3', text: 'একটু দেখছি...', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-thinking-2.mp3', text: 'লাইব্রেরিতে খুঁজছি...', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-thinking-3.mp3', text: 'হুম, একটু সময় দিন...', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-success-1.mp3', text: 'হয়ে গেছে।', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-success-2.mp3', text: 'সংরক্ষণ করা হয়েছে।', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-alert-1.mp3', text: 'একটি জরুরি সতর্কতা:', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-clarify-1.mp3', text: 'একটু নিশ্চিত হয়ে নিই।', voice: 'bn-BD-NabanitaNeural' },
  { filename: 'bn-apology-1.mp3', text: 'দুঃখিত, ঠিক শুনতে পাইনি।', voice: 'bn-BD-NabanitaNeural' },

  // English reactions
  { filename: 'en-understood-1.mp3', text: 'Understood.', voice: 'en-US-JennyNeural' },
  { filename: 'en-understood-2.mp3', text: 'Got it.', voice: 'en-US-JennyNeural' },
  { filename: 'en-thinking-1.mp3', text: 'Looking into this...', voice: 'en-US-JennyNeural' },
  { filename: 'en-thinking-2.mp3', text: 'Checking the library...', voice: 'en-US-JennyNeural' },
  { filename: 'en-thinking-3.mp3', text: 'Hmm, one moment...', voice: 'en-US-JennyNeural' },
  { filename: 'en-success-1.mp3', text: 'Done.', voice: 'en-US-JennyNeural' },
  { filename: 'en-success-2.mp3', text: 'Saved.', voice: 'en-US-JennyNeural' },
  { filename: 'en-alert-1.mp3', text: 'Important safety alert:', voice: 'en-US-JennyNeural' },
  { filename: 'en-clarify-1.mp3', text: 'Let me make sure I understood.', voice: 'en-US-JennyNeural' },
  { filename: 'en-apology-1.mp3', text: 'Sorry, I did not catch that.', voice: 'en-US-JennyNeural' },
];

async function main() {
  for (const clip of clips) {
    const dest = path.join(targetDir, clip.filename);
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(clip.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(clip.text);
      const out = fs.createWriteStream(dest);
      audioStream.pipe(out);
      await new Promise<void>((resolve, reject) => {
        out.on('finish', resolve);
        out.on('error', reject);
        audioStream.on('error', reject);
      });
    } catch (err) {
      console.error(`Failed ${clip.filename}:`, err);
    }
  }
}

void main();
