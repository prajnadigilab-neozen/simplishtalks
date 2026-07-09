import { create } from 'zustand';

interface PwaState {
  deferredPrompt: any | null;
  isInstallable: boolean;
  isStandalone: boolean;
  isDismissed: boolean;
  showWelcomeScreen: boolean;

  // Actions
  setPrompt: (prompt: any) => void;
  clearPrompt: () => void;
  installApp: () => Promise<'accepted' | 'dismissed' | 'unsupported'>;
  dismissBanner: () => void;
  checkStandalone: () => void;
  closeWelcomeScreen: () => void;
}

// Custom tracking utility
const trackEvent = (eventName: string, properties?: any) => {
  console.log(`📊 PWA Analytics Event [${eventName}]:`, properties);
  
  // 1. Google Analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, properties);
  }
  
  // 2. PostHog
  if (typeof window !== 'undefined' && (window as any).posthog) {
    (window as any).posthog.capture(eventName, properties);
  }
  
  // 3. Custom Backend Event (Optional payload to Supabase telemetry if needed)
  if (typeof window !== 'undefined' && (window as any).telemetry?.track) {
    (window as any).telemetry.track(eventName, properties);
  }
};

export const usePwaStore = create<PwaState>((set, get) => ({
  deferredPrompt: null,
  isInstallable: false,
  isStandalone: typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches,
  isDismissed: typeof localStorage !== 'undefined' ? localStorage.getItem('simplish_pwa_dismissed') === 'true' : false,
  showWelcomeScreen: typeof localStorage !== 'undefined' 
    ? (window.matchMedia('(display-mode: standalone)').matches && localStorage.getItem('simplish_pwa_welcomed') !== 'true')
    : false,

  setPrompt: (prompt) => {
    set({ deferredPrompt: prompt, isInstallable: true });
    trackEvent('install_prompt_shown', { trigger: 'beforeinstallprompt' });
  },

  clearPrompt: () => {
    set({ deferredPrompt: null, isInstallable: false });
  },

  installApp: async () => {
    const { deferredPrompt } = get();
    if (!deferredPrompt) {
      trackEvent('install_prompt_failed', { reason: 'prompt_unavailable' });
      return 'unsupported';
    }

    try {
      // Trigger the native browser install dialog
      await deferredPrompt.prompt();
      
      // Wait for the user to respond to the prompt
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        trackEvent('install_prompt_accepted');
        trackEvent('pwa_installed', { method: 'prompt' });
        
        // Show post-install experience if standalone or on next standalone load
        set({ showWelcomeScreen: true });
        
        set({ deferredPrompt: null, isInstallable: false });
        return 'accepted';
      } else {
        trackEvent('install_prompt_dismissed');
        set({ isDismissed: true });
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('simplish_pwa_dismissed', 'true');
        }
        return 'dismissed';
      }
    } catch (err) {
      console.error('Error during PWA installation:', err);
      return 'unsupported';
    }
  },

  dismissBanner: () => {
    set({ isDismissed: true });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('simplish_pwa_dismissed', 'true');
    }
    trackEvent('install_prompt_dismissed', { action: 'banner_dismissed' });
  },

  checkStandalone: () => {
    if (typeof window !== 'undefined') {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
      const alreadyWelcomed = localStorage.getItem('simplish_pwa_welcomed') === 'true';
      
      set({ 
        isStandalone: isStandaloneMode,
        showWelcomeScreen: isStandaloneMode && !alreadyWelcomed
      });
    }
  },

  closeWelcomeScreen: () => {
    set({ showWelcomeScreen: false });
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('simplish_pwa_welcomed', 'true');
    }
    trackEvent('pwa_welcome_dismissed');
  }
}));
