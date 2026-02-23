import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const PRIMARY_MODEL = 'gemini-2.0-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';

async function callGemini(model: string, contents: any, config: any) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const body = { contents, generationConfig: config };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
        console.error(`Gemini ${model} error ${res.status}:`, JSON.stringify(data, null, 2));
        throw new Error(`Gemini ${model} error ${res.status}: ${data.error?.message || 'Unknown error'}`);
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Placement Evaluation ─────────────────────────────────────────────────────

async function handlePlacement(body: any) {
    const { name, place, introduction, mcqScore, readingTranscription, readingAccuracy } = body;

    const prompt = `
    Evaluate this student's English proficiency for placement.
    
    STUDENT DATA:
    - Name: ${name}
    - Location: ${place}
    - MCQ Score: ${mcqScore}/5 (Testing basic grammar/vocab)
    - Reading Aloud Transcription: "${readingTranscription || 'N/A'}" (Accuracy: ${readingAccuracy || 0}/5)
    - Written Introduction: "${introduction}"
    
    TASKS:
    1. Assign one level: BASIC, INTERMEDIATE, ADVANCED, EXPERT.
    2. Provide a 1-10 numerical score.
    3. Give a short, encouraging reasoning in English.
    4. Give a same reasoning/feedback in Kannada script.
    
    Return JSON format.
  `;

    const config = {
        responseMimeType: 'application/json',
        responseSchema: {
            type: 'OBJECT',
            properties: {
                suggestedLevel: { type: 'STRING' },
                reasoning: { type: 'STRING' },
                reasoningKn: { type: 'STRING' },
                score: { type: 'NUMBER' },
            },
            required: ['suggestedLevel', 'reasoning', 'reasoningKn', 'score'],
        },
    };

    const contents = [{ role: 'user', parts: [{ text: prompt }] }];

    try {
        const result = await callGemini(PRIMARY_MODEL, contents, config);
        return result;
    } catch (err: any) {
        const msg = err.message?.toLowerCase() || '';
        if (msg.includes('not found') || msg.includes('404') || msg.includes('503')) {
            return await callGemini(FALLBACK_MODEL, contents, config);
        }
        throw err;
    }
}

// ── Speech Evaluation ────────────────────────────────────────────────────────

async function handleSpeech(body: any) {
    const { audioBase64, targetText } = body;

    const contents = {
        parts: [
            {
                inlineData: {
                    mimeType: 'audio/webm',
                    data: audioBase64,
                },
            },
            {
                text: `Analyze this audio recording. The user is trying to say: "${targetText}".
        1. Transcribe what the user actually said.
        2. Compare it to the target text.
        3. Rate accuracy from 1 to 5.
        4. Provide a friendly tip in Kannada (written in Kannada script) to improve pronunciation or grammar.
        Return JSON.`,
            },
        ],
    };

    const config = {
        responseMimeType: 'application/json',
        responseSchema: {
            type: 'OBJECT',
            properties: {
                transcription: { type: 'STRING' },
                accuracy: { type: 'NUMBER' },
                feedbackKn: { type: 'STRING' },
                feedbackEn: { type: 'STRING' },
            },
            required: ['transcription', 'accuracy', 'feedbackKn', 'feedbackEn'],
        },
    };

    try {
        const result = await callGemini(PRIMARY_MODEL, [contents], config);
        return result;
    } catch (err: any) {
        const msg = err.message?.toLowerCase() || '';
        if (msg.includes('not found') || msg.includes('404') || msg.includes('503')) {
            return await callGemini(FALLBACK_MODEL, [contents], config);
        }
        throw err;
    }
}

// ── Router ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { type } = body; // 'placement' or 'speech'

        let result: string;
        if (type === 'placement') {
            result = await handlePlacement(body);
        } else if (type === 'speech') {
            result = await handleSpeech(body);
        } else {
            return new Response(JSON.stringify({ error: 'Unknown evaluation type' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(result, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        console.error('evaluate error:', err.message);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
