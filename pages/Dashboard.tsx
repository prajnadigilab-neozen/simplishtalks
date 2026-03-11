import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { Module, LevelStatus, PackageType, CourseLevel, PackageStatus, UserRole } from '../types';

import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const { session, modules, progress, evaluationHistory, loading, initialized } = useAppStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [voiceHistory, setVoiceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (session?.id && session.packageType === PackageType.SNEHI) {
      const fetchVoiceHistory = async () => {
        setLoadingHistory(true);
        try {
          const { getChatHistory } = await import('../services/coachService');
          const history = await getChatHistory(session.id, undefined, 'voice');
          setVoiceHistory(history.filter(m => m.role === 'coach').slice(-5).reverse());
        } catch (err) {
          console.error("Failed to fetch voice history:", err);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchVoiceHistory();
    }
  }, [session?.id, session?.packageType]);

  // Unified Header Component
  const UnifiedHeader = () => (
    <div className="flex justify-between items-center mb-10 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-20 py-4 border-b border-slate-100 dark:border-slate-800 -mx-4 px-4 md:-mx-8 md:px-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg rotate-3 group overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
          🎓
        </div>
        <div className="cursor-pointer" onClick={() => navigate('/dashboard')}>
          <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white leading-tight">
            {t({ en: 'Namma Simplish', kn: 'ನಮ್ಮ ಸಿಂಪ್ಲಿಷ್' })}
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            {session?.name || t({ en: 'Student', kn: 'ವಿದ್ಯಾರ್ಥಿ' })}
          </p>
        </div>
      </div>

      {/* Navigation Switcher */}
      {session?.packageType !== PackageType.NONE && (
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => navigate('/dashboard')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(!window.location.pathname.includes('/talk') && (session?.packageType === PackageType.TALKS || session?.packageType === PackageType.BOTH)) ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {t({ en: 'Study Lessons', kn: 'ಪಾಠಗಳು' })}
          </button>
          <button
            onClick={() => navigate('/talk')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${(window.location.pathname.includes('/talk') && (session?.packageType === PackageType.SNEHI || session?.packageType === PackageType.BOTH)) ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            {t({ en: 'Voice Practice', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸ' })}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 md:gap-4">
        {session?.packageType !== PackageType.NONE && (
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{t({ en: 'Weekly Streak', kn: 'ವಾರದ ಸರಣಿ' })}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5, 6, 7].map(d => (
                <div key={d} className={`w-1.5 h-1.5 rounded-full ${d <= (session?.streakCount || 0) ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={() => navigate('/settings')}
          className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
        >
          ⚙️
        </button>
      </div>
    </div>
  );

  // Statistics Grid Component
  const StatsGrid = ({ type }: { type: 'TALKS' | 'AGENT' }) => {
    const stats = type === 'TALKS' ? [
      { label: t({ en: 'Daily Streak', kn: 'ದೈನಂದಿನ ಸರಣಿ' }), value: `${session?.streakCount || 0}`, icon: '🔥', color: 'text-orange-500' },
      { label: t({ en: 'Messages', kn: 'ಸಂದೇಶಗಳು' }), value: `${session?.totalMessagesSent || 0}`, icon: '💬', color: 'text-blue-500' },
      { label: t({ en: 'Progress', kn: 'ಪ್ರಗತಿ' }), value: `${progressPercentage}%`, icon: '📈', color: 'text-green-500' },
    ] : [
      { label: t({ en: 'Active Streak', kn: 'ಸಕ್ರಿಯ ಸರಣಿ' }), value: `${session?.streakCount || 0}`, icon: '🔥', color: 'text-orange-500' },
      { label: t({ en: 'Talk Time', kn: 'ಮಾತನಾಡುವ ಸಮಯ' }), value: `${Math.floor((session?.totalTalkTime || 0) / 60)}${t({ en: 'm', kn: 'ನಿ' })}`, icon: '🎙️', color: 'text-purple-500' },
      { label: t({ en: 'Credits Left', kn: 'ಬಾಕಿ ಕ್ರೆಡಿಟ್ಸ್' }), value: `${session?.agentCredits || 0}`, icon: '🪙', color: 'text-amber-500' },
    ];

    return (
      <div className="grid grid-cols-3 gap-3 md:gap-6 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-800/50 p-3 md:p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <div className="text-xl md:text-3xl mb-1 md:mb-2">{s.icon}</div>
            <div className={`text-base md:text-2xl font-black ${s.color} leading-none mb-1`}>{s.value}</div>
            <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const totalLessons = modules.reduce((acc, mod) => acc + mod.lessons.length, 0);
  const completedLessons = modules.reduce((acc, mod) =>
    acc + mod.lessons.filter(l => l.isCompleted).length, 0
  );
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const getSmartRedirectPath = () => {
    if (session?.packageType === PackageType.SNEHI) return '/talk';

    // Filter modules based on user's current level
    const currentLevel = progress?.currentLevel || CourseLevel.BASIC;
    const levelModules = modules.filter(m => m.level === currentLevel);

    if (levelModules.length === 0) {
      console.warn(`No modules found for level: ${currentLevel}`);
      return '/dashboard';
    }

    // Find first uncompleted lesson in the user's current level
    for (const module of levelModules) {
      const firstUncompleted = (module.lessons || []).find(l => !l.isCompleted);
      if (firstUncompleted) return `/lesson/${firstUncompleted.id}`;
    }

    // If all current level lessons completed, return the first one for review
    const firstLessonId = levelModules[0]?.lessons?.[0]?.id;
    if (!firstLessonId) {
      console.warn("No lessons found in modules.");
      return '/dashboard';
    }
    return `/lesson/${firstLessonId}`;
  };

  // Handle Package Activation (Navigate to Payment)
  const handleActivatePackage = (selectedPackage: PackageType) => {
    if (!session?.id) return;
    navigate(`/payment?package=${selectedPackage}`);
  };

  // 1. Don't redirect while still loading session data
  useEffect(() => {
    if (initialized && !loading && (!session?.packageType || session.packageType === PackageType.NONE)) {
      navigate('/packages', { replace: true });
    }
  }, [session?.packageType, loading, initialized, navigate]);


  // Show nothing while loading or if no package
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session?.packageType || session.packageType === PackageType.NONE) {
    return null;
  }

  const isTalksActive = session.packageType === PackageType.TALKS || session.packageType === PackageType.BOTH;
  const isSnehiActive = session.packageType === PackageType.SNEHI || session.packageType === PackageType.BOTH;
  const isBoth = session.packageType === PackageType.BOTH;

  // 2. Active Dashboard (Unified)
  return (
    <div className="p-4 md:p-8 bg-[#F8FAFC] dark:bg-slate-950 min-h-full transition-all animate-in fade-in duration-700">
      <div className="flex justify-between items-center mb-10 sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl z-20 py-4 border-b border-slate-100 dark:border-slate-800 -mx-4 px-4 md:-mx-8 md:px-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg rotate-3 group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
            🎓
          </div>
          <div>
            <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white leading-tight">{t({ en: 'Namma Simplish', kn: 'ನಮ್ಮ ಸಿಂಪ್ಲಿಷ್' })}</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{session.name || t({ en: 'Student', kn: 'ವಿದ್ಯಾರ್ಥಿ' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {isBoth ? (
            <button
              onClick={() => navigate('/talk')}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-all border border-orange-200/50 dark:border-orange-800/50"
            >
              <span>{t({ en: 'Voice Practice', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸ' })}</span>
              <span className="text-xs">🎙️</span>
            </button>
          ) : (
            <button
              disabled
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-slate-200 dark:border-slate-700 opacity-60"
            >
              <span>{t({ 
                en: `Switch to ${session.packageType === PackageType.TALKS ? 'Voice Area' : 'Study Lessons'}`, 
                kn: `${session.packageType === PackageType.TALKS ? 'ಧ್ವನಿ ಪ್ರದೇಶ' : 'ಪಾಠಗಳಿಗೆ'} ಬದಲಿಸಿ` 
              })}</span>
              <span className="text-xs">🔒</span>
            </button>
          )}
          <div className="flex flex-col items-center px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">🔥 {t({ en: 'Streak', kn: 'ಸರಣಿ' })}</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">{session.streakCount || 0} {t({ en: 'Days', kn: 'ದಿನಗಳು' })}</span>
          </div>
          <button onClick={() => navigate('/settings')} className="p-2 md:p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all text-xl">⚙️</button>
        </div>
      </div>

      <div className="mb-10 text-center md:text-left relative">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-6">
          {session.packageType === PackageType.TALKS 
            ? t({ en: 'Your Learning Dashboard', kn: 'ನಿಮ್ಮ ಕಲಿಕೆಯ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' }) 
            : (isBoth ? t({ en: 'Your Supercharged Hub', kn: 'ನಿಮ್ಮ ಸೂಪರ್ ಹಬ್' }) : t({ en: 'Your Voice Practice Hub', kn: 'ನಿಮ್ಮ ಧ್ವನಿ ಅಭ್ಯಾಸ ಕೇಂದ್ರ' }))} {isTalksActive ? '📚' : '🎙️'}
        </h1>

        {!isBoth && (
          <div className="absolute top-0 right-0 hidden md:block">
            <button onClick={() => navigate('/packages')} className="px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-all shadow-sm">
              {t({ en: 'Upgrade Path ✨', kn: 'ಹೊಸ ಫೀಚರ್ ಪಡೆಯಿರಿ ✨' })}
            </button>
          </div>
        )}

        {/* Package Selection Area (Showing Both, Greyed out Inactive) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 overflow-hidden">
          <div className={`transition-all duration-500 ${!isTalksActive ? 'opacity-40 grayscale pointer-events-none scale-[0.98]' : 'scale-100'}`}>
            <PackageCardCompact type={PackageType.TALKS} isActive={isTalksActive}>
              {isTalksActive && (
                <button
                  onClick={() => {
                    const path = getSmartRedirectPath();
                    if (path === '/dashboard') {
                      alert(t({
                        en: 'No lessons found for your level yet. Please check back later!',
                        kn: 'ನಿಮ್ಮ ಹಂತಕ್ಕೆ ಇನ್ನು ಯಾವುದೇ ಪಾಠಗಳು ಕಂಡುಬಂದಿಲ್ಲ. ದಯವಿಟ್ಟು ನಂತರ ಪರಿಶೀಲಿಸಿ!'
                      }));
                    } else {
                      navigate(path);
                    }
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                >
                  {completedLessons === 0 ? t({ en: 'Go to Talks', kn: 'ಪಾಠಗಳಿಗೆ ಹೋಗಿ' }) : t({ en: 'Continue Talks', kn: 'ಕಲಿಕೆ ಮುಂದುವರಿಸಿ' })}
                </button>
              )}
            </PackageCardCompact>
          </div>
          <div className={`transition-all duration-500 ${!isSnehiActive ? 'opacity-40 grayscale pointer-events-none scale-[0.98]' : 'scale-100'}`}>
            <PackageCardCompact type={PackageType.SNEHI} isActive={isSnehiActive}>
              {isSnehiActive && (
                <button
                  onClick={() => navigate('/talk')}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg active:scale-95"
                >
                  {t({ en: 'Go to SNEHI', kn: 'ಸ್ನೇಹಿಗೆ ಹೋಗಿ' })}
                </button>
              )}
            </PackageCardCompact>
          </div>
        </div>

        {!isBoth && (
          <div className="md:hidden flex justify-center w-full mb-8">
            <button onClick={() => navigate('/packages')} className="w-full px-4 py-3 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm">
              {t({ en: 'Upgrade Path ✨', kn: 'ಹೊಸ ಫೀಚರ್ ಪಡೆಯಿರಿ ✨' })}
            </button>
          </div>
        )}

        <StatsGrid type={!isTalksActive ? "AGENT" : "TALKS"} />
      </div>

      {/* Package Summary & Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        {/* Active Package Info */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700"></div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">{t({ en: 'Active Subscription', kn: 'ಸಕ್ರಿಯ ಸದಸ್ಯತ್ವ' })}</h3>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-4">
                {isBoth ? t({ en: 'SIMPLISH - TALKS & Simplish SNEHI', kn: 'ಸಿಂಪ್ಲಿಷ್ - ಟಾಕ್ಸ್ ಮತ್ತು ಸ್ನೇಹಿ' }) : (isTalksActive ? t({ en: 'SIMPLISH - TALKS', kn: 'ಸಿಂಪ್ಲಿಷ್ - ಟಾಕ್ಸ್' }) : t({ en: 'Simplish SNEHI', kn: 'ಸಿಂಪ್ಲಿಷ್ ಸ್ನೇಹಿ' }))}
              </h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase">{t({ en: 'Started:', kn: 'ಪ್ರಾರಂಭ:' })}</span>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    {session.packageStartDate ? new Date(session.packageStartDate).toLocaleDateString() : t({ en: 'N/A', kn: 'ಲಭ್ಯವಿಲ್ಲ' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase">{t({ en: 'Expires:', kn: 'ಮುಕ್ತಾಯ:' })}</span>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    {session.packageEndDate ? new Date(session.packageEndDate).toLocaleDateString() : t({ en: 'N/A', kn: 'ಲಭ್ಯವಿಲ್ಲ' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">{t({ en: 'Messages', kn: 'ಸಂದೇಶಗಳು' })}</div>
                <div className="text-xl font-black text-blue-600 dark:text-blue-300">{session.totalMessagesSent || 0}</div>
              </div>
              <div className="text-center px-4 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
                <div className="text-xl font-black text-orange-600 dark:text-orange-300">{Math.round((session.totalTalkTime || 0) / 60)}{t({ en: 'm', kn: 'ನಿ' })}</div>
                <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">{t({ en: 'Talk Time', kn: 'ಮಾತನಾಡುವ ಸಮಯ' })}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions / Progress */}
        <div className={`${!isTalksActive ? 'bg-orange-600 shadow-orange-500/20' : 'bg-blue-600 shadow-blue-500/20'} rounded-[2rem] p-8 text-white shadow-xl flex flex-col justify-between`}>
          <div>
            <h3 className={`${!isTalksActive ? 'text-orange-200' : 'text-blue-200'} text-[10px] font-black uppercase tracking-widest mb-4`}>
              {!isTalksActive ? t({ en: 'Voice Assistant', kn: 'ಧ್ವನಿ ಸಹಾಯಕ' }) : t({ en: 'Overall Completion', kn: 'ಒಟ್ಟು ಕಲಿಕೆ' })}
            </h3>
            {isTalksActive ? (
              <>
                <div className="text-4xl font-black mb-2">{progressPercentage}%</div>
                <div className={`h-1.5 ${!isTalksActive ? 'bg-orange-800' : 'bg-blue-800'} rounded-full overflow-hidden`}>
                  <div className="h-full bg-white" style={{ width: `${progressPercentage}%` }}></div>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl font-black mb-2 flex items-center gap-3">
                  🎙️
                </div>
                <p className="text-sm font-bold text-orange-100">{t({ en: 'Ready to start speaking?', kn: 'ಮಾತನಾಡಲು ಸಿದ್ಧರಿದ್ದೀರಾ?' })}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Tabs (Curriculum vs History) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Curriculum Preview */}
        {isTalksActive && (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{t({ en: 'Curriculum Preview', kn: 'ಪಠ್ಯಕ್ರಮದ ಅವಲೋಕನ' })}</h3>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{progress?.currentLevel || 'BASIC'} {t({ en: 'Level', kn: 'ಹಂತ' })}</span>
            </div>

            <div className="space-y-3">
              {(modules.find(m => m.level === (progress?.currentLevel || CourseLevel.BASIC))?.lessons?.slice(0, 5) || []).map((l, i) => {
                const isCompleted = progress?.completedLessons.includes(l.id);
                return (
                  <div key={l.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${isCompleted ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                      {isCompleted ? '✓' : i + 1}
                    </div>
                    <div className="flex-1">
                      <div className={`text-xs font-black ${isCompleted ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{l.title.en}</div>
                      <div className="text-[10px] font-bold text-slate-400">{l.title.kn}</div>
                    </div>
                    {!isCompleted && i === 0 && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-lg text-[8px] font-black uppercase">{t({ en: 'Next', kn: 'ಮುಂದಿನದು' })}</span>
                    )}
                  </div>
                );
              })}
              {progressPercentage < 100 && (
                <button
                  onClick={() => navigate(getSmartRedirectPath())}
                  className="w-full py-3 mt-4 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                >
                  {t({ en: 'Keep Practicing To Unlock More →', kn: 'ಹೆಚ್ಚು ಅನ್ಲಾಕ್ ಮಾಡಲು ಅಭ್ಯಾಸ ಮುಂದುವರಿಸಿ →' })}
                </button>
              )}
            </div>
          </div>
        )}

        {/* AI Evaluation & Retake */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{t({ en: 'AI Evaluation Score 📈', kn: 'AI ಮೌಲ್ಯಮಾಪನ ಅಂಕಗಳು 📈' })}</h3>
            <button
              onClick={() => navigate('/placement')}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-100 dark:border-blue-800 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>{t({ en: 'Retake Test', kn: 'ಮತ್ತೆ ಪರೀಕ್ಷೆ ನೀಡಿ' })}</span>
              <span className="text-xs">🔄</span>
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {evaluationHistory.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
                <span className="text-4xl mb-4">🧠</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-center">
                  {t({ 
                    en: 'No evaluation data yet. Take the test to see your level!', 
                    kn: 'ಇನ್ನೂ ಯಾವುದೇ ಮೌಲ್ಯಮಾಪನ ಡೇಟಾ ಇಲ್ಲ. ನಿಮ್ಮ ಹಂತವನ್ನು ತಿಳಿಯಲು ಪರೀಕ್ಷೆ ತೆಗೆದುಕೊಳ್ಳಿ!' 
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Latest Score Card */}
                {evaluationHistory[0] && (
                  <div className="p-5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl text-white shadow-lg relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 text-6xl opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">🎯</div>
                    <div className="relative z-10">
                      <div className="text-[9px] font-black uppercase tracking-widest opacity-80 mb-2">{t({ en: 'Current Proficiency Level', kn: 'ಪ್ರಸ್ತುತ ಪ್ರಾವೀಣ್ಯತೆಯ ಹಂತ' })}</div>
                      <div className="flex items-end gap-3 mb-2">
                        <span className="text-3xl font-black">{evaluationHistory[0].score}/100</span>
                        <span className="text-[10px] font-black bg-white/20 px-3 py-1 rounded-full mb-1 uppercase tracking-widest">
                          {evaluationHistory[0].level}
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-100 font-medium leading-relaxed italic line-clamp-2">
                        "{evaluationHistory[0].reasoning}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Last 5 History List */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t({ en: 'Performance History', kn: 'ಪ್ರದರ್ಶನದ ಇತಿಹಾಸ' })}</h4>
                  {evaluationHistory.map((ev: any) => (
                    <div key={ev.id} className="flex items-center gap-4 p-4 rounded-3xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-900/50 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 flex flex-col items-center justify-center shadow-sm">
                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 leading-none">{ev.score}</span>
                        <div className="w-6 h-[1px] bg-slate-100 dark:bg-slate-600 my-0.5"></div>
                        <span className="text-[8px] font-bold text-slate-400 uppercase leading-none">{t({ en: 'Pts', kn: 'ಅಂಕಗಳು' })}</span>
                      </div>
                      <div className="flex-1">
                        <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">{ev.level}</div>
                        <div className="text-[9px] font-bold text-slate-400">
                          {new Date(ev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-slate-300">#{ev.id.slice(0, 4)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Removed redundant sections to keep it clean */}

    </div>
  );
};

// We don't need PackageCard in Dashboard anymore since it moved to PackageSelection.


const PackageCardCompact: React.FC<{ type: PackageType; isActive: boolean; children?: React.ReactNode }> = ({ type, isActive, children }) => {
  const { t } = useLanguage();
  const isTalks = type === PackageType.TALKS;
  const activeClass = isTalks ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-xl shadow-blue-900/5' : 'bg-white dark:bg-slate-900 border-orange-500 shadow-xl shadow-orange-900/5';

  return (
    <div className={`relative p-6 rounded-[2rem] border-2 flex flex-col gap-4 ${isActive ? activeClass : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 opacity-60'}`}>
      <div className="flex items-center gap-6">
        <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl ${isTalks ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
          {isTalks ? '📚' : '🎙️'}
        </div>
        <div className="flex-1">
          <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">{isTalks ? 'SIMPLISH - TALKS' : 'SIMPLISH SNEHI'}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isActive ? t({ en: 'Current Active Package', kn: 'ಪ್ರಸ್ತುತ ಸಕ್ರಿಯ ಪ್ಯಾಕೇಜ್' }) : t({ en: 'Inactive Package', kn: 'ನಿಷ್ಕ್ರಿಯ ಪ್ಯಾಕೇಜ್' })}
          </p>
        </div>
        {isActive && (
          <div className="w-8 h-8 rounded-full bg-green-500 shrink-0 flex items-center justify-center text-white shadow-lg">✓</div>
        )}
      </div>
      {children && (
        <div className="mt-2 w-full">
          {children}
        </div>
      )}
    </div>
  );
};

export default Dashboard;

const ShortcutButton: React.FC<{ icon: string; label: string; color: string; onClick: () => void }> = ({ icon, label, color, onClick }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 group min-w-[80px]"
  >
    <div className={`w-14 h-14 md:w-16 md:h-16 ${color} rounded-2xl md:rounded-3xl flex items-center justify-center text-2xl md:text-3xl shadow-lg transition-all group-hover:scale-110 active:scale-95 group-hover:rotate-3`}>
      {icon}
    </div>
    <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 text-center max-w-[80px]">{label}</span>
  </button>
);
