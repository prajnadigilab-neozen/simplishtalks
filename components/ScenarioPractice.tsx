
import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from './LanguageContext';
import { textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM, AudioStore } from '../utils/audioUtils';
import { Language, CoachMessage } from '../types';
import { getChatHistory, saveChatMessage, clearUserChatHistory } from '../services/coachService';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';

interface ScenarioPracticeProps {
  scenario: {
    character: Record<Language, string>;
    objective: Record<Language, string>;
    systemInstruction: string;
    initialMessage: string;
  };
}

const ScenarioPractice: React.FC<ScenarioPracticeProps> = ({ scenario }) => {
  const { id: lessonId } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const { session } = useAppStore();
  const userId = session?.id ?? null;
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const loadHistory = async () => {
      const history = await getChatHistory(userId, lessonId);
      if (history.length > 0) {
        setMessages(history);
      } else {
        const initialMsg: CoachMessage = {
          role: 'coach',
          text: scenario.initialMessage,
          timestamp: Date.now()
        };
        setMessages([initialMsg]);
        saveChatMessage(userId, initialMsg, lessonId);
      }
      setLoading(false);
    };
    loadHistory();
  }, [userId, lessonId, scenario.initialMessage]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (isSendingRef.current || !input.trim() || isTyping || !userId) return;
    isSendingRef.current = true;

    const userMsg: CoachMessage = { role: 'user', text: input, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    saveChatMessage(userId, userMsg, lessonId);

    try {
      const historyForAI = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.text }]
      }));

      const { data, error } = await supabase.functions.invoke('scenario-chat', {
        body: {
          message: input,
          history: historyForAI,
          systemInstruction: scenario.systemInstruction,
        },
      });

      if (error) {
        console.error("Scenario Edge Function Error:", error);
        let errorMsg = 'AI is unavailable right now.';
        try {
          if ((error as any).context) {
            const body = await (error as any).context.json();
            errorMsg = body?.error || body?.reply || errorMsg;
          }
        } catch {
          errorMsg = error.message || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const result = typeof data === 'string' ? JSON.parse(data) : data;
      const coachMsg: CoachMessage = {
        role: 'coach',
        text: result.reply,
        kannadaGuide: result.kannadaHelp,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, coachMsg]);
      saveChatMessage(userId, coachMsg, lessonId);
    } catch (error: any) {
      console.error("Scenario AI Error:", error);
      const errorMsg: CoachMessage = {
        role: 'coach',
        text: error.message || "I'm having trouble connecting. Please check your internet or try logging in again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
      isSendingRef.current = false;
    }
  };

  const handleSpeak = async (text: string, id: string) => {
    if (playingId || getTTSQuotaStatus()) return;
    setPlayingId(id);
    try {
      const audio = await textToSpeech(text);
      if (audio) await playPCM(audio, text);
    } catch (e) {
      console.error(e);
    } finally {
      setPlayingId(null);
    }
  };

  const handleReset = async () => {
    if (!userId) return;
    if (!resetConfirm) { setResetConfirm(true); return; }
    setResetConfirm(false);
    await clearUserChatHistory(userId, lessonId);
    const initialMsg: CoachMessage = {
      role: 'coach',
      text: scenario.initialMessage,
      timestamp: Date.now()
    };
    setMessages([initialMsg]);
    saveChatMessage(userId, initialMsg, lessonId);
  };

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-inner">
      {/* Scenario Header */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-xl">🎭</div>
          <div>
            <h4 className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">{t(scenario.character)}</h4>
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">
              {t(scenario.objective)}
            </p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className={`p-2 transition-colors rounded-full ${resetConfirm
            ? 'text-orange-500 bg-orange-100 dark:bg-orange-900/20 ring-2 ring-orange-400 animate-pulse'
            : 'text-slate-300 hover:text-orange-500'
            }`}
          title={resetConfirm ? t({ en: "Tap again to confirm", kn: "ಖಚಿತಪಡಿಸಲು ಮತ್ತೆ ಒತ್ತಿ" }) : "Reset scenario"}
          onBlur={() => setResetConfirm(false)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20 opacity-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
        ) : (
          messages.map((m, idx) => (
            <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
              <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${m.role === 'user'
                ? 'bg-blue-600 text-white rounded-tr-none'
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700'
                }`}>
                <div className="flex justify-between items-start gap-4">
                  <p className="font-bold text-sm leading-relaxed">{m.text}</p>
                  {m.role === 'coach' && (
                    <button
                      onClick={() => handleSpeak(m.text, `msg-${idx}`)}
                      className={`p-1.5 rounded-lg transition-all ${playingId === `msg-${idx}` ? 'bg-blue-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
                      </svg>
                    </button>
                  )}
                </div>
                {m.kannadaGuide && (
                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] text-blue-500 font-black uppercase tracking-tighter mb-1">
                      {t({ en: 'ಸಹಾಯ (Help)', kn: 'ಸಹಾಯ (Help)' })}
                    </p>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                      {m.kannadaGuide}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isTyping && (
          <div className="flex gap-1 p-2">
            <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"></div>
            <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex gap-2">
        <input
          type="text"
          className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl outline-none font-bold text-sm text-blue-900 dark:text-blue-100 border-2 border-transparent focus:border-blue-500 transition-all"
          placeholder={t({ en: 'Type your reply...', kn: 'ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಬರೆಯಿರಿ...' })}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isTyping}
          className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ScenarioPractice;
