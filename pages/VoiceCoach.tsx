/** V 1.0 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { CoachMessage, PackageType } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getChatHistory, saveChatMessage, deleteChatMessage, updateUserUsage, syncUsageToProfiles, clearUserChatHistory } from '../services/coachService';
import { textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM } from '../utils/audioUtils';
import { useGeminiLive, FeedbackData } from '../hooks/useGeminiLive';
import { useAudioHardware } from '../hooks/useAudioHardware';
import { supabase } from '../lib/supabase';
import { getAiInstructions } from '../services/aiInstructionsService';
import { getSystemConfig, SystemConfig } from '../services/systemConfigService';
import { useNotificationStore } from '../store/useNotificationStore';

/* ─── Inline SVG Icons ────────────────────────────────────────────────────── */
const IcoBack = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>;
const IcoBin = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>;
const IcoVol = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" /></svg>;
const IcoSce = () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18c-2.305 0-4.408.867-6 2.292m0-14.25v14.25" /></svg>;
const Spin = ({ c = 'border-white' }: { c?: string }) => <div className={`w-5 h-5 border-2 ${c} border-t-transparent rounded-full animate-spin`} />;

/* ─── Component ────────────────────────────────────────────────────────────── */
const VoiceCoach: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { session, scenarios, currentScenarioId, dataSaverMode, syncUsage, updateSNEHIPreferences, markScenarioComplete } = useAppStore();
  const { showSuccess, showError, showInfo } = useNotificationStore();
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
  const isSessionActiveRef = useRef(false); // Gate: stops PCM before WebSocket closes

  const [scenarioTimer, setScenarioTimer] = useState(420); // 7 minutes
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveView, setShowSaveView] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const isScenarioMarkedRef = useRef(false);
  const scenarioIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Gemini callbacks */
  const onAudioChunk = useCallback((b: string) => audio.playAudioChunk(b), [audio]);
  const onTranscription = useCallback((mode: 'input' | 'output', txt: string) => {
    resetIdleTimerRef.current();
    if (mode === 'input') {
      setPendingUserText(p => p + txt);
      setIsAiThinking(true);
      if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = setTimeout(() => {
        setSessionError({ 
          type: 'TECHNICAL', 
          msg: t({ en: 'Technical issue: No response from coach. Please restart.', kn: 'ತಾಂತ್ರಿಕ ತೊಂದರೆ: ಕೋಚ್‌ರಿಂದ ಯಾವುದೇ ಪ್ರತಿಕ್ರಿಯೆ ಇಲ್ಲ. ದಯವಿಟ್ಟು ಮರುಪ್ರಾರಂಭಿಸಿ.' }) 
        });
      }, 30000); 
    } else {
      setPendingCoachText(p => p + txt);
      setIsAiThinking(false);
      if (responseTimeoutRef.current) {
        clearTimeout(responseTimeoutRef.current);
        responseTimeoutRef.current = null;
      }
    }
  }, [t]);

  const onTurnComplete = useCallback(async (uTxt: string, cTxt: string, fb: FeedbackData) => {
    setPendingUserText(''); setPendingCoachText('');
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    if (!userId) return;
    
    // Use the AI's English translation of the user's speech if provided, otherwise the raw transcription.
    const finalUTxt = fb.userEnglishTranscript || uTxt;
    if (finalUTxt) { 
      const m: CoachMessage = { 
        role: 'user', 
        text: finalUTxt, 
        kannadaGuide: fb.userKannadaTranscript, 
        timestamp: Date.now() 
      }; 
      const id = await saveChatMessage(userId, m, undefined, 'voice'); 
      if (id) m.dbId = id; 
      setMessages(p => [...p, m]); 
    }
    
    if (cTxt) { 
      const m: CoachMessage = { role: 'coach', text: cTxt, correction: fb.correction, kannadaGuide: fb.kannadaGuide, pronunciationTip: fb.pronunciationTip, timestamp: Date.now() }; 
      const id = await saveChatMessage(userId, m, undefined, 'voice'); 
      if (id) m.dbId = id; 
      setMessages(p => [...p, m]); 
      if (currentScenarioId && messages.length >= 6 && !isScenarioMarkedRef.current) {
        isScenarioMarkedRef.current = true;
        markScenarioComplete(currentScenarioId);
      }
    }
  }, [userId, currentScenarioId, messages.length, markScenarioComplete]);

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
    // CRITICAL: Stop PCM gate FIRST, before WebSocket starts closing
    isSessionActiveRef.current = false;
    gemini.disconnect(); audio.stopMic(); audio.stopAllAudio();
    setIsAiThinking(false);
    if (messages.length > 0) setShowSaveView(true);
    if (startRef.current && userId) {
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      if (s > 0) {
        await updateUserUsage(userId, s, 0); syncUsageToProfiles(userId, s, 0); syncUsage('voice', s);
        if (session) {
          const totalAfter = (session.totalTalkTime || 0) + s;
          const freeLimit = (sysConfig as any)?.universal_free_seconds ?? 600;
          let billableSeconds = 0;
          if ((session.totalTalkTime || 0) >= freeLimit) billableSeconds = s;
          else if (totalAfter > freeLimit) billableSeconds = totalAfter - freeLimit;

          if (billableSeconds > 0 && session.packageType === PackageType.SNEHI && session.agentCredits !== undefined) {
            const billableMinutes = Math.ceil(billableSeconds / 60);
            const nc = Math.max(0, session.agentCredits - billableMinutes);
            useAppStore.setState({ session: { ...session, agentCredits: nc, totalTalkTime: totalAfter } });
            await supabase.from('profiles').update({ agent_credits: nc, total_talk_time: totalAfter }).eq('id', userId);
          } else {
            useAppStore.setState({ session: { ...session, totalTalkTime: totalAfter } });
            await supabase.from('profiles').update({ total_talk_time: totalAfter }).eq('id', userId);
          }
        }
      }
      startRef.current = null;
    }
  }, [userId, gemini, session, syncUsage, sysConfig, messages.length]);

  const lastActivityRef = useRef<number>(Date.now());

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => { resetIdleTimerRef.current = resetIdleTimer; }, [resetIdleTimer]);

  useEffect(() => {
    (async () => { 
      setLoadingHistory(true); 
      if (!currentScenarioId && scenarios.length > 0 && (session?.packageType === PackageType.SNEHI || session?.packageType === PackageType.BOTH)) {
        const firstBasic = scenarios.find(s => s.level === 'BASIC') || scenarios[0];
        if (firstBasic) useAppStore.getState().setCurrentScenario(firstBasic.id);
      }
      if (useAppStore.getState().clearChatRequested && userId) {
        await clearUserChatHistory(userId, undefined, 'voice');
        setMessages([]);
        useAppStore.getState().setClearChatRequested(false);
      } else if (userId) {
        setMessages(await getChatHistory(userId, undefined, 'voice')); 
      }
      const cfg = await getSystemConfig();
      setSysConfig(cfg);
      setLoadingHistory(false); 
    })();
    return () => { 
      gemini.disconnect(); audio.stopMic(); audio.stopAllAudio(); 
    };
  }, [userId, currentScenarioId]);

  useEffect(() => {
    let interval: any = null;
    if (gemini.isConnected) {
      lastActivityRef.current = Date.now();
      let hasTriggeredIdle = false;
      interval = setInterval(() => {
        if (!hasTriggeredIdle && Date.now() - lastActivityRef.current > 300000) {
          hasTriggeredIdle = true;
          handleStop();
          setTimeout(() => {
            setSessionError({ 
              type: 'IDLE', 
              msg: t({ en: 'Session terminated due to inactivity.', kn: 'ನಿಷ್ಕ್ರಿಯತೆಯಿಂದಾಗಿ ಸೆಷನ್ ಮುಕ್ತಾಯಗೊಂಡಿದೆ.' }) 
            });
            showInfo(t({ en: 'Session Timed Out', kn: 'ಸೆಷನ್ ಸಮಯ ಮೀರಿದೆ' }), t({ en: 'Terminated due to inactivity', kn: 'ನಿಷ್ಕ್ರಿಯತೆಯಿಂದಾಗಿ ಮುಕ್ತಾಯಗೊಂಡಿದೆ' }));
          }, 0);
          return;
        }
        setScenarioTimer(prev => {
          if (prev <= 1) { 
            handleStop(); 
            setTimeout(() => setShowSaveView(true), 0);
            return 0; 
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setScenarioTimer(420);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [gemini.isConnected, handleStop, t, showInfo]);


  useEffect(() => { 
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingUserText, pendingCoachText, isAiThinking]);

  const handleStart = async () => {
    try {
      setIsInitializing(true);
      setSessionError({ type: 'NONE', msg: '' });
      const usedSeconds = session?.totalTalkTime || 0;
      const universalSeconds = 600;
      const isSnehiOrBoth = session.packageType === PackageType.SNEHI || session.packageType === PackageType.BOTH;
      const packageSeconds = isSnehiOrBoth ? (250 * 60) : 0;
      const agentCredits = session.agentCredits || 0;
      const totalLimitSeconds = universalSeconds + packageSeconds + (agentCredits * 60);
      if (Math.ceil((totalLimitSeconds - usedSeconds) / 60) <= 0) {
        alert(t({ en: 'Voice practice time exhausted.', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸದ ಸಮಯ ಮುಗಿದಿದೆ.' }));
        return;
      }
      startRef.current = Date.now();
      const rawInst = await getAiInstructions();
      let inst = rawInst ? (JSON.parse(rawInst).instructions || rawInst) : "";
      if (!inst) inst = 'Persona: "Namma Simplish Meshtru", patient bilingual tutor.';
      const activeScenario = scenarios.find(s => s.id === currentScenarioId);
      if (activeScenario) inst = activeScenario.systemInstruction;
      let finalInst = `${inst}\nSTRICT RULES: You MUST ALWAYS call the provide_feedback tool on EVERY single turn. You MUST provide the 'user_english_transcript' (what the user said, translated to English) parameter in the tool call every time. Be brief. Responses must be under 30 words.`;
      if (session?.prefersTranslation === false) finalInst += "\nDISABLE KANNADA TRANSLATIONS.";
      if (session?.prefersPronunciation === false) finalInst += "\nDISABLE PRONUNCIATION TIPS.";
      const ctx = messages.slice(-3).map(m => `${m.role === 'user' ? 'S' : 'C'}: ${m.text}`).join('\n');
      finalInst += `\n\nCtx:\n${ctx}`;
      isSessionActiveRef.current = true;
      await gemini.connect(finalInst, session?.voiceGender === 'MAN' ? 'Puck' : 'Aoede');
      await audio.startMic(pcm => {
        if (!isSessionActiveRef.current) return; // PCM gate: drop data if session is ending
        gemini.sendPcmData(pcm);
        resetIdleTimerRef.current();
      });
      resetIdleTimerRef.current();
      if (activeScenario && messages.length === 0) {
        setTimeout(() => {
          const m: CoachMessage = { role: 'coach', text: activeScenario.initialMessage, timestamp: Date.now() };
          setMessages([m]); saveChatMessage(userId!, m, undefined, 'voice');
        }, 1000);
      }
    } catch (err: any) {
      console.error("Failed to start voice session:", err);
      setSessionError({ 
        type: 'TECHNICAL', 
        msg: t({ 
          en: 'Microphone access required. Please allow microphone access in your browser settings.', 
          kn: 'ಮೈಕ್ರೊಫೋನ್ ಪ್ರವೇಶವನ್ನು ಅನುಮತಿಸಿ. ದಯವಿಟ್ಟು ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.' 
        }) 
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSavePractice = async () => {
    if (!currentScenarioId || messages.length === 0) return;
    setIsSaving(true);
    try {
      // Small buffer to allow MediaRecorder to finalize the blob
      await new Promise(r => setTimeout(r, 500));
      const finalBlob = audio.getLatestBlob() || audio.lastRecordingBlob;
      await useAppStore.getState().saveScenarioPractice(currentScenarioId, messages, finalBlob || undefined, 420 - scenarioTimer);
      showSuccess(t({ en: 'Recording Saved', kn: 'ರೆಕಾರ್ಡಿಂಗ್ ಉಳಿಸಲಾಗಿದೆ' }), t({ en: 'Revision added to curriculum', kn: 'ಪಠ್ಯಕ್ರಮಕ್ಕೆ ಸೇರಿಸಲಾಗಿದೆ' }));
      setShowSaveView(false);
    } catch { 
      showError(t({ en: 'Failed to Save', kn: 'ಉಳಿಸಲು ವಿಫಲವಾಗಿದೆ' }));
    } finally { setIsSaving(false); }
  };

  const setGender = async (g: 'MAN' | 'WOMAN') => { if (!userId) return; useAppStore.setState({ session: { ...session, voiceGender: g } }); await supabase.from('profiles').update({ voice_gender: g }).eq('id', userId); showInfo(t({ en: 'Voice Changed', kn: 'ಧ್ವನಿ ಬದಲಾಗಿದೆ' }), t({ en: `Coach is now ${g.toLowerCase()}`, kn: `ಈಗ ${g.toLowerCase()} ಧ್ವನಿ` })); };
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

  return (
    <div className="h-[100dvh] bg-[#050b24] text-white flex flex-col overflow-hidden overscroll-none select-none font-outfit relative">
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-indigo-600/20 blur-[100px] rounded-full -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-600/20 blur-[100px] rounded-full translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="flex-1 flex flex-col min-h-0 w-full max-w-[1240px] mx-auto bg-transparent lg:bg-[#0a1440]/10 lg:backdrop-blur-3xl relative z-10">
        <header className="shrink-0 h-16 md:h-20 bg-[#0a1440]/80 backdrop-blur-md border-b border-white/5 flex items-center justify-between px-3 md:px-8 relative z-50">
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button onClick={() => navigate(-1)} className="p-2 md:p-3 rounded-xl bg-white/5 border border-white/5 text-white/50 hover:text-white hover:bg-white/10 transition-all">
              <IcoBack />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <IcoSce />
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center flex-1 px-2 min-w-0">
            <h1 className="text-[10px] md:text-xs font-black uppercase tracking-[0.1em] md:tracking-[0.3em] text-white/90 truncate w-full text-center">
              {scenarios.find(s => s.id === currentScenarioId)?.title.en || 'Master Talk'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1 h-1 rounded-full ${stColor} shadow-[0_0_8px_rgba(52,211,153,0.5)]`} />
              <span className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">
                {gemini.isConnected ? `${Math.floor(scenarioTimer / 60)}:${(scenarioTimer % 60).toString().padStart(2, '0')}` : stText}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
            {session?.agentCredits !== undefined && (
              <div className="flex items-center gap-1 px-2 py-1 md:px-3 md:py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/20">
                <span className="text-[10px] font-black text-amber-400 whitespace-nowrap">{session.agentCredits} MIN</span>
              </div>
            )}
            <button 
              onClick={async () => { 
                if (clearConfirm) { 
                  if (userId) {
                    await clearUserChatHistory(userId, undefined, 'voice');
                    setMessages([]); 
                    showSuccess(t({ en: 'History Cleared', kn: 'ಇತಿಹಾಸವನ್ನು ಅಳಿಸಲಾಗಿದೆ' }));
                  }
                  setClearConfirm(false); 
                } else setClearConfirm(true); 
              }} 
              className={`p-2 md:p-2.5 rounded-xl border transition-all ${clearConfirm ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-white/5 border-white/5 text-white/30 hover:text-red-400'}`}
            >
              <IcoBin />
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          <aside className="shrink-0 flex flex-col md:pt-12 bg-[#0a1440]/20 border-white/5 h-auto md:w-64 lg:w-72 md:px-6 lg:px-8 py-4 px-6 gap-6 overflow-y-auto">
            <div className="flex items-center md:flex-col gap-6 md:gap-8">
              <div className="relative group shrink-0">
                {audio.isAiTalking && <div className={`absolute inset-[-8px] rounded-full border-2 animate-[ping_2s_infinite] opacity-20 ${man ? 'border-blue-400' : 'border-orange-400'}`} />}
                <div className={`overflow-hidden rounded-[2.5rem] w-16 h-16 md:w-32 md:h-32 lg:w-44 lg:h-44 border-4 transition-all duration-700 ${audio.isAiTalking ? 'border-white/50 scale-105 shadow-blue-500/20' : (isAiThinking || gemini.isConnecting) ? 'border-amber-400/50 scale-95 shadow-amber-500/20' : 'border-white/10'}`}>
                  <picture>
                    <source srcSet={man ? '/male_coach.avif' : '/female_coach.avif'} type="image/avif" />
                    <img src={man ? '/male_coach.png' : '/female_coach.png'} alt="Coach" className={`w-full h-full object-cover transition-all duration-700 ${(audio.isAiTalking || isAiThinking) ? 'grayscale-0' : 'grayscale-[0.3]'}`} />
                  </picture>
                  {(isAiThinking || gemini.isConnecting) && (
                    <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-bounce" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex-1 md:w-full space-y-4">
                <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
                  <button onClick={() => setGender('MAN')} className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${man ? 'bg-blue-600 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}>Man</button>
                  <button onClick={() => setGender('WOMAN')} className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${!man ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}>Woman</button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                  <button 
                    onClick={() => updateSNEHIPreferences({ prefersTranslation: !session?.prefersTranslation })}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-2xl border transition-all ${session?.prefersTranslation !== false ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/5 text-white/30'}`}
                  >
                    <span className="text-[8px] font-black uppercase tracking-widest">Trans</span>
                    <div className={`w-6 h-3 rounded-full relative transition-all ${session?.prefersTranslation !== false ? 'bg-indigo-500' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${session?.prefersTranslation !== false ? 'left-3.5' : 'left-0.5'}`} />
                    </div>
                  </button>
                  <button 
                    onClick={() => updateSNEHIPreferences({ prefersPronunciation: !session?.prefersPronunciation })}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-2xl border transition-all ${session?.prefersPronunciation !== false ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/5 text-white/30'}`}
                  >
                    <span className="text-[8px] font-black uppercase tracking-widest">Pron</span>
                    <div className={`w-6 h-3 rounded-full relative transition-all ${session?.prefersPronunciation !== false ? 'bg-emerald-500' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${session?.prefersPronunciation !== false ? 'left-3.5' : 'left-0.5'}`} />
                    </div>
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full">
              {!live ? (
                <button onClick={handleStart} disabled={isInitializing} className={`w-full relative group overflow-hidden p-[2px] rounded-2xl transition-all active:scale-95 shadow-xl shadow-orange-900/20 ${isInitializing ? 'opacity-70 cursor-not-allowed' : ''}`}>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600 via-amber-400 to-orange-600 animate-[shimmer_2s_linear_infinite]" />
                  <div className="relative bg-[#0a1440] group-hover:bg-[#0c1a4d] transition-colors rounded-[14px] py-3.5 px-4 flex items-center justify-center gap-3">
                    {isInitializing ? <Spin /> : <span className="text-sm">🎙️</span>}
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                      {isInitializing ? (t({ en: 'Initializing...', kn: 'ಪ್ರಾರಂಭಿಸಲಾಗುತ್ತಿದೆ...' })) : (t({ en: 'Start Practice', kn: 'ಅಭ್ಯಾಸ ಪ್ರಾರಂಭಿಸಿ' }))}
                    </span>
                  </div>
                </button>
              ) : (
                <button onClick={handleStop} className="w-full group py-4 bg-red-600 hover:bg-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-900/40 text-white active:scale-95 transition-all flex items-center justify-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  Exit Meeting
                </button>
              )}
              <p className="text-[8px] md:text-[9px] font-black text-amber-500/60 uppercase tracking-widest text-center hidden md:block">Ready to Speak 🎤</p>
            </div>
          </aside>

          <section className="flex-1 flex flex-col min-h-0 overflow-hidden relative bg-[#050b24]/40">
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 md:px-10 pt-10 pb-32 space-y-8 scroll-smooth" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(59, 130, 246, 0.2) transparent' }}>
              {sessionError.type !== 'NONE' && (
                <div className="animate-in fade-in slide-in-from-top-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400 mb-6">
                  <span className="text-sm">⚠️</span>
                  <p className="text-xs font-medium leading-relaxed">{sessionError.msg}</p>
                </div>
              )}
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4`}>
                  <div className={`flex flex-col gap-2 ${m.role === 'user' ? 'items-end max-w-[85%]' : 'items-start max-w-[92%]'}`}>
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">{m.role === 'user' ? 'You' : 'Snehi'} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <div className={`px-5 py-4 rounded-[1.5rem] border transition-all ${m.role === 'user' ? "bg-indigo-600 border-indigo-500/40 text-white rounded-tr-none" : "bg-white/5 border-white/5 text-white/90 rounded-tl-none"}`}>
                      <p className="text-[14px] leading-relaxed font-medium whitespace-pre-wrap">{m.text}</p>
                      {(m.correction || m.kannadaGuide || m.pronunciationTip) && (
                        <div className={`mt-5 space-y-4 border-t pt-4 ${m.role === 'user' ? 'border-indigo-400/30' : 'border-white/5'}`}>
                          {m.correction && <p className="text-[11px] font-bold text-amber-400">✨ {m.correction}</p>}
                          {m.kannadaGuide && session?.prefersTranslation !== false && (
                            <p className={`text-[10px] p-3 rounded-xl ${m.role === 'user' ? 'bg-indigo-700/50 text-indigo-100' : 'text-white/60 bg-indigo-950/30'}`}>
                              {m.kannadaGuide}
                            </p>
                          )}
                          {m.pronunciationTip && m.role === 'coach' && (
                            <div className="flex items-center justify-between gap-4 bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10">
                              <p className="text-[10px] text-emerald-200 italic">“{m.pronunciationTip}”</p>
                              <button onClick={() => speakTip(m.pronunciationTip!, `v-${idx}`)} className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">{fetchingTipId === `v-${idx}` ? <Spin c="border-emerald-400" /> : <IcoVol />}</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {pendingUserText && <div className="flex justify-end pr-4"><div className="bg-indigo-600/20 px-5 py-3 rounded-2xl text-white/50 italic text-sm">{pendingUserText}▌</div></div>}
              {isAiThinking && <div className="flex justify-start pl-4"><div className="bg-white/5 px-6 py-4 rounded-2xl text-white/60 italic text-sm animate-pulse">Snehi is thinking...</div></div>}
              {pendingCoachText && <div className="flex justify-start pl-4"><div className="bg-white/5 px-6 py-4 rounded-2xl text-white/60 italic text-sm">{pendingCoachText}▌</div></div>}
            </div>

            {showSaveView && (
              <div className="absolute inset-x-6 bottom-10 p-8 bg-[#0a1440] border border-green-500/30 rounded-[2.5rem] shadow-2xl z-50 animate-in slide-in-from-bottom-10">
                <div className="flex flex-col items-center text-center gap-6">
                  <h3 className="text-xl font-black uppercase tracking-wider">Well Spoken!</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest -mt-4">Chat and Audio will be saved for revision</p>
                  <div className="flex gap-4 w-full">
                    <button onClick={() => setShowSaveView(false)} className="flex-1 py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest">Dismiss</button>
                    <button onClick={handleSavePractice} className="flex-1 py-4 bg-green-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">{isSaving ? <Spin /> : '💾 Save Revision'}</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } } 
        body { margin: 0; padding: 0; height: 100vh; overflow: hidden; position: relative; }
        #root { height: 100%; display: flex; flex-direction: column; }
        .overflow-y-auto::-webkit-scrollbar { width: 4px; }
        .overflow-y-auto::-webkit-scrollbar-track { background: transparent; }
        .overflow-y-auto::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.1); border-radius: 10px; }
        .overflow-y-auto:hover::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.3); }
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet" />
    </div>
  );
};

export default VoiceCoach;
