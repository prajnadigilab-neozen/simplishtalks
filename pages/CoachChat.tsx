/** V 1.0 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { chatWithCoach, saveChatMessage, getChatHistory, clearUserChatHistory, deleteChatMessage, getUserUsage, updateUserUsage, syncUsageToProfiles } from '../services/coachService';
import { textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM, AudioStore } from '../utils/audioUtils';
import { CoachMessage } from '../types';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';

const CoachChat: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { session, dataSaverMode, syncUsage } = useAppStore();
  const userId = session?.id ?? null;
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [quotaReached, setQuotaReached] = useState(getTTSQuotaStatus());
  const [historyLoading, setHistoryLoading] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [totalChatMessages, setTotalChatMessages] = useState(0);
  const CHAT_QUOTA = 50;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSendingRef = useRef(false);

  useEffect(() => {
    const handleQuota = () => setQuotaReached(true);
    window.addEventListener('simplish-quota-exhausted', handleQuota);

    // Initialize data from store and fetch history
    const loadData = async () => {
      if (!userId) { setHistoryLoading(false); return; }
      setHistoryLoading(true);
      const [history, usage] = await Promise.all([
        getChatHistory(userId, undefined, 'chat'),
        getUserUsage(userId)
      ]);
      setMessages(history);
      setTotalChatMessages(usage.chat_messages_total || 0);
      setHistoryLoading(false);
    };
    loadData();

    return () => window.removeEventListener('simplish-quota-exhausted', handleQuota);
  }, [userId]); // re-run when userId becomes available

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const [streamingText, setStreamingText] = useState('');

  const handleSend = async () => {
    if (totalChatMessages >= CHAT_QUOTA) return;
    if (isSendingRef.current || !input.trim() || isTyping || !userId) return;
    isSendingRef.current = true;

    const userMsg: CoachMessage = {
      role: 'user',
      text: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);
    setStreamingText('');

    // Save user message to DB
    const dbId = await saveChatMessage(userId, userMsg, undefined, 'chat');
    setMessages(prev => prev.map(m => m.timestamp === userMsg.timestamp ? { ...m, dbId: dbId || undefined } : m));

    // Update usage and sync UI
    updateUserUsage(userId, 0, 0, 1);
    syncUsageToProfiles(userId, 0, 1); // Mirror to profiles for Dashboard display
    syncUsage('chat', 1);

    // Compression and Fast-Track handled in coachService
    const historyForAI = messages.slice(-10).map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{
        text: m.role === 'coach' && m.correction
          ? `${m.text} [Correction: ${m.correction}]`
          : m.text
      }]
    }));

    try {
      // 1. Invoke function
      const { data, error } = await supabase.functions.invoke('coach-chat', {
        body: { message: input, history: historyForAI },
      });

      if (error) throw error;

      // 2. Handle Streaming or Fast-Track
      if (data && data.isFastTrack) {
        // Handle immediate Fast-Track response
        const coachMsg: CoachMessage = {
          role: 'coach',
          text: data.replyEn,
          kannadaGuide: data.kannadaGuide,
          correction: data.correction,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, coachMsg]);
        setIsTyping(false);
      } else if (data instanceof ReadableStream) {
        // Handle Streaming
        const reader = data.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullContent += chunk;
          setStreamingText(fullContent);
        }

        // Cleanup and parse final metadata
        setIsTyping(false);
        setStreamingText('');
        isSendingRef.current = false;

        try {
          const result = JSON.parse(fullContent);
          const coachMsg: CoachMessage = {
            role: 'coach',
            text: result.replyEn,
            kannadaGuide: result.kannadaGuide,
            correction: result.correction,
            pronunciationTip: result.pronunciationTip,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, coachMsg]);

          // Final save and prefetch
          const coachDbId = await saveChatMessage(userId, coachMsg, undefined, 'chat');
          setMessages(prev => prev.map(m => m.timestamp === coachMsg.timestamp ? { ...m, dbId: coachDbId || undefined } : m));
          if (!getTTSQuotaStatus()) prefetchAudio(coachMsg, messages.length + 1);
        } catch (e) {
          console.error("Failed to parse final JSON", e);
        }
      } else {
        // Fallback for non-streaming or parsed response
        const coachMsg: CoachMessage = {
          role: 'coach',
          text: data.replyEn,
          kannadaGuide: data.kannadaGuide,
          correction: data.correction,
          pronunciationTip: data.pronunciationTip,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, coachMsg]);
        setIsTyping(false);
      }
    } catch (err) {
      console.error("Coach Interaction Error:", err);
      setIsTyping(false);
    }

    isSendingRef.current = false;
    await updateUserUsage(userId, 0, 0, 1);
    setTotalChatMessages(prev => prev + 1);
  };

  // Inline confirm instead of window.confirm()
  const handleClearHistory = async () => {
    if (!userId) return;
    if (!clearConfirm) { setClearConfirm(true); return; }
    setMessages([]);
  };

  const handleDownloadHistory = () => {
    if (messages.length === 0) return;
    const headers = ['Role', 'Text', 'Correction', 'Kannada Guide', 'Timestamp'];
    const csvContent = [
      headers.join(','),
      ...messages.map(m => [
        m.role,
        `"${m.text.replace(/"/g, '""')}"`,
        `"${(m.correction || '').replace(/"/g, '""')}"`,
        `"${(m.kannadaGuide || '').replace(/"/g, '""')}"`,
        new Date(m.timestamp).toLocaleString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `simplish_chat_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteMessage = async (msg: CoachMessage) => {
    if (!msg.dbId) return;
    await deleteChatMessage(msg.dbId);
    setMessages(prev => prev.filter(m => m.dbId !== msg.dbId));
  };

  const prefetchAudio = async (msg: CoachMessage, index: number) => {
    if (getTTSQuotaStatus()) return;

    if (msg.text) {
      textToSpeech(msg.text, 'Aoede', dataSaverMode).then(audio => {
        if (audio) {
          setMessages(prev => {
            const updated = [...prev];
            if (updated[index]) updated[index].audioEn = audio;
            return updated;
          });
        }
      });
    }

    if (msg.pronunciationTip) {
      textToSpeech(`Pronunciation tip: ${msg.pronunciationTip}`, 'Aoede', dataSaverMode).then(audio => {
        if (audio) {
          setMessages(prev => {
            const updated = [...prev];
            if (updated[index]) updated[index].audioTip = audio;
            return updated;
          });
        }
      });
    }
  };

  const handleSpeak = async (msg: CoachMessage, type: 'en' | 'tip', uniqueId: string) => {
    if (playingId !== null) return;

    const cachedAudio = type === 'en' ? msg.audioEn : msg.audioTip;
    const textToConvert = type === 'en' ? msg.text : `Pronunciation tip: ${msg.pronunciationTip}`;

    const isCached = !!cachedAudio || AudioStore.has(textToConvert);

    if (quotaReached && !isCached) return;

    setPlayingId(uniqueId);
    setFetchingId(uniqueId);

    try {
      if (cachedAudio) {
        setFetchingId(null);
        await playPCM(cachedAudio, textToConvert);
      } else {
        const audio = await textToSpeech(textToConvert, 'Aoede', dataSaverMode);
        setFetchingId(null);
        if (audio) await playPCM(audio, textToConvert);
      }
    } catch (e) {
      console.error("Playback failed", e);
      setFetchingId(null);
    } finally {
      setPlayingId(null);
    }
  };

  return (
    <div className="h-[100dvh] bg-slate-50 dark:bg-slate-950 transition-colors flex flex-col overflow-hidden overscroll-none">
      {/* Desktop Max-Width Container */}
      <div className="flex-1 flex flex-col w-full max-w-[1200px] mx-auto bg-white dark:bg-slate-900 shadow-2xl relative overflow-hidden">

        {/* Header - Fixed Height */}
        <header className="h-16 shrink-0 border-b border-blue-100 dark:border-slate-800 flex items-center justify-between px-4 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 p-2 text-blue-900 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{t({ en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' })}</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-blue-900 dark:text-slate-100 text-sm uppercase tracking-widest">{t({ en: 'Simplish Coach', kn: 'ಸಿಂಪ್ಲಿಷ್ ಕೋಚ್' })}</h2>
                <div className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded-full border border-blue-200 dark:border-blue-800">
                  <span className="text-[10px] font-black text-blue-700 dark:text-blue-400 tabular-nums">
                    {totalChatMessages}/{CHAT_QUOTA}
                  </span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-tighter">{t({ en: 'Bilingual Training', kn: 'ದ್ವಿಭಾಷಾ ತರಬೇತಿ' })}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDownloadHistory}
              className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-full transition-all"
              title="Download History (CSV)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </button>
            <button
              onClick={handleClearHistory}
              className={`p-2 transition-all rounded-full ${clearConfirm
                ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400 ring-2 ring-red-400 animate-pulse'
                : 'text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10'
                }`}
              title={clearConfirm
                ? t({ en: "Tap again to confirm", kn: "ಖಚಿತಪಡಿಸಲು ಮತ್ತೆ ಒತ್ತಿ" })
                : t({ en: "Clear All History", kn: "ಹಿಸ್ಟರಿ ಅಳಿಸಿ" })}
              onBlur={() => setClearConfirm(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 6.65m-2.86 0L11.26 9m4.105-3.04a.5.5 0 0 1 .124-.128A48.543 48.543 0 0 0 16.5 4.5h-9a48.543 48.543 0 0 0-1.011 1.432.5.5 0 0 1-.124.128M15.5 12.5a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-2.5a.5.5 0 0 1 .5-.5h7Z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Chat Scroll Area - Flex Grow */}
        <main
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth scroll-pb-20 overscroll-contain"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#3b82f644 transparent'
          }}
        >
          {historyLoading && (
            <div className="flex flex-col items-center py-10 opacity-40">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
              <span className="text-[10px] font-black uppercase tracking-widest">{t({ en: 'Loading History...', kn: 'ಇತಿಹಾಸ ಲೋಡ್ ಆಗುತ್ತಿದೆ...' })}</span>
            </div>
          )}

          {!historyLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-30 px-10">
              <span className="text-5xl mb-4">💬</span>
              <p className="text-sm font-bold uppercase tracking-widest leading-relaxed">
                {t({ en: "Start your first conversation with the Simplish Coach!", kn: "ಸಿಂಪ್ಲಿಷ್ ಕೋಚ್ ಜೊತೆ ನಿಮ್ಮ ಮೊದಲ ಮಾತುಕತೆಯನ್ನು ಪ್ರಾರಂಭಿಸಿ!" })}
              </p>
            </div>
          )}

          {messages.map((m, idx) => (
            <div
              key={m.dbId || m.timestamp + idx}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300 group/msg`}
            >
              <div className={`relative max-w-[85%] rounded-3xl p-4 shadow-sm ${m.role === 'user'
                ? 'bg-blue-800 text-white rounded-tr-none'
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                }`}>
                <div className="flex justify-between items-start gap-4">
                  <p className="font-bold leading-relaxed flex-1 whitespace-pre-wrap">{m.text}</p>
                  <div className="flex flex-col gap-2">
                    {m.role === 'coach' && (
                      <button
                        onClick={() => handleSpeak(m, 'en', `${idx}-main`)}
                        disabled={quotaReached && !m.audioEn && !AudioStore.has(m.text)}
                        className={`shrink-0 p-2 rounded-xl transition-all 
                          ${(quotaReached && !m.audioEn && !AudioStore.has(m.text)) ? 'opacity-20 cursor-not-allowed grayscale' : 'bg-blue-50 dark:bg-slate-900 text-blue-600 dark:text-blue-400 hover:scale-110 active:scale-95'}
                          ${playingId === `${idx}-main` ? 'bg-blue-600 text-white animate-pulse shadow-inner' : fetchingId === `${idx}-main` ? 'bg-blue-100 text-blue-600' : ''}`}
                      >
                        {fetchingId === `${idx}-main` ? (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
                          </svg>
                        )}
                      </button>
                    )}
                    {m.role === 'user' && m.dbId && (
                      <button
                        onClick={() => handleDeleteMessage(m)}
                        className="opacity-100 md:opacity-0 group-hover/msg:opacity-100 p-2 text-red-300 hover:text-red-500 transition-all rounded-lg"
                        title="Delete message"
                      >
                        <IcoBin />
                      </button>
                    )}
                  </div>
                </div>

                {m.role === 'coach' && (m.kannadaGuide || m.correction || m.pronunciationTip) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                    {m.kannadaGuide && (
                      <div className="bg-blue-50 dark:bg-slate-900 p-3 rounded-2xl">
                        <p className="text-xs font-bold text-blue-800 dark:text-blue-400 mb-1 uppercase tracking-tighter">
                          {t({ en: 'ಸಹಾಯ (Help)', kn: 'ಸಹಾಯ (Help)' })}
                        </p>
                        <p className="text-sm text-blue-900 dark:text-blue-200 whitespace-pre-line">{m.kannadaGuide}</p>
                      </div>
                    )}
                    {m.correction && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-2xl border border-amber-100/50 dark:border-amber-900/50">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1 uppercase tracking-tighter">{t({ en: 'Correction', kn: 'ತಿದ್ದುಪಡಿ' })}</p>
                        <p className="text-sm text-amber-900 dark:text-amber-200 italic">{m.correction}</p>
                      </div>
                    )}
                    {m.pronunciationTip && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-2xl border border-green-100/50 dark:border-green-900/50 flex justify-between items-start gap-2">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-1 uppercase tracking-tighter">{t({ en: 'Pronunciation Tip 🎙️', kn: 'ಉಚ್ಚಾರಣಾ ಸಲಹೆ 🎙️' })}</p>
                          <p className="text-sm text-green-900 dark:text-green-200">{m.pronunciationTip}</p>
                        </div>
                        <button
                          onClick={() => handleSpeak(m, 'tip', `${idx}-tip`)}
                          className={`shrink-0 p-2 rounded-lg transition-all bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-400`}
                        >
                          <IcoVol />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1 px-2">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {isTyping && !streamingText && (
            <div className="flex items-start gap-2 animate-pulse">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-100 dark:border-slate-700">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-[bounce_0.6s_infinite]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-[bounce_0.8s_infinite]"></div>
                  <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-[bounce_0.7s_infinite]"></div>
                </div>
              </div>
            </div>
          )}

          {streamingText && (
            <div className="flex items-start gap-2 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl rounded-tl-none border border-blue-100 dark:border-slate-700 shadow-sm max-w-[85%]">
                <p className="font-bold leading-relaxed text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
                  {streamingText}
                  <span className="w-1.5 h-4 bg-blue-500 inline-block ml-1 animate-pulse" />
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Input Bar - Fixed Height */}
        <footer className="h-20 shrink-0 bg-white dark:bg-slate-900 border-t border-blue-100 dark:border-slate-800 flex items-center px-4 z-20">
          <div className="flex gap-2 w-full max-w-4xl mx-auto items-center">
            <input
              type="text"
              placeholder={t({ en: 'Type in English or ಕನ್ನಡ...', kn: 'ಇಂಗ್ಲಿಷ್ ಅಥವಾ ಕನ್ನಡದಲ್ಲಿ ಬರೆಯಿರಿ...' })}
              className="flex-1 bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-blue-600 dark:focus:border-blue-400 h-14 px-5 rounded-2xl outline-none font-bold text-blue-900 dark:text-slate-100 transition-all text-sm"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="w-14 h-14 bg-orange-500 text-white rounded-2xl flex items-center justify-center shadow-lg hover:bg-orange-600 active:scale-95 disabled:opacity-50 transition-all shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </footer>
      </div>

      {/* Global CSS for thin scrollbars and bounce prevention */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.4); }
        body { overflow: hidden; position: fixed; width: 100%; height: 100%; }
      `}</style>
    </div>
  );
};

const IcoBin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 6.65m-2.86 0L11.26 9m4.105-3.04a.5.5 0 0 1 .124-.128A48.543 48.543 0 0 0 16.5 4.5h-9a48.543 48.543 0 0 0-1.011 1.432.5.5 0 0 1-.124.128M15.5 12.5a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-2.5a.5.5 0 0 1 .5-.5h7Z" />
  </svg>
);

const IcoVol = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
  </svg>
);

export default CoachChat;
