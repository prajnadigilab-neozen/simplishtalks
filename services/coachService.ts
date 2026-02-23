
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
    console.error("Coach API Error:", error);
    return {
      replyEn: "I'm sorry, I'm having trouble connecting to my brain right now. Please try again in a moment.",
      kannadaGuide: "ಕ್ಷಮಿಸಿ, ಸಂಪರ್ಕಿಸಲು ತೊಂದರೆಯಾಗುತ್ತಿದೆ. (Kshamisi, samparkisalu tondareyaguttide.)\nSorry, there is trouble connecting.",
    };
  }
}

export async function saveChatMessage(userId: string, msg: Partial<CoachMessage>, lessonId?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('chat_history').insert({
      user_id: userId,
      lesson_id: lessonId || null,
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
export async function getChatHistory(userId: string, lessonId?: string): Promise<CoachMessage[]> {
  try {
    let query = supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .eq('is_hidden_from_user', false);

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

export async function clearUserChatHistory(userId: string, lessonId?: string) {
  try {
    let query = supabase
      .from('chat_history')
      .update({ is_hidden_from_user: true })
      .eq('user_id', userId);

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
      .select('*, profiles(full_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } catch (err) {
    return [];
  }
}
