
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import { UserRole } from '../types';
import Logo from '../components/Logo';

interface LandingPageProps {
  session?: any;
}

const LandingPage: React.FC<LandingPageProps> = ({ session }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isLoggedIn = !!session;

  const handleCTA = () => {
    if (!isLoggedIn) {
      navigate('/placement');
    } else if (session.role === UserRole.ADMIN) {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative min-h-full w-full bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300">
      {/* High Contrast Header Section */}
      <div className="bg-blue-900 dark:bg-slate-950 w-full pt-10 md:pt-16 pb-20 md:pb-24 px-4 md:px-16 text-center flex flex-col items-center border-b-4 md:border-b-8 border-amber-400">
        <div className="mb-6 md:mb-8 transform hover:scale-105 transition-transform duration-300">
          <Logo className="w-24 h-24 md:w-40 md:h-40 shadow-2xl rounded-full bg-white border-4 border-white dark:border-slate-800" />
        </div>
        
        <h2 className="text-3xl md:text-7xl text-white tracking-tighter mb-2">
          <span className="font-black">SIMPLISH</span>
          <span className="text-amber-400 font-normal"> - </span>
          <span className="text-amber-400 font-cursive text-5xl md:text-8xl block md:inline">Talks</span>
        </h2>
        <p className="text-amber-400/80 font-bold text-sm md:text-2xl uppercase tracking-[0.2em] md:tracking-[0.3em]">
          {t({ en: 'Listen • Learn • Speak', kn: 'ಕೇಳಿ • ಕಲಿಯಿರಿ • ಮಾತನಾಡಿ' })}
        </p>
      </div>

      {/* Main Action Section - Centered Card */}
      <div className="relative z-10 -mt-12 md:-mt-16 px-4 md:px-6 w-full flex justify-center">
        <div className="bg-white dark:bg-slate-800 p-6 md:p-12 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl border-2 border-orange-100 dark:border-slate-700 text-center w-full max-w-2xl transform transition-all hover:shadow-orange-200/20 dark:hover:shadow-black/40">
          <h3 className="text-xl md:text-4xl font-black text-blue-900 dark:text-blue-300 mb-6 md:mb-8 leading-tight">
            {isLoggedIn 
              ? t({ en: 'Continue your journey!', kn: 'ನಿಮ್ಮ ಕಲಿಕೆಯನ್ನು ಮುಂದುವರಿಸಿ!' })
              : t({ en: 'Ready to speak English?', kn: 'ಇಂಗ್ಲಿಷ್ ಮಾತನಾಡಲು ಸಿದ್ಧರಿದ್ದೀರಾ?' })}
          </h3>
          
          <button 
            onClick={handleCTA}
            className="w-full bg-orange-500 text-white py-5 md:py-8 rounded-2xl md:rounded-3xl font-black text-lg md:text-3xl uppercase tracking-widest hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl mb-4 md:mb-6 border-b-4 md:border-b-8 border-orange-700 flex items-center justify-center gap-2 md:gap-4"
          >
            {isLoggedIn 
              ? (session.role === UserRole.ADMIN ? 'Admin Panel' : 'Continue Learning')
              : t(TRANSLATIONS.startLearning)}
            <span className="text-xl md:text-3xl">➔</span>
          </button>
          
          <div className="flex items-center justify-center gap-2 text-blue-800 dark:text-blue-400 font-black uppercase text-[10px] md:text-sm tracking-widest">
            <span className="w-2 h-2 md:w-3 md:h-3 bg-green-500 rounded-full animate-pulse"></span>
            {isLoggedIn 
              ? t({ en: 'Dashboard Enabled', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಸಕ್ರಿಯವಾಗಿದೆ' })
              : t({ en: 'Free AI Placement Test', kn: 'ಉಚಿತ AI ಪರೀಕ್ಷೆ' })}
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="py-16 md:py-24 px-4 md:px-16 flex flex-col items-center text-center max-w-6xl mx-auto w-full">
        <div className="max-w-3xl mb-12 md:mb-20 w-full">
          <p className="text-xl md:text-4xl text-gray-800 dark:text-slate-100 font-black leading-tight italic border-l-4 md:border-l-8 border-blue-600 dark:border-blue-400 pl-4 md:pl-8 text-left mb-4 md:mb-6">
            {t({ 
              en: '"The limits of my language, are the limits of my world."', 
              kn: '"ನನ್ನ ಭಾಷೆಯ ಮಿತಿಗಳೇ, ನನ್ನ ಪ್ರಪಂಚದ ಮಿತಿಗಳು."' 
            })}
          </p>
          <p className="text-right text-blue-600 dark:text-blue-400 font-black text-sm md:text-xl uppercase tracking-widest">
            - {t({ en: 'LUDWIG WITTGENSTEIN', kn: 'ಲುಡ್ವಿಗ್ ವಿಟ್ಗೆನ್‌ಸ್ಟೈನ್' })}
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 w-full">
          <FeatureCard 
            icon="🤖" 
            title={t({ en: 'AI Powered', kn: 'AI ಶಕ್ತಿ' })} 
            desc={t({ en: 'Personalized English coaching.', kn: 'ವೈಯಕ್ತಿಕ ಇಂಗ್ಲಿಷ್ ತರಬೇತಿ.' })} 
          />
          <FeatureCard 
            icon="📶" 
            title={t({ en: 'Rural Friendly', kn: 'ಗ್ರಾಮೀಣ ಸ್ನೇಹಿ' })} 
            desc={t({ en: 'Works on basic phones.', kn: 'ಸಾಮಾನ್ಯ ಫೋನ್‌ಗಳಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ.' })} 
          />
          <FeatureCard 
            icon="🎙️" 
            title={t({ en: 'Voice Training', kn: 'ಧ್ವನಿ ತರಬೇತಿ' })} 
            desc={t({ en: 'Learn through audio.', kn: 'ಧ್ವನಿ ಪಾಠಗಳ ಮೂಲಕ ಕಲಿಯಿರಿ.' })} 
          />
        </div>
      </div>

      {/* Footer - Moved explicitly inside the flex flow and ensured it has enough bottom padding */}
      <footer className="mt-auto bg-gray-50 dark:bg-slate-950 py-10 md:py-12 px-4 md:px-6 border-t border-gray-200 dark:border-slate-800 w-full mb-20 md:mb-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8">
          <div className="flex items-center gap-4">
            <Logo className="w-10 h-10 opacity-50 grayscale dark:invert dark:opacity-30" />
            <div className="text-gray-500 dark:text-slate-500 font-bold text-[10px] md:text-sm">
              © 2026 Simplish • Karnataka
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            <FooterLink href="#">Privacy</FooterLink>
            <FooterLink href="#">Terms</FooterLink>
            <FooterLink href="#">Support</FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard: React.FC<{icon: string, title: string, desc: string}> = ({ icon, title, desc }) => (
  <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-2xl md:rounded-3xl border-2 border-gray-100 dark:border-slate-700 flex flex-col items-center transition-all hover:border-blue-200 dark:hover:border-blue-400 shadow-sm hover:shadow-md">
    <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-4xl md:text-5xl mb-4 md:mb-6">
      {icon}
    </div>
    <h4 className="text-lg md:text-xl font-black text-blue-900 dark:text-blue-300 mb-2 md:mb-4 uppercase tracking-tight">{title}</h4>
    <p className="text-gray-500 dark:text-slate-400 text-sm md:text-base font-semibold leading-relaxed">{desc}</p>
  </div>
);

const FooterLink: React.FC<{href: string, children: React.ReactNode}> = ({ href, children }) => (
  <a href={href} className="text-gray-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-blue-600 transition-colors">
    {children}
  </a>
);

export default LandingPage;
