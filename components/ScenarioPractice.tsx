import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLanguage } from './LanguageContext';
import { Language, CoachMessage, Lesson } from '../types';
import { useAppStore } from '../store/useAppStore';

interface ScenarioPracticeProps {
  lesson: Lesson;
  onAccuracyChange?: (accuracy: number) => void;
  onComplete?: () => void;
}

const ScenarioPractice: React.FC<ScenarioPracticeProps> = ({ lesson, onAccuracyChange, onComplete }) => {
  const { id: lessonId } = useParams<{ id: string }>();
  const { t, lang } = useLanguage();
  const { session, syncUsage } = useAppStore();
  const userId = session?.id ?? null;

  const scenario = lesson.scenario;

  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  
  // Game states
  const [options, setOptions] = useState<{ text: string; isCorrect: boolean; feedback?: string }[]>([]);
  const [wrongOptionSelected, setWrongOptionSelected] = useState(false);
  const [feedbackText, setFeedbackText] = useState<string | null>(null);
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showCompletionCard, setShowCompletionCard] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMutedRef = useRef(false);

  // Keep ref in sync with state so setTimeout callbacks read the latest value
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Cancel speech synthesis on unmount to prevent audio from playing after navigating away
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Helper function to speak text using browser-native SpeechSynthesis (completely free & local)
  const speakLocal = (text: string, id: string) => {
    if (isMutedRef.current) return;
    if ('speechSynthesis' in window) {
      // Toggle play/mute: if already speaking this message, clicking it again should stop it
      if (playingId === id) {
        window.speechSynthesis.cancel();
        setPlayingId(null);
        return;
      }

      setPlayingId(id);
      window.speechSynthesis.cancel();
      
      const cleanText = text.replace(/\*\*/g, '').replace(/\|.*/, '').trim();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'en-US';
      
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en-US') || v.lang.startsWith('en-GB') || v.lang.startsWith('en-IN'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      utterance.onend = () => {
        setPlayingId(null);
      };
      utterance.onerror = () => {
        setPlayingId(null);
      };
      
      window.speechSynthesis.speak(utterance);
    }
  };

  // Parse dialogue lines from lesson.textContent
  const dialogueLines = React.useMemo(() => {
    if (!lesson.textContent) return [];
    return lesson.textContent.split('\n').map(line => {
      const parts = line.split('|');
      const speakPart = parts[0] || '';
      const translationPart = parts[1] || '';
      
      const colonIndex = speakPart.indexOf(':');
      if (colonIndex === -1) return null;
      
      const speaker = speakPart.substring(0, colonIndex).trim();
      const text = speakPart.substring(colonIndex + 1).trim();
      const textKn = translationPart.trim();
      
      const speakerLower = speaker.toLowerCase();
      const isUser = speakerLower === 'vikas' || speakerLower.includes('vikas') || speakerLower === 'user' || speakerLower === 'student' || speakerLower.includes('(you)');
      
      return { 
        speaker, 
        text, 
        textKn,
        role: isUser ? 'user' : 'coach'
      };
    }).filter(Boolean) as { speaker: string; text: string; textKn: string; role: 'user' | 'coach'; }[];
  }, [lesson.textContent]);

  // Parse anticipated mistakes from system instruction
  const anticipatedMistakes = React.useMemo(() => {
    if (!scenario?.systemInstruction) return [];
    const mistakes: { mistake: string, correction: string }[] = [];
    const lines = scenario.systemInstruction.split('\n');
    let inMistakesSection = false;
    for (const line of lines) {
      if (line.toLowerCase().includes('anticipated mistakes')) {
        inMistakesSection = true;
        continue;
      }
      if (inMistakesSection && line.trim().startsWith('-')) {
        const parts = line.substring(1).split('->');
        const mistake = parts[0]?.trim();
        const correction = parts[1]?.trim();
        if (mistake && correction) {
          mistakes.push({ mistake, correction });
        }
      }
    }
    return mistakes;
  }, [scenario?.systemInstruction]);

  // Fallback Dialogue if textContent is empty, or choice-based roleplay lines if available
  const processedLines = React.useMemo(() => {
    if (scenario && scenario.choice_based_roleplay) {
      const lines: any[] = [];
      scenario.choice_based_roleplay.forEach((t: any) => {
        const prompt = t.ai_prompt;
        if (prompt) {
          lines.push({
            speaker: prompt.speaker || (typeof scenario.character === 'object' ? scenario.character.en : String(scenario.character)) || 'AI Coach',
            text: prompt.english || prompt.text || '',
            textKn: prompt.kannada || prompt.textKn || '',
            role: 'coach'
          });
        }
        if (t.options && t.options.length > 0) {
          // Find the correct option (ends with 'a', isCorrect, or first option)
          const correctOpt = t.options.find((opt: any) => 
            opt.isCorrect === true || 
            (opt.option_id && opt.option_id.toLowerCase().endsWith('a'))
          ) || t.options[0];
          
          if (correctOpt) {
            lines.push({
              speaker: 'Vikas',
              text: correctOpt.english || correctOpt.text || '',
              textKn: correctOpt.kannada || correctOpt.textKn || '',
              role: 'user'
            });
          }
        }
      });
      return lines;
    }

    if (dialogueLines.length > 0) return dialogueLines;
    
    return [
      {
        speaker: 'Vikas',
        text: lesson.speakTextContent || "Hello! Can I learn English?",
        textKn: "ನಮಸ್ಕಾರ! ನಾನು ಇಂಗ್ಲಿಷ್ ಕಲಿಯಬಹುದೇ?",
        role: 'user' as const
      },
      {
        speaker: 'Coach',
        text: "Yes, you can! Keep completing lessons to practice.",
        textKn: "ಹೌದು, ನೀವು ಕಲಿಯಬಹುದು! ಅಭ್ಯಾಸ ಮಾಡಲು ಪಾಠಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸುತ್ತಿರಿ.",
        role: 'coach' as const
      }
    ];
  }, [dialogueLines, lesson.speakTextContent, scenario]);

  // Calculate accuracy based on mistakes and correct turns
  const accuracy = React.useMemo(() => {
    const totalUserTurns = processedLines.filter(line => line.role === 'user').length;
    if (totalUserTurns === 0) return 100;
    const totalAttempts = totalUserTurns + mistakeCount;
    return Math.round((totalUserTurns / totalAttempts) * 100);
  }, [processedLines, mistakeCount]);

  useEffect(() => {
    onAccuracyChange?.(accuracy);
  }, [accuracy, onAccuracyChange]);

  // Helper to generate options with anticipated mistakes mixed in
  const generateOptionsForStep = (
    correctText: string,
    mistakes: { mistake: string, correction: string }[]
  ): { text: string; isCorrect: boolean; feedback?: string }[] => {
    const optionsList: { text: string; isCorrect: boolean; feedback?: string }[] = [{ text: correctText, isCorrect: true }];
    
    // Mix in a relevant mistake if available
    if (mistakes.length > 0) {
      const priceMistake = mistakes.find(m => m.mistake.toLowerCase().includes('price') || m.mistake.toLowerCase().includes('how much'));
      const giveMistake = mistakes.find(m => m.mistake.toLowerCase().includes('give'));
      
      if (correctText.toLowerCase().includes('how much') && priceMistake) {
        optionsList.push({ text: priceMistake.mistake, isCorrect: false, feedback: priceMistake.correction });
      } else if (correctText.toLowerCase().includes('give') && giveMistake) {
        optionsList.push({ text: giveMistake.mistake, isCorrect: false, feedback: giveMistake.correction });
      } else {
        const rand = mistakes[Math.floor(Math.random() * mistakes.length)];
        optionsList.push({ text: rand.mistake, isCorrect: false, feedback: rand.correction });
      }
    } else {
      // Fallback bridge error
      let badText = correctText
        .replace(/\bis\b/gi, '')
        .replace(/\bam\b/gi, '')
        .replace(/\bare\b/gi, '')
        .replace(/\bmy name is\b/gi, 'myself');
      if (badText === correctText) {
        badText = correctText.split(' ').reverse().join(' ');
      }
      optionsList.push({ text: badText, isCorrect: false, feedback: "Remember to use proper English verbs like 'is', 'am', or 'are'!" });
    }
    
    // Add another distractor option
    let distractor = correctText;
    if (correctText.toLowerCase().includes('give me')) {
      distractor = correctText.replace(/give me/gi, 'give');
      optionsList.push({ text: distractor, isCorrect: false, feedback: "Remember the person—say 'give ME' instead of just 'give'." });
    } else if (correctText.toLowerCase().includes('i am')) {
      distractor = correctText.replace(/i am/gi, 'i');
      optionsList.push({ text: distractor, isCorrect: false, feedback: "Don't forget the bridge! Say 'I AM' to describe yourself." });
    } else {
      const words = correctText.split(' ');
      if (words.length > 3) {
        const temp = words[1];
        words[1] = words[2];
        words[2] = temp;
        optionsList.push({ text: words.join(' '), isCorrect: false, feedback: "Check your word order!" });
      } else {
        optionsList.push({ text: correctText + ' eshtu?', isCorrect: false, feedback: "Try to avoid mixing Kannada words in English sentences." });
      }
    }

    const uniqueOptions = Array.from(new Map(optionsList.map(o => [o.text, o])).values());
    return uniqueOptions.sort(() => Math.random() - 0.5);
  };

  // Retrieve custom choice-based options or generate dynamically
  const getOptionsForTurn = (turnIndex: number, correctText: string) => {
    if (scenario && scenario.choice_based_roleplay) {
      const turnNum = Math.floor(turnIndex / 2) + 1;
      const turnData = scenario.choice_based_roleplay.find((t: any) => t.turn === turnNum);
      if (turnData && turnData.options) {
        const mappedOptions = turnData.options.map((opt: any) => {
          const isCorrect = opt.isCorrect === true || 
                            (opt.option_id && opt.option_id.toLowerCase().endsWith('a')) ||
                            opt.english.trim().toLowerCase() === correctText.trim().toLowerCase();
          return {
            text: opt.english,
            isCorrect,
            feedback: opt.feedback || (isCorrect ? "Excellent!" : "Try another option.")
          };
        });
        return mappedOptions.sort(() => Math.random() - 0.5);
      }
    }
    return generateOptionsForStep(correctText, anticipatedMistakes);
  };

  // Start the scenario game
  const initGame = () => {
    setLoading(true);
    setWrongOptionSelected(false);
    setFeedbackText(null);
    setPaymentProcessed(false);
    setPaymentSuccess(false);
    setMistakeCount(0);
    setShowCompletionCard(false);

    const firstLine = processedLines[0];
    if (firstLine && firstLine.role === 'coach') {
      const coachMsg: CoachMessage = {
        role: 'coach',
        text: firstLine.text,
        kannadaGuide: firstLine.textKn,
        timestamp: Date.now()
      };
      setMessages([coachMsg]);
      setCurrentTurn(1);
      
      // Delay speech synthesis until voices are loaded
      setTimeout(() => speakLocal(firstLine.text, 'msg-0'), 200);
      
      const nextUserLine = processedLines[1];
      if (nextUserLine && nextUserLine.role === 'user') {
        const opts = getOptionsForTurn(1, nextUserLine.text);
        setOptions(opts);
      }
    } else if (firstLine) {
      setMessages([]);
      setCurrentTurn(0);
      const opts = getOptionsForTurn(0, firstLine.text);
      setOptions(opts);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (processedLines.length > 0) {
      initGame();
    }
  }, [processedLines, anticipatedMistakes]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, paymentProcessed, paymentSuccess]);

  const handleSelectOption = (opt: { text: string; isCorrect: boolean; feedback?: string }) => {
    if (opt.isCorrect) {
      setWrongOptionSelected(false);
      setFeedbackText(null);
      
      const userMsg: CoachMessage = {
        role: 'user',
        text: opt.text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMsg]);
      syncUsage('chat', 1);

      // Speak the selected option immediately
      const userMsgIndex = messages.length;
      speakLocal(opt.text, `msg-${userMsgIndex}`);

      const nextTurnIndex = currentTurn + 1;
      
      if (nextTurnIndex >= processedLines.length) {
        setCurrentTurn(nextTurnIndex);
        return;
      }
      
      const nextLine = processedLines[nextTurnIndex];
      if (nextLine.role === 'coach') {
        setCurrentTurn(nextTurnIndex);
        
        // Calculate typing delay dynamically based on the length of user speech to avoid overlap
        const userWordsCount = opt.text.split(' ').length;
        const speechDuration = Math.max(1200, userWordsCount * 350);
        
        // Show typing indicator 1.5 seconds before the 5 second delay ends
        setTimeout(() => {
          setIsTyping(true);
        }, speechDuration + 3500);
        
        setTimeout(() => {
          setIsTyping(false);
          const coachMsg: CoachMessage = {
            role: 'coach',
            text: nextLine.text,
            kannadaGuide: nextLine.textKn,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, coachMsg]);
          speakLocal(nextLine.text, `msg-${nextTurnIndex}`);
          
          const afterCoachTurnIndex = nextTurnIndex + 1;
          setCurrentTurn(afterCoachTurnIndex);
          
          if (afterCoachTurnIndex < processedLines.length) {
            const nextUserLine = processedLines[afterCoachTurnIndex];
            if (nextUserLine.role === 'user') {
              const opts = getOptionsForTurn(afterCoachTurnIndex, nextUserLine.text);
              setOptions(opts);
            }
          }
        }, speechDuration + 5000);
      } else {
        setCurrentTurn(nextTurnIndex);
        const opts = getOptionsForTurn(nextTurnIndex, nextLine.text);
        setOptions(opts);
      }
    } else {
      setWrongOptionSelected(true);
      setFeedbackText(opt.feedback || "Oops! That's not the correct sentence. Try again!");
      setMistakeCount(prev => prev + 1);
    }
  };

  const handleReset = async () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    setResetConfirm(false);
    initGame();
  };

  const handlePaySimulatedUPI = () => {
    setPaymentProcessed(true);
    setTimeout(() => {
      setPaymentSuccess(true);
      if ('speechSynthesis' in window) {
        speakLocal("Payment successful! You bought the groceries.", "payment-success");
      }
    }, 2000);
  };

  if (!scenario) return null;

  const isGameFinished = currentTurn >= processedLines.length;

  useEffect(() => {
    if (isGameFinished) {
      const timer = setTimeout(() => {
        setShowCompletionCard(true);
        onComplete?.();
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowCompletionCard(false);
    }
  }, [isGameFinished, onComplete]);

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-slate-900/50 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-inner">
      {/* Scenario Header */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-xl">🎭</div>
          <div>
            <h4 className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-widest">{t(scenario.character)}</h4>
            <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tight">
              {t(scenario.objective)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Mute Button */}
          <button
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              if (!isMuted && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
            }}
            className="p-2 transition-colors rounded-full text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-750"
            title={isMuted ? "Unmute voice" : "Mute voice"}
          >
            {isMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-red-500 animate-in fade-in duration-200">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 text-slate-400 dark:text-slate-500 hover:text-blue-500 animate-in fade-in duration-200">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
              </svg>
            )}
          </button>
          
          <button
            type="button"
            onClick={handleReset}
            className={`p-2 transition-colors rounded-full ${resetConfirm
              ? 'text-orange-500 bg-orange-100 dark:bg-orange-900/20 ring-2 ring-orange-400 animate-pulse'
              : 'text-slate-300 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-750'
              }`}
            title={resetConfirm ? t({ en: "Tap again to confirm", kn: "ಖಚಿತಪಡಿಸಲು ಮತ್ತೆ ಒತ್ತಿ" }) : "Reset scenario"}
            onBlur={() => setResetConfirm(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 shadow-inner">
        {loading ? (
          <div className="flex justify-center py-20 opacity-20">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-100 dark:border-slate-700'
                  }`}>
                  <div className="flex justify-between items-start gap-4">
                    <p className="font-bold text-sm leading-relaxed">{m.text}</p>
                    <button
                      onClick={() => speakLocal(m.text, `msg-${idx}`)}
                      className={`shrink-0 p-1.5 rounded-lg transition-all ${
                        m.role === 'user'
                          ? playingId === `msg-${idx}`
                            ? 'bg-blue-700 text-white animate-pulse'
                            : 'bg-blue-500 text-blue-100 hover:bg-blue-400'
                          : playingId === `msg-${idx}`
                            ? 'bg-blue-600 text-white animate-pulse'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
                      </svg>
                    </button>
                  </div>
                  {m.role === 'coach' && m.kannadaGuide && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <p className="text-[10px] text-blue-500 font-black uppercase tracking-tighter mb-1">ಸಹಾಯ (Help)</p>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                        {m.kannadaGuide}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex gap-1 p-2 items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-2">{t(scenario.character)} is typing</span>
                <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            )}

            {/* Custom Visual Cards at the end of the Scenario */}
            {showCompletionCard && !isTyping && (
              <div className="animate-in zoom-in duration-300 flex justify-center py-4">
                {lessonId === '69713478-448d-41da-bda1-156d5a1b616c' ? (
                  /* Vegetable Marketplace Checkout Card */
                  <div className="w-full max-w-sm bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                    
                    {!paymentSuccess ? (
                      <>
                        <div className="text-center mb-4">
                          <span className="text-3xl">🛒</span>
                          <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-widest mt-1">Simplish Provision Store</h4>
                          <p className="text-[9px] text-slate-400 font-semibold uppercase">Vegetable Market Receipt</p>
                        </div>
                        
                        <div className="border-t-2 border-dashed border-slate-200 dark:border-slate-700 py-3 my-2 space-y-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                          <div className="flex justify-between">
                            <span>Onions (2 kg @ ₹40)</span>
                            <span>₹80.00</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Potatoes (1 kg @ ₹40)</span>
                            <span>₹40.00</span>
                          </div>
                          <div className="flex justify-between border-t border-slate-100 dark:border-slate-700 pt-2 font-black text-slate-800 dark:text-slate-100 text-sm">
                            <span>Total Bill</span>
                            <span>₹120.00</span>
                          </div>
                        </div>

                        {paymentProcessed ? (
                          <div className="flex flex-col items-center justify-center py-4 gap-2">
                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Authorizing Simulated UPI...</span>
                          </div>
                        ) : (
                          <button
                            onClick={handlePaySimulatedUPI}
                            className="w-full mt-4 py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                          >
                            <span>Pay ₹120 via Simulated UPI</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                            </svg>
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6 space-y-4 animate-in zoom-in">
                        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto border-2 border-emerald-500/20">✓</div>
                        <div>
                          <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-widest">Payment Successful</h4>
                          <p className="text-[9px] text-slate-400 font-bold mt-1">Transaction Ref: TXN_SIMPLISH_9827</p>
                        </div>
                        <div className="py-2 border-y border-slate-100 dark:border-slate-700 flex justify-center text-center text-xs font-black uppercase text-slate-500 my-2">
                          <div>
                            <div className="text-slate-400 text-[8px] tracking-widest">Accuracy</div>
                            <div className="text-emerald-600 text-sm mt-1">{accuracy}%</div>
                          </div>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl">
                          <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 leading-tight">
                            Excellent! You spoke correct English, bought fresh vegetables, and simulated the checkout completely.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* General Completion Fluency Card */
                  <div className="w-full max-w-sm bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
                    <div className="text-center py-4 space-y-3">
                      <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center text-3xl mx-auto">🏆</div>
                      <div>
                        <h4 className="font-black text-slate-800 dark:text-slate-100 text-sm uppercase tracking-widest">Scenario Completed!</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Bilingual Practice Card</p>
                      </div>
                      <div className="py-2 border-y border-slate-100 dark:border-slate-700 flex justify-center text-center text-xs font-black uppercase text-slate-500">
                        <div>
                          <div className="text-slate-400 text-[8px] tracking-widest">Accuracy</div>
                          <div className="text-blue-600 text-sm mt-1">{accuracy}%</div>
                        </div>
                      </div>
                      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed pt-2">
                        You successfully met the AI Coach's objective using correct English.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Options Selection Footer */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2 shrink-0">
        {wrongOptionSelected && feedbackText && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3 rounded-2xl text-[11px] font-bold text-red-700 dark:text-red-400 flex items-start gap-2 animate-in slide-in-from-bottom-2 mb-1">
            <span className="text-sm">⚠️</span>
            <div>
              <p className="font-black uppercase text-[8px] tracking-wider text-red-500 mb-0.5">Mistake Alert</p>
              <p>{feedbackText}</p>
            </div>
          </div>
        )}

        {!isGameFinished ? (
          <>
            <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Select the correct English reply to say:</h5>
            <div className="space-y-2">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectOption(opt)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-blue-700 border-2 border-transparent hover:border-blue-500/20 rounded-2xl text-left font-bold text-xs transition-all active:scale-[0.99] flex items-center justify-between"
                >
                  <span>{opt.text}</span>
                  <span className="text-[10px] opacity-25">Select</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">
            ★ Click 'Next' or 'Finish' below to complete the lesson ★
          </div>
        )}
      </div>
    </div>
  );
};

export default ScenarioPractice;
