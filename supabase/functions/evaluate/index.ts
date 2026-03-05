import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const PRIMARY_MODEL = 'gemini-2.0-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';

async function callGemini(model: string, contents: any, config: any) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is missing in Edge Function environment variables.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const body = { contents, generationConfig: config };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error(`Gemini ${model} API Error (Status ${res.status}):`, JSON.stringify(data, null, 2));
            const errorMessage = data.error?.message || 'Unknown Gemini API Error';
            const errorReason = data.error?.status || 'UNKNOWN';
            throw new Error(`Gemini ${model} ${errorReason}: ${errorMessage}`);
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
            console.error(`Gemini ${model} returned empty response:`, JSON.stringify(data, null, 2));
            throw new Error(`Gemini ${model} returned an empty or invalid response structure.`);
        }

        return text;
    } catch (err: any) {
        console.error(`Fetch/Parse error in callGemini (${model}):`, err.message);
        throw err;
    }
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

// ── Lesson Generation ────────────────────────────────────────────────────────

async function handleGenerateLesson(body: any) {
    const { promptText } = body;

    const prompt = `
    You are an AI Curriculum Designer for a language learning app called "Simplish".
    Generate a JSON lesson object based on the following instructions from the user.
    The lesson MUST adhere to a "safe-to-fail", encouraging, and bilingual (English/Kannada) philosophy.
    
    USER INSTRUCTIONS:
    ${promptText}
    
    OUTPUT REQUIREMENTS:
    Return a strictly formatted JSON object matching the requested schema.
    Ensure "titleStr", "notesStr", "textContent", "studyTextContent", "speakTextContent" are fully generated.
    Ensure "scenario" contains "characterStr", "objectiveStr", "systemInstruction", and "initialMessage".
    `;

    const config = {
        responseMimeType: 'application/json',
        responseSchema: {
            type: 'OBJECT',
            properties: {
                titleStr: { type: 'STRING' },
                notesStr: { type: 'STRING' },
                textContent: { type: 'STRING' },
                studyTextContent: { type: 'STRING' },
                speakTextContent: { type: 'STRING' },
                scenario: {
                    type: 'OBJECT',
                    properties: {
                        characterStr: { type: 'STRING' },
                        objectiveStr: { type: 'STRING' },
                        systemInstruction: { type: 'STRING' },
                        initialMessage: { type: 'STRING' }
                    },
                    required: ["characterStr", "objectiveStr", "systemInstruction", "initialMessage"]
                }
            },
            required: ['titleStr', 'notesStr', 'textContent', 'studyTextContent', 'speakTextContent', 'scenario'],
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

// ── Router ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const body = await req.json();
        const { type } = body;

        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }

        let result: string;
        if (type === 'placement') {
            result = await handlePlacement(body);
        } else if (type === 'speech') {
            result = await handleSpeech(body);
        } else if (type === 'generate_lesson') {
            result = await handleGenerateLesson(body);
        } else {
            return new Response(JSON.stringify({ error: `Unknown evaluation type: ${type}` }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(result, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        console.error('Evaluate Edge Function Error:', err.message);

        // Return a proper error status so the client (supabase-js) throws a FunctionsHttpError
        return new Response(
            JSON.stringify({
                error: err.message,
                details: err.stack || 'No stack trace available'
            }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
