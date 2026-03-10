/** V 1.0 */
import { supabase } from "../lib/supabase";
import { CoachMessage } from "../types";

/**
 * Common grammar error patterns and their fast-track corrections.
 * Used for instant feedback before calling the heavy AI model.
 */
const FAST_TRACK_PATTERNS = [
  {
    regex: /\b(I|me) (is|am not|aint) (\w+)\b/i,
    test: (text: string) => /\bI is\b/i.test(text),
    fix: (match: any) => `I am ${match[3]}`,
    correction: "In English, we use 'I am' instead of 'I is'."
  },
  {
    regex: /\b(he|she|it) (don't|dont) (\w+)\b/i,
    test: (text: string) => /\b(he|she|it) (don't|dont)\b/i.test(text),
    fix: (match: any) => `${match[1]} doesn't ${match[3]}`,
    correction: "Remember to use 'doesn't' for he/she/it."
  },
  {
    regex: /\b(you|we|they) (was) (\w+)\b/i,
    test: (text: string) => /\b(you|we|they) was\b/i.test(text),
    fix: (match: any) => `${match[1]} were ${match[3]}`,
    correction: "Use 'were' for plural subjects and 'you'."
  }
];

function getFastTrackResponse(message: string) {
  for (const pattern of FAST_TRACK_PATTERNS) {
    if (pattern.test(message)) {
      const match = message.match(pattern.regex);
      if (match) {
        return {
          replyEn: `I noticed a small error. You should say: "${pattern.fix(match)}".`,
          kannadaGuide: "ಸಣ್ಣ ತಪ್ಪು ಗಮನಿಸಿದೆ. (Sanna tappu gamaniside.)\nNotice a small mistake.",
          correction: pattern.correction,
          isFastTrack: true
        };
      }
    }
  }
  return null;
}

function compressHistory(history: { role: 'user' | 'model', parts: { text: string }[] }[]) {
  // Keep only the last 5 turns (10 messages) to reduce payload
  const maxTurns = 5;
  const compressed = history.slice(-(maxTurns * 2));

  // Strip long corrections from previous turns to save tokens
  return compressed.map(turn => ({
    ...turn,
    parts: turn.parts.map(p => ({
      text: p.text.length > 300 ? p.text.substring(0, 300) + "..." : p.text
    }))
  }));
}

/**
 * Robust fetch wrapper for Supabase Edge Functions (matching geminiService pattern)
 */
async function invokeCoachFunction(name: string, body: any): Promise<any> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase configuration.");
  }

  let lastError: any = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let token = session?.access_token;

      // Proactive refresh
      if (session) {
        const expiresAt = session.expires_at ?? 0;
        if (Math.floor(Date.now() / 1000) + 300 > expiresAt) {
          const { data: { session: refreshed } } = await supabase.auth.refreshSession();
          token = refreshed?.access_token || token;
        }
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'x-client-info': 'supabase-js/2.39.7',
          'Authorization': `Bearer ${token || supabaseAnonKey}`
        },
        body: JSON.stringify(body)
      });

      if (response.status === 401) {
        console.warn(`Coach Edge Function 401 on attempt ${attempt}.`);
        if (attempt === 1) {
          await supabase.auth.refreshSession();
          continue; // Retry with fresh session
        }
        throw new Error("Invalid JWT: Unauthorized (401). Please try logging out and back in.");
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Edge Function Error (${response.status})`);
      }

      return response.json();
    } catch (err: any) {
      lastError = err;
      if (attempt === 1 && (err.message?.includes('JWT') || err.message?.includes('401'))) {
        continue;
      }
      break;
    }
  }
  throw lastError;
}

/**
 * Chat with the AI coach via Supabase Edge Function.
 * The API key lives server-side — never in the browser bundle.
 */
export async function chatWithCoach(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
  // 1. Fast-Track check
  const fastTrack = getFastTrackResponse(message);
  if (fastTrack) return fastTrack;

  // 2. Compress history
  const compressedHistory = compressHistory(history);

  try {
    const data = await invokeCoachFunction('coach-chat', { message, history: compressedHistory });
    // result is already JSON
    return data;
  } catch (error: any) {
    console.error("Coach API Error Details:", error);

    // Attempt to extract helpful error from direct fetch response object
    if (error.replyEn) return error;

    return {
      replyEn: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again in a moment.",
      kannadaGuide: "ಕ್ಷಮಿಸಿ, ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆ. (Kshamisi, samparkisalu tondareyaguttide.)\nSorry, there is trouble connecting.",
    };
  }
}

export async function saveChatMessage(userId: string, msg: Partial<CoachMessage>, lessonId?: string, sessionType: 'voice' | 'chat' = 'chat'): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('chat_history').insert({
      user_id: userId,
      lesson_id: lessonId || null,
      session_type: sessionType,
      role: msg.role,
      content: msg.text,
      correction: msg.correction,
      kannada_guide: msg.kannadaGuide,
      pronunciation_tip: msg.pronunciationTip,
      audio_url: msg.audioUrl
    }).select('id').single();

    if (error) throw error;
    return data?.id || null;
  } catch (err) {
    console.error("Failed to save chat message:", err);
    return null;
  }
}

export async function deleteChatMessage(msgId: string) {
  try {
    const { error } = await supabase
      .from('chat_history')
      .update({ is_hidden_from_user: true })
      .eq('id', msgId);
    if (error) throw error;
  } catch (err) {
    console.error("Failed to delete chat message:", err);
  }
}

// Paginated history — fetch last 50 messages, then reverse for display
export async function getChatHistory(userId: string, lessonId?: string, sessionType: 'voice' | 'chat' = 'chat'): Promise<CoachMessage[]> {
  try {
    let query = supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .eq('is_hidden_from_user', false)
      .eq('session_type', sessionType);

    if (lessonId) {
      query = query.eq('lesson_id', lessonId);
    } else {
      query = query.is('lesson_id', null);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return data.reverse().map(m => ({
      dbId: m.id,
      role: m.role as 'user' | 'coach',
      text: m.content,
      correction: m.correction,
      kannadaGuide: m.kannada_guide,
      pronunciationTip: m.pronunciation_tip,
      audioUrl: m.audio_url,
      timestamp: new Date(m.created_at).getTime()
    }));
  } catch (err) {
    console.error("Failed to fetch chat history:", err);
    return [];
  }
}

export async function clearUserChatHistory(userId: string, lessonId?: string, sessionType: 'voice' | 'chat' = 'chat') {
  try {
    let query = supabase
      .from('chat_history')
      .update({ is_hidden_from_user: true })
      .eq('user_id', userId)
      .eq('session_type', sessionType);

    if (lessonId) {
      query = query.eq('lesson_id', lessonId);
    } else {
      query = query.is('lesson_id', null);
    }

    const { error } = await query;
    if (error) throw error;
  } catch (err) {
    console.error("Failed to hide chat history:", err);
  }
}

export async function getAdminAuditLogs(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    return [];
  }
}

// ── Usage & Quota Tracking ──

export async function getUserUsage(userId: string) {
  try {
    const { data, error } = await supabase
      .from('user_usage')
      .select('voice_seconds_total, chat_tokens_total, chat_messages_total')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    return {
      voice_seconds_total: data?.voice_seconds_total || 0,
      chat_tokens_total: data?.chat_tokens_total || 0,
      chat_messages_total: data?.chat_messages_total || 0
    };
  } catch (err) {
    console.error("Failed to fetch user usage:", err);
    return { voice_seconds_total: 0, chat_tokens_total: 0, chat_messages_total: 0 };
  }
}

export async function updateUserUsage(userId: string, addSeconds: number = 0, addTokens: number = 0, addMessages: number = 0) {
  try {
    const { error } = await supabase.rpc('increment_user_usage', {
      p_user_id: userId,
      p_add_seconds: addSeconds,
      p_add_tokens: addTokens,
      p_add_messages: addMessages
    });
    if (error) throw error;
  } catch (err) {
    console.error("Failed to update user usage:", err);
  }
}

/**
 * Mirror usage increments directly into profiles table so the Dashboard
 * always reflects up-to-date stats without requiring a re-login.
 */
export async function syncUsageToProfiles(userId: string, addSeconds: number = 0, addMessages: number = 0) {
  try {
    const { error } = await supabase.rpc('increment_profile_usage', {
      p_user_id: userId,
      p_add_seconds: addSeconds,
      p_add_messages: addMessages
    });
    if (error) throw error;
  } catch (err) {
    // Silently fail — this is a best-effort mirror, not critical
    console.warn("Failed to sync usage to profiles:", err);
  }
}

// Admin helper to get all usage
export async function getAllUserUsage(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('user_usage')
      .select('*, profiles(full_name, phone)');
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to fetch all user usage:", err);
    return [];
  }
}

export async function getUserUsageLogs(userId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('user_usage_events')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Failed to fetch usage logs:", err);
    return [];
  }
}

export async function getPlatformReports(): Promise<any[]> {
  try {
    const { data, error } = await supabase.rpc('get_platform_reports_v2');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Failed to fetch platform reports:", err);
    return [];
  }
}
