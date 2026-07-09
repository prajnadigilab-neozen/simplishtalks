import React, { useState, useEffect } from 'react';
import { usePwaStore } from '../store/usePwaStore';
import { useLanguage } from './LanguageContext';
import { PackageType } from '../types';
import { useNavigate } from 'react-router-dom';

export const PwaInstallBanner: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const {
    deferredPrompt,
    isInstallable,
    isStandalone,
    isDismissed,
    showWelcomeScreen,
    installApp,
    dismissBanner,
    closeWelcomeScreen
  } = usePwaStore();

  const [showManualModal, setShowManualModal] = useState(false);

  // Monitor standalone mode on mount
  useEffect(() => {
    // If standalone and not yet welcomed, this will be handled by showWelcomeScreen
  }, [isStandalone]);

  // Listen to the global event to open manual instructions or trigger install
  useEffect(() => {
    const handleTriggerInstall = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { onSuccess, onFallback, onAlreadyInstalled } = customEvent.detail || {};

      if (isStandalone) {
        if (onAlreadyInstalled) onAlreadyInstalled();
        else {
          alert(t({
            en: 'SIMPLISH App is already installed.',
            kn: 'SIMPLISH ಆಪ್ ಈಗಾಗಲೇ ಇನ್ಸ್ಟಾಲ್ ಆಗಿದೆ.'
          }));
        }
        return;
      }

      if (deferredPrompt) {
        installApp().then((result) => {
          if (result === 'accepted' && onSuccess) onSuccess();
        });
      } else {
        if (onFallback) onFallback();
        else setShowManualModal(true);
      }
    };

    window.addEventListener('simplish-trigger-pwa-install', handleTriggerInstall);
    return () => {
      window.removeEventListener('simplish-trigger-pwa-install', handleTriggerInstall);
    };
  }, [deferredPrompt, isStandalone, installApp, t]);

  // If dismissed or standalone, do not show the banner (but welcome screen/manual modal can still show)
  const shouldShowBanner = deferredPrompt !== null && !isStandalone && !isDismissed;

  return (
    <>
      {/* 1. Bottom Sheet PWA Install Banner */}
      {shouldShowBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 bg-slate-900 text-white rounded-t-[2.5rem] border-t-4 border-blue-500 shadow-2xl animate-in slide-in-from-bottom duration-500">
          <div className="max-w-xl mx-auto flex flex-col gap-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg md:text-xl font-black text-blue-400 tracking-tight">
                  {t({
                    en: 'Add to Home Screen',
                    kn: 'ಫೋನ್ಗೆ ಆಪ್ ಡೌನ್ಲೋಡ್ ಮಾಡಿ'
                  })}
                </h3>
                <div className="mt-2 text-xs md:text-sm text-slate-300 font-medium space-y-1">
                  <p>✨ {t({
                    en: 'Access your classes instantly with one tap.',
                    kn: 'ಒಂದೇ ಒಂದು ಕ್ಲಿಕ್ನಲ್ಲಿ ನಿಮ್ಮ ಕ್ಲಾಸುಗಳನ್ನು ತೆರೆಯಿರಿ.'
                  })}</p>
                  <p>⚡ {t({
                    en: 'Works even when internet is slow.',
                    kn: 'ಇಂಟರ್ನೆಟ್ ನಿಧಾನವಾಗಿದ್ದರೂ ಕೆಲಸ ಮಾಡುತ್ತದೆ.'
                  })}</p>
                  <p>💾 {t({
                    en: 'Uses almost no phone storage.',
                    kn: 'ನಿಮ್ಮ ಫೋನ್ನಲ್ಲಿ ಬಹಳ ಕಡಿಮೆ ಜಾಗ ಬಳಸುತ್ತದೆ.'
                  })}</p>
                </div>
              </div>
              <span className="text-4xl">📱</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-2">
              <button
                onClick={installApp}
                className="flex-1 min-h-[48px] bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-black text-xs md:text-sm uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-blue-500/20"
              >
                {t({
                  en: 'Install App',
                  kn: 'ಆಪ್ ಇನ್ಸ್ಟಾಲ್ ಮಾಡಿ'
                })}
              </button>
              <button
                onClick={dismissBanner}
                className="px-6 min-h-[48px] bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-black text-xs md:text-sm uppercase tracking-wider rounded-xl transition-all"
              >
                {t({
                  en: 'Later',
                  kn: 'ಆಮೇಲೆ'
                })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Manual Installation Fallback Modal */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 border-4 border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-300 text-slate-900 dark:text-white">
            <div className="text-center">
              <span className="text-5xl block mb-4">💡</span>
              <h3 className="text-xl font-black mb-4 tracking-tight text-blue-600 dark:text-blue-400">
                {t({
                  en: 'How to Install',
                  kn: 'ಇನ್ಸ್ಟಾಲ್ ಮಾಡುವುದು ಹೇಗೆ'
                })}
              </h3>
              
              <div className="text-sm font-semibold leading-relaxed mb-6 text-left bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
                  <p className="text-slate-700 dark:text-slate-300">
                    {t({
                      en: 'Tap the browser menu (usually three dots ⋮ or share icon 📤).',
                      kn: 'ಬ್ರೌಸರ್ನ (⋮) ಮೆನು ಅಥವಾ ಶೇರ್ (📤) ಒತ್ತಿ.'
                    })}
                  </p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
                  <p className="text-slate-700 dark:text-slate-300">
                    {t({
                      en: 'Select "Add to Home Screen" or "Install App".',
                      kn: '"Add to Home Screen" ಅಥವಾ "ಆಪ್ ಇನ್ಸ್ಟಾಲ್ ಮಾಡಿ" ಆಯ್ಕೆಮಾಡಿ.'
                    })}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowManualModal(false)}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 shadow-md"
              >
                {t({ en: 'Got It', kn: 'ಅರ್ಥವಾಯಿತು' })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Post-Install Welcome Screen (Standalone Mode Welcome) */}
      {showWelcomeScreen && (
        <div className="fixed inset-0 z-50 bg-slate-900 text-white flex flex-col justify-between p-6 md:p-8 animate-in fade-in duration-500">
          {/* Top decoration */}
          <div className="absolute top-0 right-0 -m-32 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl -z-10" />
          <div className="absolute bottom-0 left-0 -m-32 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl -z-10" />

          {/* Spacer */}
          <div />

          {/* Welcome Message */}
          <div className="max-w-md mx-auto text-center flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-blue-500/10 rounded-[2rem] flex items-center justify-center text-5xl mb-2 animate-bounce">
              🚀
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-none uppercase">
              {t({
                en: 'Welcome to SIMPLISH',
                kn: 'SIMPLISH ಗೆ ಸ್ವಾಗತ'
              })}
            </h1>
            <p className="text-lg md:text-xl font-bold text-blue-400">
              {t({
                en: 'Your Door to Opportunity',
                kn: 'ಅವಕಾಶಗಳ ಬಾಗಿಲು'
              })}
            </p>
          </div>

          {/* App Selection Buttons */}
          <div className="max-w-md mx-auto w-full flex flex-col gap-4 mb-6">
            <button
              onClick={() => {
                closeWelcomeScreen();
                navigate('/dashboard');
              }}
              className="w-full min-h-[54px] bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 border-b-4 border-blue-800"
            >
              📖 {t({ en: 'Open SIMPLISH-TALKS', kn: 'SIMPLISH-TALKS ಓಪನ್ ಮಾಡಿ' })}
            </button>
            <button
              onClick={() => {
                closeWelcomeScreen();
                navigate('/talk');
              }}
              className="w-full min-h-[54px] bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded-2xl font-black text-xs md:text-sm uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 border-b-4 border-orange-800"
            >
              🎙️ {t({ en: 'Open SIMPLISH-SNEHI', kn: 'SIMPLISH-SNEHI ಓಪನ್ ಮಾಡಿ' })}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
