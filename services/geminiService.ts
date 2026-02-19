
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AudioStore } from "../utils/audioUtils";

let aiInstance: GoogleGenAI | null = null;
// Use sessionStorage to persist quota status across page refreshes during the session
let isQuotaExhausted = sessionStorage.getItem('simplish-tts-quota-exhausted') === 'true';

export const getTTSQuotaStatus = () => isQuotaExhausted;

const PRIMARY_MODEL = "gemini-flash-latest";
const FALLBACK_MODEL = "gemini-1.5-flash";

function getAI() {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  }
  return aiInstance;
}

// Helper to attempt generation with fallback
async function generateWithFallback(options: any) {
  const ai = getAI();
  try {
    // Try primary model first
    return await ai.models.generateContent({
      ...options,
      model: PRIMARY_MODEL
    });
  } catch (err: any) {
    // If primary fails with "not found", "404", or "503" (overloaded), try fallback
    const errorMsg = err.message?.toLowerCase() || "";
    if (errorMsg.includes('not found') || errorMsg.includes('404') || errorMsg.includes('503')) {
      console.warn(`Model ${PRIMARY_MODEL} not found, falling back to ${FALLBACK_MODEL}`);
      return await ai.models.generateContent({
        ...options,
        model: FALLBACK_MODEL
      });
    }
    throw err;
  }
}

// Simple request queue to manage rate limits
class TTSQueue {
  private queue: Array<() => Promise<void>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private MIN_GAP = 1200; // Increased gap to be safer with rate limits

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

export async function textToSpeech(text: string, voice: string = 'Kore', retryCount = 0): Promise<string | null> {
  // 1. Check Cache first
  const cached = AudioStore.get(text);
  if (cached) return cached;

  if (isQuotaExhausted) return null;

  return ttsQueue.add(async () => {
    try {
      const ai = getAI();
      const response = await generateWithFallback({
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        AudioStore.set(text, base64Audio);
        return base64Audio;
      }
      return null;
    } catch (error: any) {
      console.error("TTS Error:", error);

      const errorMsg = error?.message || "";
      const isQuotaError =
        error?.status === 'RESOURCE_EXHAUSTED' ||
        errorMsg.includes('429') ||
        errorMsg.includes('quota') ||
        (typeof error === 'object' && JSON.stringify(error).includes('429'));

      if (isQuotaError) {
        if (retryCount < 1) {
          // One retry with a significant backoff
          const delay = 5000;
          await new Promise(r => setTimeout(r, delay));
          return textToSpeech(text, voice, retryCount + 1);
        } else {
          isQuotaExhausted = true;
          sessionStorage.setItem('simplish-tts-quota-exhausted', 'true');
          window.dispatchEvent(new CustomEvent('simplish-quota-exhausted'));

          // Auto-reset quota after 5 minutes to prevent permanent lock
          setTimeout(() => {
            isQuotaExhausted = false;
            sessionStorage.removeItem('simplish-tts-quota-exhausted');
          }, 300000);
        }
      }

      aiInstance = null;
      return null;
    }
  });
}

export async function evaluatePlacement(formData: { name: string; place: string; introduction: string }) {
  try {
    const ai = getAI();
    const response = await generateWithFallback({
      contents: `Evaluate the following student response for an English placement test. 
      The student speaks Kannada. 
      Student Name: ${formData.name}
      Place: ${formData.place}
      Self Introduction: ${formData.introduction}
      
      Suggest one of these levels: BASIC, INTERMEDIATE, ADVANCED, EXPERT. 
      Return the answer in JSON format.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedLevel: {
              type: Type.STRING,
              description: "Suggested level based on English proficiency",
            },
            reasoning: {
              type: Type.STRING,
              description: "Short reason for the placement",
            },
            score: {
              type: Type.NUMBER,
              description: "Score from 1 to 10",
            }
          },
          required: ["suggestedLevel", "reasoning", "score"],
          propertyOrdering: ["suggestedLevel", "reasoning", "score"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Evaluation Error:", error);
    aiInstance = null;
    return { suggestedLevel: "BASIC", reasoning: "Defaulted to Basic due to processing error.", score: 0 };
  }
}

export async function evaluateSpeech(audioBlob: Blob, targetText: string) {
  try {
    const ai = getAI();
    const reader = new FileReader();
    const base64Promise = new Promise<string>((resolve) => {
      reader.onloadend = () => {
        const base64data = (reader.result as string).split(',')[1];
        resolve(base64data);
      };
      reader.readAsDataURL(audioBlob);
    });

    const base64Audio = await base64Promise;

    const response = await generateWithFallback({
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/webm",
              data: base64Audio
            }
          },
          {
            text: `Analyze this audio recording. The user is trying to say: "${targetText}".
            1. Transcribe what the user actually said.
            2. Compare it to the target text.
            3. Rate accuracy from 1 to 5.
            4. Provide a friendly tip in Kannada (written in Kannada script) to improve pronunciation or grammar.
            Return JSON.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcription: { type: Type.STRING },
            accuracy: { type: Type.NUMBER },
            feedbackKn: { type: Type.STRING },
            feedbackEn: { type: Type.STRING }
          },
          required: ["transcription", "accuracy", "feedbackKn", "feedbackEn"],
          propertyOrdering: ["transcription", "accuracy", "feedbackKn", "feedbackEn"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Speech Evaluation Error:", error);
    aiInstance = null;
    return {
      transcription: "Error processing audio",
      accuracy: 0,
      feedbackKn: "ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ.",
      feedbackEn: "Please try again."
    };
  }
}
