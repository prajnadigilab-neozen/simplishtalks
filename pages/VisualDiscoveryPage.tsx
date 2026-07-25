import React, { useEffect, useState } from 'react';
import { useVisualStore } from '../store/useVisualStore';
import { VisualCard } from '../components/VisualCard';
import { VisualImageModal } from '../components/VisualImageModal';
import { useLanguage } from '../components/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { PackageType } from '../types';

interface VisualDiscoveryPageProps {
  session: any;
}

const VisualDiscoveryPage: React.FC<VisualDiscoveryPageProps> = ({ session }) => {
  const { feed, loading, error, loadFeed, activeIndex, openImage } = useVisualStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const isFreeTier = session?.packageType === PackageType.NONE;

  const categoryMap: Record<string, { en: string; kn: string }> = {
    jokes: { en: 'Jokes 😆', kn: 'ಹಾಸ್ಯಗಳು 😆' },
    fun_facts: { en: 'Fun Facts 💡', kn: 'ತಮಾಷೆಯ ಸಂಗತಿಗಳು 💡' },
    describe_image: { en: 'Describe Image 🗣️', kn: 'ಚಿತ್ರ ವಿವರಣೆ 🗣️' },
    identify_image: { en: 'Identify Image 🔎', kn: 'ಚಿತ್ರ ಗುರುತಿಸುವಿಕೆ 🔎' },
    complete_sentence: { en: 'Complete Sentence ✍️', kn: 'ವಾಕ್ಯ ಪೂರ್ಣಗೊಳಿಸಿ ✍️' },
  };

  const allCategoryKeys = Array.from(
    new Set([...Object.keys(categoryMap), ...feed.map(item => item.category).filter(Boolean)])
  );

  const categoryOptions = allCategoryKeys.map(key => {
    const info = categoryMap[key];
    const count = feed.filter(item => item.category === key).length;
    const label = info 
      ? t(info) 
      : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { key, label, count };
  });

  const filteredFeed = selectedCategory === 'ALL'
    ? feed
    : feed.filter(item => item.category === selectedCategory);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-10 pb-32 min-h-screen relative">
      {/* Header Area */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <span className="text-4xl shadow-sm">🖼️</span>
            {t({ en: 'Discovery Grid', kn: 'ಡಿಸ್ಕವರಿ ಗ್ರಿಡ್' })}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-2xl text-sm leading-relaxed">
            {t({ 
              en: 'Explore bite-sized visual learning. Filter content by categories or tap any image to focus or cycle.', 
              kn: 'ಚಿಕ್ಕ ದೃಶ್ಯ ಕಲಿಕೆಯನ್ನು ಅನ್ವೇಷಿಸಿ. ವರ್ಗಗಳ ಆಧಾರದ ಮೇಲೆ ಪ್ರದರ್ಶಿಸಿ ಅಥವಾ ಝೂಮ್ ಮಾಡಲು ಚಿತ್ರದ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ.' 
            })}
          </p>
        </div>

        {/* Category Filter Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 shrink-0">
          <label htmlFor="category-select" className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <span>🎯</span> {t({ en: 'Filter Category:', kn: 'ವರ್ಗ ಆಯ್ಕೆ ಮಾಡಿ:' })}
          </label>
          <div className="relative w-full sm:w-64">
            <select
              id="category-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-black text-xs sm:text-sm py-3 px-4 pr-10 rounded-2xl shadow-sm hover:border-blue-500 dark:hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
            >
              <option value="ALL">
                ✨ {t({ en: 'All Categories', kn: 'ಎಲ್ಲಾ ವರ್ಗಗಳು' })} ({feed.length})
              </option>
              {categoryOptions.map(cat => (
                <option key={cat.key} value={cat.key}>
                  {cat.label} ({cat.count})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400 text-xs">
              ▼
            </div>
          </div>
        </div>
      </div>

      {/* Access Banner for Free Users */}
      {isFreeTier && (
        <div className="mb-10 p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden group hover:shadow-md transition-all">
           <div className="flex items-center gap-4 relative z-10">
             <div className="w-12 h-12 bg-white dark:bg-amber-900/50 rounded-full flex items-center justify-center text-xl shadow-sm border border-amber-100 dark:border-amber-700/50">✨</div>
             <div>
               <h3 className="text-[13px] font-black uppercase tracking-widest text-amber-900 dark:text-amber-400 mb-1">{t({ en: 'Unlock the Premium Feed', kn: 'ಪ್ರೀಮಿಯಂ ಫೀಡ್ ಅನ್ಲಾಕ್ ಮಾಡಿ' })}</h3>
               <p className="text-xs font-medium text-amber-700 dark:text-amber-500/80">
                 {t({ en: 'You are viewing the free general feed. Upgrade to unlock interactive visual challenges!', kn: 'ನೀವು ಉಚಿತ ಫೀಡ್ ವೀಕ್ಷಿಸುತ್ತಿದ್ದೀರಿ. ಸಂವಾದಾತ್ಮಕ ಸವಾಲುಗಳನ್ನು ಪಡೆಯಲು ಉತ್ಪನ್ನ ಖರೀದಿಸಿ!' })}
               </p>
             </div>
           </div>
           <button 
             onClick={() => navigate('/packages')}
             className="shrink-0 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors shadow-sm relative z-10 w-full sm:w-auto"
           >
             {t({ en: 'View Packages', kn: 'ಪ್ಯಾಕೇಜ್‌ಗಳನ್ನು ವೀಕ್ಷಿಸಿ' })}
           </button>
           <div className="absolute -right-10 -bottom-10 text-8xl opacity-[0.03] group-hover:scale-110 transition-transform duration-700 pointer-events-none">⭐</div>
        </div>
      )}

      {/* Loading State */}
      {loading && feed.length === 0 && (
        <div className="flex justify-center items-center py-20 opacity-50">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-xl text-center font-medium text-sm border border-rose-100 dark:border-rose-900">
          {error}
        </div>
      )}

      {/* Masonry Grid Area */}
      {filteredFeed.length > 0 && (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 sm:gap-6 space-y-4 sm:space-y-6 animate-fade-in pb-10">
          {filteredFeed.map((item) => {
            const originalIndex = feed.findIndex(f => f.id === item.id);
            return (
              <VisualCard 
                key={item.id}
                content={item}
                index={originalIndex !== -1 ? originalIndex : 0}
                onOpen={openImage}
              />
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredFeed.length === 0 && !error && (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl opacity-60">
          <span className="text-4xl mb-4 block">👀</span>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">
            {t({ en: 'No content found for selected category', kn: 'ಆಯ್ದ ವರ್ಗಕ್ಕೆ ಯಾವುದೇ ವಿಷಯ ಕಂಡುಬಂದಿಲ್ಲ' })}
          </h3>
          {selectedCategory !== 'ALL' && (
            <button 
              onClick={() => setSelectedCategory('ALL')}
              className="mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
            >
              {t({ en: 'Show All Categories', kn: 'ಎಲ್ಲಾ ವರ್ಗಗಳನ್ನು ತೋರಿಸಿ' })}
            </button>
          )}
        </div>
      )}

      {/* Modal View */}
      {activeIndex !== null && <VisualImageModal />}
    </div>
  );
};

export default VisualDiscoveryPage;
