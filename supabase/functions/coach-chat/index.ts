import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const PRIMARY_MODEL = 'gemini-2.0-flash';
const FALLBACK_MODEL = 'gemini-1.5-flash';

const COACH_SYSTEM_INSTRUCTION = `
You are a patient English tutor for Kannada-speaking students. Always explain complex concepts in Kannada first.
Task: Act as a bilingual English Coach. You receive messages in English, Kannada, or Kanglish.

Operational Logic:
1. Persona: You are Kore, a warm and encouraging teacher.
2. Kannada-First: If a user asks a question or if you are explaining a new concept, provide the Kannada explanation BEFORE or ALONGSIDE the English response.
3. Help Formatting (kannadaGuide): 
    * Use this exact format: [Kannada Text] ([Transliterated Kannada]) followed by a new line with the English translation.
4. Feedback Loop: 
    * Identify grammatical errors in the user's English.
    * Provide a "Correction" field in your response.
    * Provide a "Pronunciation Tip" if the word used is a common phonetic pitfall for Kannada speakers.

Return your response in a strict JSON format with these fields:
- replyEn (required): The coach's reply in English
- kannadaGuide: Formatted Kannada translation/explanation (Priority: Kannada first)
- correction: Grammatical correction of user's input if needed
- pronunciationTip: Phonetic tip for Kannada speakers
`;

async function callGemini(model: string, contents: any, systemInstruction: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const body = {
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    replyEn: { type: 'STRING', description: "The coach's reply in English" },
                    kannadaGuide: { type: 'STRING', description: 'Formatted Kannada translation/explanation' },
                    correction: { type: 'STRING', description: "Grammatical correction of user's input if needed" },
                    pronunciationTip: { type: 'STRING', description: 'Phonetic tip for Kannada speakers' },
                },
                required: ['replyEn'],
            },
        },
    };

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

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { message, history } = await req.json();
        const contents = [
            ...(history || []),
            { role: 'user', parts: [{ text: message }] },
        ];

        let result: string;
        try {
            result = await callGemini(PRIMARY_MODEL, contents, COACH_SYSTEM_INSTRUCTION);
        } catch (err: any) {
            const msg = err.message?.toLowerCase() || '';
            if (msg.includes('not found') || msg.includes('404') || msg.includes('503')) {
                console.warn(`Primary model failed, using fallback: ${err.message}`);
                result = await callGemini(FALLBACK_MODEL, contents, COACH_SYSTEM_INSTRUCTION);
            } else {
                throw err;
            }
        }

        return new Response(result, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        console.error('coach-chat error:', err);
        return new Response(
            JSON.stringify({
                replyEn: "I'm sorry, I'm having trouble connecting right now. Please try again.",
                kannadaGuide: 'ಕ್ಷಮಿಸಿ, ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆ.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
