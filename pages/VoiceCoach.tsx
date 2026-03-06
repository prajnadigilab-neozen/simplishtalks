/** V 1.0 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { CoachMessage } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getChatHistory, saveChatMessage, clearUserChatHistory, deleteChatMessage, getUserUsage, updateUserUsage } from '../services/coachService';
import { textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM } from '../utils/audioUtils';
import { useGeminiLive, FeedbackData } from '../hooks/useGeminiLive';
import { useAudioHardware } from '../hooks/useAudioHardware';
import AudioVisualizer from '../components/AudioVisualizer';
import { supabase } from '../lib/supabase';

const VoiceCoach: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { session, dataSaverMode } = useAppStore();
  const userId = session?.id ?? null;

  // ── Chat History ──
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [playingTipId, setPlayingTipId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  // ── Streaming Transcription ──
  const [pendingUserText, setPendingUserText] = useState('');
  const [pendingCoachText, setPendingCoachText] = useState('');

  // ── Quota Management ──
  const [totalVoiceSeconds, setTotalVoiceSeconds] = useState(0);
  const sessionStartTimeRef = useRef<number | null>(null);
  const QUOTA_SECONDS = 180; // 3 minutes

  // ── Hooks ──
  const audio = useAudioHardware();

  const onAudioChunk = useCallback((base64: string) => {
    audio.playAudioChunk(base64);
  }, [audio]);

  const onTranscription = useCallback((type: 'input' | 'output', text: string) => {
    if (type === 'input') {
      setPendingUserText(prev => prev + text);
    } else {
      setPendingCoachText(prev => prev + text);
    }
  }, []);

  const onTurnComplete = useCallback(async (userText: string, coachText: string, feedback: FeedbackData) => {
    // Flush pending text
    setPendingUserText('');
    setPendingCoachText('');

    if (!userId) return;

    if (userText) {
      const userMsg: CoachMessage = { role: 'user', text: userText, timestamp: Date.now() };
      const dbId = await saveChatMessage(userId, userMsg, undefined, 'voice');
      if (dbId) userMsg.dbId = dbId;
      setMessages(prev => [...prev, userMsg]);
    }

    if (coachText) {
      const coachMsg: CoachMessage = {
        role: 'coach',
        text: coachText,
        correction: feedback.correction,
        kannadaGuide: feedback.kannadaGuide,
        pronunciationTip: feedback.pronunciationTip,
        timestamp: Date.now(),
      };
      const dbId = await saveChatMessage(userId, coachMsg, undefined, 'voice');
      if (dbId) coachMsg.dbId = dbId;
      setMessages(prev => [...prev, coachMsg]);
    }
  }, [userId]);

  const onInterrupted = useCallback(() => {
    audio.stopAllAudio();
  }, [audio]);

  const gemini = useGeminiLive({ onAudioChunk, onTranscription, onTurnComplete, onInterrupted });

  // ── Load History ──
  useEffect(() => {
    const loadData = async () => {
      setLoadingHistory(true);
      if (userId) {
        // Fetch history and usage in parallel
        const [history, usage] = await Promise.all([
          getChatHistory(userId, undefined, 'voice'),
          getUserUsage(userId)
        ]);
        setMessages(history);
        // We now rely on session.agentCredits instead of a fixed 180 quota.
        // But we still track local session duration.
      }
      setLoadingHistory(false);
    };
    loadData();

    return () => {
      gemini.disconnect();
      audio.stopMic();
      audio.stopAllAudio();
    };
  }, [userId]);

  // ── Auto-scroll ──
  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollTop = historyScrollRef.current.scrollHeight;
    }
  }, [messages, pendingUserText, pendingCoachText]);

  // ── Actions ──
  const handleStartSession = async () => {
    const currentCredits = session?.agentCredits || 0;
    if (session?.packageType === 'AI_MESHTRU' && currentCredits <= 0) {
      alert("You have run out of AI Meshtru credits. Please recharge."); // In a real app, show a nice modal
      return;
    }

    sessionStartTimeRef.current = Date.now();
    const userPrefs = session;
    const customFocus = userPrefs?.systemPromptFocus || "You are a patient English tutor for Kannada-speaking students. Always explain complex concepts in Kannada first.";
    const lastContext = messages.slice(-5).map(m => `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.text}`).join('\n');

    const baseInstruction = `
      Persona: You are "Namma Simplish Meshtru" (Our English Teacher), a patient and encouraging bilingual tutor for rural students in Karnataka.
      
      CRITICAL RULES:
      1. STRICT LANGUAGE BOUNDARY: NEVER INCLUDE ANY OTHER LANGUAGE APART FROM KANNADA AND ENGLISH. Strictly avoid Hindi, Telugu, or Tamil.
      2. MANDATORY TRANSLATION: For EVERY English sentence you speak or write, you MUST provide the Kannada translation in brackets (...) immediately following it.
      
      Core Mission: Help students speak English confidently by explaining concepts in Kannada first.
      
      Operational Rules:
      - Use "Kanglish" (Kannada + English) to bridge the gap.
      - Use rural examples (farming, local festivals, village markets).
      - Gently correct pronunciation and ask them to try again.
      - Celebrate wins with "Sakkath!" or "Thumbane olleyadu!".
      - If the user makes a mistake, call the 'provide_feedback' tool.
    `;

    const finalInstruction = lastContext
      ? `${baseInstruction}\n\nPrevious Conversation Context for Reference:\n${lastContext}`
      : baseInstruction;

    const voiceName = userPrefs?.voiceProfile || 'Aoede';

    await gemini.connect(finalInstruction, voiceName);
    await audio.startMic((pcmBytes) => gemini.sendPcmData(pcmBytes));
  };

  const handleEndSession = async () => {
    gemini.disconnect();
    audio.stopMic();
    audio.stopAllAudio();

    if (sessionStartTimeRef.current) {
      const elapsedSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
      if (elapsedSeconds > 0) {
        await updateUserUsage(userId!, elapsedSeconds, 0);

        // Convert elapsed seconds to minutes spent (rounding up for simple billing mock)
        const minutesSpent = Math.ceil(elapsedSeconds / 60);

        if (session?.packageType === 'AI_MESHTRU' && session.agentCredits !== undefined) {
          const newCredits = Math.max(0, session.agentCredits - minutesSpent);

          // Optimistically update local store
          useAppStore.setState({
            session: { ...session, agentCredits: newCredits }
          });

          // Sync to DB
          await supabase.from('profiles').update({ agent_credits: newCredits }).eq('id', userId);
        }
      }
      sessionStartTimeRef.current = null;
    }
  };

  const handleCancel = () => {
    handleEndSession();
    navigate('/dashboard');
  };

  const handleClearHistory = async () => {
    if (!userId) return;
    if (!clearConfirm) { setClearConfirm(true); return; }
    setClearConfirm(false);
    await clearUserChatHistory(userId, undefined, 'voice');
    setMessages([]);
  };

  const handleDeleteMessage = async (msg: CoachMessage) => {
    if (!msg.dbId) return;
    await deleteChatMessage(msg.dbId);
    setMessages(prev => prev.filter(m => m.dbId !== msg.dbId));
  };

  const handleSpeakTip = async (tip: string, id: string) => {
    if (playingTipId || getTTSQuotaStatus()) return;
    setPlayingTipId(id);
    try {
      const text = `Pronunciation tip: ${tip}`;
      const audioData = await textToSpeech(text, 'Aoede', dataSaverMode);
      if (audioData) await playPCM(audioData, text);
    } catch (e) {
      console.error(e);
    } finally {
      setPlayingTipId(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-blue-900 dark:bg-slate-950 text-white transition-colors overflow-hidden relative">

      {/* Top Navigation */}
      <div className="p-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <button onClick={handleCancel} className="flex items-center gap-2 p-2 text-white/70 hover:text-white transition-colors group">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
        </button>
        <div className="flex flex-col items-center">
          <span className="font-black text-xs uppercase tracking-[0.3em] font-serif">{t(TRANSLATIONS.liveTalk)}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${gemini.isConnected ? 'bg-green-400' : gemini.isReconnecting ? 'bg-yellow-400 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">
              {gemini.isConnected ? 'Live' : gemini.isReconnecting ? 'Reconnecting' : 'Offline'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearHistory}
            className={`p-2 rounded-xl transition-colors ${clearConfirm
              ? 'text-red-400 bg-red-500/20 ring-1 ring-red-400 animate-pulse'
              : 'text-white/40 hover:text-red-400 hover:bg-red-500/10'
              }`}
            title="Clear History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Experience */}
      <div className="flex-1 flex flex-col items-center overflow-hidden">
        {/* History Area */}
        <div
          ref={historyScrollRef}
          className="w-full flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar-hidden bg-black/10 shadow-inner"
        >
          {loadingHistory && (
            <div className="flex flex-col items-center py-20 opacity-30">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mb-4"></div>
              <p className="font-black text-[10px] uppercase tracking-widest">Loading History...</p>
            </div>
          )}
          {!loadingHistory && messages.length === 0 && !pendingUserText && !pendingCoachText && (
            <p className="text-center py-20 text-white/20 font-black uppercase text-[10px] tracking-widest">Session history will appear here</p>
          )}
          {!loadingHistory && messages.map((m, idx) => (
            <div key={m.dbId || idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 group/msg`}>
              <div className={`relative max-w-[85%] p-4 rounded-3xl shadow-sm ${m.role === 'user'
                ? 'bg-blue-600/30 border border-blue-400/20 text-white rounded-tr-none'
                : 'bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-tl-none'
                }`}>
                <div className="flex justify-between items-start gap-4">
                  <p className="font-bold text-sm leading-relaxed flex-1">{m.text}</p>
                  {m.dbId && (
                    <button
                      onClick={() => handleDeleteMessage(m)}
                      className="opacity-100 md:opacity-0 group-hover/msg:opacity-100 p-1.5 text-red-400/60 hover:text-red-500 transition-all rounded-lg"
                      title="Delete message"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.34 6.65m-2.86 0L11.26 9m4.105-3.04a.5.5 0 0 1 .124-.128A48.543 48.543 0 0 0 16.5 4.5h-9a48.543 48.543 0 0 0-1.011 1.432.5.5 0 0 1-.124.128M15.5 12.5a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-2.5a.5.5 0 0 1 .5-.5h7Z" />
                      </svg>
                    </button>
                  )}
                </div>

                {m.role === 'coach' && (m.correction || m.kannadaGuide || m.pronunciationTip) && (
                  <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
                    {m.correction && (
                      <p className="text-[11px] font-bold text-amber-400 italic">Correction: {m.correction}</p>
                    )}
                    {m.kannadaGuide && (
                      <div className="bg-white/5 p-3 rounded-2xl">
                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-tighter mb-1">
                          {t({ en: 'ಸಹಾಯ (Help)', kn: 'ಸಹಾಯ (Help)' })}
                        </p>
                        <p className="text-[11px] font-medium text-blue-300 whitespace-pre-line leading-relaxed">
                          {m.kannadaGuide}
                        </p>
                      </div>
                    )}
                    {m.pronunciationTip && (
                      <div className="flex justify-between items-center gap-2 bg-white/5 p-2 rounded-xl">
                        <p className="text-[10px] text-green-400 font-black flex-1">Tip: {m.pronunciationTip}</p>
                        <button
                          onClick={() => handleSpeakTip(m.pronunciationTip!, `tip-${idx}`)}
                          className={`p-1.5 rounded-lg transition-all ${playingTipId === `tip-${idx}` ? 'bg-green-600 animate-pulse' : 'bg-white/10 text-white/60 hover:text-white'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Streaming ghost bubbles */}
          {pendingUserText && (
            <div className="flex flex-col items-end animate-in slide-in-from-bottom-2">
              <div className="relative max-w-[85%] p-4 rounded-3xl shadow-sm bg-blue-600/20 border border-blue-400/10 text-white/70 rounded-tr-none">
                <p className="font-bold text-sm leading-relaxed italic">{pendingUserText}<span className="animate-pulse">▊</span></p>
              </div>
            </div>
          )}
          {pendingCoachText && (
            <div className="flex flex-col items-start animate-in slide-in-from-bottom-2">
              <div className="relative max-w-[85%] p-4 rounded-3xl shadow-sm bg-white/5 backdrop-blur-md border border-white/5 text-white/70 rounded-tl-none">
                <p className="font-bold text-sm leading-relaxed italic">{pendingCoachText}<span className="animate-pulse">▊</span></p>
              </div>
            </div>
          )}
        </div>

        {/* Visualizer + Controls */}
        <div className="w-full flex flex-col items-center justify-center p-8 space-y-8 relative shrink-0">
          <AudioVisualizer
            analyser={audio.analyserNode}
            isConnected={gemini.isConnected}
            isAiTalking={audio.isAiTalking}
          />

          <div className="text-center max-w-md w-full">
            {!gemini.isConnected && !gemini.isConnecting && !gemini.isReconnecting && (
              <div className="animate-in fade-in zoom-in">
                <h2 className="text-3xl font-black mb-4">{t({ en: 'Speak with Kore', kn: 'ಕೋರ್ ಜೊತೆ ಮಾತನಾಡಿ' })}</h2>
                <p className="text-white/60 font-bold mb-8 leading-relaxed text-sm">
                  {t({
                    en: 'Step into a private session. Practice naturally and improve your fluency instantly.',
                    kn: 'ಖಾಸಗಿ ಸಂಭಾಷಣೆ ನಡೆಸಿ. ಸಹಜವಾಗಿ ಮಾತನಾಡಿ ಮತ್ತು ನಿಮ್ಮ ಇಂಗ್ಲಿಷ್ ಅನ್ನು ಸುಧಾರಿಸಿ.'
                  })}
                </p>
                <button
                  onClick={handleStartSession}
                  className="w-full bg-orange-500 text-white py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-2xl hover:bg-orange-600 active:scale-95 transition-all border-b-8 border-orange-700"
                >
                  {t(TRANSLATIONS.startLearning)}
                </button>
                {session?.packageType === 'AI_MESHTRU' && (
                  <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-orange-400">
                    {session.agentCredits > 0 ? `${session.agentCredits} Minutes Available` : '0 Minutes - Please Recharge'}
                  </p>
                )}
              </div>
            )}

            {gemini.isConnecting && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                <p className="font-black text-sm uppercase tracking-widest text-white/70 animate-pulse">{t(TRANSLATIONS.connecting)}</p>
              </div>
            )}

            {gemini.isReconnecting && (
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin"></div>
                <p className="font-black text-sm uppercase tracking-widest text-yellow-400/70 animate-pulse">
                  {t({ en: 'Reconnecting...', kn: 'ಮರುಸಂಪರ್ಕಿಸುತ್ತಿದೆ...' })}
                </p>
              </div>
            )}

            {gemini.isConnected && (
              <div className="flex items-center justify-center gap-8">
                <button
                  onClick={handleEndSession}
                  className="bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/30 hover:bg-red-600 active:scale-95 transition-all"
                >
                  {t(TRANSLATIONS.stopTalk)}
                </button>
              </div>
            )}

            {gemini.error && (
              <div className="mt-8 p-4 bg-red-500/20 border border-red-500 rounded-2xl text-red-200 text-sm font-bold animate-shake">
                {gemini.error}
                <button onClick={gemini.clearError} className="block mx-auto mt-2 underline opacity-50">Dismiss</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20 overflow-hidden -z-10">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-500 rounded-full blur-[120px]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-amber-500 rounded-full blur-[120px]"></div>
      </div>
    </div>
  );
};

export default VoiceCoach;
