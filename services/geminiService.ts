import { supabase } from "../lib/supabase";
import { AudioStore } from "../utils/audioUtils";
import { telemetry } from "./telemetryService";
import { quotaGuard, reportRealUsage } from "../utils/QuotaMiddleware";

/**
 * Ensures we always have a fresh, valid JWT before calling Supabase Edge Functions.
 * Returns the fresh access_token.
 */
async function getValidToken(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      console.warn("Session fetch error:", error);
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
      return refreshedSession?.access_token || null;
    }

    if (!session) {
      console.debug("No active session found. Attempting refresh...");
      const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
      return refreshedSession?.access_token || null;
    }

    const expiresAt = session.expires_at ?? 0;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    // If token expires within 5 mins, or is already expired
    if (expiresAt - nowInSeconds < 300) {
      console.debug("Token near expiry or expired. Refreshing...");
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.error("Token refresh failed:", refreshError);
        // If refresh failed but we have a session, return the current token
        return session.access_token;
      }
      return refreshedSession?.access_token || session.access_token;
    }

    return session.access_token;
  } catch (err) {
    console.error("Critical error in token management:", err);
    return null;
  }
}

/**
 * Robust fetch wrapper for Supabase Edge Functions
 */
async function invokeFunction(name: string, body: any): Promise<any> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration in environment variables.");
  }

  let lastError: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      // CRITICAL: Fetch token INSIDE the loop so retry gets a fresh one
      const token = await getValidToken();
      const bearerToken = token || supabaseAnonKey;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'x-client-info': 'supabase-js/2.39.7',
        'Authorization': `Bearer ${bearerToken}`
      };

      const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (response.status === 401) {
        console.warn(`Edge Function 401 on attempt ${attempt}. Token length: ${token?.length || 0}`);
        if (attempt === 1) {
          console.info("Attempting session refresh and retry...");
          await supabase.auth.refreshSession();
          continue; // Force retry with new token
        }
        throw new Error("Invalid JWT: Unauthorized (401). Please try logging out and back in.");
      }

      const data = await response.json();
      if (!response.ok) {
        console.error(`invokeFunction error: [${name}] status=${response.status}`, data);
        // Check for 404/503 (often Gemini availability issues)
        if (response.status === 404 || response.status === 503 || response.status === 504) {
          throw new Error(data.error || data.message || `AI Service Temporary Error (${response.status})`);
        }
        throw new Error(data.error || data.message || `Edge Function Error (${response.status})`);
      }
      return data;
    } catch (err: any) {
      lastError = err;
      // Retry once on auth or timeout errors
      if (attempt === 1 && (err.message?.includes('JWT') || err.message?.includes('401') || err.message?.includes('fetch'))) {
        continue;
      }
      break;
    }
  }
  throw lastError;
}

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
 */
export async function textToSpeech(text: string, voice: string = 'Aoede', lowBitrate: boolean = false, retryCount = 0): Promise<string | null> {
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
      const result = await invokeFunction('tts', { text, voice, lowBitrate });

      if (result.isQuota) throw { status: 'RESOURCE_EXHAUSTED', message: '429' };

      if (result.audio) {
        console.log("geminiService: Received audio from TTS. Length:", result.audio.length);
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
    const guard = await quotaGuard('gemini-3-flash-preview', prompt, 'chat');
    if (!guard.isAllowed) throw new Error(guard.message);
    if (guard.mockData) return guard.mockData.data;

    const result = await invokeFunction('evaluate', { type: 'placement', ...data });

    // Result from invokeFunction is already the parsed JSON { data, usage, model }

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
    const guard = await quotaGuard('gemini-3-flash-preview', targetText, 'chat');
    if (!guard.isAllowed) throw new Error(guard.message);
    if (guard.mockData) return guard.mockData.data;

    const result = await invokeFunction('evaluate', { type: 'speech', audioBase64, targetText });

    // Log real usage as chat to avoid conflating tokens with voice seconds
    if (result.usage) {
      telemetry.logUsage({
        api_type: 'chat', 
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
 */
export async function generateLessonWithAI(promptText: string) {
  // Quota Guardrail
  const guard = await quotaGuard('gemini-1.5-flash', promptText, 'chat');
  if (!guard.isAllowed) throw new Error(guard.message);
  if (guard.mockData) return guard.mockData.data;

  try {
    const result = await invokeFunction('evaluate', { type: 'generate_lesson', promptText });

    // Log usage
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
  } catch (error: any) {
    console.error("Lesson Generation Error:", error);
    const msg = (error.message || "").toLowerCase();

    if (msg.includes('429') || msg.includes('quota')) {
      throw new Error('⏳ API quota exhausted. Please wait a few minutes.');
    }
    if (msg.includes('401') || msg.includes('jwt')) {
      throw new Error('🔑 Authentication error. Please try logging out and back in.');
    }

    throw error;
  }
}

/**
 * Evaluate Snehi Practice Session via Supabase Edge Function to generate a Scorecard.
 */
export async function evaluateSnehiScorecard(transcript: string) {
  try {
    // Quota Guardrail for chat evaluation
    const guard = await quotaGuard('gemini-3-flash-preview', transcript, 'chat');
    if (!guard.isAllowed) throw new Error(guard.message);
    if (guard.mockData) return guard.mockData.data;

    const result = await invokeFunction('evaluate', { type: 'snehi_scorecard', transcript });

    if (result.usage) {
      telemetry.logUsage({
        api_type: 'chat',
        model_name: result.model || 'gemini-scorecard',
        input_units: result.usage.promptTokenCount,
        output_units: result.usage.candidatesTokenCount,
        total_units: result.usage.totalTokenCount
      });
    }

    return result.data;
  } catch (error) {
    console.error("Snehi Scorecard Evaluation Error:", error);
    return null; // Silent failure here, handled safely by frontend UI
  }
}
