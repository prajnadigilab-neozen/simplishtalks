/** V 1.0 */
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './components/LanguageContext';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { TRANSLATIONS, INITIAL_MODULES, LEVEL_ORDER } from './constants';
import { CourseLevel, UserProgress, LevelStatus, Module, UserRole, PackageType } from './types';
import { supabase } from './lib/supabase';
import { signOutUser, mapRole, getUserSession } from './services/authService';
import { fetchAllModules } from './services/courseService';
import LandingPage from './pages/LandingPage';
// Lazy load major page routes
const PlacementTest = React.lazy(() => import('./pages/PlacementTest'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const LessonView = React.lazy(() => import('./pages/LessonView'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const CoachChat = React.lazy(() => import('./pages/CoachChat'));
const VoiceCoach = React.lazy(() => import('./pages/VoiceCoach'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminTelemetry = React.lazy(() => import('@/pages/AdminTelemetry'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const CourseManagement = React.lazy(() => import('./pages/CourseManagement'));
const AiInstructions = React.lazy(() => import('./pages/AiInstructions'));
const LessonEditor = React.lazy(() => import('./pages/LessonEditor'));
const PaymentPage = React.lazy(() => import('./pages/PaymentPage'));
const PackageSelection = React.lazy(() => import('./pages/PackageSelection'));
const APIAnalytics = React.lazy(() => import('./pages/APIAnalytics'));
const QuotaDashboard = React.lazy(() => import('./pages/QuotaDashboard'));
const CurriculumPage = React.lazy(() => import('./pages/CurriculumPage'));
const VisualDiscoveryPage = React.lazy(() => import('./pages/VisualDiscoveryPage'));
const TopupPage = React.lazy(() => import('./pages/TopupPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const ProfileSetupPage = React.lazy(() => import('./pages/ProfileSetupPage'));
const FeedbackPage = React.lazy(() => import('./pages/FeedbackPage'));

import { telemetry } from './services/telemetryService';
import NotFoundPage from './pages/NotFoundPage';

import Logo from './components/Logo';
import ErrorBoundary from './components/ErrorBoundary';
import { useAppStore } from './store/useAppStore';
import { initSyncAndListen } from './services/syncService';
import NotificationToast from './components/NotificationToast';
import { usePwaStore } from './store/usePwaStore';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { getUserNotifications, markNotificationsAsRead } from './services/notificationService';
import { InAppNotification } from './types';
import { useNotificationStore } from './store/useNotificationStore';

interface NavigationProps {
  onSignOut: () => void;
  session: any;
}


const Navigation: React.FC<NavigationProps> = ({ onSignOut, session }) => {
  const { t, toggleLang, lang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isLanding = location.pathname === '/';
  const userRole = session?.role || UserRole.STUDENT;
  const isLoggedIn = !!session;

  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const renderNotificationText = (text: string) => {
    try {
      if (text.startsWith('{') && text.endsWith('}')) {
        const parsed = JSON.parse(text);
        if (parsed.en || parsed.kn) {
          return t(parsed);
        }
      }
    } catch (e) {
      // Fallback
    }
    // Backward compatibility for old "En / Kn" format
    if (text && text.includes(' / ')) {
      const parts = text.split(' / ');
      return lang === 'en' ? parts[0] : parts[1];
    }
    return text;
  };

  const fetchNotifications = async () => {
    if (session?.id) {
      const data = await getUserNotifications(session.id);
      setNotifications(data);
    }
  };

  useEffect(() => {
    if (session?.id) {
      fetchNotifications();
      const timer = setInterval(fetchNotifications, 30000);
      return () => clearInterval(timer);
    }
  }, [session?.id]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = async () => {
    if (session?.id) {
      const success = await markNotificationsAsRead(session.id);
      if (success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    }
  };

  return (
    <header className={`px-4 py-2.5 md:px-8 md:py-3 sticky top-0 z-50 flex justify-between items-center border-b-2 transition-all duration-300 backdrop-blur-md ${isLanding
      ? 'bg-white/95 dark:bg-slate-900/95 border-gray-100 dark:border-slate-800 shadow-sm'
      : 'bg-blue-900/95 dark:bg-slate-950/95 border-blue-900/50 dark:border-black text-white shadow-lg'
      }`}>
      <div className="flex flex-row items-center shrink-0 whitespace-nowrap">
        <div
          onClick={() => navigate('/')}
          className="cursor-pointer flex flex-row items-center transition-transform active:scale-95 whitespace-nowrap"
        >
          <Logo textOnly className={`text-xl md:text-2xl font-black whitespace-nowrap ${isLanding ? 'text-blue-900 dark:text-white' : 'text-white'}`} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-4">
        <nav className="hidden md:flex items-center gap-6 mr-4">
          <NavButton to="/" label={t({ en: 'Home', kn: 'ಮುಖಪುಟ' })} active={location.pathname === '/'} light={isLanding} />
          {isLoggedIn && !session.isRestricted && (
            <>
              {userRole === UserRole.SUPER_ADMIN || userRole === UserRole.MODERATOR ? (
                <>
                  <NavButton to="/admin" label={t({ en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' })} active={location.pathname === '/admin'} light={isLanding} />
                  {userRole === UserRole.SUPER_ADMIN && (
                    <>
                      <NavButton to="/analytics" label={t({ en: 'Analytics', kn: 'ವಿಶ್ಲೇಷಣೆ' })} active={location.pathname === '/analytics'} light={isLanding} />
                      <NavButton to="/quota" label={t({ en: 'Guardrail', kn: 'ಗಾರ್ಡ್‌ರೈಲ್' })} active={location.pathname === '/quota'} light={isLanding} />
                    </>
                  )}
                </>
              ) : (
                <>
                  <NavButton to="/dashboard" label={t({ en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' })} active={location.pathname === '/dashboard'} light={isLanding} />
                  <NavButton to="/curriculum" label={t({ en: 'Curriculum', kn: 'ಪಠ್ಯಕ್ರಮ' })} active={location.pathname === '/curriculum'} light={isLanding} />
                  <NavButton to="/discover" label={t({ en: 'Discover', kn: 'ಅನ್ವೇಷಿಸಿ' })} active={location.pathname === '/discover'} light={isLanding} />
                  <NavButton to="/packages" label={t({ en: 'Go Premium', kn: 'ಪ್ರೀಮಿಯಂ ಪಡೆಯಿರಿ' })} active={location.pathname === '/packages'} light={isLanding} />
                </>
              )}
              <NavButton to="/settings" label={t({ en: 'Settings', kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್' })} active={location.pathname === '/settings'} light={isLanding} />
            </>
          )}
        </nav>


        <div className="flex items-center gap-1 md:gap-2">
          <button
            onClick={toggleTheme}
            className={`p-2 md:p-2.5 rounded-xl transition-all flex items-center justify-center min-w-[36px] md:min-w-[44px] ${isLanding
              ? 'bg-slate-50 dark:bg-slate-800 text-blue-800 dark:text-amber-400 border border-slate-200 dark:border-slate-700'
              : 'bg-blue-800 dark:bg-slate-900 text-amber-400 border border-blue-700 dark:border-slate-800'
              }`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <button
            onClick={toggleLang}
            className={`px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all shadow-md active:scale-95 ${isLanding ? 'bg-blue-900 dark:bg-blue-600 text-white' : 'bg-amber-400 text-blue-900'
              }`}
          >
            {lang === 'en' ? 'ಕನ್ನಡ' : 'En'}
          </button>

          {isLoggedIn && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    fetchNotifications();
                  }
                }}
                className={`relative p-2 md:p-2.5 rounded-xl transition-all flex items-center justify-center min-w-[36px] md:min-w-[44px] ${isLanding
                  ? 'bg-slate-50 dark:bg-slate-800 text-blue-800 dark:text-amber-400 border border-slate-200 dark:border-slate-700'
                  : 'bg-blue-800 dark:bg-slate-900 text-amber-400 border border-blue-700 dark:border-slate-800'
                  }`}
              >
                🔔
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl p-4 shadow-2xl z-50 min-w-[280px] max-w-[320px] max-h-[400px] overflow-y-auto animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700 mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {t({ en: 'Notifications', kn: 'ಸೂಚನೆಗಳು' })}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkRead}
                        className="text-[9px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase"
                      >
                        {t({ en: 'Mark all read', kn: 'ಎಲ್ಲವನ್ನೂ ಓದಲಾಗಿದೆ ಎಂದು ಗುರುತಿಸಿ' })}
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 font-bold">
                      {t({ en: 'No notifications', kn: 'ಯಾವುದೇ ಸೂಚನೆಗಳಿಲ್ಲ' })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            n.is_read 
                              ? 'bg-slate-50/50 border-slate-100 dark:bg-slate-900/30 dark:border-slate-800' 
                              : 'bg-blue-50/50 border-blue-100 dark:bg-blue-900/10 dark:border-blue-900/30'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2 mb-1">
                            <span className="font-black text-slate-800 dark:text-slate-200 text-xs">
                              {renderNotificationText(n.title)}
                            </span>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${
                              n.type === 'success' ? 'bg-green-500' :
                              n.type === 'error' ? 'bg-red-500' :
                              n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
                            }`} />
                          </div>
                          <p className="text-slate-700 dark:text-slate-400 text-[10px] font-medium leading-normal">
                            {renderNotificationText(n.message)}
                          </p>
                          <span className="text-[8px] text-slate-400 mt-1 block">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 md:gap-2">
          {isLoggedIn ? (
            <button
              onClick={onSignOut}
              className={`text-[9px] md:text-[11px] font-black uppercase tracking-widest px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl border-2 transition-all active:scale-95 ${isLanding ? 'border-blue-900 dark:border-blue-400 text-blue-900 dark:text-blue-400 hover:bg-blue-50' : 'border-white/30 text-white hover:bg-white hover:text-blue-900'
                }`}
            >
              {t({ en: 'Exit', kn: 'ನಿರ್ಗಮಿಸು' })}
            </button>
          ) : (
            <div className="flex gap-1 md:gap-2">
              <button
                onClick={() => navigate('/login')}
                className={`text-[9px] md:text-[11px] font-black uppercase tracking-widest px-3 py-1.5 md:px-5 md:py-2.5 rounded-xl border-2 transition-all active:scale-95 ${isLanding ? 'border-slate-100 text-slate-500 dark:text-slate-400' : 'border-blue-700 text-blue-200 hover:bg-white/10'
                  }`}
              >
                {t({ en: 'Login', kn: 'ಲಾಗಿನ್' })}
              </button>
              <button
                onClick={() => navigate('/register')}
                className={`hidden sm:block text-[9px] md:text-[11px] font-black uppercase tracking-widest px-3 py-1.5 md:px-5 md:py-2.5 border-2 rounded-xl transition-all active:scale-95 ${isLanding ? 'border-blue-900 dark:border-blue-400 text-blue-900 dark:text-blue-400 bg-white/50' : 'border-white text-white hover:bg-white hover:text-blue-900'
                  }`}
              >
                {t({ en: 'Join', kn: 'ಸೇರಿ' })}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const RestrictedView: React.FC<{ onSignOut: () => void }> = ({ onSignOut }) => {
  const { t } = useLanguage();
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 md:p-8 text-center animate-in zoom-in-95">
      <div className="bg-white dark:bg-slate-800 p-8 md:p-12 rounded-[3rem] border-4 border-red-500 shadow-2xl max-w-md w-full">
        <span className="text-7xl md:text-8xl mb-6 md:mb-8 block">🚫</span>
        <h2 className="text-2xl md:text-3xl font-black text-red-600 mb-4 uppercase tracking-tighter">Access Denied</h2>
        <p className="text-slate-600 dark:text-slate-400 font-bold mb-8 md:mb-10 text-sm md:text-base">
          {t({
            en: "Your account has been restricted. Please contact support.",
            kn: "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಬೆಂಬಲವನ್ನು ಸಂಪರ್ಕಿಸಿ."
          })}
        </p>
        <button
          onClick={onSignOut}
          className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ to: string, label: string, active: boolean, light: boolean }> = ({ to, label, active, light }) => {
  const navigate = useNavigate();
  const activeStyles = light ? 'text-blue-900 dark:text-blue-400 border-blue-900 dark:border-blue-400' : 'text-amber-400 border-amber-400';
  const inactiveStyles = light ? 'text-slate-500 dark:text-slate-400 border-transparent hover:text-blue-900 dark:hover:text-blue-400' : 'text-white/70 border-transparent hover:text-amber-400 hover:text-white';

  return (
    <button onClick={() => navigate(to)} className={`text-xs font-black uppercase tracking-widest transition-all border-b-4 pb-1 ${active ? activeStyles : inactiveStyles}`}>
      {label}
    </button>
  );
};

const SnehiGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAppStore();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    if (session && !session.snehiAccessEnabled) {
      useNotificationStore.getState().showWarning(
        t({
          en: "Access to SIMPLISH-SNEHI is restricted. Please request access first.",
          kn: "SIMPLISH-SNEHI ಗೆ ಪ್ರವೇಶವನ್ನು ನಿರ್ಬಂಧಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಮೊದಲು ವಿನಂತಿಸಿ."
        })
      );
      navigate('/packages', { replace: true });
    }
  }, [session, navigate, t]);

  if (session && !session.snehiAccessEnabled) {
    return null;
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const isExitingRef = useRef(false);

  // Store Hooks
  const {
    session,
    modules,
    progress,
    loading,
    initialize,
    setSession,
    updateProgress,
    setPlacementResult
  } = useAppStore();

  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    initialize();
    const cleanupSync = initSyncAndListen(() => {
      console.log("🔄 Sync completed, refreshing store modules...");
      useAppStore.getState().refreshModules();
    });

    // Explicitly reference telemetry to ensure it initializes
    console.log("Telemetry Initialized:", !!telemetry);

    // Listen for PWA installation prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      usePwaStore.getState().setPrompt(e);
    };
    
    // Listen for successful installation
    const handleAppInstalled = () => {
      usePwaStore.getState().clearPrompt();
      if (typeof window !== 'undefined' && (window as any).telemetry?.track) {
        (window as any).telemetry.track('pwa_installed', { method: 'browser_native' });
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Trigger initial check for standalone display mode
    usePwaStore.getState().checkStandalone();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isExitingRef.current) return;
      // INITIAL_SESSION is handled by initialize() — skip to avoid double-fetch + lock race
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT') {
        setSession(null);
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        // Use the session object from the event directly — no redundant getSession() call
        if (session) {
          const { user } = session;
          const currentSession = useAppStore.getState().session;

          getUserSession(session, true).then(profile => {
            if (profile) {
              setSession({
                ...currentSession,
                ...profile,
                isLoggedIn: true
              });
            } else {
              setSession({
                ...currentSession,
                id: user.id,
                name: user.user_metadata?.full_name || currentSession?.name || 'User',
                role: mapRole(user.user_metadata?.role) || currentSession?.role,
                phone: user.phone || currentSession?.phone,
                place: user.user_metadata?.place || currentSession?.place || '',
                // CRITICAL: Preserve the actual packageType fetched from the database
                // INSTEAD of overwriting it to 'NONE', which kicks users out of the Dashboard
                packageType: currentSession?.packageType,
                isLoggedIn: true,
                isRestricted: currentSession?.isRestricted || false,
              });
            }
          }).catch(err => {
            console.error("onAuthStateChange getUserSession error:", err);
          });
        }
      }
      // TOKEN_REFRESHED is handled silently by Supabase autoRefreshToken — no action needed
    });

    return () => {
      cleanupSync();
      subscription.unsubscribe();
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleSignOut = async () => {
    setIsExiting(true);
    isExitingRef.current = true;
    try {
      await signOutUser();
      // Reset all store state without a page reload
      useAppStore.setState({ session: null, progress: null, modules: [], initialized: false });
      setIsExiting(false);
      isExitingRef.current = false;
      navigate('/', { replace: true });
    } catch (e) {
      console.error('Sign-out error:', e);
      setIsExiting(false);
      isExitingRef.current = false;
    }
  };

  // Skeleton shell: render navbar immediately, skeleton for content area while loading.
  // This makes the app feel instantaneous rather than showing a blank screen.
  if (loading || isExiting) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col max-w-[1280px] mx-auto border-x border-gray-100 dark:border-slate-800">
        {/* Skeleton Navbar */}
        <header className="px-4 py-3 md:px-8 md:py-4 sticky top-0 z-50 flex justify-between items-center border-b-2 border-gray-100 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <div className="h-7 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
            <div className="h-8 w-16 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
          </div>
        </header>
        {/* Skeleton Content */}
        <main className="flex-1 p-6 md:p-10 space-y-6">
          <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          {isExiting && (
            <p className="text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse pt-8">
              Signing out safely...
            </p>
          )}
        </main>
      </div>
    );
  }

  const requiresOnboarding = !!session && session.role !== UserRole.SUPER_ADMIN && session.role !== UserRole.MODERATOR && !session.dateOfBirth;

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col max-w-[1280px] mx-auto border-x border-gray-100 dark:border-slate-800 shadow-sm transition-all duration-300 overflow-x-hidden">
      <Navigation onSignOut={handleSignOut} session={session} />
      <NotificationToast />
      <PwaInstallBanner />

      <main className={`flex-1 overflow-y-auto ${session && !session.isRestricted ? 'pb-24 md:pb-0' : ''}`}>
        {session?.isRestricted ? (
          <RestrictedView onSignOut={handleSignOut} />
        ) : (
          <Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}>
            <Routes>
              <Route path="/" element={<LandingPage session={session} />} />
              <Route path="/register" element={
                session ? (
                  session.role === UserRole.SUPER_ADMIN || session.role === UserRole.MODERATOR ?
                    <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />
                ) : <RegisterPage />
              } />
              <Route path="/login" element={
                session ? (
                  session.role === UserRole.SUPER_ADMIN || session.role === UserRole.MODERATOR ?
                    <Navigate to="/admin" replace /> : <Navigate to="/dashboard" replace />
                ) : <RegisterPage />
              } />
              <Route path="/profile-setup" element={session ? <ErrorBoundary><ProfileSetupPage /></ErrorBoundary> : <Navigate to="/login" />} />
              <Route path="/profile" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><ProfilePage /></ErrorBoundary>
              } />
              <Route path="/settings" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><SettingsPage /></ErrorBoundary>
              } />
              <Route path="/payment" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><PaymentPage /></ErrorBoundary>
              } />
              <Route path="/packages" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><PackageSelection /></ErrorBoundary>
              } />
              <Route path="/topup" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><TopupPage /></ErrorBoundary>
              } />
              <Route path="/feedback" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><FeedbackPage /></ErrorBoundary>
              } />
              <Route path="/placement" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><PlacementTest /></ErrorBoundary>
              } />
              <Route path="/dashboard" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    progress === null ? null /* still loading — show nothing, avoid redirect */ :
                      progress.isPlacementDone ? <ErrorBoundary><Dashboard /></ErrorBoundary> :
                        <Navigate to="/placement" />
              } />
              <Route path="/curriculum" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><CurriculumPage /></ErrorBoundary>
              } />
              <Route path="/discover" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><VisualDiscoveryPage session={session} /></ErrorBoundary>
              } />
              <Route path="/lesson/:id" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><LessonView /></ErrorBoundary>
              } />
              <Route path="/coachchat" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <ErrorBoundary><CoachChat /></ErrorBoundary>
              } />
              <Route path="/talk" element={
                !session ? <Navigate to="/login" /> :
                  requiresOnboarding ? <Navigate to="/profile-setup" replace /> :
                    <SnehiGuard><ErrorBoundary><VoiceCoach /></ErrorBoundary></SnehiGuard>
              } />
              <Route path="/admin" element={session?.role === UserRole.SUPER_ADMIN || session?.role === UserRole.MODERATOR ? <ErrorBoundary><AdminDashboard /></ErrorBoundary> : <Navigate to="/dashboard" />} />
              <Route path="/admin/course" element={session?.role === UserRole.SUPER_ADMIN || session?.role === UserRole.MODERATOR ? <ErrorBoundary><CourseManagement /></ErrorBoundary> : <Navigate to="/dashboard" />} />
              <Route path="/admin/course/lesson/:moduleId/:lessonId?" element={session?.role === UserRole.SUPER_ADMIN || session?.role === UserRole.MODERATOR ? <ErrorBoundary><LessonEditor /></ErrorBoundary> : <Navigate to="/dashboard" />} />
              <Route path="/admin/telemetry" element={session?.role === UserRole.SUPER_ADMIN || session?.role === UserRole.MODERATOR ? <ErrorBoundary><AdminTelemetry /></ErrorBoundary> : <Navigate to="/dashboard" />} />
              <Route path="/admin/ai-instructions" element={session?.role === UserRole.SUPER_ADMIN || session?.role === UserRole.MODERATOR ? <ErrorBoundary><AiInstructions /></ErrorBoundary> : <Navigate to="/dashboard" />} />
              <Route path="/analytics" element={session?.role === UserRole.SUPER_ADMIN ? <ErrorBoundary><APIAnalytics /></ErrorBoundary> : <Navigate to="/dashboard" />} />
              <Route path="/quota" element={session?.role === UserRole.SUPER_ADMIN ? <ErrorBoundary><QuotaDashboard /></ErrorBoundary> : <Navigate to="/dashboard" />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        )}
      </main>

      {session && !session.isRestricted && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t-2 border-slate-100 dark:border-slate-800 flex justify-around items-center px-2 py-4 shadow-[0_-5px_20px_rgba(0,0,0,0.08)]">
          {session?.role === UserRole.SUPER_ADMIN || session?.role === UserRole.MODERATOR ? (
            <MobileNavItem icon="🏠" label={t({ en: 'Home', kn: 'ಮುಖಪುಟ' })} to="/" />
          ) : null}
          {session?.role === UserRole.SUPER_ADMIN || session?.role === UserRole.MODERATOR ? (
            <>
              <MobileNavItem icon="🛡️" label={t({ en: 'Admin', kn: 'ಅಡ್ಮಿನ್' })} to="/admin" />
              {session?.role === UserRole.SUPER_ADMIN && (
                <MobileNavItem icon="🛡️" label={t({ en: 'Quota', kn: 'ಕೋಟಾ' })} to="/quota" />
              )}
              <MobileNavItem icon="⚙️" label={t({ en: 'Settings', kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್' })} to="/settings" />
            </>
          ) : (
            <>
              <MobileNavItem icon="📚" label={t({ en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' })} to="/dashboard" />
              <MobileNavItem icon="📖" label={t({ en: 'Curriculum', kn: 'ಪಠ್ಯಕ್ರಮ' })} to="/curriculum" />
              <MobileNavItem icon="🖼️" label={t({ en: 'Discover', kn: 'ಅನ್ವೇಷಿಸಿ' })} to="/discover" />
              {(session?.packageType === PackageType.TALKS || session?.packageType === PackageType.BOTH) && (
                <MobileNavItem icon="💬" label={t({ en: 'Chat', kn: 'ಚಾಟ್' })} to="/coachchat" />
              )}
              <MobileNavItem icon="🛍️" label={t({ en: 'Go Premium', kn: 'ಪ್ರೀಮಿಯಂ ಪಡೆಯಿರಿ' })} to="/packages" />
              <MobileNavItem icon="⚙️" label={t({ en: 'Settings', kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್' })} to="/settings" />
            </>
          )}
        </nav>
      )}
    </div>
  );
};

const MobileNavItem: React.FC<{ icon: string; label: string; to: string }> = ({ icon, label, to }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === to || (to === '/dashboard' && location.pathname.startsWith('/lesson'));
  return (
    <button
      onClick={() => navigate(to)}
      className={`flex flex-col items-center justify-center p-1 transition-all flex-1 active:scale-90 ${isActive
        ? 'text-blue-600 dark:text-blue-400 scale-105'
        : 'text-slate-500 dark:text-slate-400'
        }`}
    >
      <div className={`text-xl mb-1 flex items-center justify-center h-8 w-8 rounded-xl transition-all ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 shadow-sm' : ''}`}>
        {icon}
      </div>
      <span className={`text-[8.5px] font-black uppercase tracking-[0.1em] text-center px-1 ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
      {isActive && <div className="mt-0.5 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full"></div>}
    </button>
  );
};

const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <LanguageProvider>
        <Router>
          <AppContent />
        </Router>
      </LanguageProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
