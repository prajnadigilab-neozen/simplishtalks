
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { Module, LevelStatus, PackageType, CourseLevel } from '../types';

import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { PackageStatus } from '../types';

const Dashboard: React.FC = () => {
  const { session, modules, progress } = useAppStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [voiceHistory, setVoiceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (session?.id && session.packageType === "AI_MESHTRU") {
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
            onClick={() => navigate('/path')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${session?.packageType === PackageType.TALKS ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Study Lessons
          </button>
          <button
            onClick={() => navigate('/talk')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${session?.packageType === PackageType.AI_MESHTRU ? 'bg-white dark:bg-slate-700 text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
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
            <div className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</div>
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
    if (session?.packageType === PackageType.AI_MESHTRU) return '/talk';

    // Find first uncompleted lesson in current level
    const currentLevel = progress?.currentLevel || CourseLevel.BASIC;
    const currentModule = modules.find(m => m.level === currentLevel);
    if (currentModule) {
      const firstUncompleted = currentModule.lessons.find(l => !l.isCompleted);
      if (firstUncompleted) return `/lesson/${firstUncompleted.id}`;
    }
    return '/path';
  };

  // Handle Package Activation
  const handleActivatePackage = async (selectedPackage: PackageType) => {
    if (!session?.id) return;
    try {
      const updates = {
        package_type: selectedPackage,
        package_status: PackageStatus.ACTIVE,
        package_start_date: new Date().toISOString(),
        package_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        agent_credits: selectedPackage === PackageType.AI_MESHTRU ? 60 : 0
      };

      const { error } = await supabase.from('profiles').update(updates).eq('id', session.id);
      if (error) throw error;

      // Force a re-fetch of the session to update the Dashboard view
      await useAppStore.getState().initialize(true);

      // Redirect to the respective area using smart logic
      if (selectedPackage === PackageType.TALKS) {
        // Redirection for TALKS is handled by the "Start Learning" button flow normally,
        // but for initial activation we can use the helper directly
        navigate(getSmartRedirectPath());
      } else {
        navigate('/talk');
      }
    } catch (e) {
      console.error("Package activation failed:", e);
    }
  };

  // 1. Selection State (If no package selected at all)
  if (!session?.packageType || session.packageType === PackageType.NONE) {
    const scoreMatch = session?.systemPromptFocus?.match(/Placement Score: (\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    const isAdvanced = score >= 7;

    return (
      <div className="p-4 md:p-8 bg-[#F8FAFC] dark:bg-slate-950 min-h-full transition-all flex flex-col items-center justify-center animate-in fade-in duration-700">
        <div className="max-w-4xl w-full text-center mb-10">
          <div className="inline-block px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
            Step 2: Activation
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 leading-tight">
            Pick your path to <span className="text-blue-600">Fluency.</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold max-w-xl mx-auto text-sm md:text-base">
            Based on your placement score ({score}/10), we've identified the best learning model for your current level.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full max-w-5xl">
          <PackageCard
            type={PackageType.TALKS}
            isRecommended={!isAdvanced}
            isActive={false}
            onSelect={() => handleActivatePackage(PackageType.TALKS)}
          />
          <PackageCard
            type={PackageType.AI_MESHTRU}
            isRecommended={isAdvanced}
            isActive={false}
            onSelect={() => handleActivatePackage(PackageType.AI_MESHTRU)}
          />
        </div>
      </div>
    );
  }

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
          <button
            onClick={() => navigate(session.packageType === PackageType.TALKS ? '/talk' : getSmartRedirectPath())}
            className="hidden md:flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all border border-blue-200/50 dark:border-blue-800/50"
          >
            <span>Switch to {session.packageType === PackageType.TALKS ? 'Voice Area' : 'Study Lessons'}</span>
            <span className="text-xs">→</span>
          </button>
          <div className="flex flex-col items-center px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">🔥 Streak</span>
            <span className="text-xs font-black text-slate-900 dark:text-white">{session.streakCount || 0} Days</span>
          </div>
          <button onClick={() => navigate('/settings')} className="p-2 md:p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-110 active:scale-95 transition-all text-xl">⚙️</button>
        </div>
      </div>

      <div className="mb-10 text-center md:text-left">
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-6">
          {session.packageType === PackageType.TALKS ? 'Your Learning Dashboard' : 'Your Voice Practice Hub'} 🎙️
        </h1>

        {/* Package Selection Area (Showing Both, Greyed out Inactive) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 overflow-hidden">
          <div className={`transition-all duration-500 ${session.packageType !== PackageType.TALKS ? 'opacity-40 grayscale pointer-events-none scale-[0.98]' : 'scale-100'}`}>
            <PackageCardCompact type={PackageType.TALKS} isActive={session.packageType === PackageType.TALKS} />
          </div>
          <div className={`transition-all duration-500 ${session.packageType !== PackageType.AI_MESHTRU ? 'opacity-40 grayscale pointer-events-none scale-[0.98]' : 'scale-100'}`}>
            <PackageCardCompact type={PackageType.AI_MESHTRU} isActive={session.packageType === PackageType.AI_MESHTRU} />
          </div>
        </div>

        <StatsGrid type={session.packageType === PackageType.TALKS ? "TALKS" : "AGENT"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {session.packageType === PackageType.TALKS ? (
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-blue-900 dark:text-blue-300">Course Path</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Fluency Step-by-Step</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {modules.map((mod, idx) => (
                  <div key={mod.id || idx} className={`p-6 rounded-[2rem] border-2 transition-all ${mod.status === LevelStatus.LOCKED ? 'bg-slate-100 dark:bg-slate-900/50 grayscale opacity-60' : 'bg-white dark:bg-slate-900 border-white shadow-xl shadow-blue-900/5'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-lg">{idx === 0 ? '🌱' : '🚀'}</div>
                      <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase">{t(mod.level)}</span>
                    </div>
                    <h3 className="text-sm font-black mb-4 truncate">{t(mod.title)}</h3>
                    <button disabled={mod.status === LevelStatus.LOCKED} onClick={() => navigate(mod.status === LevelStatus.COMPLETED ? `/lesson/${mod.lessons[0].id}` : getSmartRedirectPath())} className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Open Path</button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div
              onClick={() => navigate('/talk')}
              className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-[2.5rem] p-10 border-4 border-orange-400 dark:border-amber-600 shadow-2xl cursor-pointer hover:scale-[1.01] transition-all group overflow-hidden relative min-h-[350px] flex flex-col justify-center items-center text-center"
            >
              <div className="relative z-10">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center text-5xl mb-6 backdrop-blur-xl border-4 border-white/30 group-hover:scale-110 transition-transform animate-pulse">🎙️</div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-2 uppercase tracking-tighter">Talk with Kore</h2>
                <p className="text-white/90 font-black text-[10px] uppercase tracking-[0.2em] mb-8">Start your voice session now</p>
                <div className="inline-flex items-center gap-3 px-8 py-3 bg-white text-orange-600 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl">Connect Now →</div>
              </div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            </div>
          )}

          {session.packageType === PackageType.AI_MESHTRU && (
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">Recent Recordings</h3>
                <span className="text-[10px] font-black text-orange-500 uppercase cursor-pointer">View All</span>
              </div>
              <div className="space-y-4">
                {loadingHistory ? (
                  <div className="py-10 text-center opacity-30 animate-pulse">Loading sessions...</div>
                ) : voiceHistory.length === 0 ? (
                  <div className="py-10 text-center text-[10px] font-black uppercase text-slate-400">No sessions yet</div>
                ) : (
                  voiceHistory.map((m, idx) => (
                    <div key={m.dbId || idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-orange-50 transition-colors group">
                      <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-lg">🎙️</div>
                      <div className="flex-1">
                        <div className="text-xs font-black text-slate-800 truncate max-w-[200px]">{m.text}</div>
                        <div className="text-[10px] font-bold text-slate-400">{new Date(m.timestamp).toLocaleDateString()} • {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <button onClick={() => navigate('/talk')} className="opacity-0 group-hover:opacity-100 p-2 text-orange-500 font-black uppercase text-[10px]">Review</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          {session.packageType === PackageType.AI_MESHTRU ? (
            <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl">
              <h3 className="text-amber-500 text-[10px] font-black uppercase tracking-widest mb-6">Credit Wallet</h3>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-5xl font-black">{session.agentCredits || 0}</span>
                <span className="text-slate-500 font-black text-sm mb-2 uppercase">Mins</span>
              </div>
              <p className="text-slate-400 text-[10px] font-bold mb-8">Credits expire on {session.packageEndDate ? new Date(session.packageEndDate).toLocaleDateString() : 'N/A'}.</p>
              <button className="w-full py-4 bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-400 transition-all shadow-xl">Buy More Credits</button>
            </div>
          ) : (
            <div className="bg-blue-900 rounded-[2rem] p-8 text-white shadow-2xl">
              <h3 className="text-blue-400 text-[10px] font-black uppercase tracking-widest mb-6">Course Progress</h3>
              <div className="flex items-end gap-1 mb-4">
                <span className="text-5xl font-black">{progressPercentage}%</span>
                <span className="text-blue-400 font-black text-sm mb-2 uppercase">Done</span>
              </div>
              <div className="h-2 bg-blue-800 rounded-full overflow-hidden mb-8">
                <div className="h-full bg-white transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>
              </div>
              <button
                onClick={() => navigate(getSmartRedirectPath())}
                className="w-full py-4 bg-white text-blue-900 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 transition-all shadow-lg active:scale-95"
              >
                Start Learning
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* --- Helper Components --- */

const PackageCard: React.FC<{ type: PackageType; isRecommended: boolean; isActive: boolean; onSelect: () => void }> = ({ type, isRecommended, isActive, onSelect }) => {
  const isTalks = type === PackageType.TALKS;
  return (
    <div className={`group relative transition-all ${isActive ? 'ring-4 ring-blue-500 scale-[1.02]' : ''}`}>
      <div className={`absolute inset-0 ${isTalks ? 'bg-blue-600' : 'bg-orange-600'} rounded-[2.5rem] ${isTalks ? 'rotate-1' : '-rotate-1'} group-hover:rotate-0 transition-transform opacity-10`}></div>
      <div className="relative bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-xl hover:border-blue-500 transition-all flex flex-col h-full overflow-hidden">
        <div className="flex justify-between items-start mb-6">
          <div className={`w-14 h-14 ${isTalks ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'} rounded-2xl flex items-center justify-center text-3xl`}>
            {isTalks ? '📚' : '🎙️'}
          </div>
          {isRecommended && (
            <span className={`${isTalks ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'} px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest`}>Recommended</span>
          )}
        </div>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{isTalks ? 'SIMPLISH - TALKS' : 'SIMPLISH AI Meshtru'}</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-8 leading-relaxed">
          {isTalks ? 'Structural English path with gated levels and bilingual chat support.' : 'Direct voice practice with AI personas. Focus on fluency.'}
        </p>
        <ul className="space-y-3 mb-10 flex-1">
          {(isTalks ? ['4-Tier Roadmap', 'Bilingual AI Tutor', 'Topic Progress'] : ['Direct Voice Call', 'Visual Personas', 'Call Records']).map(f => (
            <li key={f} className="flex items-center gap-3 text-[11px] font-black text-slate-700 dark:text-slate-300">
              <span className={`w-5 h-5 rounded-full ${isTalks ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} flex items-center justify-center text-[10px]`}>✓</span>
              {f}
            </li>
          ))}
        </ul>
        <button onClick={onSelect} className={`w-full py-5 ${isTalks ? 'bg-blue-600' : 'bg-orange-500'} text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all shadow-xl`}>
          {isTalks ? 'Start Learning' : 'Choose Voice Path'}
        </button>
      </div>
    </div>
  );
};

const PackageCardCompact: React.FC<{ type: PackageType; isActive: boolean }> = ({ type, isActive }) => {
  const isTalks = type === PackageType.TALKS;
  return (
    <div className={`relative p-6 rounded-[2rem] border-2 flex items-center gap-6 ${isActive ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-xl shadow-blue-900/5' : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 opacity-60'}`}>
      <div className={`w-14 h-14 shrink-0 rounded-2xl flex items-center justify-center text-3xl ${isTalks ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
        {isTalks ? '📚' : '🎙️'}
      </div>
      <div>
        <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">{isTalks ? 'SIMPLISH - TALKS' : 'SIMPLISH AI Meshtru'}</h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {isActive ? 'Current Active Package' : 'Inactive Package'}
        </p>
      </div>
      {isActive && (
        <div className="ml-auto w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white shadow-lg">✓</div>
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


