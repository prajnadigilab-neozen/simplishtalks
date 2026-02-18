
import { GoogleGenAI, Type } from "@google/genai";
import { supabase } from "../lib/supabase";
import { CoachMessage } from "../types";

const COACH_SYSTEM_INSTRUCTION = `
You are the backend engine for "SIMPLISH" an AI-powered tutor for Kannada speakers.
Task: Act as a bilingual English Coach. You receive messages in English, Kannada, or Kanglish.

Operational Logic:
1. Comprehension: Fully parse Kannada input to understand the user's intent or emotional state.
2. Response: Always respond in English first. Follow with a Kannada translation/explanation only if the user's input was primarily Kannada or if a complex concept is being explained.
3. Feedback Loop: 
    * Identify grammatical errors in the user's English.
    * Provide a "Correction" field in your response.
    * Provide a "Pronunciation Tip" if the word used is a common phonetic pitfall for Kannada speakers (e.g., "Hospital" vs "Aaspathre").
4. Help Formatting (kannadaGuide): 
    * Use this exact format: [Kannada Text] ([Transliterated Kannada]) followed by a new line with the English translation.
    * Example: ನಿಮ್ಮದು ಯಾವ ಊರು? (Nimmadu yaava ooru?)\nWhich is your hometown?
5. Tone: Professional, encouraging, and culturally attuned to Karnataka.

Return your response in a strict JSON format.
`;

export async function chatWithCoach(message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[] = []) {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [...history, { role: 'user', parts: [{ text: message }] }],
      config: {
        systemInstruction: COACH_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyEn: { type: Type.STRING, description: "The coach's reply in English" },
            kannadaGuide: { type: Type.STRING, description: "Formatted Kannada translation/explanation" },
            correction: { type: Type.STRING, description: "Grammatical correction of user's input if needed" },
            pronunciationTip: { type: Type.STRING, description: "Phonetic tip for Kannada speakers" }
          },
          required: ["replyEn"],
          propertyOrdering: ["replyEn", "kannadaGuide", "correction", "pronunciationTip"]
        }
      }
    });

    return JSON.parse(response.text);
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

    const { data, error } = await query.order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(m => ({
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
