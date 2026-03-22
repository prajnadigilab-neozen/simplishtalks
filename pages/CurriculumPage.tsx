/** V 1.0 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { CourseLevel, LevelStatus, PackageType, UserRole } from '../types';
import { TRANSLATIONS } from '../constants';
import { useNotificationStore } from '../store/useNotificationStore';
import { CreateCustomScenarioModal } from '../components/CreateCustomScenarioModal';

const CurriculumPage: React.FC = () => {
  const { session, modules, scenarios, scenarioSaves, progress, loading, setCurrentScenario, fetchScenarioSaves, setClearChatRequested } = useAppStore();
  const { showSuccess, showError } = useNotificationStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    fetchScenarioSaves();
  }, []);

  const isTalksActive = session?.packageType === PackageType.TALKS || session?.packageType === PackageType.BOTH || session?.role !== UserRole.STUDENT;
  const isSnehiActive = session?.packageType === PackageType.SNEHI || session?.packageType === PackageType.BOTH || session?.role !== UserRole.STUDENT;

  const [activeTab, setActiveTab] = useState<'talks' | 'snehi'>(
    (location.state as any)?.activeTab || (isTalksActive ? 'talks' : 'snehi')
  );
  const [selectedLevel, setSelectedLevel] = React.useState<CourseLevel>(CourseLevel.BASIC);
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Filter modules/scenarios
  const modulesWithLessons = modules.filter(m => m.lessons && m.lessons.length > 0);
  const levelModules = modulesWithLessons.filter(m => m.level === selectedLevel);

  const filteredScenarios = scenarios.filter(s =>
    s.level === selectedLevel && (selectedCategory === 'all' || s.category.en === selectedCategory)
  );

  const getSavesForScenario = (scenarioId: string) => {
    return (scenarioSaves || []).filter((s: any) => s.scenario_id === scenarioId).slice(0, 3);
  };

  const downloadSavedChat = (chatHistory: any[], filename: string) => {
    if (!chatHistory || chatHistory.length === 0) return;
    const textContent = chatHistory.map((m: any) => {
      let line = `${m.role.toUpperCase()}: ${m.text}`;
      if (m.correction) line += `\nCorrection: ${m.correction}`;
      if (m.kannadaGuide) line += `\nKannada Guide: ${m.kannadaGuide}`;
      if (m.pronunciationTip) line += `\nPronunciation Tip: ${m.pronunciationTip}`;
      line += `\nTimestamp: ${new Date(m.timestamp).toLocaleString()}\n`;
      return line;
    }).join('\n---\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showSuccess(t({ en: 'Chat Downloaded', kn: 'ಚಾಟ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಲಾಗಿದೆ' }), `${filename}.txt`);
  };

  const [downloadingAudioId, setDownloadingAudioId] = useState<string | null>(null);

  const downloadAudioFile = async (url: string, filename: string, id: string) => {
    try {
      setDownloadingAudioId(id);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      showSuccess(t({ en: 'Audio Downloaded', kn: 'ಆಡಿಯೋ ಡೌನ್‌ಲೋಡ್ ಮಾಡಲಾಗಿದೆ' }), filename);
    } catch (err) {
      console.error("Failed to download audio:", err);
      showError(t({ en: 'Download Failed', kn: 'ಡೌನ್‌ಲೋಡ್ ವಿಫಲವಾಗಿದೆ' }));
      // Fallback: Just open the URL in a new tab if fetch fails due to CORS or other issues
      window.open(url, '_blank');
    } finally {
      setDownloadingAudioId(null);
    }
  };

  const categories = Array.from(new Set(scenarios.filter(s => s.level === selectedLevel).map(s => s.category.en)));
  const levels = [CourseLevel.BASIC, CourseLevel.INTERMEDIATE, CourseLevel.ADVANCED, CourseLevel.EXPERT, CourseLevel.CUSTOM];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 font-outfit">
      <header className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-blue-900 dark:text-white uppercase tracking-tighter">
          {t(TRANSLATIONS.curriculum)}
        </h1>
        {isTalksActive && isSnehiActive && (
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => setActiveTab('talks')}
              className={`px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'talks'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-600 border-2 border-slate-50 dark:border-slate-700'
                }`}
            >
              SIMPLISH-TALKS
            </button>
            <button
              onClick={() => setActiveTab('snehi')}
              className={`px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'snehi'
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-600 border-2 border-slate-50 dark:border-slate-700'
                }`}
            >
              SIMPLISH-SNEHI
            </button>
          </div>
        )}
      </header>

      {/* Hierarchy Selectors */}
      <div className="flex flex-wrap justify-center gap-4 py-4 bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] border-2 border-slate-50 dark:border-slate-800">
        <div className="flex flex-wrap justify-center gap-2">
          {levels.map(l => (
            <button
              key={l}
              onClick={() => { setSelectedLevel(l); setSelectedCategory('all'); }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedLevel === l
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              {t(TRANSLATIONS[l.toLowerCase()])}
            </button>
          ))}
        </div>

        {activeTab === 'snehi' && categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 border-l-2 border-slate-200 dark:border-slate-800 pl-4 ml-4">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === 'all'
                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
            >
              {t({ en: 'All Categories', kn: 'ಎಲ್ಲಾ ವರ್ಗಗಳು' })}
            </button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCategory === c
                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-12 animate-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'talks' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {levelModules.map((module) => (
              <div
                key={module.id}
                className={`group bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 transition-all p-8 relative overflow-hidden ${module.status === LevelStatus.LOCKED
                  ? 'border-slate-100 dark:border-slate-800 opacity-60 grayscale'
                  : 'border-blue-50 dark:border-slate-700 shadow-xl hover:shadow-2xl hover:-translate-y-1'
                  }`}
              >
                <div className="relative z-10 space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                        {t(module.title)}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                        {t(module.description)}
                      </p>
                    </div>
                    {module.status === LevelStatus.COMPLETED && (
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 p-2 rounded-2xl text-xl">✅</span>
                    )}
                    {module.status === LevelStatus.LOCKED && <span className="text-2xl grayscale">🔒</span>}
                  </div>

                  <div className="space-y-3">
                    {module.lessons.map((lesson, idx) => {
                      const isCompleted = progress?.completedLessons.includes(lesson.id);
                      return (
                        <div
                          key={lesson.id}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${isCompleted ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${isCompleted ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                              }`}>
                              {idx + 1}
                            </span>
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300">{t(lesson.title)}</span>
                          </div>
                          {module.status !== LevelStatus.LOCKED && (
                            <button
                              onClick={() => navigate(`/lesson/${lesson.id}`)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isCompleted ? 'text-blue-600 hover:bg-blue-100' : 'bg-blue-600 text-white hover:bg-black'
                                }`}
                            >
                              {isCompleted ? t(TRANSLATIONS.revise) : t(TRANSLATIONS.startLearning)}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800/80 dark:to-slate-900 border border-indigo-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                <div className="flex-shrink-0 bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                  <div className="flex gap-2">
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800/30">
                      <span className="text-[8px] text-blue-500/80 mb-[-2px] uppercase font-black">P</span><span className="text-xs font-black">10</span>
                    </div>
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/30">
                      <span className="text-[8px] text-emerald-500/80 mb-[-2px] uppercase font-black">F</span><span className="text-xs font-black">10</span>
                    </div>
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800/30">
                      <span className="text-[8px] text-purple-500/80 mb-[-2px] uppercase font-black">C</span><span className="text-xs font-black">10</span>
                    </div>
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800/30">
                      <span className="text-[8px] text-amber-500/80 mb-[-2px] uppercase font-black">A</span><span className="text-xs font-black">10</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3 lg:space-y-2">
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                    <span className="underline decoration-indigo-300 dark:decoration-indigo-600 decoration-2 underline-offset-4">
                      {t({ en: 'AI Evaluation Scorecard', kn: 'AI ಮೌಲ್ಯಮಾಪನ ಸ್ಕೋರ್‌ಕಾರ್ಡ್' })}
                    </span>
                    <span className="ml-2 text-[10px] text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {t({ en: 'Out of 10 Pts', kn: '10 ಅಂಕಗಳಿಗೆ' })}
                    </span>
                  </h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    <p><strong className="text-blue-700 dark:text-blue-400">P (Pronunciation):</strong> Focuses on the "Target Sounds" defined (e.g., TH, V vs W, P/B).</p>
                    <p><strong className="text-emerald-700 dark:text-emerald-400">F (Flow & Reduction):</strong> Did You use "gonna/wanna"? Was the rhythm natural or robotic?</p>
                    <p><strong className="text-purple-700 dark:text-purple-400">C (Confidence):</strong> Measured by response latency (how long they took to start speaking) and filler word count (um, uh).</p>
                    <p><strong className="text-amber-700 dark:text-amber-400">A (Accuracy):</strong> Did you use the correct tense (e.g., Past Tense).</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Custom Scenarios Ribbon */}
            {(Object.is(selectedCategory, 'all') || scenarios.some(s => s.level === CourseLevel.CUSTOM)) && (
              <div className="mb-10">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span>{t({ en: 'Your Custom Scenarios', kn: 'ನಿಮ್ಮ ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶಗಳು' })}</span>
                  {scenarios.some(s => s.level === CourseLevel.CUSTOM) && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-0 md:px-0 no-scrollbar">
                  
                  {/* Create Custom Scenario Card */}
                  {Object.is(selectedCategory, 'all') && (
                    <div
                      onClick={() => setIsCustomModalOpen(true)}
                      className="min-w-[210px] md:min-w-[280px] flex-shrink-0 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 transition-all group min-h-[250px]"
                    >
                      <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      </div>
                      <h3 className="text-base md:text-lg font-black text-slate-700 dark:text-slate-300">
                        {t({ en: 'Create Custom Scenario', kn: 'ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶವನ್ನು ರಚಿಸಿ' })}
                      </h3>
                      <p className="text-[10px] md:text-xs text-slate-500 mt-2 font-medium px-2">
                        {t({ en: 'Provide your context and AI will build the practice', kn: 'ನಿಮ್ಮ ಸನ್ನಿವೇಶ ಒದಗಿಸಿ ಮತ್ತು AI ನಿಮಗಾಗಿ ಅಭ್ಯಾಸವನ್ನು ನಿರ್ಮಿಸಲು ಬಿಡಿ' })}
                      </p>
                    </div>
                  )}

                  {scenarios.filter(s => s.level === CourseLevel.CUSTOM).reverse().map((s) => {
                    const scenarioSavesForId = getSavesForScenario(s.id);
                    return (
                      <div
                        key={s.id}
                        className="min-w-[210px] md:min-w-[280px] flex-shrink-0 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[8px] font-black uppercase tracking-widest rounded-lg">
                            {s.category.en}
                          </span>
                          <span className="text-xs group-hover:scale-125 transition-transform">🎙️</span>
                        </div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-white line-clamp-2 leading-snug mb-4">
                          {t(s.title)}
                        </h4>
                        
                        <div className="flex-1">
                          {/* Saved Revisions List (Mini Scorecard) */}
                          {scenarioSavesForId && scenarioSavesForId.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 space-y-3">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex justify-between px-1">
                                <span>{t({ en: 'Recent Revisions', kn: 'ಇತ್ತೀಚಿನ ಪರಿಷ್ಕರಣೆಗಳು' })}</span>
                                <span className="text-blue-500 font-bold">New</span>
                              </p>
                              <div className="space-y-2">
                                {scenarioSavesForId.slice(0, 2).map((save: any, idx: number) => (
                                  <div key={save.id} className="group/rev flex items-center justify-between p-2.5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-slate-800 transition-all">
                                    <div className="flex flex-col min-w-[45px]">
                                       <span className="text-[9px] font-black text-slate-800 dark:text-white uppercase leading-none">R{scenarioSavesForId.length - idx}</span>
                                       <span className="text-[7px] text-slate-400 font-bold mt-0.5">{new Date(save.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 px-1">
                                      {save.p_score != null && (
                                        <div className="flex gap-0.5 items-center">
                                          <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center border border-blue-100/50">
                                            <span className="text-[7px] font-black">{save.p_score}</span>
                                          </div>
                                          <div className="w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center border border-emerald-100/50">
                                            <span className="text-[7px] font-black">{save.f_score}</span>
                                          </div>
                                          <div className="w-4 h-4 rounded-full bg-purple-50 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center border border-purple-100/50">
                                            <span className="text-[7px] font-black">{save.c_score}</span>
                                          </div>
                                          <div className="w-4 h-4 rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center border border-amber-100/50">
                                            <span className="text-[7px] font-black">{save.a_score}</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex gap-1">
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); downloadSavedChat(save.chat_history, `Simplish-Talk-${t(s.title)}-${new Date(save.created_at).toLocaleDateString()}`); }}
                                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                      </button>
                                      {save.audio_url && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); downloadAudioFile(save.audio_url, `Simplish-Talk-${t(s.title)}-${new Date(save.created_at).toLocaleDateString()}`, save.id); }}
                                          className="p-1 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 transition-all"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" /></svg>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="mt-auto pt-4">
                          <button
                            onClick={() => {
                              setClearChatRequested(true);
                              setCurrentScenario(s.id);
                              navigate('/talk');
                            }}
                            className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-blue-700 transition-all active:scale-95"
                          >
                            {t({ en: 'Start Practice', kn: 'ಅಭ್ಯಾಸ ಪ್ರಾರಂಭಿಸಿ' })}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredScenarios.map((scenario) => {
                // Filter out custom scenarios from standard grid
                if (scenario.level === CourseLevel.CUSTOM) return null;
                const isCompleted = progress?.completedScenarios.includes(scenario.id);
                const scenarioSavesForId = getSavesForScenario(scenario.id);
                return (
                  <div
                    key={scenario.id}
                    className="bg-white dark:bg-slate-800 rounded-[2rem] border-2 border-slate-50 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group flex flex-col h-full"
                  >
                    <div className="mb-4 flex justify-between items-start">
                      <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[8px] font-black uppercase tracking-widest rounded-lg">
                        {scenario.category.en}
                      </span>
                      {isCompleted && <span className="text-green-500 text-lg">✅</span>}
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-blue-600 transition-colors">
                      {t(scenario.title)}
                    </h3>

                    <div className="flex-1">
                      {/* Saved Revisions List - Moved above the button and made more sleek */}
                      {scenarioSavesForId && scenarioSavesForId.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 space-y-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                            {t({ en: 'Recent Revisions', kn: 'ಇತ್ತೀಚಿನ ಪರಿಷ್ಕರಣೆಗಳು' })}
                          </p>
                          <div className="space-y-2">
                            {scenarioSavesForId.slice(0, 2).map((save, idx) => (
                              <div key={save.id} className="group/rev flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all">
                                <div className="flex flex-col min-w-[50px]">
                                   <span className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase leading-none">R{scenarioSavesForId.length - idx}</span>
                                   <span className="text-[8px] font-bold text-slate-400 mt-0.5">{new Date(save.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                </div>

                                <div className="flex items-center gap-1.5 px-2 flex-1">
                                  {save.p_score != null && (
                                    <div className="flex gap-1 items-center" title={save.evaluation_feedback || 'AI Evaluation'}>
                                      <div className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center border border-blue-100/50 dark:border-blue-800/20">
                                        <span className="text-[8px] font-black">{save.p_score}</span>
                                      </div>
                                      <div className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center border border-emerald-100/50 dark:border-emerald-800/20">
                                        <span className="text-[8px] font-black">{save.f_score}</span>
                                      </div>
                                      <div className="w-5 h-5 rounded-full bg-purple-50 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center border border-purple-100/50 dark:border-purple-800/20">
                                        <span className="text-[8px] font-black">{save.c_score}</span>
                                      </div>
                                      <div className="w-5 h-5 rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center border border-amber-100/50 dark:border-amber-800/20">
                                        <span className="text-[8px] font-black">{save.a_score}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); downloadSavedChat(save.chat_history, `Chat_${scenario.id}_Rev${scenarioSavesForId.length - idx}`); }}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                                    title="Download Chat"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                  </button>
                                  {save.audio_url && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); downloadAudioFile(save.audio_url, `Audio_${scenario.id}_Rev${scenarioSavesForId.length - idx}.webm`, save.id); }}
                                      disabled={downloadingAudioId === save.id}
                                      className={`p-1.5 rounded-lg transition-all ${downloadingAudioId === save.id ? 'opacity-50' : 'text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30'}`}
                                      title="Download Audio"
                                    >
                                      {downloadingAudioId === save.id ? (
                                        <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                      ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.59-.707-1.59-1.59V9.84c0-.88.71-1.59 1.59-1.59h2.24Z" /></svg>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-6">
                      <button
                        onClick={() => {
                          setClearChatRequested(true);
                          setCurrentScenario(scenario.id);
                          navigate('/talk');
                        }}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95"
                      >
                        {isCompleted ? t({ en: 'Practice Again', kn: 'ಮತ್ತೆ ಅಭ್ಯಾಸ ಮಾಡಿ' }) : t({ en: 'Start Practice', kn: 'ಅಭ್ಯಾಸ ಪ್ರಾರಂಭಿಸಿ' })}
                      </button>
                    </div>
                  </div>
                );
              })}
              {filteredScenarios.length === 0 && (
                <div className="col-span-full py-20 text-center space-y-4">
                  <span className="text-4xl block">✨</span>
                  <p className="text-slate-400 font-bold tracking-tight">
                    {t({ en: 'No scenarios found for this criteria.', kn: 'ಈ ಮಾನದಂಡಕ್ಕೆ ಯಾವುದೇ ಸನ್ನಿವೇಶಗಳು ಕಂಡುಬಂದಿಲ್ಲ.' })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <CreateCustomScenarioModal isOpen={isCustomModalOpen} onClose={() => setIsCustomModalOpen(false)} />
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&display=swap" rel="stylesheet" />
    </div>
  );
};

export default CurriculumPage;
