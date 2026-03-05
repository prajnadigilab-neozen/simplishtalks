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
    } else if (session.role === UserRole.SUPER_ADMIN || session.role === UserRole.MODERATOR) {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-slate-50 dark:bg-slate-900 flex flex-col font-sans transition-colors duration-300">
      
      {/* 1. Hero Section */}
      <section className="relative px-6 pt-24 pb-20 md:pt-32 md:pb-32 flex flex-col items-center text-center overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 bg-blue-900/5 dark:bg-blue-900/20 -z-10" />
        <div className="absolute top-0 right-0 -m-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 -m-32 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl -z-10" />

        <div className="mb-8 transform hover:scale-105 transition-transform duration-500 drop-shadow-xl">
          <Logo className="w-32 h-32 md:w-48 md:h-48" />
        </div>

        <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 font-bold text-sm tracking-widest uppercase">
          {t({ en: 'Brilliance has no pin code', kn: 'ಪ್ರತಿಭೆಗೆ ಪಿನ್ ಕೋಡ್ ಇಲ್ಲ' })}
        </div>

        <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white mb-6 leading-tight max-w-4xl tracking-tight">
          {t({ en: 'English is a door, not a wall.', kn: 'ಇಂಗ್ಲೀಷ್ ತಡೆಗೋಡೆಯಲ್ಲ, ಅದು ಬಾಗಿಲು.' })}
        </h1>

        <p className="text-lg md:text-2xl text-slate-600 dark:text-slate-300 mb-10 max-w-3xl leading-relaxed">
          {t({ 
            en: "Break the 'elite' barrier. Learn to speak English with clarity and confidence using localized Kannada support. Because eloquence is a tool for everyone—not just the privileged few.", 
            kn: "'ಎಲೈಟ್' ತಡೆಗೋಡೆಯನ್ನು ಒಡೆಯಿರಿ. ಸ್ಥಳೀಯ ಕನ್ನಡ ಬೆಂಬಲದೊಂದಿಗೆ ಸ್ಪಷ್ಟತೆ ಮತ್ತು ವಿಶ್ವಾಸದಿಂದ ಇಂಗ್ಲಿಷ್ ಮಾತನಾಡಲು ಕಲಿಯಿರಿ. ಏಕೆಂದರೆ ವಾಕ್ಚಾತುರ್ಯ ಎಲ್ಲರಿಗೂ ಸೇರಿದ್ದು-ಕೇವಲ ಕೆಲವು ಸವಲತ್ತುಳ್ಳವರಿಗಲ್ಲ." 
          })}
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md mx-auto">
          <button
            onClick={handleCTA}
            className="w-full bg-orange-500 text-white px-8 py-5 rounded-2xl font-black text-xl hover:bg-orange-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-orange-500/20 border-b-4 border-orange-700 flex items-center justify-center gap-2 group"
          >
            {isLoggedIn
              ? (session.role === UserRole.SUPER_ADMIN || session.role === UserRole.MODERATOR ? 'Admin Panel' : 'Continue Learning')
              : t({ en: 'Open The Door (Free)', kn: 'ಬಾಗಿಲು ತೆರೆಯಿರಿ (ಉಚಿತ)' })}
            <span className="text-2xl group-hover:translate-x-1 transition-transform">➔</span>
          </button>
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 font-bold text-sm">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
          {isLoggedIn
            ? t({ en: 'Dashboard Enabled', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಸಕ್ರಿಯವಾಗಿದೆ' })
            : t({ en: 'No credit card required', kn: 'ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್ ಅಗತ್ಯವಿಲ್ಲ' })}
        </div>
      </section>

      {/* 2. Core Philosophy */}
      <section className="py-20 px-6 bg-white dark:bg-slate-950/50 border-y border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'Master English the "Native" Way.', kn: '"ಸ್ಥಳೀಯ" ರೀತಿಯಲ್ಲಿ ಇಂಗ್ಲಿಷ್ ಕರಗತ ಮಾಡಿಕೊಳ್ಳಿ.' })}
            </h2>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed">
              {t({
                en: "Think about it: you didn't learn Kannada by memorizing a textbook. You learned by listening, speaking, and making mistakes. We use that exact same logic. We put speaking first and leave rigid grammar rules behind.",
                kn: "ಯೋಚಿಸಿ: ನೀವು ಪಠ್ಯಪುಸ್ತಕವನ್ನು ಕಂಠಪಾಠ ಮಾಡುವ ಮೂಲಕ ಕನ್ನಡವನ್ನು ಕಲಿಯಲಿಲ್ಲ. ನೀವು ಕೇಳುವ, ಮಾತನಾಡುವ ಮತ್ತು ತಪ್ಪುಗಳನ್ನು ಮಾಡುವ ಮೂಲಕ ಕಲಿತಿದ್ದೀರಿ. ನಾವು ಅದೇ ತರ್ಕವನ್ನು ಬಳಸುತ್ತೇವೆ. ನಾವು ಮಾತನಾಡುವಿಕೆಗೆ ಪ್ರಾಮುಖ್ಯತೆ ನೀಡುತ್ತೇವೆ ಮತ್ತು ಕಠಿಣ ವ್ಯಾಕರಣ ನಿಯಮಗಳನ್ನು ಹಿಂದೆ ಬಿಡುತ್ತೇವೆ."
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <PhilosophyCard
              icon="🎯"
              title={t({ en: 'The Safe Zone', kn: 'ಸುರಕ್ಷಿತ ವಲಯ' })}
              desc={t({ en: "Make 100 mistakes today. We celebrate them. It means you're trying.", kn: "ಇಂದು 100 ತಪ್ಪುಗಳನ್ನು ಮಾಡಿ. ನಾವು ಅವುಗಳನ್ನು ಆಚರಿಸುತ್ತೇವೆ. ಇದರರ್ಥ ನೀವು ಪ್ರಯತ್ನಿಸುತ್ತಿದ್ದೀರಿ ಎಂದರ್ಥ." })}
            />
            <PhilosophyCard
              icon="🤝"
              title={t({ en: 'Kannada Friendly', kn: 'ಕನ್ನಡ-ಸ್ನೇಹಿ' })}
              desc={t({ en: 'We use your mother tongue to build bridges, not confusion.', kn: 'ನಾವು ಗೊಂದಲವಲ್ಲ, ಸೇತುವೆಗಳನ್ನು ನಿರ್ಮಿಸಲು ನಿಮ್ಮ ಮಾತೃಭಾಷೆಯನ್ನು ಬಳಸುತ್ತೇವೆ.' })}
            />
            <PhilosophyCard
              icon="⚖️"
              title={t({ en: 'Paced For You', kn: 'ನಿಮಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ' })}
              desc={t({ en: 'No rush. No pressure. A learning speed that respects your daily life.', kn: 'ಯಾವುದೇ ಆತುರವಿಲ್ಲ. ಯಾವುದೇ ಒತ್ತಡವಿಲ್ಲ. ನಿಮ್ಮ ದೈನಂದಿನ ಜೀವನವನ್ನು ಗೌರವಿಸುವ ಕಲಿಕೆಯ ವೇಗ.' })}
            />
          </div>
        </div>
      </section>

      {/* 3. Key Features */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">
              {t({ en: 'Practice Without Judgement.', kn: 'ಯಾವುದೇ ತೀರ್ಪಿಲ್ಲದೆ ಅಭ್ಯಾಸ ಮಾಡಿ.' })}
            </h2>
            <p className="text-xl text-amber-600 dark:text-amber-500 font-bold">
              {t({ en: 'A safe-to-fail environment designed to kill your fear of speaking.', kn: 'ನಿಮ್ಮ ಮಾತನಾಡುವ ಭಯವನ್ನು ಕೊಲ್ಲಲು ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಸುರಕ್ಷಿತ ಪರಿಸರ.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            <FeatureCard
              icon="💬"
              title={t({ en: 'Learn in Kannada, Build in English', kn: 'ಕನ್ನಡದಲ್ಲಿ ಕಲಿಯಿರಿ, ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ನಿರ್ಮಿಸಿ' })}
              desc={t({ en: 'Got a doubt? Ask in Kannada. Our smart chat interface helps you grasp tough concepts and build strong writing skills without the language barrier getting in the way.', kn: 'ಅನುಮಾನವಿದೆಯೇ? ಕನ್ನಡದಲ್ಲಿ ಕೇಳಿ. ನಮ್ಮ ಸ್ಮಾರ್ಟ್ ಚಾಟ್ ಇಂಟರ್ಫೇಸ್ ಭಾಷೆಯ ತಡೆಗೋಡೆಯಿಲ್ಲದೆ ಕಠಿಣ ಪರಿಕಲ್ಪನೆಗಳನ್ನು ಗ್ರಹಿಸಲು ಮತ್ತು ಬಲವಾದ ಬರವಣಿಗೆ ಕೌಶಲ್ಯಗಳನ್ನು ನಿರ್ಮಿಸಲು ನಿಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ.' })}
            />
            <FeatureCard
              icon="🎙️"
              title={t({ en: 'Talk to AI. Sound like a Pro.', kn: 'AI ಜೊತೆ ಮಾತನಾಡಿ. ಪ್ರೊ ನಂತೆ ಧ್ವನಿಸಿ.' })}
              desc={t({ en: 'Simulate real-world conversations with an AI that listens patiently. Focus entirely on your pronunciation and speaking flow, completely free from the fear of being judged.', kn: 'ತಾಳ್ಮೆಯಿಂದ ಆಲಿಸುವ AI ಯೊಂದಿಗೆ ನೈಜ-ಪ್ರಪಂಚದ ಸಂಭಾಷಣೆಗಳನ್ನು ಅನುಕರಿಸಿ. ನಿಮ್ಮ ಉಚ್ಚಾರಣೆ ಮತ್ತು ಮಾತನಾಡುವ ಹರಿವಿನ ಮೇಲೆ ಸಂಪೂರ್ಣವಾಗಿ ಗಮನಹರಿಸಿ, ನಿರ್ಣಯಿಸಲ್ಪಡುವ ಭಯದಿಂದ ಸಂಪೂರ್ಣವಾಗಿ ಮುಕ್ತರಾಗಿ.' })}
            />
          </div>
        </div>
      </section>

      {/* 4. The Learning Journey */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">
              {t({ en: 'From Hesitation to High-Stakes Communication.', kn: 'ಹಿಂಜರಿಕೆಯಿಂದ ಉನ್ನತ ಮಟ್ಟದ ಸಂವಹನದವರೆಗೆ.' })}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              {t({ en: 'A tiered path that guides you from your first confident sentence to commanding a boardroom.', kn: 'ನಿಮ್ಮ ಮೊದಲ ವಾಕ್ಯದಿಂದ ಬೋರ್ಡ್‌ರೂಮ್‌ಗೆ ಮಾರ್ಗದರ್ಶನ ನೀಡುವ ಶ್ರೇಣೀಕೃತ ಮಾರ್ಗ.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <JourneyStep num="1" title={t({ en: 'The Basics', kn: 'ಮೂಲಭೂತ' })} desc={t({ en: 'Break the ice. Build your comfort zone and master core foundations.', kn: 'ನಿಮ್ಮ ಸೌಕರ್ಯ ವಲಯವನ್ನು ನಿರ್ಮಿಸಿ ಮತ್ತು ಪ್ರಮುಖ ಅಡಿಪಾಯಗಳನ್ನು ಕರಗತ ಮಾಡಿಕೊಳ್ಳಿ.' })} />
            <JourneyStep num="2" title={t({ en: 'Intermediate', kn: 'ಮಧ್ಯಮ' })} desc={t({ en: 'Step out into the world. Handle everyday conversations with absolute ease.', kn: 'ಜಗತ್ತಿಗೆ ಕಾಲಿಡಿ. ದೈನಂದಿನ ಸಂಭಾಷಣೆಗಳನ್ನು ಸಂಪೂರ್ಣ ಸುಲಭವಾಗಿ ನಿಭಾಯಿಸಿ.' })} />
            <JourneyStep num="3" title={t({ en: 'Advanced', kn: 'ಸುಧಾರಿತ' })} desc={t({ en: 'Stop translating in your head. Achieve a natural flow and speak instinctively.', kn: 'ನಿಮ್ಮ ತಲೆಯಲ್ಲಿ ಭಾಷಾಂತರಿಸುವುದನ್ನು ನಿಲ್ಲಿಸಿ. ನೈಸರ್ಗಿಕ ಹರಿವನ್ನು ಸಾಧಿಸಿ ಮತ್ತು ಸಹಜವಾಗಿ ಮಾತನಾಡಿ.' })} />
            <JourneyStep num="4" title={t({ en: 'Expert', kn: 'ಪರಿಣಿತ' })} desc={t({ en: 'Command the room. Polish your professionalism for high-stakes career communication.', kn: 'ಕೊಠಡಿಯನ್ನು ಕಮಾಂಡ್ ಮಾಡಿ. ಉನ್ನತ ಮಟ್ಟದ ವೃತ್ತಿಜೀವನದ ಸಂವಹನಕ್ಕಾಗಿ ನಿಮ್ಮ ವೃತ್ತಿಪರತೆಯನ್ನು ಪಾಲಿಶ್ ಮಾಡಿ.' })} />
          </div>

          <div className="mt-16 flex justify-center">
             <button
              onClick={handleCTA}
              className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg flex items-center gap-3"
            >
              {t({ en: 'Find Your Starting Level', kn: 'ನಿಮ್ಮ ಆರಂಭಿಕ ಮಟ್ಟವನ್ನು ಹುಡುಕಿ' })}
              <span>➔</span>
            </button>
          </div>
        </div>
      </section>

      {/* 5. Final Motivation */}
      <section className="py-24 px-6 bg-blue-900 dark:bg-slate-950 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}></div>
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
            {t({ en: 'Your voice deserves to be heard.', kn: 'ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ಕೇಳಲು ಅರ್ಹತೆಯಿದೆ.' })}
            <br />
            <span className="text-blue-300">{t({ en: "Let's make sure they understand it.", kn: 'ಅದನ್ನು ಅವರು ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವಂತೆ ಮಾಡೋಣ.' })}</span>
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl">
            {t({ en: 'Join thousands of learners breaking down walls and opening new doors.', kn: 'ಗೋಡೆಗಳನ್ನು ಒಡೆಯುವ ಮತ್ತು ಹೊಸ ಬಾಗಿಲುಗಳನ್ನು ತೆರೆಯುವ ಸಾವಿರಾರು ಕಲಿಯುವವರೊಂದಿಗೆ ಸೇರಿ.' })}
          </p>
          <button
            onClick={handleCTA}
            className="bg-amber-400 text-blue-950 px-10 py-5 rounded-2xl font-black text-2xl hover:bg-amber-300 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-amber-400/20 border-b-4 border-amber-600 flex items-center gap-3"
          >
            {isLoggedIn ? (session.role === UserRole.SUPER_ADMIN || session.role === UserRole.MODERATOR ? 'Admin Panel' : 'Continue Learning') : t({ en: 'Start Your Free Journey', kn: 'ನಿಮ್ಮ ಉಚಿತ ಪ್ರಯಾಣವನ್ನು ಪ್ರಾರಂಭಿಸಿ' })}
            <span>🚀</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 py-12 px-6 border-t border-slate-800 w-full relative z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <Logo textOnly className="text-2xl font-black invert opacity-50" />
            <div className="text-slate-500 font-bold text-sm">
              © 2026 Simplish - Talks • Karnataka
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <FooterLink href="#">Privacy Policy</FooterLink>
            <FooterLink href="#">Terms of Service</FooterLink>
            <FooterLink href="#">Contact</FooterLink>
          </div>
        </div>
      </footer>
    </div>
  );
};

const PhilosophyCard: React.FC<{ icon: string, title: string, desc: string }> = ({ icon, title, desc }) => (
  <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 transition-all hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-lg hover:-translate-y-1">
    <div className="text-5xl mb-6">{icon}</div>
    <h3 className="text-2xl font-black text-slate-900 dark:text-blue-200 mb-4">{title}</h3>
    <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{desc}</p>
  </div>
);

const FeatureCard: React.FC<{ icon: string, title: string, desc: string }> = ({ icon, title, desc }) => (
  <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-3xl border-2 border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col h-full">
    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 rounded-2xl flex items-center justify-center text-3xl mb-6">
      {icon}
    </div>
    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-4 leading-snug">{title}</h3>
    <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium text-lg">{desc}</p>
  </div>
);

const JourneyStep: React.FC<{ num: string, title: string, desc: string }> = ({ num, title, desc }) => (
  <div className="relative p-6 bg-slate-50 dark:bg-slate-900/40 rounded-3xl border border-slate-100 dark:border-slate-800">
    <div className="text-6xl font-black text-slate-200 dark:text-slate-800 mb-4">{num}</div>
    <h4 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 relative z-10">{title}</h4>
    <p className="text-sm text-slate-600 dark:text-slate-400 relative z-10">{desc}</p>
  </div>
);

const FooterLink: React.FC<{ href: string, children: React.ReactNode }> = ({ href, children }) => (
  <a href={href} className="text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">
    {children}
  </a>
);

export default LandingPage;
