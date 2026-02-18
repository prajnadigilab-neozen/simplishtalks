
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
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
    decodeAudioData(data, ctx).then(buffer => {
      globalBufferCache.set(text, buffer);
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
    audioBuffer = globalBufferCache.get(textKey)!;
  } else {
    const audioData = decodeBase64(base64Audio);
    audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
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
