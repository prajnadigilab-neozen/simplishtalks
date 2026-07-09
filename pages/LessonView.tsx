/** V 1.0 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { Module, Lesson, CourseLevel } from '../types';
import AudioRecorder from '../components/AudioRecorder';
import AIFeedbackCard from '../components/AIFeedbackCard';
import ScenarioPractice from '../components/ScenarioPractice';
import { evaluateSpeech, textToSpeech, getTTSQuotaStatus } from '../services/geminiService';
import { playPCM, playCached, AudioStore } from '../utils/audioUtils';
import { saveUserRecording, fetchUserRecordings } from '../services/courseService';

import { useAppStore } from '../store/useAppStore';

type TabType = 'watch' | 'study' | 'speak' | 'practice';
const TAB_ORDER: TabType[] = ['watch', 'study', 'speak', 'practice'];

const LEVEL_TAB_DURATIONS: Record<CourseLevel, Record<TabType, number>> = {
  [CourseLevel.BASIC]: { watch: 60, study: 120, speak: 180, practice: 240 },
  [CourseLevel.INTERMEDIATE]: { watch: 120, study: 180, speak: 300, practice: 300 },
  [CourseLevel.ADVANCED]: { watch: 180, study: 180, speak: 420, practice: 420 },
  [CourseLevel.EXPERT]: { watch: 300, study: 300, speak: 600, practice: 600 },
  [CourseLevel.CUSTOM]: { watch: 60, study: 120, speak: 180, practice: 240 }
};

export const normalizeLevel = (levelStr: string | null | undefined): CourseLevel => {
  if (!levelStr) return CourseLevel.BASIC;
  const upper = levelStr.toUpperCase();
  if (upper.includes('EXPERT')) return CourseLevel.EXPERT;
  if (upper.includes('ADVANCED')) return CourseLevel.ADVANCED;
  if (upper.includes('INTERMEDIATE')) return CourseLevel.INTERMEDIATE;
  if (upper.includes('BASIC')) return CourseLevel.BASIC;
  if (upper.includes('CUSTOM')) return CourseLevel.CUSTOM;
  return CourseLevel.BASIC;
};

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Helper to render **bold** text as 🟢 strong tags
const renderBoldText = (text: string | null) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-black text-blue-900 dark:text-blue-400">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

interface ParsedStudySection {
  title: string;
  content: string;
  icon: string;
  color: string;
}

interface StudyVocabItem {
  word: string;
  meaning: string;
  kannada: string;
  example: string;
}

const parseStudyContent = (text: string) => {
  const sections: ParsedStudySection[] = [];
  const vocabulary: StudyVocabItem[] = [];
  
  // Extract Cultural Context
  const culturalMatch = text.match(/(?:🌟\s*)?CULTURAL\s*&\s*IDIOMATIC\s*CONTEXT:\s*([\s\S]*?)(?=\n\s*(?:🌟\s*)?KANNADA\s*BRIDGE:|\n\s*(?:📚\s*)?KEY\s*VOCABULARY:|$)/i);
  if (culturalMatch) {
    sections.push({
      title: "Cultural & Idiomatic Context",
      content: culturalMatch[1].trim(),
      icon: "✨",
      color: "from-amber-500/10 to-orange-500/5 border-amber-200/65 dark:border-amber-900/30 text-amber-950 dark:text-amber-300"
    });
  }

  // Extract Kannada Bridge
  const bridgeMatch = text.match(/(?:🌟\s*)?KANNADA\s*BRIDGE:\s*([\s\S]*?)(?=\n\s*(?:🌟\s*)?CULTURAL\s*&\s*IDIOMATIC\s*CONTEXT:|\n\s*(?:📚\s*)?KEY\s*VOCABULARY:|$)/i);
  if (bridgeMatch) {
    sections.push({
      title: "Kannada to English Bridge",
      content: bridgeMatch[1].trim(),
      icon: "🌉",
      color: "from-sky-500/10 to-indigo-500/5 border-sky-200/65 dark:border-sky-900/30 text-sky-950 dark:text-sky-300"
    });
  }

  // Extract Key Vocabulary
  const vocabSectionMatch = text.match(/(?:📚\s*)?KEY\s*VOCABULARY:\s*([\s\S]*)$/i);
  if (vocabSectionMatch) {
    const vocabText = vocabSectionMatch[1].trim();
    const items = vocabText.split(/(?=\n-\s*|\n\*\s*|^-\s*|^\*\s*)/g);
    for (const item of items) {
      const cleaned = item.trim().replace(/^[-\*\s]+/, '');
      if (!cleaned) continue;

      const lines = cleaned.split('\n').map(l => l.trim());
      const firstLine = lines[0] || '';
      
      const colonIdx = firstLine.indexOf(':');
      if (colonIdx === -1) continue;
      
      const word = firstLine.substring(0, colonIdx).trim();
      const meaning = firstLine.substring(colonIdx + 1).trim();
      
      let kannada = '';
      let example = '';
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().startsWith('kannada equivalent:')) {
          kannada = line.replace(/kannada equivalent:\s*/i, '').trim();
        } else if (line.toLowerCase().startsWith('example:')) {
          example = line.replace(/example:\s*/i, '').trim();
        }
      }
      
      if (word && meaning) {
        vocabulary.push({ word, meaning, kannada, example });
      }
    }
  }

  return { sections, vocabulary };
};

const LessonView: React.FC = () => {
  const { modules, session, updateProgress: onComplete, dataSaverMode } = useAppStore();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const module = modules.find(m => m.lessons.some(l => l.id === id));
  const lesson = module?.lessons.find(l => l.id === id);

  const [activeTab, setActiveTab] = useState<TabType>('watch');
  const [isFullscreenPdf, setIsFullscreenPdf] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [feedback, setFeedback] = useState<any>(null);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showModuleCompleteModal, setShowModuleCompleteModal] = useState(false);
  const [showLessonCompleteModal, setShowLessonCompleteModal] = useState(false);
  const [roleplayAccuracy, setRoleplayAccuracy] = useState<number>(100);
  const [quotaReached, setQuotaReached] = useState(getTTSQuotaStatus());
  // Timed practice states
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [initialDuration, setInitialDuration] = useState<number>(0);
  const [completedStages, setCompletedStages] = useState<Record<TabType, boolean>>({
    watch: false, study: false, speak: false, practice: false
  });
  const [timeSpent, setTimeSpent] = useState<Record<TabType, number>>({
    watch: 0, study: 0, speak: 0, practice: 0
  });
  const [isTimerPaused, setIsTimerPaused] = useState(false);

  // Handle visibility change to automatically pause timer when tab/screen is inactive
  // and resume when returning (unless it was manually paused beforehand)
  const wasManuallyPaused = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!isTimerPaused) {
          setIsTimerPaused(true);
          wasManuallyPaused.current = false;
        } else {
          wasManuallyPaused.current = true;
        }
      } else if (document.visibilityState === 'visible') {
        if (!wasManuallyPaused.current) {
          setIsTimerPaused(false);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isTimerPaused]);

  // Study tab content
  const [studyTextContent, setStudyTextContent] = useState<string | null>(null);
  const [studyTextLoading, setStudyTextLoading] = useState(false);

  // Speak tab content
  const [speakTextContent, setSpeakTextContent] = useState<string | null>(lesson?.speakTextContent || null);
  const [speakTextLoading, setSpeakTextLoading] = useState(false);
  const [speakRecordingBlob, setSpeakRecordingBlob] = useState<Blob | null>(null);
  const [savingRecording, setSavingRecording] = useState(false);
  const [savedRecordings, setSavedRecordings] = useState<any[]>([]);

  // Parse Speak tab text to support JSON-based pronunciation and transliteration guides
  const speakTextData = React.useMemo(() => {
    // Helper to clean legacy pipe delimiters
    const cleanText = (str: string | null | undefined): string => {
      if (!str) return "";
      return str.replace(/\|"/g, '').replace(/\|/g, '').trim();
    };

    // Primary: Read directly from lessons database columns
    if (lesson?.englishTextToRead) {
      return {
        english: cleanText(lesson.englishTextToRead),
        kannadaPhonetic: cleanText(lesson.transcriptionToReadKannadaPhonetic),
        transliteration: cleanText(lesson.transcriptionToReadTransliteration),
        instruction: "Read the English sentences aloud. If you feel hesitant, read the Kannada script right below it—it spells out the exact English pronunciation to give you instant confidence!",
        isJson: false
      };
    }

    // Secondary/Fallback: Parse JSON string from speakTextContent if needed
    let english = speakTextContent || "";
    let kannadaPhonetic = "";
    let transliteration = "";
    let instruction = "";
    let isJson = false;

    if (english && english.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(english);
        english = parsed.english_text_to_read || parsed.english || "";
        kannadaPhonetic = parsed.transcription_to_read_kannada_phonetic || parsed.transcription_to_read_kannada || parsed.kannada_phonetic || "";
        transliteration = parsed.transcription_to_read_transliteration || parsed.transliteration || "";
        instruction = parsed.instruction || "";
        isJson = true;
      } catch (e) {
        console.error("Failed to parse speakTextContent as JSON", e);
      }
    }
    return { 
      english: cleanText(english), 
      kannadaPhonetic: cleanText(kannadaPhonetic), 
      transliteration: cleanText(transliteration), 
      instruction, 
      isJson 
    };
  }, [speakTextContent, lesson]);

  const getYouTubeEmbedUrl = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  // Fetch text content for Study tab
  useEffect(() => {
    // If we already have the generated text from the database, use that instead of fetching the URL
    if (lesson?.studyTextContent) {
      setStudyTextContent(lesson.studyTextContent);
      return;
    }

    if (activeTab === 'study' && lesson?.textUrl && !studyTextContent) {
      setStudyTextLoading(true);
      fetch(lesson.textUrl)
        .then(res => res.ok ? res.text() : Promise.reject('Failed'))
        .then(text => setStudyTextContent(text))
        .catch(err => console.error("Failed to fetch study text:", err))
        .finally(() => setStudyTextLoading(false));
    }
  }, [activeTab, lesson?.textUrl, lesson?.studyTextContent]);

  // Fetch text content for Speak tab
  useEffect(() => {
    // If we already have the generated text from the database, use that instead of fetching the URL
    if (lesson?.speakTextContent) {
      setSpeakTextContent(lesson.speakTextContent);
      return;
    }

    if (activeTab === 'speak' && lesson?.speakTextUrl && !speakTextContent) {
      setSpeakTextLoading(true);
      fetch(lesson.speakTextUrl)
        .then(res => res.ok ? res.text() : Promise.reject('Failed'))
        .then(text => setSpeakTextContent(text))
        .catch(err => console.error("Failed to fetch speak text:", err))
        .finally(() => setSpeakTextLoading(false));
    }
  }, [activeTab, lesson?.speakTextUrl, lesson?.speakTextContent]);

  // Load saved recordings
  useEffect(() => {
    if (activeTab === 'speak' && lesson?.id && session?.id) {
      fetchUserRecordings(session.id, lesson.id).then(setSavedRecordings);
    }
  }, [activeTab, lesson?.id, session?.id]);

  useEffect(() => {
    const handleQuota = () => setQuotaReached(true);
    window.addEventListener('simplish-quota-exhausted', handleQuota);
    return () => window.removeEventListener('simplish-quota-exhausted', handleQuota);
  }, []);

  // Listen for ESC key to close Lesson Complete Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showLessonCompleteModal) {
        setShowLessonCompleteModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showLessonCompleteModal]);

  // Reset completed stages and time spent on lesson change
  useEffect(() => {
    setCompletedStages({ watch: false, study: false, speak: false, practice: false });
    setTimeSpent({ watch: 0, study: 0, speak: 0, practice: 0 });
    setIsTimerPaused(false);
  }, [id]);

  // Track time spent on the active tab
  useEffect(() => {
    if (completedStages[activeTab] || isTimerPaused || showLessonCompleteModal) return;

    const interval = setInterval(() => {
      setTimeSpent(prev => ({
        ...prev,
        [activeTab]: prev[activeTab] + 1
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, completedStages, isTimerPaused, showLessonCompleteModal]);

  // Mark speak tab as completed when speech feedback is received
  useEffect(() => {
    if (activeTab === 'speak' && feedback && !completedStages.speak) {
      setCompletedStages(prev => ({ ...prev, speak: true }));
    }
  }, [activeTab, feedback, completedStages.speak]);

  // Load duration when tab or lesson changes
  useEffect(() => {
    if (!module || !activeTab) return;
    const level = normalizeLevel(module.level);
    const duration = LEVEL_TAB_DURATIONS[level]?.[activeTab] || 60;
    
    if (completedStages[activeTab]) {
      setTimeRemaining(0);
    } else {
      setTimeRemaining(duration);
    }
    setInitialDuration(duration);
  }, [activeTab, id, module, completedStages]);

  // Countdown timer logic
  useEffect(() => {
    if (completedStages[activeTab] || isTimerPaused || showLessonCompleteModal) {
      if (completedStages[activeTab]) setTimeRemaining(0);
      return;
    }
    if (timeRemaining <= 0) {
      if (initialDuration > 0 && !completedStages[activeTab]) {
        setCompletedStages(prev => ({ ...prev, [activeTab]: true }));
      }
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, activeTab, completedStages, initialDuration, isTimerPaused, showLessonCompleteModal]);

  if (!lesson) return <div className="p-10 text-center font-bold dark:text-white">Lesson not found</div>;

  const handleComplete = async () => {
    if (lesson && module && !isFinishing) {
      // Save current lesson's accuracy score to localStorage
      let finalAccuracy = 100;
      if (lesson.scenario) {
        finalAccuracy = roleplayAccuracy;
      } else if (feedback && feedback.accuracy) {
        finalAccuracy = feedback.accuracy * 20; // 1-5 stars to percentage
      }
      localStorage.setItem(`lesson_accuracy_${lesson.id}`, finalAccuracy.toString());

      // Show the lesson completion modal first
      setShowLessonCompleteModal(true);
    }
  };

  const handleProceedAfterLesson = async () => {
    if (lesson && module) {
      setIsFinishing(true);
      try {
        await onComplete(lesson.id, module.level);
        setShowLessonCompleteModal(false);

        // Find next lesson
        const currentLessonIndex = module.lessons.findIndex(l => l.id === id);
        const nextLesson = module.lessons[currentLessonIndex + 1];

        if (nextLesson) {
          navigate(`/lesson/${nextLesson.id}`);
          setActiveTab('watch'); // Reset to first tab for new lesson
        } else {
          // Module completed! Show the congratulatory completion modal
          setShowModuleCompleteModal(true);
        }
      } catch (e) {
        console.error("Failed to finish lesson", e);
      } finally {
        setIsFinishing(false);
      }
    }
  };

  const handleAudioComplete = async (blob: Blob, durationSeconds?: number, transcribedText?: string) => {
    if (!transcribedText || !transcribedText.trim()) {
      return; // Prevent blank/error popup if no speech was transcribed
    }
    setAiLoading(true);
    try {
      const targetText = t(lesson.title);
      const cleanTargetText = targetText.replace(/\|.*/, "").trim();
      const result = evaluateSpeechLocally(transcribedText, cleanTargetText, lang);
      setFeedback({ ...result, targetText: cleanTargetText });
    } catch (error) {
      console.error("Failed to evaluate speech:", error);
    } finally {
      setAiLoading(false);
    }
  };

  const evaluateSpeechLocally = (transcription: string, targetText: string, currentLang: 'en' | 'kn') => {
    if (!transcription || transcription.trim() === '') {
      return {
        transcription: "(No speech detected / ಧ್ವನಿ ಪತ್ತೆಯಾಗಿಲ್ಲ)",
        accuracy: 1,
        feedbackKn: "ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಪ್ರಯತ್ನಿಸಿ ಮತ್ತು ನಿಮ್ಮ ಮೈಕ್ರೊಫೋನ್ ಸಕ್ರಿಯವಾಗಿದೆಯೇ ಎಂದು ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.",
        feedbackEn: "Please try again and make sure your microphone is enabled."
      };
    }

    const cleanStr = (s: string) => s.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").replace(/\s+/g, " ").trim();
    const cleanTarget = cleanStr(targetText);
    const cleanTrans = cleanStr(transcription);
    
    const targetWords = cleanTarget.split(' ').filter(Boolean);
    const transWords = cleanTrans.split(' ').filter(Boolean);
    
    if (targetWords.length === 0) {
      return { transcription, accuracy: 5, feedbackEn: "Well done!", feedbackKn: "ಚೆನ್ನಾಗಿ ಮಾಡಿದ್ದೀರಿ!" };
    }

    let matchCount = 0;
    const transSet = new Set(transWords);
    targetWords.forEach(word => {
      if (transSet.has(word)) {
        matchCount++;
        transSet.delete(word);
      }
    });

    const ratio = matchCount / targetWords.length;
    let accuracy = 1;
    if (ratio >= 0.9) accuracy = 5;
    else if (ratio >= 0.75) accuracy = 4;
    else if (ratio >= 0.5) accuracy = 3;
    else if (ratio >= 0.25) accuracy = 2;

    let feedbackEn = "";
    let feedbackKn = "";

    if (accuracy === 5) {
      feedbackEn = "Perfect pronunciation! Well done.";
      feedbackKn = "ಅದ್ಭುತ ಉಚ್ಚಾರಣೆ! ಚೆನ್ನಾಗಿ ಮಾಡಿದ್ದೀರಿ.";
    } else if (accuracy === 4) {
      feedbackEn = "Very good job! Just a tiny error.";
      feedbackKn = "ತುಂಬಾ ಚೆನ್ನಾಗಿ ಹೇಳಿದ್ದೀರಿ! ಕೇವಲ ಸಣ್ಣ ತಪ್ಪು.";
    } else if (accuracy === 3) {
      feedbackEn = "Good try! Keep practicing to get the flow right.";
      feedbackKn = "ಉತ್ತಮ ಪ್ರಯತ್ನ! ಮಾತು ನಿರರ್ಗಳವಾಗಲು ಅಭ್ಯಾಸ ಮುಂದುವರಿಸಿ.";
    } else if (accuracy === 2) {
      feedbackEn = "We heard some words. Try to speak slowly and clearly.";
      feedbackKn = "ಕೆಲವು ಪದಗಳು ಸರಿಯಾಗಿ ಕೇಳಿಸಿದವು. ನಿಧಾನವಾಗಿ ಮತ್ತು ಸ್ಪಷ್ಟವಾಗಿ ಹೇಳಲು ಪ್ರಯತ್ನಿಸಿ.";
    } else {
      feedbackEn = "We couldn't catch that. Please try reading it again.";
      feedbackKn = "ನಮಗೆ ಅರ್ಥವಾಗಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೊಮ್ಮೆ ಓದಲು ಪ್ರಯತ್ನಿಸಿ.";
    }

    return {
      transcription,
      accuracy,
      feedbackEn,
      feedbackKn
    };
  };

  // SPEAK tab: save recording to DB
  const handleSpeakRecordingComplete = async (blob: Blob, durationSeconds?: number, transcribedText?: string) => {
    setSpeakRecordingBlob(blob);
    if (!session?.id || !lesson?.id) {
      alert("Please log in to save recordings.");
      return;
    }

    if (!transcribedText || !transcribedText.trim()) {
      console.warn("Speech recognition returned empty transcription, skipping feedback popup.");
      return; // Avoid showing the undesired "No speech detected" popup card
    }

    setSavingRecording(true);
    setAiLoading(true);
    try {
      const result = await saveUserRecording(session.id, lesson.id, blob);
      if (result.error) {
        console.warn("Failed to upload recording to Supabase storage (using local IndexedDB fallback):", result.error);
      } else {
        const recordings = await fetchUserRecordings(session.id, lesson.id);
        setSavedRecordings(recordings);
      }

      const textToEvaluate = speakTextData.english || speakTextContent || t(lesson.title) || "";
      const cleanTarget = textToEvaluate.replace(/\|.*/, "").trim();

      const feedbackResult = evaluateSpeechLocally(transcribedText, cleanTarget, lang);
      setFeedback({ ...feedbackResult, targetText: cleanTarget });
    } catch (err) {
      console.error("Save recording error:", err);
    } finally {
      setSavingRecording(false);
      setAiLoading(false);
    }
  };

  const currentTabIndex = TAB_ORDER.indexOf(activeTab);
  const availableTabs = TAB_ORDER.filter(tab => {
    if (tab === 'practice') return !!lesson.scenario;
    return true;
  });
  const isLastTab = currentTabIndex === availableTabs.length - 1;

  const goToNextTab = () => {
    const nextIndex = availableTabs.indexOf(activeTab) + 1;
    if (nextIndex < availableTabs.length) {
      setActiveTab(availableTabs[nextIndex]);
    }
  };

  // Determine what the top media panel should show based on active tab
  const showMediaPanel = activeTab === 'watch';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 relative transition-colors duration-300">
      {/* Top Header Navigation */}
      <div className="bg-white dark:bg-slate-900 px-4 py-3 border-b-2 border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-[50] shrink-0">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 px-3 py-1.5 text-blue-900 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-full transition-colors group"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Dashboard</span>
        </button>
        
        <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] line-clamp-1 flex-1 text-center px-4">
          {t(lesson.title)}
        </h1>
        
        {/* Sticky Timer Display on Header Nav */}
        <div className="flex items-center gap-3 select-none shrink-0">
          {!completedStages[activeTab] && (
            <button
              type="button"
              onClick={() => setIsTimerPaused(!isTimerPaused)}
              className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-355 hover:bg-slate-100 dark:hover:bg-slate-750 transition-all border border-slate-200/60 dark:border-slate-700/60 shadow-sm flex items-center justify-center active:scale-95"
              title={isTimerPaused ? "Resume Timer" : "Pause Timer"}
            >
              {isTimerPaused ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-emerald-600 animate-pulse">
                  <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-amber-500">
                  <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H7.5a.75.75 0 0 1-.75-.75V5.25Zm7.5 0A.75.75 0 0 1 15 4.5h1.5a.75.75 0 0 1 .75.75v13.5a.75.75 0 0 1-.75.75H15a.75.75 0 0 1-.75-.75V5.25Z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}

          <div className="text-right">
            {completedStages[activeTab] ? (
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-full uppercase tracking-wider block animate-pulse">✓ Done</span>
            ) : isTimerPaused ? (
              <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full uppercase tracking-wider block animate-pulse">⏸ Paused</span>
            ) : (
              <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-100 block">
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </span>
            )}
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">
              Target: {initialDuration / 60}m
            </span>
          </div>
          
          <div className="w-8 h-8 relative flex items-center justify-center shrink-0">
            {/* Circular SVG Progress Bar */}
            <svg className="w-8 h-8 transform -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="12"
                className="stroke-slate-100 dark:stroke-slate-850 fill-none"
                strokeWidth="2.5"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                className="stroke-blue-600 dark:stroke-blue-500 fill-none transition-all duration-1000"
                strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (completedStages[activeTab] ? 0 : timeRemaining / initialDuration)}`}
              />
            </svg>
            <div className="absolute text-[8px] font-bold text-slate-655 dark:text-slate-400">
              {completedStages[activeTab] ? '✓' : `${Math.round(((initialDuration - timeRemaining) / initialDuration) * 100)}%`}
            </div>
          </div>
        </div>
      </div>

      {showCompletionModal && (
        <div className="fixed inset-0 z-[100] bg-blue-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in zoom-in duration-500">
          <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-blue-500 to-green-500"></div>
            <div className="text-6xl mb-6 scale-125 animate-bounce">🏆</div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 leading-tight">Course Completed!</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm mb-8">ನಮ್ಮ ಅಭಿನಂದನೆಗಳು! ನೀವು ಈ ಹಂತದ ಎಲ್ಲಾ ಪಾಠಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಮುಗಿಸಿದ್ದೀರಿ.</p>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-black transition-all"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {showLessonCompleteModal && lesson && module && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-6 md:p-8 max-w-md w-full text-center shadow-2xl relative overflow-hidden my-8 transform animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            
            <div className="text-5xl mb-4 animate-bounce">🎓</div>
            
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-1 leading-tight uppercase tracking-tight">
              Lesson Completed!
            </h2>
            <p className="text-blue-600 dark:text-blue-400 font-black text-[9px] uppercase tracking-widest mb-4">
              {t(lesson.title)}
            </p>
            
            {/* Accuracy Badge */}
            {(() => {
              let finalAccuracy = 100;
              if (lesson.scenario) {
                finalAccuracy = roleplayAccuracy;
              } else if (feedback && feedback.accuracy) {
                finalAccuracy = feedback.accuracy * 20;
              }
              return (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 mb-6">
                  <span className="text-slate-400 text-[8px] font-black uppercase tracking-wider block mb-1">Your Lesson Accuracy</span>
                  <span className="text-blue-600 dark:text-blue-400 text-3xl font-black">{finalAccuracy}%</span>
                </div>
              );
            })()}

            {/* Time Taken vs Allotted Time Breakdown */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 text-left mb-6">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Time Spent Breakdown</h4>
              <div className="space-y-3">
                {TAB_ORDER.filter(tab => tab !== 'practice' || !!lesson.scenario).map((tab) => {
                  const spent = timeSpent[tab];
                  const level = normalizeLevel(module.level);
                  const allotted = LEVEL_TAB_DURATIONS[level]?.[tab] || 60;
                  const percent = Math.min(100, Math.round((spent / allotted) * 100));
                  
                  return (
                    <div key={tab} className="space-y-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-slate-650 dark:text-slate-400 uppercase text-[9px] tracking-wider">
                          {tab === 'watch' ? '1. Watch/Listen' :
                           tab === 'study' ? '2. Study Guide' :
                           tab === 'speak' ? '3. Speak' :
                           '4. Interact'}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {formatTime(spent)} <span className="text-slate-450 dark:text-slate-500 font-normal">/ {formatTime(allotted)}</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            spent >= allotted 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowLessonCompleteModal(false)}
                disabled={isFinishing}
                className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceedAfterLesson}
                disabled={isFinishing}
                className="flex-[2] py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isFinishing ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <> Proceed </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModuleCompleteModal && module && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-6 md:p-8 max-w-lg w-full text-center shadow-2xl relative overflow-hidden my-8 transform animate-in zoom-in-95 duration-300">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500"></div>
            
            <div className="text-6xl mb-4 animate-bounce">🏆</div>
            
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-1 leading-tight uppercase tracking-tight">
              {normalizeLevel(module.level) === CourseLevel.BASIC ? 'Basic Module Completed!' : `${t(module.title)} Completed!`}
            </h2>
            
            <p className="text-amber-600 dark:text-amber-400 font-black text-[9px] uppercase tracking-widest mb-4">
              Level Completed Successfully
            </p>
            
            <p className="text-slate-600 dark:text-slate-300 text-xs font-bold leading-relaxed mb-6 max-w-sm mx-auto">
              {normalizeLevel(module.level) === CourseLevel.BASIC 
                ? "Congratulations! You have successfully completed all lessons in the Basic module and mastered the fundamentals of daily English conversation! Your dedication is truly inspiring."
                : `Congratulations! You have completed all lessons in the ${t(module.title)} module and leveled up your English skills. Keep going!`}
            </p>
            
            {/* Lesson Accuracy Breakdown Section */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 text-left mb-6 max-h-[220px] overflow-y-auto">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Lesson-wise Accuracy</h4>
              <div className="space-y-3">
                {module.lessons.map((l) => {
                  const lessonAcc = Number(localStorage.getItem(`lesson_accuracy_${l.id}`) || 100);
                  return (
                    <div key={l.id} className="flex justify-between items-center text-xs font-bold">
                      <span className="text-slate-700 dark:text-slate-300 line-clamp-1 max-w-[280px]">{t(l.title)}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                            style={{ width: `${lessonAcc}%` }}
                          ></div>
                        </div>
                        <span className="text-blue-600 dark:text-blue-400 min-w-[32px] text-right font-black">{lessonAcc}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Overall Accuracy Badge */}
            {(() => {
              const totalAcc = module.lessons.reduce((acc, curr) => acc + Number(localStorage.getItem(`lesson_accuracy_${curr.id}`) || 100), 0);
              const overallAcc = Math.round(totalAcc / module.lessons.length);
              return (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-2xl p-4 flex items-center justify-around mb-8">
                  <div className="text-left">
                    <span className="text-slate-400 text-[8px] font-black uppercase tracking-wider block">Average Accuracy</span>
                    <span className="text-amber-600 dark:text-amber-400 text-2xl font-black">{overallAcc}%</span>
                  </div>
                  <div className="border-l border-amber-200 dark:border-amber-900/30 h-8"></div>
                  <div className="text-left">
                    <span className="text-slate-400 text-[8px] font-black uppercase tracking-wider block">Lessons Done</span>
                    <span className="text-slate-800 dark:text-white text-lg font-black">{module.lessons.length} / {module.lessons.length}</span>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3">
              <button
                onClick={() => {
                  setShowModuleCompleteModal(false);
                  const currentModuleIndex = modules.findIndex(m => m.id === module.id);
                  const nextModule = modules[currentModuleIndex + 1];
                  if (nextModule && nextModule.lessons && nextModule.lessons.length > 0) {
                    navigate(`/lesson/${nextModule.lessons[0].id}`);
                    setActiveTab('watch');
                  } else {
                    setShowCompletionModal(true);
                  }
                }}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:from-orange-600 hover:to-amber-600 transition-all transform active:scale-[0.98]"
              >
                Proceed to next Level
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-lg">
            <AIFeedbackCard data={feedback} onClose={() => setFeedback(null)} />
          </div>
        </div>
      )}

      {/* Top Media Panel - changes based on tab */}
      {showMediaPanel && (
        <div className="w-full bg-slate-900 shadow-2xl shrink-0 overflow-hidden">
          {activeTab === 'watch' && (
            <>
              {lesson.videoUrl ? (
                <div className="aspect-video">
                  {dataSaverMode ? (
                    <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center p-6 text-center gap-4">
                      <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center border border-blue-500/30">
                        <span className="text-3xl">🎚️</span>
                      </div>
                      <div>
                        <p className="text-white font-black text-sm uppercase tracking-widest">Data Saver Active</p>
                        <p className="text-slate-400 text-[10px] mt-1">Video hidden to save data</p>
                      </div>
                      {lesson.audioUrl ? (
                        <audio src={lesson.audioUrl} controls className="w-full max-w-xs h-10" />
                      ) : (
                        <div className="px-4 py-2 bg-slate-700 rounded-lg text-slate-300 text-[10px] font-bold">
                          No audio-only version available
                        </div>
                      )}
                      <button
                        onClick={() => useAppStore.getState().setDataSaverMode(false)}
                        className="mt-2 text-[10px] font-black text-blue-400 underline decoration-2 underline-offset-4"
                      >
                        Disable to watch video
                      </button>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              ) : lesson.audioUrl ? (
                <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-center gap-6 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 relative min-h-[140px] overflow-hidden">
                  <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                  <div className="w-14 h-14 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center relative shrink-0">
                    <div className="absolute inset-0 rounded-2xl animate-ping bg-blue-500/10"></div>
                    <span className="text-3xl drop-shadow-lg">🎙️</span>
                  </div>
                  <div className="w-full max-w-xs space-y-2 relative z-10 text-center md:text-left">
                    <div>
                      <p className="text-blue-400 font-black text-[9px] uppercase tracking-[0.25em]">Audio Masterclass</p>
                      <p className="text-white/40 text-[8px] font-medium italic mt-0.5">Use headphones for focus</p>
                    </div>
                    <audio src={lesson.audioUrl} controls className="w-full h-8 rounded-lg" />
                  </div>
                </div>
              ) : (
                <StaticTitlePanel title={t(lesson.title)} subtitle="Watch/Listen" />
              )}
            </>
          )}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 transition-colors overflow-x-auto no-scrollbar shrink-0">
        <TabButton
          active={activeTab === 'watch'}
          onClick={() => setActiveTab('watch')}
          label={t({ en: 'Watch/Listen', kn: 'ನೋಡಿ/ಕೇಳಿ' })}
          step={1}
        />
        <TabButton
          active={activeTab === 'study'}
          onClick={() => setActiveTab('study')}
          label={t({ en: 'Study', kn: 'ಅಭ್ಯಾಸ' })}
          step={2}
        />
        <TabButton
          active={activeTab === 'speak'}
          onClick={() => setActiveTab('speak')}
          label={t({ en: 'Speak', kn: 'ಮಾತನಾಡಿ' })}
          step={3}
        />
        {lesson.scenario && (
          <TabButton
            active={activeTab === 'practice'}
            onClick={() => setActiveTab('practice')}
            label={t(TRANSLATIONS.practice)}
            step={4}
          />
        )}
      </div>

      {/* Tab Content */}
      <div className="p-4 md:p-6 flex-1 overflow-y-auto pb-48 md:pb-40 bg-white dark:bg-slate-900 transition-colors">

        {/* ===== WATCH/LISTEN TAB ===== */}
        {activeTab === 'watch' && (
          <div className="animate-in fade-in space-y-5">
            {/* Enhanced Topic Title */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-lg md:text-xl shrink-0 shadow-lg shadow-blue-600/20">📺</div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl md:text-3xl font-black bg-gradient-to-r from-blue-900 via-indigo-800 to-blue-700 dark:from-blue-300 dark:via-indigo-300 dark:to-blue-200 bg-clip-text text-transparent leading-tight">{t(lesson.title)}</h2>
                <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mt-2"></div>
              </div>
            </div>

            {lesson.textContent ? (
              <div className="space-y-2">
                {lesson.textContent.split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => {
                  const parts = line.split('|');
                  const speakPart = (parts[0] || '').trim();
                  const kannadaPart = (parts[1] || '').trim();
                  const colonIdx = speakPart.indexOf(':');
                  const speaker = colonIdx > -1 ? speakPart.substring(0, colonIdx).trim() : '';
                  const englishText = colonIdx > -1 ? speakPart.substring(colonIdx + 1).trim() : speakPart;
                  
                  // Determine alignment: even = left (coach/interviewer), odd = right (user)
                  const isEven = idx % 2 === 0;
                  
                  return (
                    <div key={idx} className={`flex ${isEven ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[92%] md:max-w-[85%] rounded-2xl p-3.5 md:p-4 border ${
                        isEven 
                          ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-tl-sm' 
                          : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40 rounded-tr-sm'
                      }`}>
                        {speaker && (
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${
                            isEven ? 'text-indigo-600 dark:text-indigo-400' : 'text-blue-600 dark:text-blue-400'
                          }`}>{speaker}</p>
                        )}
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                          {renderBoldText(englishText)}
                        </p>
                        {kannadaPart && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-700/50 leading-relaxed italic">
                            ({kannadaPart})
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                {t(lesson.notes)}
              </p>
            )}

          </div>
        )}

        {/* ===== STUDY TAB ===== */}
        {activeTab === 'study' && (
          <div className="space-y-5 animate-in fade-in h-full flex flex-col">
            {/* PDF Section */}
            {lesson.pdfUrl && (
              <div className="flex-1 flex flex-col gap-3 min-h-[500px]">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital PDF Notes</h4>
                  <div className="flex gap-2">
                    <a href={lesson.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">Open Original</a>
                    <button onClick={() => setIsFullscreenPdf(true)} className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase">Full Screen</button>
                  </div>
                </div>
                <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 relative">
                  <iframe
                    key={lesson.pdfUrl}
                    src={`${lesson.pdfUrl}#toolbar=0&navpanes=0`}
                    className="w-full h-full"
                    title="PDF Notes"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-2 bg-black/50 text-[8px] text-white text-center backdrop-blur-sm">
                    If notes don't load, click "Open Original" above.
                  </div>
                </div>
              </div>
            )}

            {/* Text Content Section (Generated by AI or by URL) */}
            {(lesson.textUrl || studyTextContent) && (
              <div className="space-y-6">
                {studyTextLoading ? (
                  <div className="flex items-center justify-center gap-3 py-12">
                    <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-slate-400 font-bold">Loading study materials...</span>
                  </div>
                ) : studyTextContent ? (
                  (() => {
                    const { sections, vocabulary } = parseStudyContent(studyTextContent);
                    if (sections.length === 0 && vocabulary.length === 0) {
                      // Fallback for older lessons
                      return (
                        <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Study Text</h4>
                            {lesson.textUrl && (
                              <a href={lesson.textUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase">Download TXT</a>
                            )}
                          </div>
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 max-h-[500px] overflow-y-auto leading-relaxed">
                            {renderBoldText(studyTextContent)}
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="space-y-5 max-w-3xl mx-auto">
                        {/* Sections (Cultural & Bridge) — lightweight for low-bandwidth */}
                        {sections.map((sec, idx) => (
                          <div key={idx} className={`bg-gradient-to-br ${sec.color} p-4 md:p-5 rounded-xl border`}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xl">{sec.icon}</span>
                              <h3 className="text-xs font-black uppercase tracking-wider">{sec.title}</h3>
                            </div>
                            <p className="text-sm font-bold leading-relaxed text-slate-700 dark:text-slate-350">
                              {renderBoldText(sec.content)}
                            </p>
                          </div>
                        ))}

                        {/* Vocabulary Section — compact cards */}
                        {vocabulary.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                              <span className="text-lg">📚</span>
                              <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Key Vocabulary</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {vocabulary.map((vocab, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                                  <div className="space-y-2">
                                    <div className="flex items-baseline flex-wrap gap-1.5">
                                      <span className="text-sm font-black text-indigo-900 dark:text-indigo-300">{vocab.word}</span>
                                      {vocab.kannada && (
                                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                          ({vocab.kannada})
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 leading-relaxed">
                                      {vocab.meaning}
                                    </p>
                                  </div>
                                  
                                  {vocab.example && (
                                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/40">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">💬 Example:</p>
                                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800/80">
                                        "{vocab.example}"
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-xs font-medium text-slate-400 italic">
                    Could not load study content. Use the download button above.
                  </div>
                )}
              </div>
            )}

            {/* Fallback if no PDF or Text */}
            {!lesson.pdfUrl && !lesson.textUrl && !studyTextContent && (
              <div className="text-center py-12 text-slate-400">
                <p className="text-4xl mb-4">📄</p>
                <p className="font-bold text-sm">No study materials uploaded for this lesson.</p>
              </div>
            )}
          </div>
        )}

        {/* ===== SPEAK TAB ===== */}
        {
          activeTab === 'speak' && (
            <div className="animate-in fade-in space-y-5">
              {/* Compact Speak Header */}
              <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-950/20 px-4 py-3 rounded-xl border border-purple-200 dark:border-purple-900/30">
                <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white text-lg shrink-0">🎤</div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-purple-800 dark:text-purple-400 uppercase tracking-tight">Reading & Speaking</h3>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Read aloud & record your voice</p>
                </div>
              </div>

              {/* Audio Recorder — ABOVE the reading text */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 border-b border-purple-100 dark:border-purple-900/30">
                  <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest">🎙️ Record Your Reading</h4>
                </div>
                <AudioRecorder onRecordingComplete={handleSpeakRecordingComplete} lessonId={lesson.id} />
                {savingRecording && (
                  <div className="p-3 flex items-center gap-2 justify-center bg-purple-50 dark:bg-purple-900/20">
                    <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-bold text-purple-600">Saving recording...</span>
                  </div>
                )}
              </div>

              {/* Saved Recordings */}
              {savedRecordings.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Your Recordings</h4>
                  {savedRecordings.map((rec, i) => (
                    <audio key={rec.id} src={rec.audio_url} controls className="w-full h-8 mb-1.5" />
                  ))}
                </div>
              )}

              {/* Speak PDF Content */}
              {lesson.speakPdfUrl && (
                <div className="flex flex-col gap-3 min-h-[400px]">
                  <div className="flex justify-between items-center px-1">
                    <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Reading Material (PDF)</h4>
                    <a href={lesson.speakPdfUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase">Open PDF</a>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 relative h-[400px]">
                    <iframe
                      key={lesson.speakPdfUrl}
                      src={`${lesson.speakPdfUrl}#toolbar=0&navpanes=0`}
                      className="w-full h-full"
                      title="Speak PDF"
                    />
                  </div>
                </div>
              )}

              {/* Speak Text Content */}
              {(lesson.speakTextUrl || speakTextContent) && (
                <div className="bg-purple-50/50 dark:bg-slate-800 p-4 rounded-xl border border-purple-200 dark:border-slate-700 space-y-3">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Reading Material (Text)</h4>
                    {lesson.speakTextUrl && (
                      <a href={lesson.speakTextUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-black text-purple-600 bg-purple-50 px-3 py-1 rounded-full uppercase">Download</a>
                    )}
                  </div>
                  
                  {speakTextLoading ? (
                    <div className="flex items-center gap-2 py-4">
                      <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[10px] text-slate-400">Loading content...</span>
                    </div>
                  ) : speakTextData.english ? (
                    <div className="space-y-4">
                      {/* English Text to Read */}
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-900 p-4 rounded-lg border border-purple-100 dark:border-slate-700 max-h-[300px] overflow-y-auto leading-relaxed">
                        <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block mb-2">English Text to Read:</span>
                        {renderBoldText(speakTextData.english)}
                      </div>

                      {/* Kannada Phonetic Guide */}
                      {speakTextData.kannadaPhonetic && (
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-350 whitespace-pre-wrap bg-slate-100 dark:bg-slate-900 p-4 rounded-lg border border-purple-200 dark:border-slate-750 leading-relaxed">
                          <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-450 uppercase tracking-widest block mb-2">Pronunciation Guide (ಕನ್ನಡ ಸಹಾಯ):</span>
                          <p className="text-slate-800 dark:text-slate-200 font-bold">{speakTextData.kannadaPhonetic}</p>
                        </div>
                      )}

                      {/* Transliteration Guide */}
                      {speakTextData.transliteration && (
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-350 whitespace-pre-wrap bg-indigo-50/40 dark:bg-slate-900 p-4 rounded-lg border border-indigo-150 dark:border-slate-700 leading-relaxed">
                          <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-2">Transliteration Guide:</span>
                          <p className="text-slate-800 dark:text-slate-200 font-bold italic">{speakTextData.transliteration}</p>
                        </div>
                      )}

                      {/* Instruction Guide */}
                      {speakTextData.instruction && (
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed italic bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                          ℹ️ {speakTextData.instruction}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-slate-400 italic">
                      Could not load reading content. Use the download button above.
                    </div>
                  )}
                </div>
              )}

              {/* Fallback if no speak content */}
              {!lesson.speakPdfUrl && !lesson.speakTextUrl && !speakTextContent && (
                <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl border-2 border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2">Read the lesson title aloud:</p>
                  <p className="text-xl font-black text-purple-700 dark:text-purple-400">"{t(lesson.title)}"</p>
                </div>
              )}

              {/* Audio Recorder and Saved Recordings are now placed above the reading text */}
            </div>
          )}

        {/* ===== PRACTICE TAB ===== */}
        {
          activeTab === 'practice' && lesson.scenario && (
            <div className="animate-in slide-in-from-bottom-6 h-full pb-10">
              <ScenarioPractice 
                lesson={lesson} 
                onAccuracyChange={setRoleplayAccuracy} 
                onComplete={() => setCompletedStages(prev => ({ ...prev, practice: true }))}
              />
            </div>
          )
        }
      </div >

      {/* Footer Nav */}
      {/* Footer Nav — compact to avoid overlap */}
      <div className="fixed bottom-[68px] md:bottom-0 left-0 right-0 max-w-[720px] mx-auto px-3 py-2.5 md:px-4 md:py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 flex gap-2 md:gap-3 z-[40]">
        {activeTab !== 'watch' && (
          <button
            onClick={() => navigate(-1)}
            disabled={isFinishing}
            className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg font-black text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-widest disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1"
          >
            ← <span className="hidden sm:inline">{t({ en: 'Back', kn: 'ಹಿಂದೆ' })}</span>
          </button>
        )}

        {
          isLastTab ? (
            <button
              onClick={handleComplete}
              disabled={isFinishing}
              className={`flex-[2] py-2.5 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 ${
                completedStages[activeTab] 
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' 
                  : 'bg-slate-700 hover:bg-slate-800'
              }`}
            >
              {isFinishing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <> {t({ en: 'Finish Lesson', kn: 'ಪಾಠ ಮುಗಿಸಿ' })} {completedStages[activeTab] ? '✨' : '⏱️'} </>
              )}
            </button>
          ) : (
            <button
              onClick={goToNextTab}
              className={`flex-[2] py-2.5 text-white rounded-lg font-black text-[10px] uppercase tracking-widest shadow-md transition-colors flex items-center justify-center gap-2 ${
                completedStages[activeTab] 
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700' 
                  : 'bg-slate-700 hover:bg-slate-800'
              }`}
            >
              {t({ en: 'Next Step', kn: 'ಮುಂದಿನ ಹಂತ' })} {completedStages[activeTab] ? '✓' : '→'}
            </button>
          )
        }
      </div>

      {isFullscreenPdf && lesson.pdfUrl && (
        <div className="fixed inset-0 z-[100] bg-black p-4 md:p-8 flex flex-col">
          <button onClick={() => setIsFullscreenPdf(false)} className="self-end mb-4 bg-white/10 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase tracking-widest">Close</button>
          <iframe src={lesson.pdfUrl} className="w-full flex-1 rounded-2xl bg-white" />
        </div>
      )}
    </div >
  );
};

// ===== Sub-Components =====

const StaticTitlePanel: React.FC<{ title: string; subtitle: string; icon?: string }> = ({ title, subtitle, icon = '📺' }) => (
  <div className="p-6 md:p-8 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-slate-900 to-blue-950 relative overflow-hidden min-h-[140px]">
    <div className="absolute top-[-10%] right-[-10%] w-48 h-48 bg-blue-600/10 rounded-full blur-3xl"></div>
    <div className="absolute bottom-[-10%] left-[-10%] w-36 h-36 bg-purple-600/10 rounded-full blur-3xl"></div>
    <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-xl backdrop-blur-md shrink-0">
      <span className="text-2xl">{icon}</span>
    </div>
    <div className="text-center space-y-1 relative z-10 px-4">
      <h2 className="text-white text-lg font-black tracking-tight leading-tight">{title}</h2>
      <p className="text-blue-400/80 font-black text-[9px] uppercase tracking-[0.3em]">{subtitle}</p>
    </div>
  </div>
);

const TabButton: React.FC<{ active: boolean; label: string; onClick: () => void; badge?: string; step?: number }> = ({ active, label, onClick, badge, step }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-4 px-4 text-[10px] font-black uppercase tracking-widest transition-all border-b-4 whitespace-nowrap relative ${active ? 'text-blue-700 dark:text-blue-400 border-blue-700 dark:border-blue-400 bg-white dark:bg-slate-900' : 'text-slate-400 border-transparent hover:text-slate-600'
      }`}
  >
    {step && <span className="text-[8px] mr-1 opacity-50">{step}.</span>}
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
    } catch (e) {
      console.error("Speak error:", e);
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={handleSpeak}
      className={`${small ? 'p-1' : 'p-2'} rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-all active:scale-95`}
    >
      {loading ? (
        <div className={`${small ? 'w-4 h-4' : 'w-5 h-5'} border-2 border-blue-600 border-t-transparent rounded-full animate-spin`}></div>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={small ? "w-4 h-4" : "w-5 h-5"}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" />
        </svg>
      )}
    </button>
  );
};

export default LessonView;
