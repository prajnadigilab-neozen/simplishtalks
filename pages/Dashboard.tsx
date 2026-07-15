import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { Module, LevelStatus, PackageType, CourseLevel, PackageStatus, UserRole } from '../types';

import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { getSystemConfig } from '../services/systemConfigService';
import SnehiCheckoutModal from '../components/SnehiCheckoutModal';
import { attributionService } from '../services/attributionService';

const Dashboard: React.FC = () => {
  const { session, modules, scenarios, progress, evaluationHistory, feedback, loading, initialized } = useAppStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [voiceHistory, setVoiceHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // SNEHI Payment states
  const [snehiRequest, setSnehiRequest] = useState<any>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [sysConfig, setSysConfig] = useState<any>(null);

  useEffect(() => {
    getSystemConfig().then(cfg => {
      if (cfg) setSysConfig(cfg);
    });
  }, []);

  const fetchSnehiRequest = async () => {
    if (session?.id) {
      try {
        const { getMyAccessRequestStatus } = await import('../services/snehiAccessService');
        const req = await getMyAccessRequestStatus(session.id);
        setSnehiRequest(req);
      } catch (err) {
        console.error("Error loading SNEHI request:", err);
      }
    }
  };

  useEffect(() => {
    if (session?.id) {
      fetchSnehiRequest();
    }
  }, [session?.id]);

  const handleRequestAccess = async () => {
    if (!session?.id) return;
    setLoadingRequest(true);
    try {
      const { submitSnehiRequest } = await import('../services/snehiAccessService');
      const success = await submitSnehiRequest(session.id);
      if (success) {
        await fetchSnehiRequest();
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingRequest(false);
  };

  const totalLessons = modules.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0);
  const completedLessons = progress?.completedLessons.length || 0;
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const totalScenarios = scenarios.length;
  const completedScenarios = progress?.completedScenarios.length || 0;
  const snehiProgressPercentage = totalScenarios > 0 ? Math.round((completedScenarios / totalScenarios) * 100) : 0;

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

  // Trigger real-time system notification on 100% curriculum completion
  useEffect(() => {
    if (initialized && progressPercentage === 100 && !feedback && session?.id) {
      const notifyGraduation = async () => {
        const key = `grad_notified_${session.id}`;
        if (localStorage.getItem(key)) return;

        try {
          const { createNotification } = await import('../services/notificationService');
          await createNotification(
            session.id,
            JSON.stringify({
              en: 'Congratulations on graduation! Share your journey with us.',
              kn: 'ಪದವಿ ಪಡೆದಿದ್ದಕ್ಕಾಗಿ ಅಭಿನಂದನೆಗಳು! ನಿಮ್ಮ ಅನುಭವವನ್ನು ನಮ್ಮೊಂದಿಗೆ ಹಂಚಿಕೊಳ್ಳಿ.'
            }),
            JSON.stringify({
              en: 'You have completed 100% of Namma Simplish curriculum. Submit your feedback to claim your graduation certificate and rewards.',
              kn: 'ನೀವು ನಮ್ಮ ಸಿಂಪ್ಲಿಷ್ ಪಠ್ಯಕ್ರಮದ 100% ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ. ನಿಮ್ಮ ಪದವಿ ಪ್ರಮಾಣಪತ್ರ ಮತ್ತು ಬಹುಮಾನಗಳನ್ನು ಪಡೆಯಲು ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಸಲ್ಲಿಸಿ.'
            }),
            'success'
          );
          localStorage.setItem(key, 'true');
        } catch (e) {
          console.error("Graduation notification trigger error:", e);
        }
      };
      notifyGraduation();
    }
  }, [initialized, progressPercentage, feedback, session?.id]);

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
      { label: t({ en: 'Scenarios', kn: 'ಸನ್ನಿವೇಶಗಳು' }), value: `${progress?.completedScenarios.length || 0}/${scenarios.length}`, icon: '🎯', color: 'text-purple-500' },
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

  // Progress metrics moved to top

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

  // 1. (Removed automatic redirect for PackageType.NONE to allow greyed-out viewing)


  // Show nothing while loading or if no package
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }



  const isTalksActive = session?.packageType === PackageType.TALKS || session?.packageType === PackageType.BOTH;
  const isSnehiActive = session?.packageType === PackageType.SNEHI || session?.packageType === PackageType.BOTH;
  const isBoth = session?.packageType === PackageType.BOTH;
  const isNone = !session?.packageType || session?.packageType === PackageType.NONE;
  
  // For display purposes, we act as if BOTH are available so the layout renders everything,
  // but we apply CSS locks based on isNone.
  const displayTalks = isTalksActive || isNone;
  const displayBoth = isBoth || isNone;

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

      {/* Graduation & Feedback Banner */}
      {progressPercentage === 100 && !feedback && (
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 md:p-10 rounded-3xl text-white shadow-xl mb-10 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-[9px] font-black tracking-widest uppercase bg-white/20 px-3 py-1 rounded-full">
                🎓 Graduation Unlocked
              </span>
              <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                🎉 {t({ en: 'Congratulations!', kn: 'ಅಭಿನಂದನೆಗಳು!' })}
              </h2>
              <p className="text-sm text-blue-100 font-medium leading-relaxed">
                {t({
                  en: 'You have successfully completed your SIMPLISH learning journey. We would love to hear about your experience. Your feedback helps us improve and inspire future learners.',
                  kn: 'ನೀವು ನಮ್ಮ ಸಿಂಪ್ಲಿಷ್ ಕಲಿಕೆಯ ಪ್ರಯಾಣವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪೂರ್ಣಗೊಳಿಸಿದ್ದೀರಿ. ನಿಮ್ಮ ಅನುಭವದ ಬಗ್ಗೆ ಕೇಳಲು ನಾವು ಬಯಸುತ್ತೇವೆ. ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಯು ನಮ್ಮನ್ನು ಸುಧಾರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.'
                })}
              </p>
            </div>
            <button
              onClick={() => navigate('/feedback')}
              className="px-8 py-3.5 bg-white text-blue-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 hover:scale-[1.03] active:scale-[0.98] transition-all shadow-lg shrink-0"
            >
              {t({ en: 'Submit Feedback', kn: 'ಪ್ರತಿಕ್ರಿಯೆ ನೀಡಿ' })}
            </button>
          </div>
        </div>
      )}

      <div className="mb-10 text-center md:text-left relative">
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-6">
            {isNone ? t({ en: 'Preview Your Dashboard', kn: 'ನಿಮ್ಮ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಪೂರ್ವವೀಕ್ಷಣೆ' }) : 
             session?.packageType === PackageType.TALKS 
              ? t({ en: 'Your Learning Dashboard', kn: 'ನಿಮ್ಮ ಕಲಿಕೆಯ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' }) 
              : (isBoth ? t({ en: 'Your Supercharged Hub', kn: 'ನಿಮ್ಮ ಸೂಪರ್ ಹಬ್' }) : t({ en: 'Your Voice Practice Hub', kn: 'ನಿಮ್ಮ ಧ್ವನಿ ಅಭ್ಯಾಸ ಕೇಂದ್ರ' }))} {displayTalks ? '📚' : '🎙️'}
          </h1>

          {isNone && (
            <div className="absolute top-0 right-0">
              <button onClick={() => navigate('/packages')} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg animate-pulse">
                {t({ en: 'Unlock All Features ✨', kn: 'ಎಲ್ಲಾ ವೈಶಿಷ್ಟ್ಯಗಳನ್ನು ಅನ್ಲಾಕ್ ಮಾಡಿ ✨' })}
              </button>
            </div>
          )}
          {(!displayBoth && !isNone) && (
            <div className="absolute top-0 right-0 hidden md:block">
              <button onClick={() => navigate('/packages')} className="px-4 py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-200 transition-all shadow-sm">
                {t({ en: 'Upgrade Path ✨', kn: 'ಹೊಸ ಫೀಚರ್ ಪಡೆಯಿರಿ ✨' })}
              </button>
            </div>
          )}

        {/* Package Selection Area (Showing Both, Greyed out Inactive) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10 overflow-hidden">
          <div className={`transition-all duration-500 ${!isTalksActive ? 'opacity-40 grayscale pointer-events-none scale-[0.98]' : 'scale-100'}`}>
            <PackageCardCompact type={PackageType.TALKS} isActive={isTalksActive || isNone}>
              {(isTalksActive || isNone) && (
                <div className="flex flex-col gap-2 w-full">
                  <button
                    disabled={isNone}
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
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:bg-slate-400"
                  >
                    {completedLessons === 0 ? t({ en: 'Go to SIMPLISH Talks', kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್‌ಗೆ ಹೋಗಿ' }) : t({ en: 'Continue SIMPLISH Talks', kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ ಮುಂದುವರಿಸಿ' })}
                  </button>
                  <button
                    onClick={() => {
                      attributionService.recordPendingAttribution('android');
                      attributionService.logEvent('web_download_button_clicked', { platform: 'android', source: 'dashboard_talks' });
                      window.dispatchEvent(new CustomEvent('simplish-trigger-pwa-install'));
                    }}
                    className="w-full py-2.5 border-2 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>📥</span> {t({ en: 'Download App', kn: 'ಆಪ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ' })}
                  </button>
                </div>
              )}
            </PackageCardCompact>
          </div>
          <div className="scale-100">
            {(() => {
              const snehiState = session?.snehiAccessEnabled ? 'ACTIVE' : (snehiRequest?.status || 'None');
              return (
                <PackageCardCompact type={PackageType.SNEHI} isActive={snehiState === 'ACTIVE'}>
                  <div className="flex flex-col gap-2 w-full">
                    {snehiState === 'ACTIVE' && (
                      <button
                        onClick={() => navigate('/talk')}
                        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                      >
                        {t({ en: 'Go to SNEHI', kn: 'ಸ್ನೇಹಿಗೆ ಹೋಗಿ' })}
                      </button>
                    )}
                    {snehiState === 'None' && (
                      <button
                        onClick={handleRequestAccess}
                        disabled={loadingRequest || isNone}
                        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                      >
                        {loadingRequest && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        {t({ en: 'Request Access', kn: 'ಪ್ರವೇಶ ವಿನಂತಿಸಿ' })}
                      </button>
                    )}
                    {snehiState === 'PENDING' && (
                      <button
                        disabled
                        className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-slate-200 dark:border-slate-700"
                      >
                        {t({ en: '⏳ Under Review', kn: '⏳ ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ' })}
                      </button>
                    )}
                    {snehiState === 'AWAITING_PMT' && (
                      <button
                        onClick={() => setShowCheckoutModal(true)}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                      >
                        {t({ en: '💳 Pay Now', kn: '💳 ಪಾವತಿಸಿ' })}
                      </button>
                    )}
                    {snehiState === 'REJECTED' && (
                      <button
                        onClick={() => navigate('/packages')}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
                      >
                        {t({ en: '🔄 Request Again', kn: '🔄 ಮತ್ತೆ ವಿನಂತಿಸಿ' })}
                      </button>
                    )}
                    {snehiState === 'DISABLED' && (
                      <button
                        disabled
                        className="w-full py-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-not-allowed border border-red-200/50 dark:border-red-800/50"
                      >
                        {t({ en: '🔒 Access Restricted', kn: '🔒 ಪ್ರವೇಶ ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ' })}
                      </button>
                    )}
                    {(snehiState === 'ACTIVE' || snehiState === 'AWAITING_PMT') && (
                      <button
                        onClick={() => {
                          attributionService.recordPendingAttribution('android');
                          attributionService.logEvent('web_download_button_clicked', { platform: 'android', source: 'dashboard_snehi' });
                          window.dispatchEvent(new CustomEvent('simplish-trigger-pwa-install'));
                        }}
                        className="w-full py-2.5 border-2 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <span>📥</span> {t({ en: 'Download App', kn: 'ಆಪ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ' })}
                      </button>
                    )}
                  </div>
                </PackageCardCompact>
              );
            })()}
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
                {isNone ? t({ en: 'No Active Packages', kn: 'ಸಕ್ರಿಯ ಪ್ಯಾಕೇಜ್ ಇಲ್ಲ' }) : (isBoth ? t({ en: 'SIMPLISH - TALKS & Simplish SNEHI', kn: 'ಸಿಂಪ್ಲಿಷ್ - ಟಾಕ್ಸ್ ಮತ್ತು ಸ್ನೇಹಿ' }) : (isTalksActive ? t({ en: 'SIMPLISH - TALKS', kn: 'ಸಿಂಪ್ಲಿಷ್ - ಟಾಕ್ಸ್' }) : t({ en: 'Simplish SNEHI', kn: 'ಸಿಂಪ್ಲಿಷ್ ಸ್ನೇಹಿ' })))}
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
                <div className="text-[10px] font-bold opacity-80 mb-4">{t({ en: 'LESSONS COMPLETED', kn: 'ಪಾಠಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ' })}</div>
                <div className={`h-1.5 ${!isTalksActive ? 'bg-orange-800' : 'bg-blue-800'} rounded-full overflow-hidden`}>
                  <div className="h-full bg-white" style={{ width: `${progressPercentage}%` }}></div>
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl font-black mb-2">{snehiProgressPercentage}%</div>
                <div className="text-[10px] font-bold opacity-80 mb-4">{t({ en: 'SCENARIOS COMPLETED', kn: 'ಸನ್ನಿವೇಶಗಳು ಪೂರ್ಣಗೊಂಡಿವೆ' })}</div>
                <div className="h-1.5 bg-orange-800 rounded-full overflow-hidden">
                  <div className="h-full bg-white" style={{ width: `${snehiProgressPercentage}%` }}></div>
                </div>
              </>
            )}
          </div>
          {isBoth && (
             <div className="mt-6 pt-6 border-t border-white/20">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-[10px] font-black uppercase opacity-70">{isTalksActive ? 'SNEHI Progress' : 'Talks Progress'}</span>
                   <span className="text-xs font-black">{isTalksActive ? snehiProgressPercentage : progressPercentage}%</span>
                </div>
                <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                   <div className="h-full bg-white" style={{ width: `${isTalksActive ? snehiProgressPercentage : progressPercentage}%` }}></div>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Content Tabs (Curriculum vs History) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-10">
        {/* SIMPLISH Talks Curriculum Preview */}
        <div className={`bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-all relative group ${!isTalksActive ? 'opacity-50 grayscale blur-[0.5px]' : ''}`}>
          {!isTalksActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/20 dark:bg-slate-900/20 backdrop-blur-[1px] rounded-[2rem]">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center text-xl border border-slate-100 dark:border-slate-700">🔒</div>
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{t({ en: 'Study Lessons', kn: 'ಪಾಠಗಳು' })}</h3>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{progress?.currentLevel || 'BASIC'}</span>
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
                    <div className={`text-[11px] font-black ${isCompleted ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{l.title.en}</div>
                    <div className="text-[10px] font-bold text-slate-400">{l.title.kn}</div>
                  </div>
                </div>
              );
            })}
            {isTalksActive && progressPercentage < 100 && (
              <button
                onClick={() => navigate(getSmartRedirectPath())}
                className="w-full py-3 mt-4 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
              >
                {t({ en: 'Continue Reading →', kn: 'ಓದುತ್ತಾ ಇರಿ →' })}
              </button>
            )}
          </div>
        </div>

        {/* SNEHI Practice Preview (New) */}
        <div className={`bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm transition-all relative group ${!isSnehiActive ? 'opacity-50 grayscale blur-[0.5px]' : ''}`}>
          {!isSnehiActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/20 dark:bg-slate-900/20 backdrop-blur-[1px] rounded-[2rem]">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center text-xl border border-slate-100 dark:border-slate-700">🔒</div>
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-slate-900 dark:text-white">{t({ en: 'Voice Practice', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸ' })}</h3>
            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{t({ en: 'SNEHI', kn: 'ಸ್ನೇಹಿ' })}</span>
          </div>

          <div className="space-y-3">
            {(scenarios.slice(0, 5)).map((s, i) => {
              const isCompleted = progress?.completedScenarios.includes(s.id);
              return (
                <div key={s.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${isCompleted ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${isCompleted ? 'bg-green-100 text-green-600' : 'bg-orange-50 text-orange-600'}`}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className={`text-[11px] font-black ${isCompleted ? 'text-slate-400' : 'text-slate-900 dark:text-white'}`}>{s.title.en}</div>
                    <div className="text-[10px] font-bold text-slate-400">{s.category.en}</div>
                  </div>
                </div>
              );
            })}
            {isSnehiActive && (
              <button
                onClick={() => navigate('/talk')}
                className="w-full py-3 mt-4 text-[10px] font-black text-orange-500 uppercase tracking-widest hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
              >
                {t({ en: 'Start Practicing →', kn: 'ಅಭ್ಯಾಸ ಪ್ರಾರಂಭಿಸಿ →' })}
              </button>
            )}
          </div>
        </div>

        {/* AI Evaluation & Retake (Shrunk) */}
        <div className={`bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col transition-all relative ${isNone ? 'opacity-50 grayscale blur-[0.5px]' : ''}`}>
          {isNone && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/20 dark:bg-slate-900/20 backdrop-blur-[1px] rounded-[2rem]">
              <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-xl flex items-center justify-center text-xl border border-slate-100 dark:border-slate-700">🔒</div>
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">{t({ en: 'AI Scorecard', kn: 'AI ಸ್ಕೋರ್‌ಕಾರ್ಡ್' })}</h3>
            <button onClick={() => navigate('/placement')} className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 text-blue-600 rounded-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all">🔄</button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {evaluationHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 opacity-40">
                <span className="text-3xl mb-4">📈</span>
                <p className="text-[9px] font-black uppercase tracking-widest text-center">{t({ en: 'Waiting for Test...', kn: 'ಪರೀಕ್ಷೆಗಾಗಿ ಕಾಯುತ್ತಿದೆ...' })}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Compact Latest Score Card */}
                {evaluationHistory[0] && (
                  <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-md">
                    <div className="flex justify-between items-start mb-2">
                       <span className="text-[10px] font-black uppercase opacity-80">{evaluationHistory[0].level}</span>
                       <span className="text-lg font-black">{evaluationHistory[0].score}%</span>
                    </div>
                    <p className="text-[9px] text-blue-100 font-medium italic line-clamp-2 leading-relaxed opacity-90">"{evaluationHistory[0].reasoning}"</p>
                  </div>
                )}

                {/* Compact History Items */}
                <div className="space-y-2">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t({ en: 'Last Attempts', kn: 'ಹಿಂದಿನ ಪ್ರಯತ್ನಗಳು' })}</h4>
                  {evaluationHistory.slice(1, 4).map((ev: any) => (
                    <div key={ev.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                         <div className="text-[10px] font-black text-blue-600">{ev.score}%</div>
                         <div className="text-[9px] font-bold text-slate-500 uppercase">{ev.level}</div>
                      </div>
                      <div className="text-[8px] font-bold text-slate-400">{new Date(ev.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Removed redundant sections to keep it clean */}

      {showCheckoutModal && snehiRequest && (
        <SnehiCheckoutModal
          userId={session.id}
          requestId={snehiRequest.id}
          basePrice={sysConfig?.price_snehi || 499}
          onClose={() => setShowCheckoutModal(false)}
          onSuccess={async () => {
            setShowCheckoutModal(false);
            const { clearProfileCache } = await import('../services/authService');
            clearProfileCache();
            try {
              await useAppStore.getState().refreshSession();
            } catch (e) {
              console.error(e);
            }
            await fetchSnehiRequest();
          }}
        />
      )}

    </div>
  );
};

// We don't need PackageCard in Dashboard anymore since it moved to PackageSelection.


const PackageCardCompact: React.FC<{ type: PackageType; isActive: boolean; children?: React.ReactNode }> = ({ type, isActive, children }) => {
  const { t } = useLanguage();
  const { session } = useAppStore();
  const isTalks = type === PackageType.TALKS;
  const activeClass = isTalks ? 'bg-white dark:bg-slate-900 border-blue-500 shadow-xl shadow-blue-900/5' : 'bg-white dark:bg-slate-900 border-orange-500 shadow-xl shadow-orange-900/5';

  const [prices, setPrices] = useState({ talks: 299, snehi: 499, gstPercent: 18 });

  useEffect(() => {
    getSystemConfig().then(cfg => {
      if (cfg) {
        setPrices({
          talks: cfg.price_talks || 299,
          snehi: cfg.price_snehi || 499,
          gstPercent: cfg.gst_percentage != null ? Number(cfg.gst_percentage) : 18
        });
      }
    });
  }, []);

  // Calculate remaining days
  let daysLeft = 0;
  if (session?.packageEndDate) {
    const diff = new Date(session.packageEndDate).getTime() - new Date().getTime();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const topupAmount = session?.topupAmount || 0;
  const remainingMins = session?.agentCredits || 0;

  // Total amount = Package Price + Topup Amount
  const packagePrice = isTalks ? prices.talks : prices.snehi;
  const totalAmount = packagePrice + topupAmount;
  const gstIncludedAmount = Math.round(totalAmount * (1 + prices.gstPercent / 100));

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

      {/* Validity Info Strip */}
      {isActive && (
        <div className={`flex items-center gap-2 flex-wrap mt-1 ${isTalks ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
          {/* Recharge Amount */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${isTalks ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40' : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40'}`}>
            <span>💰</span>
            <span>₹{gstIncludedAmount} <span className="text-[8px] opacity-75 font-semibold">({t({ en: 'GST Included', kn: 'ಜಿಎಸ್‌ಟಿ ಸೇರಿದೆ' })})</span></span>
          </div>

          {/* Remaining Days */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${isTalks ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40' : 'bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40'}`}>
            <span>📅</span>
            <span>{daysLeft} {t({ en: 'Days', kn: 'ದಿನ' })}</span>
          </div>

          {/* Remaining Minutes (SNEHI only) */}
          {!isTalks && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/40">
              <span>⏱️</span>
              <span>{remainingMins} {t({ en: 'Mins', kn: 'ನಿಮಿ' })}</span>
            </div>
          )}
        </div>
      )}

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
