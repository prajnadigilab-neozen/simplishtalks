import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-flash-latest';

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
                    reply: { type: 'STRING', description: "The character's reply in English" },
                    kannadaHelp: { type: 'STRING', description: 'Kannada guide for understanding' },
                    pronunciationTip: { type: 'STRING', description: 'Brief pronunciation tip for the student' },
                },
                required: ['reply'],
            },
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini ${model} error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { message, history, systemInstruction } = await req.json();
        const contents = [
            ...(history || []),
            { role: 'user', parts: [{ text: message }] },
        ];

        const fullInstruction = `
      ${systemInstruction}
      
      Rules:
      1. Stay in character.
      2. Keep responses short and simple.
      3. If the student makes a big mistake, gently correct them in English.
      4. If needed for understanding, provide a Kannada guide in the 'kannadaHelp' field.
      5. If the student's message has English pronunciation or grammar issues that can be improved, provide a short 'pronunciationTip'.
      6. FORMAT for 'kannadaHelp': [Kannada Text] ([Transliterated Kannada]) followed by a new line with the English translation.
      7. Return JSON format.
    `;

        let result: string;
        try {
            result = await callGemini(PRIMARY_MODEL, contents, fullInstruction);
        } catch (err: any) {
            const msg = err.message?.toLowerCase() || '';
            if (msg.includes('not found') || msg.includes('404')) {
                // If primary is deprecated, try fallback
                try {
                    result = await callGemini(FALLBACK_MODEL, contents, fullInstruction);
                } catch (fallbackErr: any) {
                    const failMsg = fallbackErr.message?.toLowerCase() || '';
                    if (failMsg.includes('not found') || failMsg.includes('404')) {
                        // System instruction mandate: Return a message instead of a generic error
                        return new Response(JSON.stringify({
                            reply: "The selected AI model is deprecated constraint. Please update your model selection in the settings.",
                            kannadaHelp: "ಆಯ್ಕೆಮಾಡಿದ AI ಮಾದರಿ ಸ್ಥಗಿತಗೊಂಡಿದೆ. ದಯವಿಟ್ಟು ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅಪ್‌ಡೇಟ್ ಮಾಡಿ."
                        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
                    }
                    throw fallbackErr;
                }
            } else if (msg.includes('503')) {
                result = await callGemini(FALLBACK_MODEL, contents, fullInstruction);
            } else {
                throw err;
            }
        }

        return new Response(result, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        console.error('scenario-chat error:', err);
        return new Response(
            JSON.stringify({ reply: "I'm having trouble right now. Please try again.", kannadaHelp: '' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
