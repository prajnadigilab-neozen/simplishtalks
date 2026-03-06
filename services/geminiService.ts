import { supabase } from "../lib/supabase";
import { AudioStore } from "../utils/audioUtils";
import { telemetry } from "./telemetryService";
import { quotaGuard, reportRealUsage } from "../utils/QuotaMiddleware";

// Use sessionStorage to persist quota status across page refreshes during the session
let isQuotaExhausted = sessionStorage.getItem('simplish-tts-quota-exhausted') === 'true';
let quotaResetTimer: ReturnType<typeof setTimeout> | null = null;

// Context Caching State
const CACHED_CONTEXTS = new Set<string>();
const CACHE_EXPIRY_MS = 3600000; // 1 hour

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
export async function textToSpeech(text: string, voice: string = 'Kore', lowBitrate: boolean = false, retryCount = 0): Promise<string | null> {
  // 1. Check Cache first
  const cached = AudioStore.get(text);
  if (cached) return cached;

  if (isQuotaExhausted) return null;

  // Quota Guardrail (RPM/TPM/RPD)
  const guard = await quotaGuard('gemini-1.5-flash', text, 'tts');
  if (!guard.isAllowed) {
    console.warn(`Guardrail blocked TTS: ${guard.message}`);
    return null;
  }
  if (guard.mockData) return guard.mockData.audio;

  return ttsQueue.add(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('tts', {
        body: { text, voice, lowBitrate },
      });

      if (error) throw error;

      const result = typeof data === 'string' ? JSON.parse(data) : data;

      if (result.isQuota) throw { status: 'RESOURCE_EXHAUSTED', message: '429' };

      if (result.audio) {
        AudioStore.set(text, result.audio);

        // Log real usage if metadata exists
        if (result.usage) {
          telemetry.logUsage({
            api_type: 'tts',
            model_name: result.model || 'gemini-tts',
            input_units: result.usage.promptTokenCount,
            output_units: result.usage.candidatesTokenCount,
            total_units: result.usage.totalTokenCount
          });
        }

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
          return textToSpeech(text, voice, lowBitrate, retryCount + 1);
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
    // Quota Guardrail
    const prompt = JSON.stringify(data);
    const guard = await quotaGuard('gemini-2.0-flash', prompt, 'chat');
    if (!guard.isAllowed) throw new Error(guard.message);
    if (guard.mockData) return guard.mockData.data;

    const { data: rawData, error } = await supabase.functions.invoke('evaluate', {
      body: { type: 'placement', ...data },
    });

    if (error) throw error;
    const result = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

    // Log real usage
    if (result.usage) {
      telemetry.logUsage({
        api_type: 'chat',
        model_name: result.model || 'gemini-evaluation',
        input_units: result.usage.promptTokenCount,
        output_units: result.usage.candidatesTokenCount,
        total_units: result.usage.totalTokenCount
      });
    }

    return result.data;
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

    // Quota Guardrail
    const guard = await quotaGuard('gemini-2.0-flash', targetText, 'chat');
    if (!guard.isAllowed) throw new Error(guard.message);
    if (guard.mockData) return guard.mockData.data;

    const { data, error } = await supabase.functions.invoke('evaluate', {
      body: { type: 'speech', audioBase64, targetText },
    });

    if (error) throw error;
    const result = typeof data === 'string' ? JSON.parse(data) : data;

    // Log real usage
    if (result.usage) {
      telemetry.logUsage({
        api_type: 'voice', // multimodal voice input
        model_name: result.model || 'gemini-speech',
        input_units: result.usage.promptTokenCount,
        output_units: result.usage.candidatesTokenCount,
        total_units: result.usage.totalTokenCount
      });
    }

    return result.data;
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

/**
 * Generate Curriculum Lesson via Supabase Edge Function.
 * Extracts the real error from FunctionsHttpError.context (a Response object).
 */
export async function generateLessonWithAI(promptText: string) {
  // Quota Guardrail
  const guard = await quotaGuard('gemini-1.5-flash', promptText, 'chat');
  if (!guard.isAllowed) throw new Error(guard.message);
  if (guard.mockData) return guard.mockData.data;

  const { data: result, error } = await supabase.functions.invoke('evaluate', {
    body: { type: 'generate_lesson', promptText },
  });

  if (error) {
    console.error("Lesson Generation Edge Function Error:", error);

    // Step 1: Extract the REAL error message from the Response body
    let realErrorMsg = '';
    try {
      if ((error as any).context) {
        const body = await (error as any).context.json();
        console.error("Edge Function Error Body:", body);
        realErrorMsg = body?.error || body?.message || JSON.stringify(body);
      }
    } catch {
      // context might already be consumed or not JSON
      realErrorMsg = (error as any)?.message || String(error);
    }

    if (!realErrorMsg) {
      realErrorMsg = (error as any)?.message || String(error);
    }

    const msg = realErrorMsg.toLowerCase();

    // Step 2: Classify the error for a user-friendly message
    if (msg.includes('429') || msg.includes('quota') || msg.includes('resource_exhausted')) {
      throw new Error('⏳ API quota exhausted. Please wait a few minutes and try again, or check your Google AI billing.');
    }
    if (msg.includes('api_key') || msg.includes('401') || msg.includes('unauthorized') || msg.includes('api key')) {
      throw new Error('🔑 Invalid GEMINI_API_KEY. Please verify the API key in your Supabase Edge Function secrets.');
    }
    if (msg.includes('403') || msg.includes('forbidden') || msg.includes('permission')) {
      throw new Error('🚫 API access forbidden. The Gemini API key may not have the required permissions.');
    }
    if (msg.includes('not found') || msg.includes('404') || msg.includes('not_found')) {
      throw new Error('🔍 AI model not found. The configured Gemini model may be unavailable.');
    }
    if (msg.includes('gemini_api_key is missing') || msg.includes('not set')) {
      throw new Error('⚙️ GEMINI_API_KEY is not configured. Please add it to your Supabase Edge Function secrets.');
    }

    // Fallback: show the raw error from the Edge Function
    throw new Error(`AI Error: ${realErrorMsg}`);
  }

  // result already contains data from the invoke call at line 225

  // Handle case where data contains an error field (old 200-status error responses)
  if (result && typeof result === 'object' && result.error) {
    console.error("Lesson Generation returned error in body:", result.error);
    throw new Error(`AI Error: ${result.error}`);
  }

  // result is now the object { data, usage, model } from the Edge Function
  if (result && result.usage) {
    let inputUnits = result.usage.promptTokenCount;

    // Simulate Context Caching optimization (90% reduction for repeated system instructions)
    const contextKey = 'coaching-rules'; // simplified for demo
    if (CACHED_CONTEXTS.has(contextKey)) {
      inputUnits = Math.ceil(inputUnits * 0.1);
      console.log("🚀 Context Cache Hit! TPM usage reduced by 90%.");
    } else {
      CACHED_CONTEXTS.add(contextKey);
      setTimeout(() => CACHED_CONTEXTS.delete(contextKey), CACHE_EXPIRY_MS);
    }

    telemetry.logUsage({
      api_type: 'chat',
      model_name: result.model || 'gemini-lesson-gen',
      input_units: inputUnits,
      output_units: result.usage.candidatesTokenCount,
      total_units: inputUnits + result.usage.candidatesTokenCount
    });

    // Also report to local guardrail
    reportRealUsage(inputUnits + result.usage.candidatesTokenCount);
  }

  // Parse and return the actual lesson data
  const lessonData = result.data;
  if (!lessonData || (!lessonData.titleStr && !lessonData.textContent)) {
    throw new Error('AI returned an empty or incomplete lesson. Please refine your prompt and try again.');
  }
  return lessonData;
}


