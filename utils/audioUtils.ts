
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Encode a Uint8Array to base64 — used to send PCM audio to the Gemini Live API */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Decode raw 16-bit PCM data (used by Gemini Live) */
export async function decodeRawPCM(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// Global Audio Cache
// Maps text keys to base64 audio data
const globalAudioCache = new Map<string, string>();
// Maps text keys to decoded AudioBuffers for instant playback
const globalBufferCache = new Map<string, AudioBuffer>();

let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  }
  return sharedAudioCtx;
}

export const AudioStore = {
  set: (text: string, base64: string) => {
    globalAudioCache.set(text, base64);
    // Trigger background decoding so it's ready for instant play
    const ctx = getAudioCtx();
    const data = decodeBase64(base64);
    // Standard TTS returns encoded files (MP3/WAV/etc)
    // CRITICAL: slice(0) to create a copy, as decodeAudioData detaches the buffer on failure/success
    const bufferToDecode = data.buffer.slice(0) as ArrayBuffer;
    ctx.decodeAudioData(bufferToDecode).then(buffer => {
      globalBufferCache.set(text, buffer);
    }).catch(() => {
      // Fallback to PCM if decoding failed
      decodeRawPCM(data, ctx).then(buffer => {
        globalBufferCache.set(text, buffer);
      });
    });
  },
  get: (text: string) => globalAudioCache.get(text),
  getBuffer: (text: string) => globalBufferCache.get(text),
  has: (text: string) => globalAudioCache.has(text) || globalBufferCache.has(text)
};

export async function playPCM(base64Audio: string, textKey?: string) {
  const ctx = getAudioCtx();

  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  let audioBuffer: AudioBuffer;

  // If we have a cached buffer for this text, use it immediately
  if (textKey && globalBufferCache.has(textKey)) {
    console.log("AudioUtils: Using cached audio buffer for key:", textKey);
    audioBuffer = globalBufferCache.get(textKey)!;
  } else {
    const audioData = decodeBase64(base64Audio);
    try {
      // Try native decoding first (for MP3/WAV from TTS)
      console.log("AudioUtils: Attempting native decode...");
      // CRITICAL: slice(0) to create a copy, as decodeAudioData detaches the buffer
      const bufferToDecode = audioData.buffer.slice(0) as ArrayBuffer;
      audioBuffer = await ctx.decodeAudioData(bufferToDecode);
      console.log("AudioUtils: Native decode success. Duration:", audioBuffer.duration);
    } catch (e) {
      // Fallback to raw PCM (for Gemini Live)
      console.log("AudioUtils: Native decode failed, falling back to PCM. Error:", e);
      audioBuffer = await decodeRawPCM(audioData, ctx, 24000, 1);
      console.log("AudioUtils: PCM decode success. Duration:", audioBuffer.duration);
    }
    if (textKey) globalBufferCache.set(textKey, audioBuffer);
  }

  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(ctx.destination);
  source.start();

  return new Promise((resolve) => {
    source.onended = resolve;
  });
}

// Helper to play from text key directly if cached
export async function playCached(text: string): Promise<boolean> {
  const buffer = globalBufferCache.get(text);
  if (buffer) {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') await ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    return new Promise((resolve) => {
      source.onended = () => resolve(true);
    });
  }
  return false;
}
