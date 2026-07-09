
import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM, AudioStore } from '../utils/audioUtils';

interface AIFeedbackCardProps {
  data: {
    transcription: string;
    accuracy: number;
    feedbackKn: string;
    feedbackEn: string;
    targetText?: string;
  };
  onClose: () => void;
}

const AIFeedbackCard: React.FC<AIFeedbackCardProps> = ({ data, onClose }) => {
  const { lang, t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [cachedAudio, setCachedAudio] = useState<string | null>(null);
  const [quotaReached, setQuotaReached] = useState(getTTSQuotaStatus());

  useEffect(() => {
    const handleQuota = () => setQuotaReached(true);
    window.addEventListener('simplish-quota-exhausted', handleQuota);
    return () => window.removeEventListener('simplish-quota-exhausted', handleQuota);
  }, []);

  // Pre-fetch target text audio on mount
  useEffect(() => {
    if (data.targetText && !quotaReached) {
      const text = `Listen and repeat: ${data.targetText}`;
      if (!AudioStore.has(text)) {
        textToSpeech(text).then(audio => {
          if (audio) setCachedAudio(audio);
        });
      } else {
        setCachedAudio(AudioStore.get(text) || null);
      }
    }
  }, [data.targetText, quotaReached]);
  
  const getStatusColor = () => {
    if (data.accuracy >= 4) return 'bg-green-500';
    if (data.accuracy >= 2.5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getStatusIcon = () => {
    if (data.accuracy >= 4) return '🌟';
    if (data.accuracy >= 2.5) return '👍';
    return '👂';
  };

  const handlePlayTarget = async () => {
    if (isPlaying || !data.targetText) return;
    
    const textToConvert = `Listen and repeat: ${data.targetText}`;
    const isCached = !!cachedAudio || AudioStore.has(textToConvert);

    if (quotaReached && !isCached) return;

    setIsPlaying(true);
    try {
      if (cachedAudio) {
        await playPCM(cachedAudio, textToConvert);
      } else {
        const audio = await textToSpeech(textToConvert);
        if (audio) {
          setCachedAudio(audio);
          await playPCM(audio, textToConvert);
        }
      }
    } catch (e) {
      console.error("TTS Playback Error", e);
    } finally {
      setIsPlaying(false);
    }
  };

  const textKey = `Listen and repeat: ${data.targetText}`;
  const isDisabled = quotaReached && !cachedAudio && !AudioStore.has(textKey);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border-4 border-blue-900 dark:border-blue-400 p-8 shadow-2xl animate-in slide-in-from-bottom-10">
      <div className="flex justify-between items-start mb-6">
        <div className={`w-16 h-16 ${getStatusColor()} rounded-3xl flex items-center justify-center text-3xl shadow-lg`}>
          {getStatusIcon()}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Accuracy</div>
          <div className="flex gap-1 justify-end">
            {[1, 2, 3, 4, 5].map(star => (
              <span key={star} className={`text-xl ${star <= data.accuracy ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`}>
                ★
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
          <div>
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Sentence:</h4>
            <p className="text-lg font-bold text-blue-900 dark:text-blue-300">"{data.targetText || '...'}"</p>
          </div>
          <button 
            onClick={handlePlayTarget}
            disabled={isDisabled || isPlaying}
            title={isDisabled ? "Audio limit reached" : "Listen and repeat"}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all 
              ${isDisabled ? 'opacity-20 cursor-not-allowed grayscale' : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:scale-110 active:scale-95'} 
              ${isPlaying ? 'bg-blue-600 text-white animate-pulse shadow-inner' : ''}`}
          >
            {isPlaying ? (
               <div className="flex gap-0.5">
                 <div className="w-1 h-3 bg-white animate-[bounce_0.6s_infinite]"></div>
                 <div className="w-1 h-4 bg-white animate-[bounce_0.8s_infinite]"></div>
                 <div className="w-1 h-3 bg-white animate-[bounce_0.7s_infinite]"></div>
               </div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
              </svg>
            )}
          </button>
        </div>

        <div>
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">You Said:</h4>
          <p className="text-xl font-bold text-red-600 dark:text-red-400 italic">"{data.transcription}"</p>
        </div>

        <div className="bg-blue-50 dark:bg-slate-900/50 p-6 rounded-3xl border-2 border-blue-100 dark:border-slate-700">
          <p className="text-blue-900 dark:text-blue-300 font-bold text-lg leading-relaxed mb-2">
            {lang === 'kn' ? data.feedbackKn : data.feedbackEn}
          </p>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
            {lang === 'kn' ? data.feedbackEn : data.feedbackKn}
          </p>
        </div>

        {isDisabled && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold text-center uppercase tracking-tighter">
            {t({ 
              en: "Voice playback limit reached. It will reset later.", 
              kn: "ಧ್ವನಿ ಪ್ಲೇಬ್ಯಾಕ್ ಮಿತಿ ತಲುಪಿದೆ. ನಂತರ ಮರುಹೊಂದಿಸಲಾಗುತ್ತದೆ." 
            })}
          </p>
        )}

        <button 
          onClick={onClose}
          className="w-full py-5 bg-blue-900 dark:bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-black transition-all"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};

export default AIFeedbackCard;
