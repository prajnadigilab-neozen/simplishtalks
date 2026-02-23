
import { supabase } from "../lib/supabase";
import { AudioStore } from "../utils/audioUtils";

// Use sessionStorage to persist quota status across page refreshes during the session
let isQuotaExhausted = sessionStorage.getItem('simplish-tts-quota-exhausted') === 'true';
let quotaResetTimer: ReturnType<typeof setTimeout> | null = null;

export const getTTSQuotaStatus = () => isQuotaExhausted;

// Simple request queue to manage rate limits
class TTSQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private MIN_GAP = 1200;

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const waitTime = Math.max(0, this.MIN_GAP - (now - this.lastRequestTime));
      if (waitTime > 0) await new Promise(r => setTimeout(r, waitTime));

      const task = this.queue.shift();
      if (task) {
        try {
          await task();
        } catch (e) {
          // Task failures are handled by the promise in add()
        }
        this.lastRequestTime = Date.now();
      }
    }

    this.isProcessing = false;
  }
}

const ttsQueue = new TTSQueue();

/**
 * Text-to-Speech via Supabase Edge Function.
 * API key lives server-side — never in the browser.
 */
export async function textToSpeech(text: string, voice: string = 'Kore', retryCount = 0): Promise<string | null> {
  // 1. Check Cache first
  const cached = AudioStore.get(text);
  if (cached) return cached;

  if (isQuotaExhausted) return null;

  return ttsQueue.add(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('tts', {
        body: { text, voice },
      });

      if (error) throw error;

      const result = typeof data === 'string' ? JSON.parse(data) : data;

      if (result.isQuota) throw { status: 'RESOURCE_EXHAUSTED', message: '429' };

      if (result.audio) {
        AudioStore.set(text, result.audio);
        return result.audio;
      }
      return null;
    } catch (error: any) {
      console.error("TTS Error:", error);

      const errorMsg = error?.message || "";
      const isQuotaError =
        error?.status === 'RESOURCE_EXHAUSTED' ||
        errorMsg.includes('429') ||
        errorMsg.includes('quota');

      if (isQuotaError) {
        if (retryCount < 1) {
          const delay = 5000;
          await new Promise(r => setTimeout(r, delay));
          return textToSpeech(text, voice, retryCount + 1);
        } else {
          isQuotaExhausted = true;
          sessionStorage.setItem('simplish-tts-quota-exhausted', 'true');
          window.dispatchEvent(new CustomEvent('simplish-quota-exhausted'));

          if (quotaResetTimer) clearTimeout(quotaResetTimer);
          quotaResetTimer = setTimeout(() => {
            isQuotaExhausted = false;
            quotaResetTimer = null;
            sessionStorage.removeItem('simplish-tts-quota-exhausted');
          }, 300000);
        }
      }

      return null;
    }
  });
}

/**
 * Placement evaluation via Supabase Edge Function.
 */
export async function evaluatePlacement(data: {
  name: string;
  place: string;
  introduction: string;
  mcqScore: number;
  readingTranscription?: string;
  readingAccuracy?: number;
}) {
  try {
    const { data: result, error } = await supabase.functions.invoke('evaluate', {
      body: { type: 'placement', ...data },
    });

    if (error) throw error;
    return typeof result === 'string' ? JSON.parse(result) : result;
  } catch (error) {
    console.error("Gemini Evaluation Error:", error);
    return {
      suggestedLevel: "BASIC",
      reasoning: "Defaulted to Basic due to a processing error.",
      reasoningKn: "ತಾಂತ್ರಿಕ ದೋಷದಿಂದಾಗಿ ಬೇಸಿಕ್ ಮಟ್ಟಕ್ಕೆ ಹೊಂದಿಸಲಾಗಿದೆ.",
      score: 0
    };
  }
}

/**
 * Speech evaluation via Supabase Edge Function.
 */
export async function evaluateSpeech(audioBlob: Blob, targetText: string) {
  try {
    // Convert blob to base64 for the Edge Function
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64data = (reader.result as string).split(',')[1];
        resolve(base64data);
      };
      reader.readAsDataURL(audioBlob);
    });

    const audioBase64 = await base64Promise;

    const { data: result, error } = await supabase.functions.invoke('evaluate', {
      body: { type: 'speech', audioBase64, targetText },
    });

    if (error) throw error;
    return typeof result === 'string' ? JSON.parse(result) : result;
  } catch (error) {
    console.error("Speech Evaluation Error:", error);
    return {
      transcription: "Error processing audio",
      accuracy: 0,
      feedbackKn: "ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.",
      feedbackEn: "Please try again."
    };
  }
}
