
import { supabase } from "../lib/supabase";
import { CoachMessage } from "../types";

/**
 * Chat with the AI coach via Supabase Edge Function.
 * The API key lives server-side — never in the browser bundle.
 */
export async function chatWithCoach(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
  try {
    const { data, error } = await supabase.functions.invoke('coach-chat', {
      body: { message, history },
    });

    if (error) throw error;

    // Edge function returns JSON string or parsed object
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (error: any) {
    console.error("Coach API Error Details:", error);
    if (error.context) {
      // Supabase FunctionsHttpError often hides the body in context
      try {
        const body = await error.context.json();
        console.error("Coach API Error Body:", body);
        if (body.replyEn) return body;
      } catch (e) { /* ignore */ }
    }
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
      pronunciation_tip: msg.pronunciationTip
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
      .single();

    return {
      voice_seconds_total: data.voice_seconds_total || 0,
      chat_tokens_total: data.chat_tokens_total || 0,
      chat_messages_total: data.chat_messages_total || 0
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
    const { data, error } = await supabase.rpc('get_platform_reports');
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Failed to fetch platform reports:", err);
    return [];
  }
}
