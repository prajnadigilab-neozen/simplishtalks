import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import Logo from '../components/Logo';

const NotFoundPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 md:p-8 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="relative">
        {/* Decorative background elements */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl -z-10 opacity-60 animate-pulse"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-amber-100 dark:bg-amber-900/20 rounded-full blur-3xl -z-10 opacity-60 animate-pulse" style={{ animationDelay: '1s' }}></div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-10 md:p-16 rounded-[3.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-2xl max-w-lg w-full relative overflow-hidden">
          <div className="mb-8 flex justify-center">
             <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-3xl shadow-inner mb-2">
                <Logo textOnly className="text-3xl font-black text-blue-900 dark:text-white" />
             </div>
          </div>
          
          <div className="relative mb-6">
            <span className="text-8xl md:text-9xl font-black text-slate-100 dark:text-slate-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 select-none">404</span>
            <span className="text-6xl md:text-7xl block mb-2 drop-shadow-lg animate-bounce">🔍</span>
          </div>

          <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tighter leading-none">
            {t({ en: 'Page Not Found', kn: 'ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ' })}
          </h1>
          
          <p className="text-slate-600 dark:text-slate-400 font-bold mb-10 text-base md:text-lg leading-relaxed max-w-sm mx-auto">
            {t({
              en: "Sorry, we couldn't find the page you're looking for.",
              kn: "ಕ್ಷಮಿಸಿ, ನೀವು ಹುಡುಕುತ್ತಿರುವ ಪುಟ ನಮಗೆ ಕಂಡುಬಂದಿಲ್ಲ."
            })}
          </p>

          <button
            onClick={() => navigate('/dashboard')}
            className="group relative w-full bg-blue-900 dark:bg-blue-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest overflow-hidden transition-all hover:bg-blue-800 dark:hover:bg-blue-500 active:scale-95 shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              <span>🏠</span>
              {t({ en: 'Back to Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ಗೆ ಹಿಂತಿರುಗಿ' })}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
          
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
             <button 
               onClick={() => navigate('/')}
               className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-blue-600 transition-colors"
             >
               {t({ en: 'Return Home', kn: 'ಹೋಮ್ ಪೇಜ್' })}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
