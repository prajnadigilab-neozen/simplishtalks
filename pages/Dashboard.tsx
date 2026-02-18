
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { Module, LevelStatus } from '../types';

import { useAppStore } from '../store/useAppStore';

const Dashboard: React.FC = () => {
  const { modules } = useAppStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const totalLessons = modules.reduce((acc, mod) => acc + mod.lessons.length, 0);
  const completedLessons = modules.reduce((acc, mod) =>
    acc + mod.lessons.filter(l => l.isCompleted).length, 0
  );
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="p-4 md:p-8 bg-white dark:bg-slate-900 min-h-full transition-colors duration-300">
      {/* Progress Header */}
      <div className="mb-6 md:mb-10 bg-blue-50 dark:bg-slate-800 rounded-2xl md:rounded-3xl p-5 md:p-6 border-2 border-blue-100 dark:border-slate-700 shadow-sm transition-colors">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[10px] md:text-sm font-black text-blue-900 dark:text-blue-300 uppercase tracking-widest">
            {t({ en: 'Your Progress', kn: 'ನಿಮ್ಮ ಪ್ರಗತಿ' })}
          </h3>
          <button
            onClick={() => navigate('/settings')}
            className="text-[9px] md:text-[10px] font-black text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full border border-blue-100 dark:border-slate-700 hover:bg-blue-50 transition-colors uppercase"
          >
            {t({ en: 'Profile 👤', kn: 'ಪ್ರೊಫೈಲ್ 👤' })}
          </button>
        </div>
        <div className="w-full h-3 md:h-4 bg-blue-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-1000 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="flex justify-between items-center mt-3">
          <p className="text-[9px] md:text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase">
            {completedLessons} of {totalLessons} done
          </p>
          <span className="text-lg md:text-xl font-black text-blue-800 dark:text-blue-400">{progressPercentage}%</span>
        </div>
      </div>

      {/* Quick Shortcuts */}
      <div className="mb-8">
        <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mb-4 ml-1">
          {t({ en: 'Quick Shortcuts', kn: 'ಶಾರ್ಟ್‌ಕಟ್‌ಗಳು' })}
        </h4>
        <div className="flex gap-4 md:gap-6 overflow-x-auto no-scrollbar pb-2">
          <ShortcutButton
            icon="🎙️"
            label={t({ en: 'Voice Practice', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸ' })}
            color="bg-orange-500"
            onClick={() => navigate('/talk')}
          />
          <ShortcutButton
            icon="💬"
            label={t({ en: 'Bilingual Chat', kn: 'AI ಚಾಟ್' })}
            color="bg-blue-700"
            onClick={() => navigate('/coachchat')}
          />
          <ShortcutButton
            icon="📚"
            label={t({ en: 'Course Path', kn: 'ಕಲಿಕೆಯ ಹಾದಿ' })}
            color="bg-slate-800 dark:bg-slate-700"
            onClick={() => {
              const element = document.getElementById('course-path');
              element?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8 md:mb-10">
        {/* Live Talk Card */}
        <div
          onClick={() => navigate('/talk')}
          className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-2xl md:rounded-3xl p-5 md:p-6 border-2 border-orange-400 dark:border-amber-600 shadow-lg cursor-pointer hover:scale-[1.01] active:scale-[0.98] transition-all group overflow-hidden relative"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">
                {t({ en: 'Voice Practice', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸ' })}
              </span>
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]"></div>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-1">{t(TRANSLATIONS.talkingAiTitle)}</h3>
            <p className="text-white/80 font-bold text-[10px] md:text-xs max-w-[85%] leading-relaxed">{t(TRANSLATIONS.talkingAiDesc)}</p>
            <div className="mt-4 md:mt-6 flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-[0.2em]">
              {t({ en: 'Talk Now', kn: 'ಮಾತನಾಡಿ' })} <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </div>
        </div>

        {/* Coach Chat Card */}
        <div
          onClick={() => navigate('/coachchat')}
          className="bg-gradient-to-br from-blue-700 to-blue-900 rounded-2xl md:rounded-3xl p-5 md:p-6 border-2 border-blue-600 dark:border-blue-950 shadow-lg cursor-pointer hover:scale-[1.01] active:scale-[0.98] transition-all group overflow-hidden relative"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">
                {t({ en: 'Bilingual Chat', kn: 'AI ಚಾಟ್' })}
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-black text-white mb-1">{t({ en: 'Chat with AI Coach', kn: 'AI ಕೋಚ್ ಜೊತೆ ಚಾಟ್' })}</h3>
            <p className="text-white/80 font-bold text-[10px] md:text-xs max-w-[85%] leading-relaxed">
              {t({ en: 'Ask in Kannada, learn in English.', kn: 'ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಕಲಿಯಿರಿ.' })}
            </p>
            <div className="mt-4 md:mt-6 flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-[0.2em]">
              {t({ en: 'Start Chatting', kn: 'ಮಾತನಾಡಿ' })} <span className="group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </div>
        </div>
      </div>

      <div id="course-path" className="mb-6 md:mb-8 border-l-4 md:border-l-8 border-amber-400 pl-4 py-1 md:py-2">
        <h2 className="text-2xl md:text-3xl font-black text-blue-900 dark:text-blue-300 leading-tight">
          {t({ en: 'Course Path', kn: 'ಕಲಿಕೆಯ ಹಾದಿ' })}
        </h2>
        <p className="text-[10px] md:text-xs text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-1">Gated Learning Levels</p>
      </div>

      <div className="space-y-4 md:space-y-6">
        {modules.map((mod, idx) => (
          <div
            key={mod.level}
            className={`border-2 rounded-2xl overflow-hidden transition-all ${mod.status === LevelStatus.LOCKED
                ? 'bg-gray-50 dark:bg-slate-800 border-gray-100 dark:border-slate-700 opacity-60'
                : 'bg-white dark:bg-slate-800 border-blue-100 dark:border-slate-700 shadow-md'
              }`}
          >
            <div className="p-4 md:p-5">
              <div className="flex justify-between items-start gap-3 mb-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-2xl font-black ${mod.status === LevelStatus.LOCKED
                      ? 'bg-gray-200 dark:bg-slate-700 text-gray-400 dark:text-slate-500'
                      : mod.status === LevelStatus.COMPLETED
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-blue-800 dark:bg-blue-600 text-white shadow-lg'
                    }`}>
                    {idx + 1}
                  </div>
                  <div>
                    <h3 className={`text-base md:text-xl font-black leading-tight ${mod.status === LevelStatus.LOCKED ? 'text-gray-400 dark:text-slate-500' : 'text-blue-900 dark:text-slate-100'}`}>
                      {t(mod.title)}
                    </h3>
                    <p className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest ${mod.status === LevelStatus.LOCKED ? 'text-gray-300' : 'text-amber-500'}`}>
                      {t(mod.level)}
                    </p>
                  </div>
                </div>
                {mod.status === LevelStatus.LOCKED ? (
                  <div className="bg-gray-100 dark:bg-slate-700 p-1.5 md:p-2 rounded-lg text-sm md:text-lg">🔒</div>
                ) : mod.status === LevelStatus.COMPLETED ? (
                  <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-lg text-green-700 dark:text-green-400 font-black text-[8px] md:text-xs">DONE ✓</div>
                ) : null}
              </div>

              <p className="text-xs md:text-sm text-gray-600 dark:text-slate-400 font-medium mb-4 md:mb-6 leading-relaxed">
                {t(mod.description)}
              </p>

              {mod.status !== LevelStatus.LOCKED && (
                <div className="space-y-2">
                  {mod.lessons.map(lesson => (
                    <button
                      key={lesson.id}
                      onClick={() => navigate(`/lesson/${lesson.id}`)}
                      className="w-full flex items-center justify-between p-3 md:p-4 bg-gray-50 dark:bg-slate-900/50 rounded-xl border-2 border-transparent hover:border-blue-400 transition-all group"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-[10px] ${lesson.isCompleted
                            ? 'bg-green-600 text-white'
                            : 'bg-white dark:bg-slate-800 border-2 border-blue-200 text-blue-800 group-hover:bg-blue-800 group-hover:text-white'
                          }`}>
                          {lesson.isCompleted ? '✓' : '▶'}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-xs md:text-sm font-black text-gray-800 dark:text-slate-200">{t(lesson.title)}</span>
                          {lesson.scenario && (
                            <span className="text-[7px] md:text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 mt-0.5">
                              Practice Ready
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-300 group-hover:text-blue-800">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

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

export default Dashboard;
