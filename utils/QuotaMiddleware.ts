import { getModelQuota, estimateTokens, getMockResponse } from '../services/apiGuardrail';
import { getCreditStatus } from '../services/billingService';

interface UsageState {
    rpd: number;
    tpm: number;
    rpm: number;
    lastRequestTime: number;
    lastMinuteReset: number;
    lastDayReset: number;
}

const STORAGE_KEY = 'simplish_api_usage';

const getInitialState = (): UsageState => ({
    rpd: 0,
    tpm: 0,
    rpm: 0,
    lastRequestTime: 0,
    lastMinuteReset: Date.now(),
    lastDayReset: getMidnightPT(),
});

/**
 * Calculates Midnight Pacific Time in local MS.
 * Google resets at 0:00 PT (1:30 PM IST).
 */
function getMidnightPT(): number {
    const now = new Date();
    // Convert to PT (UTC-8)
    const ptDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    ptDate.setHours(24, 0, 0, 0); // Next midnight PT
    return ptDate.getTime();
}

const loadState = (): UsageState => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getInitialState();

    const state = JSON.parse(stored);
    const now = Date.now();

    // Reset daily if past midnight PT
    if (now > state.lastDayReset) {
        state.rpd = 0;
        state.lastDayReset = getMidnightPT();
    }

    // Reset minute if 60s passed
    if (now - state.lastMinuteReset > 60000) {
        state.rpm = 0;
        state.tpm = 0;
        state.lastMinuteReset = now;
    }

    return state;
};

const saveState = (state: UsageState) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const quotaGuard = async (model: string, prompt: string, type: 'chat' | 'tts' = 'chat') => {
    // 1. Check TEST_MODE
    if (import.meta.env.VITE_TEST_MODE === 'true') {
        return { isAllowed: true, mockData: getMockResponse(type) };
    }

    const quota = getModelQuota(model);
    const state = loadState();
    const estimatedTokens = estimateTokens(prompt);

    // 2. Check GCP Billing Circuit Breaker
    const billing = await getCreditStatus();
    if (billing.is_circuit_breaker_active) {
        return {
            isAllowed: false,
            reason: 'BILLING_EXHAUSTED',
            message: 'AI Pro Developer Credit ($10) has hit $0. API paused to prevent accidental charges.'
        };
    }

    // 2. Check Limits
    if (state.rpd >= quota.rpd) {
        return { isAllowed: false, reason: 'QUOTA_EXHAUSTED', message: 'Daily quota exceeded. Please wait until 1:30 PM IST for reset.' };
    }

    if (state.rpm >= quota.rpm) {
        return { isAllowed: false, reason: 'RATE_LIMITED', message: 'Requests too frequent. Cooling down for 60 seconds.' };
    }

    if (state.tpm + estimatedTokens > quota.tpm) {
        return { isAllowed: false, reason: 'RATE_LIMITED', message: 'Token limit reached for this minute. Please wait 60 seconds.' };
    }

    // 3. Update State (Optimistic)
    state.rpd += 1;
    state.rpm += 1;
    state.tpm += estimatedTokens;
    state.lastRequestTime = Date.now();
    saveState(state);

    return { isAllowed: true, estimatedTokens };
};

export const reportRealUsage = (tokens: number) => {
    const state = loadState();
    // Adjust if estimate was wrong? Usually just log for now
    console.log(`Real tokens used: ${tokens}`);
}

export const getUsageStatus = (model: string) => {
    const state = loadState();
    const quota = getModelQuota(model);
    return {
        rpd: state.rpd,
        rpdLimit: quota.rpd,
        tpm: state.tpm,
        tpmLimit: quota.tpm,
        rpm: state.rpm,
        rpmLimit: quota.rpm,
        resetTime: state.lastDayReset
    };
}
