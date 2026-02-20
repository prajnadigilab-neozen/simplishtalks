
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { Module, Lesson, CourseLevel } from '../types';
import AudioRecorder from '../components/AudioRecorder';
import AIFeedbackCard from '../components/AIFeedbackCard';
import ScenarioPractice from '../components/ScenarioPractice';
import { evaluateSpeech, textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM, playCached, AudioStore } from '../utils/audioUtils';

import { useAppStore } from '../store/useAppStore';

const LessonView: React.FC = () => {
  const { modules, updateProgress: onComplete } = useAppStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const module = modules.find(m => m.lessons.some(l => l.id === id));
  const lesson = module?.lessons.find(l => l.id === id);

  const [activeTab, setActiveTab] = useState<'content' | 'notes' | 'assignment' | 'practice'>('content');
  const [isFullscreenPdf, setIsFullscreenPdf] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [quotaReached, setQuotaReached] = useState(getTTSQuotaStatus());

  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  useEffect(() => {
    const handleQuota = () => setQuotaReached(true);
    window.addEventListener('simplish-quota-exhausted', handleQuota);
    return () => window.removeEventListener('simplish-quota-exhausted', handleQuota);
  }, []);

  if (!lesson) return <div className="p-10 text-center font-bold dark:text-white">Lesson not found</div>;

  const handleComplete = async () => {
    if (lesson && module && !isFinishing) {
      setIsFinishing(true);
      try {
        await onComplete(lesson.id, module.level);
        navigate('/dashboard');
      } catch (e) {
        console.error("Failed to finish lesson", e);
      } finally {
        setIsFinishing(false);
      }
    }
  };

  const handleAudioComplete = async (blob: Blob) => {
    setAiLoading(true);
    try {
      const targetText = t(lesson.title);
      const result = await evaluateSpeech(blob, targetText);
      setFeedback({ ...result, targetText });
    } catch (error) {
      console.error("Failed to evaluate speech:", error);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative transition-colors duration-300">
      {feedback && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-lg">
            <AIFeedbackCard data={feedback} onClose={() => setFeedback(null)} />
          </div>
        </div>
      )}

      {/* Top Media Bar */}
      <div className="w-full bg-slate-900 shadow-2xl shrink-0 overflow-hidden">
        {lesson.videoUrl ? (
          <div className="aspect-video">
            {getYouTubeEmbedUrl(lesson.videoUrl) ? (
              <iframe
                src={getYouTubeEmbedUrl(lesson.videoUrl)!}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            ) : (
              <video src={lesson.videoUrl} controls className="w-full h-full" poster="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1200&auto=format&fit=crop" />
            )}
          </div>
        ) : lesson.audioUrl ? (
          <div className="p-10 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 relative">
            <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            <div className="w-24 h-24 bg-blue-600/20 border-2 border-blue-500/50 rounded-full flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full animate-ping bg-blue-500/10"></div>
              <span className="text-5xl drop-shadow-lg">🎙️</span>
            </div>
            <div className="w-full max-w-sm space-y-4 relative z-10">
              <audio src={lesson.audioUrl} controls className="w-full h-12 rounded-full" />
              <div className="text-center">
                <p className="text-blue-400 font-black text-[10px] uppercase tracking-[0.3em]">Audio Masterclass</p>
                <p className="text-white/40 text-[9px] font-medium mt-1 italic">Use headphones for better focus</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-900 to-blue-950 relative overflow-hidden min-h-[280px]">
            {/* Background elements */}
            <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-48 h-48 bg-purple-600/10 rounded-full blur-3xl"></div>

            <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center shadow-2xl backdrop-blur-md">
              <span className="text-4xl">📖</span>
            </div>

            <div className="text-center space-y-2 relative z-10 px-6">
              <h2 className="text-white text-2xl font-black tracking-tight leading-tight">{t(lesson.title)}</h2>
              <div className="h-1 w-12 bg-blue-500 mx-auto rounded-full"></div>
              <p className="text-blue-400/80 font-black text-[10px] uppercase tracking-[0.4em] mt-4">Active Study Mode</p>
            </div>

            <div className="absolute bottom-4 right-6 flex gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 animate-pulse"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/30 animate-pulse delay-100"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/10 animate-pulse delay-200"></div>
            </div>
          </div>
        )}
      </div>


      <div className="flex bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 transition-colors overflow-x-auto no-scrollbar shrink-0">
        <TabButton
          active={activeTab === 'content'}
          onClick={() => setActiveTab('content')}
          label={lesson.videoUrl || lesson.audioUrl ? t({ en: 'Watch/Listen', kn: 'ನೋಡಿ/ಕೇಳಿ' }) : t({ en: 'Learn', kn: 'ಕಲಿಯಿರಿ' })}
        />
        <TabButton
          active={activeTab === 'notes'}
          onClick={() => setActiveTab('notes')}
          label={t({ en: 'Study', kn: 'ಅಭ್ಯಾಸ' })}
        />
        <TabButton
          active={activeTab === 'assignment'}
          onClick={() => setActiveTab('assignment')}
          label={t({ en: 'Speak', kn: 'ಮಾತನಾಡಿ' })}
        />
        {lesson.scenario && (
          <TabButton
            active={activeTab === 'practice'}
            onClick={() => setActiveTab('practice')}
            label={t(TRANSLATIONS.practice)}
            badge="New"
          />
        )}
      </div>

      <div className="p-4 md:p-6 flex-1 overflow-y-auto pb-40 md:pb-32 bg-white dark:bg-slate-900 transition-colors">
        {activeTab === 'content' && (
          <div className="animate-in fade-in space-y-6">
            <h2 className="text-xl md:text-2xl font-black text-blue-900 dark:text-slate-100 mb-2">{t(lesson.title)}</h2>

            {lesson.textContent ? (
              <div className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700">
                {lesson.textContent}
              </div>
            ) : (
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                {t(lesson.notes)}
              </p>
            )}

            <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-black">?</div>
                <h4 className="font-black text-blue-900 dark:text-blue-300 text-xs uppercase tracking-widest">
                  Key Concepts
                </h4>
              </div>
              <p className="text-xs font-medium text-slate-500">{t(lesson.notes)}</p>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-4 animate-in fade-in h-full flex flex-col">
            <div className="bg-blue-50/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-blue-100 dark:border-slate-700">
              <h4 className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-3">Target Sentence</h4>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-blue-100 dark:border-slate-700 flex justify-between items-center">
                <div className="flex-1">
                  <p className="text-xs md:text-sm text-blue-900 dark:text-blue-300 font-bold mb-0.5">"{t(lesson.title)}"</p>
                </div>
                <SpeakButton text={t(lesson.title)} />
              </div>
            </div>

            {lesson.pdfUrl && (
              <div className="flex-1 flex flex-col gap-3 min-h-[400px]">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital PDF Notes</h4>
                  <button onClick={() => setIsFullscreenPdf(true)} className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">Full Screen</button>
                </div>
                <iframe src={`${lesson.pdfUrl}#toolbar=0&navpanes=0`} className="w-full flex-1 border-2 border-slate-100 rounded-2xl" />
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignment' && (
          <div className="animate-in fade-in space-y-6">
            <div className="bg-orange-50 dark:bg-orange-900/10 p-6 rounded-[2.5rem] border-2 border-orange-100 dark:border-orange-900/30">
              <h3 className="text-lg font-black text-orange-800 dark:text-orange-400 mb-2 uppercase tracking-tight">Speaking Challenge</h3>
              <p className="text-sm text-orange-900/70 dark:text-orange-300 font-bold">
                Read the lesson title aloud. Our AI will check your pronunciation and give you tips in Kannada!
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-[3rem] border-2 border-slate-100 dark:border-slate-700 overflow-hidden shadow-xl">
              <AudioRecorder onRecordingComplete={handleAudioComplete} lessonId={lesson.id} />
              {aiLoading && (
                <div className="p-10 flex flex-col items-center gap-4 bg-slate-50 dark:bg-slate-900">
                  <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] animate-pulse">AI is Listening...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'practice' && lesson.scenario && (
          <div className="animate-in slide-in-from-bottom-6 h-full pb-10">
            <div className="mb-6">
              <h3 className="text-lg font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">{t(TRANSLATIONS.scenarioTitle)}</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{t(TRANSLATIONS.scenarioDesc)}</p>
            </div>
            <ScenarioPractice scenario={lesson.scenario} />
          </div>
        )}
      </div>

      {/* Footer Nav */}
      <div className="fixed bottom-[68px] md:bottom-0 left-0 right-0 max-w-[720px] mx-auto p-4 md:p-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-100 dark:border-slate-800 flex gap-3 md:gap-4 z-[40]">
        <button
          onClick={() => navigate('/dashboard')}
          disabled={isFinishing}
          className="flex-1 py-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl font-black text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest disabled:opacity-50"
        >
          {t({ en: 'Back', kn: 'ಹಿಂದಕ್ಕೆ' })}
        </button>
        <button
          onClick={handleComplete}
          disabled={isFinishing}
          className="flex-[2] py-3 bg-orange-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg hover:bg-orange-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isFinishing ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <> {t({ en: 'Finish Lesson', kn: 'ಪಾಠ ಮುಗಿಸಿ' })} ✨ </>
          )}
        </button>
      </div>

      {isFullscreenPdf && lesson.pdfUrl && (
        <div className="fixed inset-0 z-[100] bg-black p-4 md:p-8 flex flex-col">
          <button onClick={() => setIsFullscreenPdf(false)} className="self-end mb-4 bg-white/10 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest">Close</button>
          <iframe src={lesson.pdfUrl} className="w-full flex-1 rounded-2xl bg-white" />
        </div>
      )}
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; label: string; onClick: () => void; badge?: string }> = ({ active, label, onClick, badge }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap relative ${active ? 'text-blue-700 dark:text-blue-400 border-blue-700 dark:border-blue-400 bg-white dark:bg-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
      }`}
  >
    {label}
    {badge && <span className="absolute top-1 right-1 bg-amber-400 text-white text-[7px] px-1 rounded animate-pulse">{badge}</span>}
  </button>
);

const SpeakButton: React.FC<{ text: string; small?: boolean }> = ({ text, small }) => {
  const [loading, setLoading] = useState(false);
  const handleSpeak = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const played = await playCached(text);
      if (!played) {
        const audio = await textToSpeech(text);
        if (audio) await playPCM(audio, text);
      }
    } catch (e) { console.error("Speak error:", e); } finally { setLoading(false); }
  };
  return (
    <button onClick={handleSpeak} className={`${small ? 'p-1' : 'p-2'} rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ${loading ? 'animate-pulse' : ''}`}>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
      </svg>
    </button>
  );
};

export default LessonView;
