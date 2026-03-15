import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const PRIMARY_MODEL = 'gemini-3-flash-preview';
const FALLBACK_MODEL = 'gemini-flash-latest';

const COACH_SYSTEM_INSTRUCTION = `
You are a patient English tutor for Kannada-speaking students. Always explain complex concepts in Kannada first.
Return your response in a strict JSON format with these fields:
- replyEn (required): The coach's reply in English
- kannadaGuide: Formatted Kannada translation/explanation
- correction: Grammatical correction of user's input if needed
- pronunciationTip: Phonetic tip for Kannada speakers
IMPORTANT: Respond ONLY with the JSON object. No markdown, no pre-amble.
`;

async function* streamGemini(model: string, contents: any, systemInstruction: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`;

    const body = {
        contents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
            responseMimeType: 'application/json',
        },
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new Error(`Gemini streaming error ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No stream available');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonText = line.substring(6);
                if (jsonText.trim() === '[DONE]') break;
                try {
                    const data = JSON.parse(jsonText);
                    const chunk = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (chunk) yield chunk;
                } catch (e) {
                    // Ignore transient parse errors on chunk boundaries
                }
            }
        }
    }
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { message, history, prefersTranslation, prefersPronunciation } = await req.json();
        
        let systemInstruction = COACH_SYSTEM_INSTRUCTION;
        if (prefersTranslation === false) {
            systemInstruction += "\nSTRICT RULE: The user has DISABLED translations. Do NOT provide 'kannadaGuide'. Communicate exclusively in English.";
        }
        if (prefersPronunciation === false) {
            systemInstruction += "\nSTRICT RULE: The user has DISABLED pronunciation tips. Do NOT provide 'pronunciationTip'.";
        }

        const contents = [
            ...(history || []),
            { role: 'user', parts: [{ text: message }] },
        ];

        const stream = streamGemini(PRIMARY_MODEL, contents, systemInstruction);

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        (async () => {
            try {
                for await (const chunk of stream) {
                    await writer.write(encoder.encode(chunk));
                }
                await writer.close();
            } catch (err) {
                console.error('Streaming error:', err);
                try { await writer.abort(err); } catch (e) { }
            }
        })();

        return new Response(readable, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Content-Type-Options': 'nosniff'
            },
        });
    } catch (err: any) {
        console.error('coach-chat error:', err);
        const msg = err.message?.toLowerCase() || '';

        // System instruction mandate: Return a message instead of a generic error if model is deprecated
        if (msg.includes('not found') || msg.includes('404')) {
            return new Response(
                JSON.stringify({
                    replyEn: "The selected AI model is deprecated constraint. Please update your model selection in the settings.",
                    kannadaGuide: "ಆಯ್ಕೆಮಾಡಿದ AI ಮಾದರಿ ಸ್ಥಗಿತಗೊಂಡಿದೆ. ದಯವಿಟ್ಟು ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅಪ್‌ಡೇಟ್ ಮಾಡಿ.",
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        return new Response(
            JSON.stringify({
                replyEn: `EDGE ERROR: ${err.message}`,
                kannadaGuide: 'ಕ್ಷಮಿಸಿ, ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆ.',
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
