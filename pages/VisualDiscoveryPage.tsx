import React, { useEffect } from 'react';
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

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const isFreeTier = session?.packageType === PackageType.NONE;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-10 pb-32 min-h-screen relative">
      {/* Header Area */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <span className="text-4xl shadow-sm">🖼️</span>
            {t({ en: 'Discovery Grid', kn: 'ಡಿಸ್ಕವರಿ ಗ್ರಿಡ್' })}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium max-w-2xl text-sm leading-relaxed">
            {t({ 
              en: 'Explore bite-sized visual learning. Tap any image to focus or cycle. Premium users enjoy exclusive interactive challenges!', 
              kn: 'ಚಿಕ್ಕ ದೃಶ್ಯ ಕಲಿಕೆಯನ್ನು ಅನ್ವೇಷಿಸಿ. ಝೂಮ್ ಮಾಡಲು ಚಿತ್ರದ ಮೇಲೆ ಕ್ಲಿಕ್ ಮಾಡಿ. ಪ್ರೀಮಿಯಂ ಬಳಕೆದಾರರಿಗೆ ವಿಶೇಷ ಸವಾಲುಗಳು ಲಭ್ಯ!' 
            })}
          </p>
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
      {feed.length > 0 && (
        <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 sm:gap-6 space-y-4 sm:space-y-6 animate-fade-in pb-10">
          {feed.map((item, idx) => (
            <VisualCard 
              key={item.id}
              content={item}
              index={idx}
              onOpen={openImage}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && feed.length === 0 && !error && (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl opacity-60">
          <span className="text-4xl mb-4 block">👀</span>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t({ en: 'No content found', kn: 'ಯಾವುದೇ ವಿಷಯ ಕಂಡುಬಂದಿಲ್ಲ' })}</h3>
        </div>
      )}

      {/* Modal View */}
      {activeIndex !== null && <VisualImageModal />}
    </div>
  );
};

export default VisualDiscoveryPage;
