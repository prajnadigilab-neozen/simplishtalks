/** V 1.0 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { CourseLevel, LevelStatus, PackageType, UserRole } from '../types';
import { TRANSLATIONS } from '../constants';

const CurriculumPage: React.FC = () => {
  const { session, modules, scenarios, progress, loading, setCurrentScenario } = useAppStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const isTalksActive = session?.packageType === PackageType.TALKS || session?.packageType === PackageType.BOTH || session?.role !== UserRole.STUDENT;
  const isSnehiActive = session?.packageType === PackageType.SNEHI || session?.packageType === PackageType.BOTH || session?.role !== UserRole.STUDENT;

  const [activeTab, setActiveTab] = React.useState<'talks' | 'snehi'>(isTalksActive ? 'talks' : 'snehi');
  const [selectedLevel, setSelectedLevel] = React.useState<CourseLevel>(CourseLevel.BASIC);
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

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

  const categories = Array.from(new Set(scenarios.filter(s => s.level === selectedLevel).map(s => s.category.en)));

  const levels = [CourseLevel.BASIC, CourseLevel.INTERMEDIATE, CourseLevel.ADVANCED, CourseLevel.EXPERT];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <header className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-blue-900 dark:text-white uppercase tracking-tighter">
          {t(TRANSLATIONS.curriculum)}
        </h1>
        {isTalksActive && isSnehiActive && (
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => setActiveTab('talks')}
              className={`px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === 'talks' 
                  ? 'bg-blue-600 text-white shadow-lg scale-105' 
                  : 'bg-white dark:bg-slate-800 text-slate-400 hover:text-blue-600 border-2 border-slate-50 dark:border-slate-700'
              }`}
            >
              SIMPLISH-TALKS
            </button>
            <button
              onClick={() => setActiveTab('snehi')}
              className={`px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                activeTab === 'snehi' 
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
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedLevel === l 
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
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                selectedCategory === 'all' 
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
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  selectedCategory === c 
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
                className={`group bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 transition-all p-8 relative overflow-hidden ${
                  module.status === LevelStatus.LOCKED
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
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                            isCompleted ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${
                              isCompleted ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                            }`}>
                              {idx + 1}
                            </span>
                            <span className="text-sm font-black text-slate-700 dark:text-slate-300">{t(lesson.title)}</span>
                          </div>
                          {module.status !== LevelStatus.LOCKED && (
                            <button
                              onClick={() => navigate(`/lesson/${lesson.id}`)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                isCompleted ? 'text-blue-600 hover:bg-blue-100' : 'bg-blue-600 text-white hover:bg-black'
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredScenarios.map((scenario) => {
              const isCompleted = progress?.completedScenarios.includes(scenario.id);
              return (
                <div
                  key={scenario.id}
                  className="bg-white dark:bg-slate-800 rounded-[2rem] border-2 border-slate-50 dark:border-slate-800 p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
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
                  <div className="flex items-center gap-2 mt-6 pt-6 border-t border-slate-50 dark:border-slate-800">
                    <button
                      onClick={() => {
                        setCurrentScenario(scenario.id);
                        navigate('/voice');
                      }}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-95"
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
        )}
      </div>
    </div>
  );
};

export default CurriculumPage;
