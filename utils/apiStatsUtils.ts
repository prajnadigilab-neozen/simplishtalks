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

export const getProgressColor = (percent: number): string => {
  if (percent < 70) return 'bg-emerald-500';
  if (percent < 90) return 'bg-amber-500';
  return 'bg-rose-500';
};
