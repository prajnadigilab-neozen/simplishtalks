
export interface ModelQuota {
    rpm: number; // Requests Per Minute
    tpm: number; // Tokens Per Minute
    rpd: number; // Requests Per Day
}

export const MODEL_QUOTAS: Record<string, ModelQuota> = {
    'gemini-2.0-flash': { rpm: 10, tpm: 250000, rpd: 250 },
    'gemini-2.0-pro': { rpm: 5, tpm: 250000, rpd: 100 },
    'gemini-1.5-flash': { rpm: 15, tpm: 250000, rpd: 1000 },
};

export const getModelQuota = (model: string): ModelQuota => {
    return MODEL_QUOTAS[model] || MODEL_QUOTAS['gemini-2.0-flash']; // Default to Flash
};

/**
 * Simple Token Estimator
 * Rule of thumb: 1 token ~= 4 characters for English.
 * 1 token ~= 1-2 characters for Kannada script.
 */
export const estimateTokens = (text: string): number => {
    if (!text) return 0;
    // Estimate based on character count and heuristic for mixed English/Kannada
    const characterCount = text.length;
    // Use a slightly more conservative multiplier (0.3 characters per token) to be safe
    return Math.ceil(characterCount / 3);
};

export const isExceedingThreshold = (tokens: number, model: string, threshold = 0.5): boolean => {
    const quota = getModelQuota(model);
    return tokens > quota.tpm * threshold;
};

/**
 * Mocking logic for Test Mode
 */
export const getMockResponse = (type: string) => {
    const mocks: Record<string, any> = {
        'chat': {
            data: {
                content: "This is a mock response from the TestingGuard. GEMINI_API_KEY was not called.",
                correction: "None",
                kannada_guide: "ಇದು ಟೆಸ್ಟ್ ಮೋಡ್‌ನಿಂದ ಬಂದ ಪ್ರತಿಕ್ರಿಯೆ.",
            },
            usage: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 }
        },
        'tts': {
            audio: "mock_base64_audio_data",
            usage: { promptTokenCount: 5, candidatesTokenCount: 10, totalTokenCount: 15 }
        }
    };
    return mocks[type] || mocks['chat'];
};
