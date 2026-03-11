/** V 1.0 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { CoachMessage, PackageType } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getChatHistory, saveChatMessage, deleteChatMessage, updateUserUsage, syncUsageToProfiles } from '../services/coachService';
import { textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM } from '../utils/audioUtils';
import { useGeminiLive, FeedbackData } from '../hooks/useGeminiLive';
import { useAudioHardware } from '../hooks/useAudioHardware';
import { supabase } from '../lib/supabase';
import { getAiInstructions } from '../services/aiInstructionsService';
import { getSystemConfig, SystemConfig } from '../services/systemConfigService';

/* ─── Inline SVG Icons (zero bundle cost) ──────────────────────────────────── */
const IcoBack = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>;
const IcoDown = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>;
const IcoBin = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>;
const IcoVol = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" /></svg>;
const Spin = ({ c = 'border-white' }: { c?: string }) => <div className={`w-5 h-5 border-2 ${c} border-t-transparent rounded-full animate-spin`} />;

/* ─── Component ────────────────────────────────────────────────────────────── */
const VoiceCoach: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { session, dataSaverMode, syncUsage } = useAppStore();
  const userId = session?.id ?? null;

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [playingTipId, setPlayingTipId] = useState<string | null>(null);
  const [fetchingTipId, setFetchingTipId] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [pendingUserText, setPendingUserText] = useState('');
  const [pendingCoachText, setPendingCoachText] = useState('');
  const [sessionError, setSessionError] = useState<{ type: 'TECHNICAL' | 'IDLE' | 'NONE', msg: string }>({ type: 'NONE', msg: '' });
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number | null>(null);
  const responseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audio = useAudioHardware();
  const resetIdleTimerRef = useRef<() => void>(() => {});

  /* Gemini callbacks */
  const onAudioChunk = useCallback((b: string) => audio.playAudioChunk(b), [audio]);
  const onTranscription = useCallback((mode: 'input' | 'output', txt: string) => {
    resetIdleTimerRef.current();
    if (mode === 'input') {
      setPendingUserText(p => p + txt);
      // Reset response timeout on every user speaking chunk
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = setTimeout(() => {
        setSessionError({ 
          type: 'TECHNICAL', 
          msg: t({ en: 'Technical issue: No response from coach. Please restart.', kn: 'ತಾಂತ್ರಿಕ ತೊಂದರೆ: ಕೋಚ್‌ರಿಂದ ಯಾವುದೇ ಪ್ರತಿಕ್ರಿಯೆ ಇಲ್ಲ. ದಯವಿಟ್ಟು ಮರುಪ್ರಾರಂಭಿಸಿ.' }) 
        });
      }, 30000); 
    } else {
      setPendingCoachText(p => p + txt);
      // Clear timeout as soon as coach starts responding
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
    }
  }, [t]); // resetIdleTimerRef is stable, and resetIdleTimer value is accessed via ref.current

  const onTurnComplete = useCallback(async (uTxt: string, cTxt: string, fb: FeedbackData) => {
    setPendingUserText(''); setPendingCoachText('');
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    if (!userId) return;
    if (uTxt) { const m: CoachMessage = { role: 'user', text: uTxt, timestamp: Date.now() }; const id = await saveChatMessage(userId, m, undefined, 'voice'); if (id) m.dbId = id; setMessages(p => [...p, m]); }
    if (cTxt) { const m: CoachMessage = { role: 'coach', text: cTxt, correction: fb.correction, kannadaGuide: fb.kannadaGuide, pronunciationTip: fb.pronunciationTip, timestamp: Date.now() }; const id = await saveChatMessage(userId, m, undefined, 'voice'); if (id) m.dbId = id; setMessages(p => [...p, m]); }
  }, [userId]);

  const onInterrupted = useCallback(() => {
    resetIdleTimerRef.current();
    audio.stopAllAudio();
  }, [audio]);

  const gemini = useGeminiLive({ onAudioChunk, onTranscription, onTurnComplete, onInterrupted });

  /* Actions */
  const handleStop = useCallback(async () => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
    responseTimeoutRef.current = null;
    
    gemini.disconnect(); audio.stopMic(); audio.stopAllAudio();
    if (startRef.current && userId) {
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      if (s > 0) {
        await updateUserUsage(userId, s, 0); syncUsageToProfiles(userId, s, 0); syncUsage('voice', s);
        
        // Dynamic Allotment Logic
        if (session) {
          const totalAfter = (session.totalTalkTime || 0) + s;
          const freeLimit = sysConfig?.universal_free_seconds ?? 180;
          
          let billableSeconds = 0;
          if ((session.totalTalkTime || 0) >= freeLimit) {
            billableSeconds = s;
          } else if (totalAfter > freeLimit) {
            billableSeconds = totalAfter - freeLimit;
          }

          if (billableSeconds > 0 && session.packageType === PackageType.SNEHI && session.agentCredits !== undefined) {
            // agent_credits are in MINUTES as per previous implementation
            const billableMinutes = Math.ceil(billableSeconds / 60);
            const nc = Math.max(0, session.agentCredits - billableMinutes);
            useAppStore.setState({ session: { ...session, agentCredits: nc, totalTalkTime: totalAfter } });
            await supabase.from('profiles').update({ agent_credits: nc, total_talk_time: totalAfter }).eq('id', userId);
          } else {
            // Just update total talk time for free tier
            useAppStore.setState({ session: { ...session, totalTalkTime: totalAfter } });
            await supabase.from('profiles').update({ total_talk_time: totalAfter }).eq('id', userId);
          }
        }
      }
      startRef.current = null;
    }
  }, [userId, gemini, session, syncUsage]);

  const resetIdleTimer = useCallback(() => {
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    if (gemini.isConnected) {
      idleTimeoutRef.current = setTimeout(() => {
        handleStop();
        setSessionError({ 
          type: 'IDLE', 
          msg: t({ en: 'Session terminated due to inactivity.', kn: 'ನಿಷ್ಕ್ರಿಯತೆಯಿಂದಾಗಿ ಸೆಷನ್ ಮುಕ್ತಾಯಗೊಂಡಿದೆ.' }) 
        });
      }, 300000); // 5 minutes
    }
  }, [gemini.isConnected, t, handleStop]);

  useEffect(() => {
    resetIdleTimerRef.current = resetIdleTimer;
  }, [resetIdleTimer]);

  /* Load history and config */
  useEffect(() => {
    (async () => { 
      setLoadingHistory(true); 
      if (userId) setMessages(await getChatHistory(userId, undefined, 'voice')); 
      const cfg = await getSystemConfig();
      setSysConfig(cfg);
      setLoadingHistory(false); 
    })();
    return () => { gemini.disconnect(); audio.stopMic(); audio.stopAllAudio(); };
  }, [userId]);

  /* Auto-scroll on new messages */
  useEffect(() => { scrollRef.current && (scrollRef.current.scrollTop = scrollRef.current.scrollHeight); }, [messages, pendingUserText, pendingCoachText]);

  /* Actions */
  const handleStart = async () => {
    setSessionError({ type: 'NONE', msg: '' });
    if (session?.packageType === PackageType.SNEHI && (session.agentCredits ?? 0) <= 0) { alert('No credits left.'); return; }
    startRef.current = Date.now();
    
    // Fetch latest AI instructions from DB or fallback
    const rawInst = await getAiInstructions();
    let inst = "";
    if (rawInst) {
      try {
        const parsed = JSON.parse(rawInst);
        inst = parsed.instructions || "";
        if (parsed.aiVoice && Array.isArray(parsed.aiVoice)) {
          inst += "\n\nSpecific Voice Rules:\n" + parsed.aiVoice.join("\n");
        }
      } catch (e) {
        inst = rawInst; // Fallback if it's plain text
      }
    }

    if (!inst) {
      inst = `Persona: "Namma Simplish Meshtru", patient bilingual English tutor for Karnataka.
      STRICT RULE: Use ONLY Kannada for translations and support. Never use Telugu or Hindi.
      RULES: Only Kannada+English. Provide Kannada translation in brackets for every English sentence. Use rural examples. Celebrate wins. Call 'provide_feedback' on mistakes.`;
    }

    const ctx = messages.slice(-5).map(m => `${m.role === 'user' ? 'Student' : 'Coach'}: ${m.text}`).join('\n');
    const finalInst = `${inst}
IMPORTANT TRANSCRIPTION RULE: When you transcribe or summarize the student's speech, you MUST transcribe Kannada words exclusively in the Kannada script. NEVER use Devanagari (Hindi) or Bengali scripts in your transcriptions or output. Always produce authentic Kannada script for Kannada words.
${ctx ? `\n\nContext of last 5 messages:\n${ctx}` : ''}`;
    
    await gemini.connect(finalInst, session?.voiceGender === 'MAN' ? 'Puck' : 'Aoede');
    await audio.startMic(pcm => {
      gemini.sendPcmData(pcm);
      resetIdleTimerRef.current();
    });
    resetIdleTimerRef.current();
  };

  const setGender = async (g: 'MAN' | 'WOMAN') => { if (!userId) return; useAppStore.setState({ session: { ...session, voiceGender: g } }); await supabase.from('profiles').update({ voice_gender: g }).eq('id', userId); };

  const download = () => {
    if (!messages.length) return;
    const rows = messages.map(m => [m.role, m.text, m.correction, m.kannadaGuide, m.pronunciationTip, new Date(m.timestamp).toLocaleString()].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([['Role,Text,Correction,Guide,Tip,Time', ...rows].join('\n')], { type: 'text/csv' })); a.download = `voice_${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };

  const delMsg = async (m: CoachMessage) => { if (!m.dbId) return; await deleteChatMessage(m.dbId); setMessages(p => p.filter(x => x.dbId !== m.dbId)); };

  const speakTip = async (tip: string, id: string) => {
    if (playingTipId || fetchingTipId || getTTSQuotaStatus()) return;
    setFetchingTipId(id);
    try { const d = await textToSpeech(`Pronunciation tip: ${tip}`, 'Aoede', dataSaverMode); setFetchingTipId(null); if (d) await playPCM(d, tip); } catch { setFetchingTipId(null); } finally { setPlayingTipId(null); }
  };

  const live = gemini.isConnected || gemini.isConnecting || gemini.isReconnecting;
  const man = session?.voiceGender === 'MAN';
  const stColor = gemini.isConnected ? 'bg-green-400' : gemini.isReconnecting ? 'bg-yellow-400 animate-pulse' : 'bg-red-500';
  const stText = gemini.isConnected ? 'Live' : gemini.isReconnecting ? 'Sync' : 'Offline';

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER — Matches the reference screenshot exactly:
     ┌─────────────────── HEADER BAR ────────────────────────────────┐
     │ ← DASHBOARD    LIVE TALK · ● OFF · 57 MIN    MAN|WOMAN  ↓ 🗑 │
     ├──────────────┬───────────────────────────────────────────────┤
     │  Blue Card   │                                              │
     │  ┌────────┐  │   Coach bubble (left-aligned, wide)           │
     │  │ AVATAR │  │                     User bubble (right)       │
     │  └────────┘  │   Coach bubble                                │
     │ Speak w/Kore │                     User bubble               │
     │  desc text   │   Coach bubble with corrections               │
     │ [START LEARN] │                                              │
     │ 57 MIN AVAIL │  ← only this right panel scrolls (scrollbar) │
     └──────────────┴───────────────────────────────────────────────┘
     ═══════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="h-[100dvh] bg-[#0f1b4d] text-white flex flex-col overflow-hidden overscroll-none select-none">

      {/* ─── DESKTOP MAX-WIDTH SHELL ─── */}
      <div className="flex-1 flex flex-col w-full max-w-[1200px] mx-auto bg-[#0a1440] shadow-2xl relative overflow-hidden">

        {/* ══════ HEADER BAR ══════ */}
        <header className="flex items-center justify-between h-14 px-4 bg-[#0f1b4d] border-b border-white/10 shrink-0 z-20">
          {/* Left: back */}
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors">
            <IcoBack /><span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Dashboard</span>
          </button>

          {/* Center: title + status + credits */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase tracking-[0.25em]">Live Talk</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${stColor}`} />
              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">{stText}</span>
            </div>
            {session?.agentCredits !== undefined && (
              <span className="text-[9px] font-black text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                {session.agentCredits} MIN
              </span>
            )}
          </div>

          {/* Right: toggle + download + clear (Mobile: simplified) */}
          <div className="flex items-center gap-1.5">
            <div className={`flex bg-white/10 rounded-lg p-0.5 border border-white/10 transition-opacity ${live ? 'opacity-30 pointer-events-none' : ''}`}>
              <button disabled={live} onClick={() => setGender('MAN')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${man ? 'bg-blue-600 text-white shadow' : 'text-white/40 hover:text-white/70'}`}>Man</button>
              <button disabled={live} onClick={() => setGender('WOMAN')} className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${!man ? 'bg-orange-500 text-white shadow' : 'text-white/40 hover:text-white/70'}`}>Woman</button>
            </div>
            <button onClick={download} title="Download" className="p-1 text-white/40 hover:text-white/70 transition-colors hidden sm:block"><IcoDown /></button>
            <button onClick={() => { if (clearConfirm) { setMessages([]); setClearConfirm(false); } else setClearConfirm(true); }} title="Clear" className={`p-1 transition-colors ${clearConfirm ? 'text-red-400 animate-pulse' : 'text-white/40 hover:text-white/70'}`}><IcoBin /></button>
          </div>
        </header>

        {/* ══════ MAIN BODY ══════ */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* ────── LEFT: Persona Card ────── */}
          <aside className="
            shrink-0
            flex md:flex-col items-center
            md:justify-center
            bg-[#1a2f7a] border-b md:border-b-0 md:border-r border-white/10
            /* Mobile styling */
            h-auto px-4 py-3 gap-3
            /* Desktop styling */
            md:w-56 md:px-5 md:py-8 md:gap-5
            lg:w-64
          ">
            <div className="relative shrink-0">
              {audio.isAiTalking && (
                <div className={`absolute inset-[-5px] rounded-full border-2 animate-ping opacity-30 ${man ? 'border-blue-300' : 'border-orange-300'}`} />
              )}
              <div className={`
                overflow-hidden rounded-full shadow-xl
                w-16 h-16 md:w-32 md:h-32 lg:w-36 lg:h-36
                border-[3px] transition-all duration-500
                ${audio.isAiTalking ? 'border-white/80 scale-105' : 'border-white/25'}
              `}>
                {dataSaverMode ? (
                  <div className="w-full h-full bg-[#0f1b4d] flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-white/30"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3Z" /></svg>
                  </div>
                ) : (
                  <img src={man ? '/male_coach.png' : '/female_coach.png'} alt="Coach" className="w-full h-full object-cover object-top" loading="lazy" />
                )}
              </div>
              {gemini.isConnected && <span className="absolute bottom-0 right-0 md:bottom-1 md:right-1 w-3 h-3 bg-green-400 border-2 border-[#1a2f7a] rounded-full shadow" />}
            </div>

            <div className="hidden md:flex flex-col items-center text-center gap-1">
              <h2 className="text-base font-black text-white">{t({ en: 'Speak with Kore', kn: 'ಕೋರ್ ಜೊತೆ ಮಾತನಾಡಿ' })}</h2>
              <p className="text-[10px] text-white/50 leading-relaxed px-2">{t({ en: 'Practice naturally and improve your fluency instantly.', kn: 'ನೈಸರ್ಗಿಕವಾಗಿ ಅಭ್ಯಾಸ ಮಾಡಿ ಮತ್ತು ನಿಮ್ಮ ನಿರರ್ಗಳತೆಯನ್ನು ತಕ್ಷಣವೇ ಸುಧಾರಿಸಿ.' })}</p>
            </div>

            <div className="flex-1 md:hidden">
              <p className="text-xs font-black text-white">{t({ en: 'Speak with Kore', kn: 'ಕೋರ್ ಜೊತೆ ಮಾತನಾಡಿ' })}</p>
              <p className="text-[9px] text-white/40 uppercase tracking-widest">{stText}</p>
            </div>

            {(() => {
              const freeLimit = sysConfig?.universal_free_seconds ?? 180;
              const usedSeconds = session?.totalTalkTime || 0;
              const remainingFreeMinutes = Math.ceil(Math.max(0, freeLimit - usedSeconds) / 60);
              const agentCredits = session?.packageType === PackageType.SNEHI ? (session.agentCredits || 0) : 0;
              const totalAvailableMinutes = remainingFreeMinutes + agentCredits;
              
              const isTimeExhausted = totalAvailableMinutes <= 0;

              return (
                <div className="flex flex-col gap-2">
                  <div className="shrink-0 md:w-full">
                    {!live ? (
                      <button 
                        onClick={handleStart} 
                        disabled={isTimeExhausted}
                        className={`font-black uppercase tracking-[0.15em] shadow-lg transition-all rounded-xl text-[10px] px-5 py-2.5 md:w-full md:py-3.5 md:text-xs text-white
                          ${isTimeExhausted ? 'bg-slate-500 opacity-50 cursor-not-allowed' : 'bg-orange-500 hover:bg-orange-600 active:scale-95'}`}
                      >
                        {isTimeExhausted ? t({ en: 'Time Exhausted', kn: 'ಸಮಯ ಮುಗಿದಿದೆ' }) : t(TRANSLATIONS.startLearning)}
                      </button>
                    ) : (
                      <button onClick={handleStop} className="bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black uppercase tracking-[0.15em] shadow-lg transition-all rounded-xl text-[10px] px-5 py-2.5 md:w-full md:py-3.5 md:text-xs">
                        {t(TRANSLATIONS.stopTalk)}
                      </button>
                    )}
                  </div>
                  <p className="hidden md:block text-[9px] font-black text-orange-400 uppercase tracking-widest text-center mt-2">
                    {t({ en: `${totalAvailableMinutes} MIN AVAILABLE`, kn: `${totalAvailableMinutes} ನಿಮಿಷಗಳು ಬಾಕಿ ಇವೆ` })}
                  </p>
                </div>
              );
            })()}
          </aside>

          {/* ────── RIGHT: Chat Box ────── */}
          <section className="flex-1 flex flex-col overflow-hidden bg-[#0a1440] relative">
            {!loadingHistory && (
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 md:px-6 pt-6 pb-24 space-y-4 scroll-smooth overscroll-contain"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#3b82f644 transparent' }}
              >
                {messages.length === 0 && !pendingUserText && !pendingCoachText && (
                  <div className="h-full flex flex-col items-center justify-center opacity-15 text-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-12 h-12"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3Z" /></svg>
                    <p className="text-[10px] font-bold uppercase tracking-widest">{t({ en: 'Your session history starts here', kn: 'ನಿಮ್ಮ ಸೆಷನ್ ಇತಿಹಾಸ ಇಲ್ಲಿ ಪ್ರಾರಂಭವಾಗುತ್ತದೆ' })}</p>
                  </div>
                )}

                {messages.map((m, idx) => (
                  <div key={m.dbId || idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} group/msg animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`flex items-end gap-1 ${m.role === 'user' ? 'max-w-[80%]' : 'max-w-[90%]'}`}>
                      {m.role === 'user' && m.dbId && <button onClick={() => delMsg(m)} className="opacity-0 group-hover/msg:opacity-50 p-1 text-white/20 hover:text-red-400 shrink-0"><IcoBin /></button>}

                      <div className={m.role === 'user'
                        ? "bg-blue-600/60 backdrop-blur border border-blue-500/20 px-4 py-2.5 rounded-2xl rounded-br-sm shadow-sm"
                        : "bg-[#1e328a] border border-white/8 px-5 py-4 rounded-2xl rounded-bl-sm shadow"
                      }>
                        <p className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{m.text}</p>

                        {m.role === 'coach' && (m.correction || m.kannadaGuide || m.pronunciationTip) && (
                          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                            {m.correction && <p className="text-[11px] text-amber-400 font-semibold italic">{t({ en: 'Correction:', kn: 'ತಿದ್ದುಪಡಿ:' })} <span className="text-amber-300 font-bold">{m.correction}</span></p>}
                            {m.kannadaGuide && (
                              <div className="bg-blue-900/40 rounded-xl px-3.5 py-2.5">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1.5">{t({ en: 'ಸಹಾಯ (HELP)', kn: 'ಸಹಾಯ (HELP)' })}</p>
                                <p className="text-[11px] text-blue-100 font-medium whitespace-pre-line leading-relaxed">{m.kannadaGuide}</p>
                              </div>
                            )}
                            {m.pronunciationTip && (
                              <div className="flex items-center justify-between gap-3 bg-emerald-900/30 rounded-xl px-3.5 py-3 border border-emerald-500/10">
                                <div className="flex-1">
                                  <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">{t({ en: "Coach's Tip 🎙️", kn: "ಕೋಚ್ ಸಲಹೆ 🎙️" })}</p>
                                  <p className="text-[11px] text-emerald-100 font-medium leading-relaxed">{m.pronunciationTip}</p>
                                </div>
                                <button onClick={() => speakTip(m.pronunciationTip!, `v-${idx}`)} className="p-2.5 rounded-lg border border-white/10 hover:bg-white/10 active:scale-90 transition-all shrink-0">
                                  {fetchingTipId === `v-${idx}` ? <Spin c="border-emerald-400" /> : <IcoVol />}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {m.role === 'coach' && m.dbId && <button onClick={() => delMsg(m)} className="opacity-0 group-hover/msg:opacity-50 p-1 text-white/20 hover:text-red-400 shrink-0"><IcoBin /></button>}
                    </div>
                  </div>
                ))}

                {pendingUserText && (
                  <div className="flex justify-end animate-pulse">
                    <div className="bg-blue-600/30 border border-blue-500/10 px-4 py-2.5 rounded-2xl rounded-br-sm max-w-[70%]">
                      <p className="text-[13px] font-medium italic text-white/50">{pendingUserText}▌</p>
                    </div>
                  </div>
                )}
                {pendingCoachText && (
                  <div className="flex justify-start animate-fade-in">
                    <div className="bg-[#1e328a]/50 border border-white/5 px-5 py-4 rounded-2xl rounded-bl-sm max-w-[85%]">
                      <p className="text-[13px] font-medium italic text-white/70">{pendingCoachText}<span className="animate-pulse">▌</span></p>
                    </div>
                  </div>
                )}

                {/* Scroll Anchor */}
                <div className="h-4 w-full shrink-0" />
              </div>
            )}

            {loadingHistory && <div className="flex-1 flex items-center justify-center opacity-25"><Spin c="border-white/40" /></div>}

            {gemini.error && (
              <div className="absolute bottom-24 left-4 right-4 p-3.5 bg-red-950 border border-red-500/30 rounded-xl flex items-center justify-between shadow-2xl z-30">
                <p className="text-xs text-red-100 font-medium flex-1">{gemini.error}</p>
                <button onClick={gemini.clearError} className="px-3 py-1.5 text-[9px] font-black uppercase text-red-300 border border-red-500/20 rounded-md">Dismiss</button>
              </div>
            )}

            {sessionError.type !== 'NONE' && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-500">
                <div className="bg-[#1a2f7a] border-2 border-white/20 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center space-y-6">
                  <div className="text-5xl">{sessionError.type === 'IDLE' ? '😴' : '⚠️'}</div>
                  <h3 className="text-xl font-black uppercase tracking-tight">
                    {sessionError.type === 'IDLE' ? t({ en: 'Idle User', kn: 'ನಿಷ್ಕ್ರಿಯ ಬಳಕೆದಾರ' }) : t({ en: 'Technical Issue', kn: 'ತಾಂತ್ರಿಕ ತೊಂದರೆ' })}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed font-medium">
                    {sessionError.msg}
                  </p>
                  <button 
                    onClick={handleStart}
                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all"
                  >
                    {t({ en: 'Start Over', kn: 'ಮತ್ತೆ ಪ್ರಾರಂಭಿಸಿ' })}
                  </button>
                  <button 
                    onClick={() => { setSessionError({ type: 'NONE', msg: '' }); navigate('/dashboard'); }}
                    className="w-full py-3 text-white/40 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors"
                  >
                    {t({ en: 'Go to Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹೋಗಿ' })}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        body { overflow: hidden; position: fixed; width: 100%; height: 100%; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default VoiceCoach;
