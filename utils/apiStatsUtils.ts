export interface TrendData {
  date: string;
  voice: number;
  chat: number;
}

export interface APIStats {
  voice_usage: number; // seconds
  chat_usage: number; // tokens
  total_limit: number; // normalized units
  expiry_date: string;
  is_auto_renew: boolean;
  trend_data: TrendData[];
  api_key: string;
}

export const normalizeUsage = (voice_usage: number, chat_usage: number): number => {
  // Total Usage = (voice_usage / 60 * 10) + (chat_tokens * 1)
  return (voice_usage / 60 * 10) + (chat_usage * 1);
};

export const GEMINI_PRICING = {
  'gemini-1.5-flash': { input: 0.000000075, output: 0.0000003 }, // per token
  'gemini-2.0-flash-exp': { input: 0.000000075, output: 0.0000003 },
  'gemini-1.5-pro': { input: 0.00000125, output: 0.000005 },
  'gemini-3-flash-preview': { input: 0.000000075, output: 0.0000003 },
  'gemini-flash-latest': { input: 0.000000075, output: 0.0000003 },
  'default': { input: 0.000000075, output: 0.0000003 },
};

export const calculateSpend = (model: string, inputTokens: number, outputTokens: number): number => {
  const modelKey = Object.keys(GEMINI_PRICING).find(k => model.includes(k)) || 'default';
  const price = GEMINI_PRICING[modelKey as keyof typeof GEMINI_PRICING];
  return (inputTokens * price.input) + (outputTokens * price.output);
};

export const getProgressColor = (percent: number): string => {
  if (percent < 70) return 'bg-emerald-500';
  if (percent < 90) return 'bg-amber-500';
  return 'bg-rose-500';
};
