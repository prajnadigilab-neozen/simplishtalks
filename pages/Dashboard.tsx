import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { INITIAL_MODULES, TRANSLATIONS } from '../constants';
import { Module, LevelStatus, PackageType, CourseLevel, PackageStatus, UserRole } from '../types';

import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const { session, modules, progress, loading, initialized } = useAppStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [voiceHistory, setVoiceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (session?.id && session.packageType === PackageType.SANGAATHI) {
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
            Namma Simplish
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
            {session?.name || 'Student'}
          </p>
        </div>
      </div>

      {/* Navigation Switcher */}
      {session?.packageType !== PackageType.NONE && (
        <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => navigate('/dashboard')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${session?.packageType === PackageType.TALKS || session?.packageType === PackageType.BOTH ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Study Lessons
          </button>
          <button
            onClick={() => navigate('/talk')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${session?.packageType === PackageType.SANGAATHI || session?.packageType === PackageType.BOTH ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Voice Practice
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 md:gap-4">
        {session?.packageType !== PackageType.NONE && (
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Weekly Streak</span>
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
      { label: 'Daily Streak', value: `${session?.streakCount || 0}`, icon: '🔥', color: 'text-orange-500' },
      { label: 'Messages', value: `${session?.totalMessagesSent || 0}`, icon: '💬', color: 'text-blue-500' },
      { label: 'Progress', value: `${progressPercentage}%`, icon: '📈', color: 'text-green-500' },
    ] : [
      { label: 'Active Streak', value: `${session?.streakCount || 0}`, icon: '🔥', color: 'text-orange-500' },
      { label: 'Talk Time', value: `${Math.floor((session?.totalTalkTime || 0) / 60)}m`, icon: '🎙️', color: 'text-purple-500' },
      { label: 'Credits Left', value: `${session?.agentCredits || 0}`, icon: '🪙', color: 'text-amber-500' },
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
    if (session?.packageType === PackageType.SANGAATHI) return '/talk';

    // Fallback if no modules are loaded yet
    if (!modules || modules.length === 0) {
      console.warn("No modules found in store. Redirecting to dashboard.");
      return '/dashboard';
    }

    // Find first uncompleted lesson across all available modules
    for (const module of modules) {
      const firstUncompleted = (module.lessons || []).find(l => !l.isCompleted);
      if (firstUncompleted) return `/lesson/${firstUncompleted.id}`;
    }

    // If all completed, return to the very first lesson for review
    const firstLessonId = modules[0]?.lessons?.[0]?.id;
    if (!firstLessonId) {
      console.warn("No lessons found in modules. Redirecting to dashboard.");
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
  const isSangaathiActive = session.packageType === PackageType.SANGAATHI || session.packageType === PackageType.BOTH;
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
            <h2 className="text-sm md:text-lg font-black text-slate-900 dark:text-white leading-tight">Namma Simplish</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">{session.name || 'Student'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {isBoth ? (
            <button
              onClick={() => navigate('/talk')}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-all border border-orange-200/50 dark:border-orange-800/50"
            >
              <span>Voice Practice</span>
              <span className="text-xs">🎙️</span>
            </button>
          ) : (
            <button
              disabled
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-slate-200 dark:border-slate-700 opacity-60"
            >
              <span>Switch to {session.packageType === PackageType.TALKS ? 'Voice Area' : 'Study Lessons'}</span>
              <span className="text-xs">🔒</span>
            </button>
          )}
          <div className="flex flex-col items-center px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">🔥 Streak</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">{session.streakCount || 0} Days</span>
          </div>
          <button onClick={() => navigate('/settings')} className="p-2 md:p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all text-xl">⚙️</button>
        </div>
      </div>

      <div className="mb-10 text-center md:text-left relative">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-6">
          {session.packageType === PackageType.TALKS ? 'Your Learning Dashboard' : (isBoth ? 'Your Supercharged Hub' : 'Your Voice Practice Hub')} {isTalksActive ? '📚' : '🎙️'}
        </h1>

        {!isBoth && (
          <div className="absolute top-0 right-0 hidden md:block">
            <button onClick={() => navigate('/packages')} className="px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-all shadow-sm">
              Upgrade Path ✨
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
                  {completedLessons === 0 ? 'Go to Talks' : 'Continue Talks'}
                </button>
              )}
            </PackageCardCompact>
          </div>
          <div className={`transition-all duration-500 ${!isSangaathiActive ? 'opacity-40 grayscale pointer-events-none scale-[0.98]' : 'scale-100'}`}>
            <PackageCardCompact type={PackageType.SANGAATHI} isActive={isSangaathiActive}>
              {isSangaathiActive && (
                <button
                  onClick={() => navigate('/talk')}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg active:scale-95"
                >
                  Go to SANGAATHI
                </button>
              )}
            </PackageCardCompact>
          </div>
        </div>

        {!isBoth && (
          <div className="md:hidden flex justify-center w-full mb-8">
            <button onClick={() => navigate('/packages')} className="w-full px-4 py-3 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm">
              Upgrade Path ✨
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
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Active Subscription</h3>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-4">
                {isBoth ? 'SIMPLISH - TALKS & Simplish SANGAATHI' : (isTalksActive ? 'SIMPLISH - TALKS' : 'Simplish SANGAATHI')}
              </h2>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Started:</span>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    {session.packageStartDate ? new Date(session.packageStartDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Expires:</span>
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    {session.packageEndDate ? new Date(session.packageEndDate).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-center px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Messages</div>
                <div className="text-xl font-black text-blue-600 dark:text-blue-300">{session.totalMessagesSent || 0}</div>
              </div>
              <div className="text-center px-4 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
                <div className="text-xl font-black text-orange-600 dark:text-orange-300">{Math.round((session.totalTalkTime || 0) / 60)}m</div>
                <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Talk Time</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions / Progress */}
        <div className={`${!isTalksActive ? 'bg-orange-600 shadow-orange-500/20' : 'bg-blue-600 shadow-blue-500/20'} rounded-[2rem] p-8 text-white shadow-xl flex flex-col justify-between`}>
          <div>
            <h3 className={`${!isTalksActive ? 'text-orange-200' : 'text-blue-200'} text-[10px] font-black uppercase tracking-widest mb-4`}>
              {!isTalksActive ? 'Voice Assistant' : 'Overall Completion'}
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
                <p className="text-sm font-bold text-orange-100">Ready to start speaking?</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content Tabs (Curriculum vs History) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Curriculum Preview (Always visible if TALKS or just to show what's coming) */}
        {isTalksActive && (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Curriculum Preview</h3>
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{progress?.currentLevel || 'BASIC'} Level</span>
            </div>

            <div className="space-y-3">
              {(INITIAL_MODULES.find(m => m.level === (progress?.currentLevel || CourseLevel.BASIC))?.lessons?.slice(0, 5) || []).map((l, i) => {
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
                      <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded-lg text-[8px] font-black uppercase">Next</span>
                    )}
                  </div>
                );
              })}
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 mt-4 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
              >
                Keep Practicing To Unlock More →
              </button>
            </div>
          </div>
        )}

        {/* Activity / History */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">Recent Activity</h3>
            <button
              onClick={() => navigate(session.packageType === PackageType.SANGAATHI ? '/talk' : '/coachchat')}
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-500"
            >
              View All
            </button>
          </div>

          <div className="flex-1 space-y-4">
            {isSangaathiActive ? (
              loadingHistory ? (
                <div className="py-10 text-center opacity-30 animate-pulse">Loading sessions...</div>
              ) : voiceHistory.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
                  <span className="text-4xl mb-4">🎙️</span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-center">No recordings yet.<br />Start practicing fluency!</p>
                </div>
              ) : (
                voiceHistory.slice(0, 4).map((m, idx) => (
                  <div key={m.dbId || idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:border-orange-200 dark:hover:border-orange-900 border border-transparent transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-lg">🎙️</div>
                    <div className="flex-1 overflow-hidden">
                      <div className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{m.text}</div>
                      <div className="text-[10px] font-bold text-slate-400">{new Date(m.timestamp).toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => navigate('/talk')} className="p-2 text-orange-500 font-black uppercase text-[10px]">Play</button>
                  </div>
                ))
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-40">
                <span className="text-4xl mb-4">💬</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-center">Chat history and streaks<br />will appear here as you learn.</p>
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
  const isTalks = type === PackageType.TALKS;
  return (
    <div className={`relative p-6 rounded-[2rem] border-2 flex flex-col gap-4 ${isActive ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-xl shadow-blue-900/5' : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 opacity-60'}`}>
      <div className="flex items-center gap-6">
        <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl ${isTalks ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
          {isTalks ? '📚' : '🎙️'}
        </div>
        <div className="flex-1">
          <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">{isTalks ? 'SIMPLISH - TALKS' : 'Simplish SANGAATHI'}</h4>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {isActive ? 'Current Active Package' : 'Inactive Package'}
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
