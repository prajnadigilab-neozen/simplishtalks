import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
// Use the TTS-specific preview model found in the list
const MODEL = 'models/gemini-2.5-flash-preview-tts';

async function generateTTS(text: string, voice: string, lowBitrate: boolean) {
    const url = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice },
                },
            },
        },
    };

    // Note: If Gemini API adds explicit bitrate control, it would be added to speechConfig here.
    // For now, we are providing the plumbing to the backend.

    console.log(`TTS request: url=${url.split('?')[0]}, text="${text.substring(0, 50)}...", voice=${voice}, lowBitrate=${lowBitrate}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
        console.error(`Gemini TTS error ${res.status}:`, JSON.stringify(data, null, 2));
        throw new Error(`Gemini TTS error ${res.status}: ${data.error?.message || 'Unknown error'}`);
    }

    const audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    const usage = data.usageMetadata;

    if (!audio) {
        console.warn('Gemini returned OK but no audio data in response. Response:', JSON.stringify(data, null, 2));
    }
    return { audio, usage };
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { text, voice = 'Kore', lowBitrate = false } = await req.json();

        if (!text) {
            return new Response(JSON.stringify({ audio: null }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { audio, usage } = await generateTTS(text, voice, lowBitrate);

        return new Response(JSON.stringify({
            audio,
            usage,
            model: MODEL
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        console.error('tts edge function error:', err.message);

        const isQuota = err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED');

        return new Response(
            JSON.stringify({ audio: null, error: err.message, isQuota }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
