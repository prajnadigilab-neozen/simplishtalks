import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { UserRole } from '../types';
import Logo from '../components/Logo';
import TestimonialWidget from '../components/TestimonialWidget';

interface LandingPageProps {
  session?: any;
}

const LandingPage: React.FC<LandingPageProps> = ({ session }) => {
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const isLoggedIn = !!session;

  // Interactive UI states
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Simulation states
  const [simStep, setSimStep] = useState(1); // 1: Choose Scenario, 2: Record Voice, 3: AI Feedback
  const [simScenario, setSimScenario] = useState<'office' | 'travel'>('office');
  const [simRecording, setSimRecording] = useState(false);
  const [simProgress, setSimProgress] = useState(0);

  useEffect(() => {
    let interval: any;
    if (simRecording) {
      interval = setInterval(() => {
        setSimProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setSimRecording(false);
            setSimStep(3);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [simRecording]);

  const handleCTA = () => {
    if (!isLoggedIn) {
      navigate('/placement');
    } else if (session.role === UserRole.SUPER_ADMIN || session.role === UserRole.MODERATOR) {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handleSnehiCTA = () => {
    if (!isLoggedIn) {
      navigate('/placement');
    } else {
      navigate('/talk');
    }
  };

  const startSimulation = () => {
    setSimStep(1);
    setSimProgress(0);
    setSimRecording(false);
    setShowPromoModal(true);
  };

  const faqs = [
    {
      q: t({
        en: 'Do I need good English before using Talks or Snehi?',
        kn: 'ಟಾಕ್ಸ್ ಅಥವಾ ಸ್ನೇಹಿ ಬಳಸುವ ಮುನ್ನ ನನಗೆ ಒಳ್ಳೆಯ ಇಂಗ್ಲಿಷ್ ಬೇಕೇ?'
      }),
      a: t({
        en: 'No. You can start with basic English and improve through practice.',
        kn: 'ಇಲ್ಲ. ನೀವು ಮೂಲ ಇಂಗ್ಲಿಷ್‌ನಿಂದ ಪ್ರಾರಂಭಿಸಿ ಅಭ್ಯಾಸದ ಮೂಲಕ ಸುಧಾರಿಸಬಹುದು.'
      })
    },
    {
      q: t({
        en: 'Will Snehi correct every mistake?',
        kn: 'ಸ್ನೇಹಿ ಪ್ರತಿ ತಪ್ಪನ್ನೂ ತಿದ್ದುತ್ತಾರೆಯೆ?'
      }),
      a: t({
        en: 'Snehi focuses on helping you communicate confidently while encouraging improvement.',
        kn: 'ಸ್ನೇಹಿ ನೀವು ಆತ್ಮಿವಿಶ್ವಾಸದಿಂದ ಸಂವಹನ ನಡೆಸಲು ಸಹಾಯ ಮಾಡುವತ್ತ ಗಮನ ಹರಿಸುತ್ತದೆ ಮತ್ತು ಸುಧಾರಣೆಗೆ ಪ್ರೋತ್ಸಾಹಿಸುತ್ತದೆ.'
      })
    },
    {
      q: t({
        en: 'Can I practice alone?',
        kn: 'ನಾನು ಒಬ್ಬನೇ ಅಭ್ಯಾಸ ಮಾಡಬಹುದೇ?'
      }),
      a: t({
        en: 'Yes. SIMPLISH Talks is designed for private speaking practice.',
        kn: 'ಹೌದು. ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ ಅನ್ನು ಖಾಸಗಿ ಮಾತನಾಡುವ ಅಭ್ಯಾಸಕ್ಕಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ.'
      })
    },
    {
      q: t({
        en: 'Can I choose conversation topics?',
        kn: 'ನಾನು ಸಂಭಾಷಣೆಯ ವಿಷಯಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಬಹುದೇ?'
      }),
      a: t({
        en: 'Yes. Snehi allows you to select or create practice scenarios.',
        kn: 'ಹೌದು. ಸ್ನೇಹಿ ನಿಮಗೆ ಸನ್ನಿವೇಶಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಲು ಅಥವಾ ರಚಿಸಲು ಅನುಮತಿಸುತ್ತದೆ.'
      })
    },
    {
      q: t({
        en: 'Is this suitable for interview preparation?',
        kn: 'ಇದು ಸಂದರ್ಶನದ ಸಿದ್ಧತೆಗೆ ಸೂಕ್ತವೇ?'
      }),
      a: t({
        en: 'Absolutely. Many scenarios are designed around workplace and interview communication.',
        kn: 'ಖಂಡಿತವಾಗಿಯೂ. ಅನೇಕ ಸನ್ನಿವೇಶಗಳನ್ನು ಕೆಲಸದ ಸ್ಥಳ ಮತ್ತು ಸಂದರ್ಶನದ ಸಂವಹನದ ಸುತ್ತ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ.'
      })
    },
    {
      q: t({
        en: 'Will people hear my recordings?',
        kn: 'ಜನರು ನನ್ನ ರೆಕಾರ್ಡಿಂಗ್‌ಗಳನ್ನು ಕೇಳುತ್ತಾರೆಯೇ?'
      }),
      a: t({
        en: 'No. Your practice sessions remain private.',
        kn: 'ಇಲ್ಲ. ನಿಮ್ಮ ಅಭ್ಯಾಸದ ಅವಧಿಗಳು ಖಾಸಗಿಯಾಗಿರುತ್ತವೆ.'
      })
    }
  ];

  return (
    <div className="relative min-h-screen w-full bg-slate-50 dark:bg-slate-900 flex flex-col font-sans transition-colors duration-300">

      {/* SECTION 1: HERO SECTION */}
      <section className="relative px-6 pt-24 pb-20 md:pt-32 md:pb-32 flex flex-col items-center text-center overflow-hidden border-b border-slate-200 dark:border-slate-800">
        {/* Decorative background shapes */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900/5 via-indigo-900/5 to-transparent dark:from-blue-900/10 dark:via-slate-900/30 -z-10" />
        <div className="absolute top-0 right-0 -m-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl -z-10 animate-pulse" />
        <div className="absolute bottom-0 left-0 -m-32 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl -z-10" />

        <div className="mb-8 transform hover:scale-105 transition-transform duration-500 drop-shadow-xl">
          <Logo />
        </div>

        {/* Pre-header */}
        <div className="inline-flex flex-col items-center gap-1 px-5 py-2.5 mb-8 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 shadow-sm">
          <span className="text-blue-800 dark:text-blue-300 font-extrabold text-sm md:text-base tracking-wide flex items-center gap-1.5">
            {t({ en: '🎤 SIMPLISH Talks + 🤖 Snehi AI', kn: '🎤 ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ + 🤖 ಸ್ನೇಹಿ AI' })}
          </span>
          <span className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">
            {t({ en: 'Practice. Speak. Gain Confidence.', kn: 'ಅಭ್ಯಾಸ ಮಾಡಿ. ಮಾತನಾಡಿ. ಆತ್ಮವಿಶ್ವಾಸ ಗಳಿಸಿ.' })}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-7xl font-black text-slate-900 dark:text-white mb-6 leading-tight max-w-4xl tracking-tight">
          {t({
            en: 'Speak English Without Fear',
            kn: 'ಭಯವಿಲ್ಲದೆ ಇಂಗ್ಲಿಷ್ ಮಾತನಾಡಿ'
          })}
        </h1>

        {/* Sub-headline */}
        <p className="text-lg md:text-2xl font-bold text-indigo-650 dark:text-indigo-400 mb-6 max-w-3xl leading-relaxed">
          {t({
            en: 'Practice real conversations, improve your speaking skills, and build confidence with your AI English friend—Snehi.',
            kn: 'ನಿಮ್ಮ AI ಇಂಗ್ಲಿಷ್ ಸ್ನೇಹಿತ ಸ್ನೇಹಿಯೊಂದಿಗೆ ನೈಜ ಸಂಭಾಷಣೆಗಳನ್ನು ಅಭ್ಯಾಸ ಮಾಡಿ, ನಿಮ್ಮ ಮಾತನಾಡುವ ಕೌಶಲ್ಯವನ್ನು ಸುಧಾರಿಸಿ ಮತ್ತು ಆತ್ಮವಿಶ್ವಾಸವನ್ನು ಬೆಳೆಸಿಕೊಳ್ಳಿ.'
          })}
        </p>

        {/* Supporting Copy */}
        <div className="max-w-3xl mb-12 text-slate-700 dark:text-slate-300 bg-white/45 dark:bg-slate-950/20 backdrop-blur-sm border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 md:p-8 text-center space-y-4">
          <p className="font-semibold text-lg">
            {t({ en: 'Understanding English is only the first step.', kn: 'ಇಂಗ್ಲಿಷ್ ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವುದು ಕೇವಲ ಮೊದಲ ಹೆಜ್ಜೆ.' })}
            <br />
            <span className="text-slate-900 dark:text-white font-black">
              {t({ en: 'Real confidence comes from speaking.', kn: 'ನಿಜವಾದ ಆತ್ಮವಿಶ್ವಾಸ ಮಾತನಾಡುವುದರಿಂದ ಬರುತ್ತದೆ.' })}
            </span>
          </p>
          <p className="text-sm md:text-base leading-relaxed text-slate-650 dark:text-slate-400">
            {t({
              en: 'With SIMPLISH Talks and Snehi, you can practice conversations, record your voice, improve pronunciation, learn useful vocabulary, and speak naturally—all in a safe, supportive environment designed for Kannada speakers.',
              kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ ಮತ್ತು ಸ್ನೇಹಿಯೊಂದಿಗೆ, ನೀವು ಸಂಭಾಷಣೆಗಳನ್ನು ಅಭ್ಯಾಸ ಮಾಡಬಹುದು, ನಿಮ್ಮ ಧ್ವನಿಯನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಬಹುದು, ಉಚ್ಚಾರಣೆಯನ್ನು ಸುಧಾರಿಸಬಹುದು, ಉಪಯುಕ್ತ ಶಬ್ದಕೋಶವನ್ನು ಕಲಿಯಬಹುದು ಮತ್ತು ಸ್ವಾಭಾವಿಕವಾಗಿ ಮಾತನಾಡಬಹುದು—ಎಲ್ಲವೂ ಕನ್ನಡ ಮಾತನಾಡುವವರಿಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಸುರಕ್ಷಿತ ಮತ್ತು ಬೆಂಬಲಿತ ವಾತಾವರಣದಲ್ಲಿ.'
            })}
          </p>
          <div className="flex justify-center items-center gap-6 pt-2 text-xs font-black tracking-widest text-slate-400 uppercase">
            <span>{t({ en: 'No shame.', kn: 'ನಾಚಬೇಡಿ' })}</span>
            <span>•</span>
            <span>{t({ en: 'No pressure.', kn: 'ಒತ್ತಡವಿಲ್ಲ' })}</span>
            <span>•</span>
            <span>{t({ en: 'Just practice & progress.', kn: 'ಕೇವಲ ಅಭ್ಯಾಸ ಮತ್ತು ಪ್ರಗತಿ' })}</span>
          </div>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-2xl mx-auto px-4 mb-16">
          <button
            onClick={handleCTA}
            className="w-full sm:flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-8 py-5 rounded-2xl font-black text-xl hover:from-orange-600 hover:to-amber-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-orange-500/20 border-b-4 border-orange-700 flex items-center justify-center gap-2 group"
          >
            🚀 {t({ en: 'Start Practicing', kn: 'ಅಭ್ಯಾಸ ಮಾಡಲು ಪ್ರಾರಂಭಿಸಿ' })}
          </button>

          <button
            onClick={startSimulation}
            className="w-full sm:flex-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-white border-2 border-slate-200 dark:border-slate-700 px-8 py-5 rounded-2xl font-black text-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg hover:border-indigo-400 dark:hover:border-indigo-500"
          >
            ▶ {t({ en: 'Watch How It Works', kn: 'ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ ಎಂದು ನೋಡಿ' })}
          </button>
        </div>

        {/* Trust Indicators */}
        <div className="w-full max-w-4xl">
          <p className="text-xs uppercase tracking-widest text-slate-400 font-extrabold mb-6">
            {t({ en: 'Why learners love SIMPLISH', kn: 'ಕಲಿಯುವವರು ಸಿಂಪ್ಲಿಷ್ ಅನ್ನು ಪ್ರೀತಿಸಲು ಕಾರಣ' })}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4">
            <TrustBadge label={t({ en: 'Real-Life Scenarios', kn: 'ನೈಜ-ಜೀವನದ ಸನ್ನಿವೇಶಗಳು' })} />
            <TrustBadge label={t({ en: 'Voice Practice', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸ' })} />
            <TrustBadge label={t({ en: 'AI Conversation Partner', kn: 'AI ಸಂವಾದದ ಪಾಲುದಾರ' })} />
            <TrustBadge label={t({ en: 'Designed for Kannada Speakers', kn: 'ಕನ್ನಡಿಗರಿಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ' })} />
          </div>
        </div>
      </section>

      {/* SECTION 2: WHY MOST PEOPLE NEVER START SPEAKING */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800 relative">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'Why Most People Never Start Speaking', kn: 'ಹೆಚ್ಚಿನ ಜನರು ಮಾತನಾಡಲು ಏಕೆ ಪ್ರಾರಂಭಿಸುವುದಿಲ್ಲ' })}
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              {t({ en: 'Traditional education teaches us rules, but speaking requires action and safety.', kn: 'ಸಾಂಪ್ರದಾಯಿಕ ಶಿಕ್ಷಣ ನಮಗೆ ನಿಯಮಗಳನ್ನು ಕಲಿಸುತ್ತದೆ, ಆದರೆ ಮಾತನಾಡಲು ಕ್ರಿಯೆ ಮತ್ತು ಸುರಕ್ಷತೆ ಬೇಕು.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-6 flex items-center gap-2">
                <span>💡</span> {t({ en: 'Many learners:', kn: 'ಅನೇಕ ಕಲಿಯುವವರು:' })}
              </h3>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-350">
                  <span className="text-green-500 text-xl">✅</span>
                  <span>{t({ en: 'Understand English', kn: 'ಇಂಗ್ಲಿಷ್ ಅರ್ಥಮಾಡಿಕೊಳ್ಳುತ್ತಾರೆ' })}</span>
                </li>
                <li className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-350">
                  <span className="text-green-500 text-xl">✅</span>
                  <span>{t({ en: 'Know grammar', kn: 'ವ್ಯಾಕರಣ ತಿಳಿದಿರುತ್ತಾರೆ' })}</span>
                </li>
                <li className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-350">
                  <span className="text-green-500 text-xl">✅</span>
                  <span>{t({ en: 'Know vocabulary', kn: 'ಶಬ್ದಕೋಶ ತಿಳಿದಿರುತ್ತಾರೆ' })}</span>
                </li>
              </ul>
              <p className="mt-8 text-red-500 dark:text-red-400 font-extrabold flex items-center gap-2 text-lg">
                ⚠️ {t({ en: 'But still hesitate to speak. Why?', kn: 'ಆದರೆ ಮಾತನಾಡಲು ಇನ್ನೂ ಹಿಂಜರಿಯುತ್ತಾರೆ. ಏಕೆ?' })}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold text-slate-950 dark:text-white mb-6 flex items-center gap-2">
                <span>💔</span> {t({ en: 'Because they fear:', kn: 'ಏಕೆಂದರೆ ಅವರು ಭಯಪಡುತ್ತಾರೆ:' })}
              </h3>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-350">
                  <span className="text-red-500 text-xl">❌</span>
                  <span>{t({ en: 'Making mistakes', kn: 'ತಪ್ಪು ಮಾಡಬಹುದೆಂದು' })}</span>
                </li>
                <li className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-350">
                  <span className="text-red-500 text-xl">❌</span>
                  <span>{t({ en: 'Being judged', kn: 'ಇತರರು ಹಾಸ್ಯ ಮಾಡುತ್ತಾರೆಂದು' })}</span>
                </li>
                <li className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-350">
                  <span className="text-red-500 text-xl">❌</span>
                  <span>{t({ en: 'Forgetting words', kn: 'ಪದಗಳನ್ನು ಮರೆತು ಹೋಗುತ್ತದೆಂದು' })}</span>
                </li>
                <li className="flex items-center gap-3 font-semibold text-slate-700 dark:text-slate-350">
                  <span className="text-red-500 text-xl">❌</span>
                  <span>{t({ en: 'Speaking in front of others', kn: 'ಇತರರ ಮುಂದೆ ಮಾತನಾಡಲು ಹಿಂಜರಿಕೆಯಿಂದ' })}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-950/30 border-2 border-indigo-200 dark:border-indigo-800 rounded-3xl p-6 md:p-8 text-center text-indigo-950 dark:text-indigo-200 font-extrabold text-lg">
            ✨ {t({
              en: 'SIMPLISH Talks and Snehi help remove that fear through consistent, private practice.',
              kn: 'ಸ್ಥಿರವಾದ, ವೈಯಕ್ತಿಕ ಅಭ್ಯಾಸದ ಮೂಲಕ ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ ಮತ್ತು ಸ್ನೇಹಿ ಆ ಭಯವನ್ನು ಹೋಗಲಾಡಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.'
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: PRACTICE BEFORE REAL LIFE */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4">
              {t({ en: 'Practice Before Real Life', kn: 'ನೈಜ ಜೀವನಕ್ಕೆ ಮುನ್ನ ಅಭ್ಯಾಸ ಮಾಡಿ' })}
            </h2>
            <p className="text-xl text-blue-600 dark:text-blue-400 font-extrabold">
              {t({ en: 'SIMPLISH Talks', kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್' })}
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
              {t({ en: 'Your personal English practice space.', kn: 'ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಇಂಗ್ಲಿಷ್ ಅಭ್ಯಾಸದ ಸ್ಥಳ.' })}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-12">
            <ScenarioCard icon="🏢" label={t({ en: 'Office conversations', kn: 'ಕಚೇರಿ ಸಂಭಾಷಣೆಗಳು' })} />
            <ScenarioCard icon="🎓" label={t({ en: 'College discussions', kn: 'ಕಾಲೇಜು ಚರ್ಚೆಗಳು' })} />
            <ScenarioCard icon="🛒" label={t({ en: 'Shopping', kn: 'ಶಾಪಿಂಗ್' })} />
            <ScenarioCard icon="✈️" label={t({ en: 'Travel', kn: 'ಪ್ರಯಾಣ' })} />
            <ScenarioCard icon="☎️" label={t({ en: 'Phone calls', kn: 'ಫೋನ್ ಕರೆಗಳು' })} />
            <ScenarioCard icon="🤝" label={t({ en: 'Meeting new people', kn: 'ಹೊಸ ಜನರನ್ನು ಭೇಟಿಯಾಗುವುದು' })} />
          </div>

          <p className="text-center text-slate-600 dark:text-slate-400 font-black text-lg">
            📖 {t({ en: 'Read, record, listen, and improve at your own pace.', kn: 'ಓದಿ, ರೆಕಾರ್ಡ್ ಮಾಡಿ, ಆಲಿಸಿ ಮತ್ತು ನಿಮ್ಮದೇ ಆದ ವೇಗದಲ್ಲಿ ಸುಧಾರಿಸಿ.' })}
          </p>
        </div>
      </section>

      {/* SECTION 4: HEAR YOURSELF IMPROVE */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'Hear Yourself Improve', kn: 'ನಿಮ್ಮ ಸುಧಾರಣೆಯನ್ನು ನೀವೇ ಕೇಳಿ' })}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              {t({
                en: 'One of the fastest ways to improve speaking is hearing yourself speak.',
                kn: 'ಮಾತನಾಡುವುದನ್ನು ಸುಧಾರಿಸಲು ಅತ್ಯಂತ ವೇಗವಾದ ಮಾರ್ಗವೆಂದರೆ ನಿಮ್ಮ ಮಾತನ್ನು ನೀವೇ ಕೇಳುವುದು.'
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-16">
            <ImproveStep num="1" icon="📖" text={t({ en: 'Read aloud', kn: 'ಗಟ್ಟಿಯಾಗಿ ಓದುವುದು' })} />
            <ImproveStep num="2" icon="🎤" text={t({ en: 'Record your voice', kn: 'ನಿಮ್ಮ ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡುವುದು' })} />
            <ImproveStep num="3" icon="🎧" text={t({ en: 'Listen to recordings', kn: 'ನಿಮ್ಮ ರೆಕಾರ್ಡಿಂಗ್ ಆಲಿಸುವುದು' })} />
            <ImproveStep num="4" icon="🗣️" text={t({ en: 'Improve pronunciation', kn: 'ಉಚ್ಚಾರಣೆ ಸುಧಾರಿಸುವುದು' })} />
            <ImproveStep num="5" icon="📈" text={t({ en: 'Build confidence', kn: 'ಆತ್ಮವಿಶ್ವಾಸ ಬೆಳೆಸಿಕೊಳ್ಳುವುದು' })} />
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-105 dark:border-slate-800 rounded-3xl p-8 max-w-xl mx-auto text-center space-y-3 shadow-md">
            <div className="text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-widest text-xs">
              {t({ en: 'Safe Practice Space', kn: 'ಸುರಕ್ಷಿತ ಅಭ್ಯಾಸ ಸ್ಥಳ' })}
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {t({ en: 'No audience. No embarrassment.', kn: 'ಯಾವುದೇ ಪ್ರೇಕ್ಷಕರಿಲ್ಲ. ಯಾವುದೇ ಮುಜುಗರವಿಲ್ಲ.' })}
            </p>
            <p className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">
              {t({ en: 'Just you and your progress.', kn: 'ಕೇವಲ ನೀವು ಮತ್ತು ನಿಮ್ಮ ಪ್ರಗತಿ.' })}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 5: LEARN THROUGH REAL CONVERSATIONS */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'Learn Through Real Conversations', kn: 'ನೈಜ ಸಂಭಾಷಣೆಗಳ ಮೂಲಕ ಕಲಿಯಿರಿ' })}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              {t({
                en: 'Instead of memorizing isolated words, learn English through practical situations.',
                kn: 'ಪ್ರತ್ಯೇಕ ಪದಗಳನ್ನು ಕಂಠಪಾಠ ಮಾಡುವ ಬದಲು, ಪ್ರಾಯೋಗಿಕ ಸನ್ನಿವೇಶಗಳ ಮೂಲಕ ಇಂಗ್ಲಿಷ್ ಕಲಿಯಿರಿ.'
              })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 mb-12">
            <FeatureBadge icon="📖" title={t({ en: 'Everyday conversations', kn: 'ದೈನಂದಿನ ಸಂಭಾಷಣೆಗಳು' })} />
            <FeatureBadge icon="📝" title={t({ en: 'Vocabulary cards', kn: 'ಶಬ್ದಕೋಶದ ಕಾರ್ಡ್‌ಗಳು' })} />
            <FeatureBadge icon="🎯" title={t({ en: 'Quick quizzes', kn: 'ತ್ವರಿತ ರಸಪ್ರಶ್ನೆಗಳು' })} />
            <FeatureBadge icon="💡" title={t({ en: 'Explanations for mistakes', kn: 'ತಪ್ಪು ಉತ್ತರಗಳಿಗೆ ವಿವರಣೆಗಳು' })} />
            <FeatureBadge icon="😂" title={t({ en: 'Fun language tips & jokes', kn: 'ಮೋಜಿನ ಭಾಷಾ ಸಲಹೆಗಳು ಮತ್ತು ಹಾಸ್ಯಗಳು' })} />
          </div>

          <p className="text-center text-blue-600 dark:text-blue-400 font-black text-xl">
            🔥 {t({ en: 'This helps new words stay in your memory longer.', kn: 'ಇದು ಹೊಸ ಪದಗಳು ನಿಮ್ಮ ನೆನಪಿನಲ್ಲಿ ಹೆಚ್ಚು ಕಾಲ ಉಳಿಯಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.' })}
          </p>
        </div>
      </section>

      {/* SECTION 6: MEET SNEHI (YOUR AI ENGLISH FRIEND) */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="relative w-64 h-64 md:w-80 md:h-80 bg-gradient-to-tr from-amber-400 to-orange-500 rounded-[3rem] overflow-hidden shadow-2xl transform hover:scale-[1.02] transition-transform duration-500 border-4 border-white dark:border-slate-800">
                <img
                  src="/female_coach.png"
                  alt="Snehi AI"
                  className="w-full h-full object-cover object-top filter contrast-[1.05]"
                />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-slate-950/80 to-transparent p-6 text-white text-center">
                  <span className="font-black text-2xl">SNEHI</span>
                  <span className="block text-xs font-bold text-amber-300 uppercase tracking-widest mt-1">
                    {t({ en: 'AI English Partner', kn: 'AI ಇಂಗ್ಲಿಷ್ ಪಾಲುದಾರ' })}
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-orange-500 font-extrabold">
                  {t({ en: 'Meet Snehi', kn: 'ಸ್ನೇಹಿಯನ್ನು ಭೇಟಿಯಾಗಿ' })}
                </span>
                <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mt-2 mb-4 leading-tight">
                  {t({ en: 'Your AI English Friend', kn: 'ನಿಮ್ಮ AI ಇಂಗ್ಲಿಷ್ ಸ್ನೇಹಿತ' })}
                </h2>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex-1 text-center font-bold">
                  ❌ {t({ en: 'Snehi is not a teacher', kn: 'ಸ್ನೇಹಿ ಶಿಕ್ಷಕರಲ್ಲ' })}
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl flex-1 text-center font-bold">
                  ❌ {t({ en: 'Snehi is not an examiner', kn: 'ಸ್ನೇಹಿ ಪರೀಕ್ಷಕರಲ್ಲ' })}
                </div>
              </div>

              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 p-6 rounded-2xl font-black text-indigo-900 dark:text-indigo-300 text-lg">
                🤝 {t({ en: 'Snehi is a supportive conversation partner.', kn: 'ಸ್ನೇಹಿ ಒಬ್ಬ ಬೆಂಬಲ ನೀಡುವ ಸಂಭಾಷಣೆಯ ಪಾಲುದಾರ.' })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SnehiFeatureItem text={t({ en: 'Talk naturally', kn: 'ಸ್ವಾಭಾವಿಕವಾಗಿ ಮಾತನಾಡಿ' })} />
                <SnehiFeatureItem text={t({ en: 'Practice anytime', kn: 'ಯಾವಾಗ ಬೇಕಾದರೂ ಅಭ್ಯಾಸ ಮಾಡಿ' })} />
                <SnehiFeatureItem text={t({ en: 'Choose conversation topics', kn: 'ಸಂಭಾಷಣೆಯ ವಿಷಯಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಿ' })} />
                <SnehiFeatureItem text={t({ en: 'Create custom situations', kn: 'ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶಗಳನ್ನು ರಚಿಸಿ' })} />
                <SnehiFeatureItem text={t({ en: 'Build confidence gradually', kn: 'ಕ್ರಮೇಣ ಆತ್ಮವಿಶ್ವಾಸವನ್ನು ಬೆಳೆಸಿಕೊಳ್ಳಿ' })} />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="text-xl font-extrabold text-slate-805 dark:text-slate-200 italic">
                  💡 "{t({
                    en: 'The goal is not perfect grammar. The goal is comfortable communication.',
                    kn: 'ಗುರಿ ಪರಿಪೂರ್ಣ ವ್ಯಾಕರಣವಲ್ಲ. ಗುರಿ ಆರಾಮದಾಯಕ ಸಂವಹನ.'
                  })}"
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 7: A JUDGMENT-FREE SPEAKING ZONE */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'A Judgment-Free Speaking Zone', kn: 'ಯಾವುದೇ ತೀರ್ಪಿಲ್ಲದ ಮಾತನಾಡುವ ವಲಯ' })}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-medium">
              {t({
                en: 'Most learners stay silent because they fear making mistakes. Snehi was designed differently.',
                kn: 'ಅನೇಕ ಕಲಿಯುವವರು ತಪ್ಪುಗಳನ್ನು ಮಾಡಲು ಹೆದರುವುದರಿಂದ ಮೌನವಾಗಿರುತ್ತಾರೆ. ಸ್ನೇಹಿಯನ್ನು ವಿಭಿನ್ನವಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾಗಿದೆ.'
              })}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-800 p-8 md:p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 shadow-xl max-w-3xl mx-auto mb-12">
            <h3 className="text-2xl font-black text-slate-950 dark:text-white mb-8 text-center">
              {t({ en: 'With Snehi You Can:', kn: 'ಸ್ನೇಹಿಯೊಂದಿಗೆ ನೀವು ಮಾಡಬಹುದು:' })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <CheckItem label={t({ en: 'Pause and think', kn: 'ನಿಲ್ಲಿಸಿ ಯೋಚಿಸಿ' })} />
              <CheckItem label={t({ en: 'Make mistakes safely', kn: 'ಸುರಕ್ಷಿತವಾಗಿ ತಪ್ಪುಗಳನ್ನು ಮಾಡಿ' })} />
              <CheckItem label={t({ en: 'Try again', kn: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' })} />
              <CheckItem label={t({ en: 'Experiment with new words', kn: 'ಹೊಸ ಪದಗಳೊಂದಿಗೆ ಪ್ರಯೋಗ ಮಾಡಿ' })} />
              <div className="sm:col-span-2 flex justify-center pt-2">
                <CheckItem label={t({ en: 'Build confidence one conversation at a time', kn: 'ಒಂದೊಂದೇ ಸಂಭಾಷಣೆಯ ಮೂಲಕ ಆತ್ಮವಿಶ್ವಾಸ ಬೆಳೆಸಿಕೊಳ್ಳಿ' })} />
              </div>
            </div>
          </div>

          <p className="text-center text-xl font-black text-orange-600 dark:text-orange-400">
            🌱 {t({ en: 'Because confidence grows through practice—not perfection.', kn: 'ಏಕೆಂದರೆ ಆತ್ಮವಿಶ್ವಾಸವು ಅಭ್ಯಾಸದ ಮೂಲಕ ಬೆಳೆಯುತ್ತದೆ—ಪರಿಪೂರ್ಣತೆಯಿಂದಲ್ಲ.' })}
          </p>
        </div>
      </section>

      {/* SECTION 8: WHAT MAKES SIMPLISH DIFFERENT */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'What Makes SIMPLISH Different?', kn: 'ಸಿಂಪ್ಲಿಷ್ ಅನ್ನು ವಿಭಿನ್ನವಾಗಿಸುವುದು ಯಾವುದು?' })}
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              {t({ en: 'How does SIMPLISH compare to standard learning models?', kn: 'ಸಾಮಾನ್ಯ ಕಲಿಕೆಯ ವಿಧಾನಗಳಿಗಿಂತ ಸಿಂಪ್ಲಿಷ್ ಹೇಗೆ ಭಿನ್ನವಾಗಿದೆ?' })}
            </p>
          </div>

          <div className="overflow-hidden rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl bg-slate-50 dark:bg-slate-900">
            <table className="w-full border-collapse text-left text-sm md:text-base">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-5 font-black text-slate-700 dark:text-slate-400 w-1/2">
                    {t({ en: 'Traditional English Courses', kn: 'ಸಂಪ್ರದಾಯಿಕ ಇಂಗ್ಲಿಷ್ ಕೋರ್ಸ್‌ಗಳು' })}
                  </th>
                  <th className="p-5 font-black text-indigo-650 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10 w-1/2">
                    {t({ en: 'SIMPLISH Talks + Snehi', kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ + ಸ್ನೇಹಿ' })}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                <CompareRow
                  left={t({ en: 'Grammar-focused', kn: 'ವ್ಯಾಕರಣ-ಕೇಂದ್ರಿತ' })}
                  right={t({ en: 'Conversation-focused', kn: 'ಸಂಭಾಷಣೆ-ಕೇಂದ್ರಿತ' })}
                />
                <CompareRow
                  left={t({ en: 'Passive learning', kn: 'ನಿಷ್ಕ್ರಿಯ ಕಲಿಕೆ' })}
                  right={t({ en: 'Active speaking', kn: 'ಸಕ್ರಿಯ ಮಾತುಕತೆ' })}
                />
                <CompareRow
                  left={t({ en: 'Fear of mistakes', kn: 'ತಪ್ಪುಗಳ ಭಯ' })}
                  right={t({ en: 'Safe practice environment', kn: 'ಸುರಕ್ಷಿತ ಅಭ್ಯಾಸ ಪರಿಸರ' })}
                />
                <CompareRow
                  left={t({ en: 'Classroom pressure', kn: 'ತರಗತಿಯ ಒತ್ತಡ' })}
                  right={t({ en: 'Learn privately', kn: 'ಖಾಸಗಿಯಾಗಿ ಕಲಿಯಿರಿ' })}
                />

                <CompareRow
                  left={t({ en: 'Generic lessons', kn: 'ಸಾಮಾನ್ಯ ಪಾಠಗಳು' })}
                  right={t({ en: 'Real-life scenarios', kn: 'ನೈಜ-ಜೀವನದ ಸನ್ನಿವೇಶಗಳು' })}
                />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 9: YOUR JOURNEY TO CONFIDENCE */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'Your Journey to Confidence', kn: 'ಆತ್ಮವಿಶ್ವಾಸದ ಕಡೆಗೆ ನಿಮ್ಮ ಪ್ರಯಾಣ' })}
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              {t({ en: 'A step-by-step roadmap to natural spoken fluency.', kn: 'ನೈಸರ್ಗಿಕ ಮಾತನಾಡುವ ನಿರರ್ಗಳತೆಗಾಗಿ ಹಂತ-ಹಂತದ ರೋಡ್‌ಮ್ಯಾಪ್.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Visual connector lines for large screens */}
            <div className="hidden lg:block absolute top-1/2 left-4 right-4 h-1 bg-slate-200 dark:bg-slate-700 -translate-y-10 -z-10" />

            <JourneyStepCard
              step="1"
              icon="📚"
              title={t({ en: 'Learn with SIMPLISH LMS', kn: '📚 ಸಿಂಪ್ಲಿಷ್ LMS ನೊಂದಿಗೆ ಕಲಿಯಿರಿ' })}
              desc={t({ en: 'Understand English.', kn: 'ಇಂಗ್ಲಿಷ್ ಅರ್ಥಮಾಡಿಕೊಳ್ಳಿ.' })}
            />
            <JourneyStepCard
              step="2"
              icon="🎤"
              title={t({ en: 'Practice with SIMPLISH Talks', kn: '🎤 ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್‌ನೊಂದಿಗೆ ಅಭ್ಯಾಸ ಮಾಡಿ' })}
              desc={t({ en: 'Build speaking habits.', kn: 'ಮಾತನಾಡುವ ಹವ್ಯಾಸಗಳನ್ನು ಬೆಳೆಸಿಕೊಳ್ಳಿ.' })}
            />
            <JourneyStepCard
              step="3"
              icon="🤖"
              title={t({ en: 'Speak with Snehi', kn: '🤖 ಸ್ನೇಹಿಯೊಂದಿಗೆ ಮಾತನಾಡಿ' })}
              desc={t({ en: 'Gain confidence through conversation.', kn: 'ಸಂಭಾಷಣೆಯ ಮೂಲಕ ಆತ್ಮವಿಶ್ವಾಸ ಗಳಿಸಿ.' })}
            />
            <JourneyStepCard
              step="4"
              icon="🚀"
              title={t({ en: 'Use English in Real Life', kn: '🚀 ನೈಜ ಜೀವನದಲ್ಲಿ ಇಂಗ್ಲಿಷ್ ಬಳಸಿ' })}
              desc={t({ en: 'Interviews. Workplaces. Meetings. Daily conversations.', kn: 'ಸಂದರ್ಶನಗಳು. ಕೆಲಸದ ಸ್ಥಳಗಳು. ಸಭೆಗಳು. ದೈನಂದಿನ ಸಂಭಾಷಣೆಗಳು.' })}
            />
          </div>
        </div>
      </section>

      {/* SECTION 10: WHO IS THIS FOR? */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'Who Is This For?', kn: 'ಇದು ಯಾರಿಗಾಗಿ?' })}
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium">
              {t({ en: 'No matter what barrier is holding you back, Talks and Snehi are here to support.', kn: 'ಯಾವ ತಡೆಗೋಡೆಯೇ ನಿಮ್ಮನ್ನು ತಡೆದಿದ್ದರೂ, ಟಾಕ್ಸ್ ಮತ್ತು ಸ್ನೇಹಿ ನಿಮಗೆ ಸಹಾಯ ಮಾಡಲು ಸಿದ್ಧವಾಗಿವೆ.' })}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <BarrierCard
              quote={t({ en: '"I understand English but cannot speak."', kn: '"ನನಗೆ ಇಂಗ್ಲಿಷ್ ಅರ್ಥವಾಗುತ್ತದೆ ಆದರೆ ಮಾತನಾಡಲು ಬರುವುದಿಲ್ಲ."' })}
              response={t({ en: 'Perfect. This is exactly who Talks and Snehi were built for.', kn: 'ಅದ್ಭುತ. ಇದಕ್ಕಾಗಿಯೇ ಟಾಕ್ಸ್ ಮತ್ತು ಸ್ನೇಹಿಯನ್ನು ನಿರ್ಮಿಸಲಾಗಿದೆ.' })}
            />
            <BarrierCard
              quote={t({ en: '"I feel nervous speaking English."', kn: '"ಇಂಗ್ಲಿಷ್ ಮಾತನಾಡಲು ನನಗೆ ಭಯವಾಗುತ್ತದೆ."' })}
              response={t({ en: 'Practice privately until you feel ready.', kn: 'ನೀವು ಸಿದ್ಧರಾಗುವವರೆಗೆ ಖಾಸಗಿಯಾಗಿ ಅಭ್ಯಾಸ ಮಾಡಿ.' })}
            />
            <BarrierCard
              quote={t({ en: '"I translate every sentence in my head."', kn: '"ನಾನು ಪ್ರತಿ ವಾಕ್ಯವನ್ನು ನನ್ನ ತಲೆಯಲ್ಲಿ ಭಾಷಾಂತರಿಸುತ್ತೇನೆ."' })}
              response={t({ en: 'Real conversations help you think more naturally.', kn: 'ನೈಜ ಸಂಭಾಷಣೆಗಳು ನೀವು ಹೆಚ್ಚು ಸ್ವಾಭಾವಿಕವಾಗಿ ಯೋಚಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.' })}
            />
            <BarrierCard
              quote={t({ en: '"I\'m afraid of making mistakes."', kn: '"ನನಗೆ ತಪ್ಪು ಮಾಡಲು ಹೆದರಿಕೆಯಾಗುತ್ತಿದೆ."' })}
              response={t({ en: 'Mistakes are how confidence is built.', kn: 'ತಪ್ಪುಗಳ ಮೂಲಕವೇ ಆತ್ಮವಿಶ್ವಾಸ ಬೆಳೆಯುವುದು.' })}
            />
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-6">
              {t({ en: 'Answers to Your Questions', kn: 'ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳಿಗೆ ಉತ್ತರಗಳು' })}
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
              {t({ en: 'Everything you need to know about starting your journey.', kn: 'ನಿಮ್ಮ ಪ್ರಯಾಣವನ್ನು ಪ್ರಾರಂಭಿಸುವ ಬಗ್ಗೆ ನೀವು ತಿಳಿದುಕೊಳ್ಳಬೇಕಾದ ಎಲ್ಲವೂ.' })}
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                  className="w-full text-left p-6 font-bold text-slate-900 dark:text-white flex justify-between items-center transition-colors hover:text-indigo-600 dark:hover:text-indigo-455"
                >
                  <span>{faq.q}</span>
                  <span className="text-xl transform transition-transform duration-300">
                    {activeFaq === idx ? '−' : '+'}
                  </span>
                </button>
                {activeFaq === idx && (
                  <div className="p-6 pt-0 text-slate-650 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 px-6 bg-gradient-to-r from-blue-900 to-indigo-950 dark:from-slate-950 dark:to-slate-900 text-center relative overflow-hidden text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')" }}></div>
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            {t({ en: 'Confidence Comes From Speaking', kn: 'ಮಾತನಾಡುವುದರಿಂದ ಆತ್ಮವಿಶ್ವಾಸ ಬರುತ್ತದೆ' })}
          </h2>

          <div className="max-w-2xl text-blue-100 dark:text-slate-300 text-lg md:text-xl mb-12 space-y-2 font-semibold">
            <p>{t({ en: "You don't become confident by reading more grammar.", kn: 'ಹೆಚ್ಚು ವ್ಯಾಕರಣವನ್ನು ಓದುವುದರಿಂದ ನೀವು ಆತ್ಮವಿಶ್ವಾಸ ಹೊಂದಲು ಸಾಧ್ಯವಿಲ್ಲ.' })}</p>
            <p className="text-amber-400 font-extrabold">{t({ en: 'You become confident by speaking.', kn: 'ಮಾತನಾಡುವ ಮೂಲಕ ನೀವು ಆತ್ಮವಿಶ್ವಾಸ ಹೊಂದುತ್ತೀರಿ.' })}</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm pt-4 text-slate-300 font-bold uppercase tracking-wider">
              <span>{t({ en: 'Practice real conversations', kn: 'ನೈಜ ಸಂಭಾಷಣೆಗಳನ್ನು ಅಭ್ಯಾಸ ಮಾಡಿ' })}</span>
              <span>•</span>
              <span>{t({ en: 'Hear yourself improve', kn: 'ನಿಮ್ಮ ಸುಧಾರಣೆಯನ್ನು ನೀವೇ ಕೇಳಿ' })}</span>
              <span>•</span>
              <span>{t({ en: 'Talk without fear', kn: 'ಭಯವಿಲ್ಲದೆ ಮಾತನಾಡಿ' })}</span>
            </div>
            <p className="text-sm pt-2 text-indigo-200">{t({ en: 'Build confidence one conversation at a time.', kn: 'ಒಂದೊಂದೇ ಸಂಭಾಷಣೆಯ ಮೂಲಕ ಆತ್ಮವಿಶ್ವಾಸವನ್ನು ಬೆಳೆಸಿಕೊಳ್ಳಿ.' })}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-3xl">
            <button
              onClick={handleCTA}
              className="w-full sm:w-auto bg-amber-400 text-blue-950 px-10 py-5 rounded-2xl font-black text-xl hover:bg-amber-350 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-amber-400/20 border-b-4 border-amber-600 flex items-center justify-center gap-2"
            >
              🚀 {t({ en: 'Start Practicing', kn: 'ಅಭ್ಯಾಸ ಮಾಡಲು ಪ್ರಾರಂಭಿಸಿ' })}
            </button>

            <button
              onClick={handleCTA}
              className="w-full sm:w-auto bg-blue-800 text-white border-2 border-blue-650 px-8 py-5 rounded-2xl font-black text-xl hover:bg-blue-750 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              🎤 {t({ en: 'Try SIMPLISH Talks', kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ ಪ್ರಯತ್ನಿಸಿ' })}
            </button>

            <button
              onClick={handleSnehiCTA}
              className="w-full sm:w-auto bg-indigo-600 text-white border-2 border-indigo-500 px-8 py-5 rounded-2xl font-black text-xl hover:bg-indigo-550 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              🤖 {t({ en: 'Talk to Snehi', kn: 'ಸ್ನೇಹಿ ಜೊತೆ ಮಾತನಾಡಿ' })}
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <TestimonialWidget />

      {/* Footer */}
      <footer className="bg-slate-900 dark:bg-slate-950 py-12 px-6 border-t border-slate-800 w-full relative z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <Logo textOnly className="text-2xl font-black invert opacity-50" />
            <div className="text-slate-500 font-bold text-sm">
              © 2026 Simplish - Talks • {t({ en: 'Karnataka', kn: 'ಕರ್ನಾಟಕ' })}
            </div>
          </div>

        </div>
      </footer>

      {/* INTERACTIVE WORKINGS DEMO MODAL */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-[2.5rem] max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">

            {/* Modal Header */}
            <div className="p-6 bg-slate-50 dark:bg-slate-850/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-xl text-slate-900 dark:text-white">
                {t({ en: 'See How It Works', kn: 'ಇದು ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ ಎಂದು ನೋಡಿ' })}
              </h3>
              <button
                onClick={() => setShowPromoModal(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-white text-2xl font-bold w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Modal Content / Simulator Screen */}
            <div className="p-6 flex-1 flex flex-col justify-center min-h-[300px]">

              {simStep === 1 && (
                <div className="space-y-6 text-center">
                  <p className="font-bold text-slate-700 dark:text-slate-300">
                    {t({ en: 'Select a conversation situation to try:', kn: 'ಪ್ರಯತ್ನಿಸಲು ಒಂದು ಸಂಭಾಷಣೆಯ ಸನ್ನಿವೇಶವನ್ನು ಆರಿಸಿ:' })}
                  </p>
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setSimScenario('office');
                        setSimStep(2);
                      }}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-805 hover:bg-indigo-50 dark:hover:bg-indigo-900/35 border border-slate-205 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl font-bold flex items-center justify-between text-left group"
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-2xl">🏢</span>
                        <span>{t({ en: 'Office Introduction', kn: 'ಕಚೇರಿಯ ಪರಿಚಯ' })}</span>
                      </span>
                      <span className="text-slate-400 group-hover:translate-x-1 transition-transform">➔</span>
                    </button>

                    <button
                      onClick={() => {
                        setSimScenario('travel');
                        setSimStep(2);
                      }}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/35 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 rounded-2xl font-bold flex items-center justify-between text-left group"
                    >
                      <span className="flex items-center gap-3">
                        <span className="text-2xl">✈️</span>
                        <span>{t({ en: 'Hotel Check-in', kn: 'ಹೋಟೆಲ್ ಚೆಕ್-ಇನ್' })}</span>
                      </span>
                      <span className="text-slate-400 group-hover:translate-x-1 transition-transform">➔</span>
                    </button>
                  </div>
                </div>
              )}

              {simStep === 2 && (
                <div className="space-y-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {simScenario === 'office'
                        ? t({ en: 'Office Scenario', kn: 'ಕಚೇರಿ ಸನ್ನಿವೇಶ' })
                        : t({ en: 'Hotel Scenario', kn: 'ಹೋಟೆಲ್ ಸನ್ನಿವೇಶ' })}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-left">
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                      {simScenario === 'office' ? 'Ravi (Colleague):' : 'Priya (Receptionist):'}
                    </p>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {simScenario === 'office'
                        ? 'Hello! Welcome to the team. Tell me, what will you be working on here?'
                        : 'Welcome to the Grand Plaza. May I have your name and ID card please?'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic border-t border-slate-200/50 dark:border-slate-700/50 pt-2">
                      {simScenario === 'office'
                        ? 'ಕನ್ನಡದಲ್ಲಿ: "ನಮಸ್ಕಾರ! ತಂಡಕ್ಕೆ ಸುಸ್ವಾಗತ. ನೀವು ಇಲ್ಲಿ ಯಾವ ಕೆಲಸ ಮಾಡಲಿದ್ದೀರಿ ಎಂದು ತಿಳಿಸಿ."'
                        : 'ಕನ್ನಡದಲ್ಲಿ: "ಗ್ರ್ಯಾಂಡ್ ಪ್ಲಾಜಾಗೆ ಸುಸ್ವಾಗತ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಹೆಸರು ಮತ್ತು ಗುರುತಿನ ಚೀಟಿ ನೀಡಬಹುದೇ?"'}
                    </p>
                  </div>

                  {simRecording ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center">
                        <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center animate-ping absolute opacity-30" />
                        <div className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center relative shadow-lg">
                          🎙️
                        </div>
                      </div>
                      <p className="text-red-500 font-extrabold animate-pulse">
                        {t({ en: 'Recording voice...', kn: 'ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...' })}
                      </p>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div className="bg-red-500 h-full transition-all" style={{ width: `${simProgress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSimProgress(0);
                        setSimRecording(true);
                      }}
                      className="mx-auto w-36 h-36 bg-indigo-650 text-white rounded-full flex flex-col items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 border-4 border-indigo-200 dark:border-indigo-800"
                    >
                      <span className="text-3xl">🎤</span>
                      <span className="text-xs font-black uppercase tracking-wider">{t({ en: 'Speak Now', kn: 'ಮಾತನಾಡಿ' })}</span>
                    </button>
                  )}
                </div>
              )}

              {simStep === 3 && (
                <div className="space-y-5">
                  <div className="text-center bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 p-4 rounded-2xl">
                    <span className="text-3xl">🎉</span>
                    <h4 className="font-black text-green-950 dark:text-green-300 mt-2 text-lg">
                      {t({ en: 'AI Evaluation Complete!', kn: 'AI ಮೌಲ್ಯಮಾಪನ ಪೂರ್ಣಗೊಂಡಿದೆ!' })}
                    </h4>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200/50 dark:border-slate-700/50">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {t({ en: 'Pronunciation Score', kn: 'ಉಚ್ಚಾರಣೆ ಸ್ಕೋರ್' })}
                      </span>
                      <span className="font-black text-green-600 dark:text-green-400 text-lg">94%</span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {t({ en: 'Suggestions', kn: 'ಸಲಹೆಗಳು' })}
                      </p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-350 leading-relaxed">
                        {simScenario === 'office'
                          ? t({
                            en: 'Your pronunciation was clear. Suggestion: Use "I will be working on web development" to sound more natural.',
                            kn: 'ನಿಮ್ಮ ಉಚ್ಚಾರಣೆ ಸ್ಪಷ್ಟವಾಗಿತ್ತು. ಸಲಹೆ: ಹೆಚ್ಚು ನೈಸರ್ಗಿಕವಾಗಿ ಕೇಳಿಸಲು "I will be working on web development" ಎಂದು ಬಳಸಿ.'
                          })
                          : t({
                            en: 'Excellent response! Suggestion: Remember to pronounce "Plaza" with a soft "z" sound.',
                            kn: 'ಉತ್ತಮ ಪ್ರತಿಕ್ರಿಯೆ! ಸಲಹೆ: "Plaza" ಪದವನ್ನು ಮೃದುವಾದ "z" ಧ್ವನಿಯೊಂದಿಗೆ ಉಚ್ಚರಿಸಲು ನೆನಪಿಡಿ.'
                          })
                        }
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSimStep(1)}
                      className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-2xl font-black text-sm transition-all"
                    >
                      🔄 {t({ en: 'Try Another', kn: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ' })}
                    </button>
                    <button
                      onClick={() => setShowPromoModal(false)}
                      className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-755 text-white rounded-2xl font-black text-sm transition-all"
                    >
                      🚀 {t({ en: 'Get Started', kn: 'ಪ್ರಾರಂಭಿಸಿ' })}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// HELPER COMPONENTS

const TrustBadge: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-1.5 p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-800 shadow-sm">
    <span className="text-green-500 font-extrabold text-sm shrink-0">✓</span>
    <span className="text-slate-800 dark:text-slate-200 font-bold text-xs leading-tight">{label}</span>
  </div>
);

const ScenarioCard: React.FC<{ icon: string; label: string }> = ({ icon, label }) => (
  <div className="bg-white dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center text-center shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all">
    <span className="text-3xl mb-3">{icon}</span>
    <span className="text-slate-800 dark:text-slate-200 font-bold text-sm md:text-base leading-snug">{label}</span>
  </div>
);

const ImproveStep: React.FC<{ num: string; icon: string; text: string }> = ({ num, icon, text }) => (
  <div className="bg-slate-50 dark:bg-slate-900/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-805 flex flex-col items-center text-center relative">
    <span className="absolute top-3 left-3 w-5 h-5 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 text-[10px] font-black rounded-full flex items-center justify-center">
      {num}
    </span>
    <span className="text-3xl mb-3 mt-2">{icon}</span>
    <span className="text-slate-850 dark:text-slate-300 font-bold text-xs md:text-sm leading-tight">{text}</span>
  </div>
);

const FeatureBadge: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
  <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-col items-center text-center shadow-sm">
    <span className="text-3xl mb-3">{icon}</span>
    <span className="text-slate-850 dark:text-slate-200 font-bold text-xs md:text-sm leading-snug">{title}</span>
  </div>
);

const SnehiFeatureItem: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80">
    <span className="text-lg">🤖</span>
    <span className="text-slate-750 dark:text-slate-300 font-bold text-sm">{text}</span>
  </div>
);

const CheckItem: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 font-semibold text-slate-800 dark:text-slate-300">
    <span className="text-green-500 text-lg shrink-0">✓</span>
    <span className="text-sm md:text-base leading-snug">{label}</span>
  </div>
);

const CompareRow: React.FC<{ left: string; right: string }> = ({ left, right }) => (
  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-850/30 transition-colors">
    <td className="p-4 md:p-5 text-slate-600 dark:text-slate-400 font-medium">{left}</td>
    <td className="p-4 md:p-5 text-indigo-950 dark:text-indigo-200 font-bold bg-indigo-50/20 dark:bg-indigo-900/5">{right}</td>
  </tr>
);

const JourneyStepCard: React.FC<{ step: string; icon: string; title: string; desc: string }> = ({ step, icon, title, desc }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg relative flex flex-col h-full z-10 hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
    <span className="absolute -top-3 -right-3 w-8 h-8 bg-indigo-650 text-white rounded-full flex items-center justify-center font-black text-sm shadow-md">
      {step}
    </span>
    <div className="text-4xl mb-4">{icon}</div>
    <h4 className="text-base font-black text-slate-900 dark:text-white mb-2 leading-snug">{title}</h4>
    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-semibold mt-auto">{desc}</p>
  </div>
);

const BarrierCard: React.FC<{ quote: string; response: string }> = ({ quote, response }) => (
  <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-6 rounded-3xl space-y-3 flex flex-col justify-between">
    <p className="text-slate-800 dark:text-slate-200 font-extrabold italic text-sm md:text-base leading-snug">
      {quote}
    </p>
    <p className="text-indigo-650 dark:text-indigo-400 font-bold text-xs md:text-sm">
      👉 {response}
    </p>
  </div>
);

export default LandingPage;
