
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './components/LanguageContext';
import { ThemeProvider, useTheme } from './components/ThemeContext';
import { TRANSLATIONS, INITIAL_MODULES, LEVEL_ORDER } from './constants';
import { CourseLevel, UserProgress, LevelStatus, Module, UserRole } from './types';
import { supabase } from './lib/supabase';
import { getUserSession, signOutUser } from './services/authService';
import { fetchAllModules } from './services/courseService';
import LandingPage from './pages/LandingPage';
import PlacementTest from './pages/PlacementTest';
import Dashboard from './pages/Dashboard';
import LessonView from './pages/LessonView';
import RegisterPage from './pages/RegisterPage';
import CoachChat from './pages/CoachChat';
import VoiceCoach from './pages/VoiceCoach';
import AdminDashboard from './pages/AdminDashboard';
import SettingsPage from './pages/SettingsPage';
import Logo from './components/Logo';
import ErrorBoundary from './components/ErrorBoundary';
import { useAppStore } from './store/useAppStore';

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
  const userRole = session?.role || UserRole.USER;
  const isLoggedIn = !!session;

  return (
    <header className={`px-4 py-2.5 md:px-8 md:py-3 sticky top-0 z-50 flex justify-between items-center border-b-2 transition-all duration-300 backdrop-blur-md ${isLanding
      ? 'bg-white/95 dark:bg-slate-900/95 border-gray-100 dark:border-slate-800 shadow-sm'
      : 'bg-blue-900/95 dark:bg-slate-950/95 border-blue-900/50 dark:border-black text-white shadow-lg'
      }`}>
      <div className="flex items-center shrink-0">
        <div
          onClick={() => navigate('/')}
          className="cursor-pointer flex items-center transition-transform active:scale-95"
        >
          <Logo textOnly className={`text-xl md:text-2xl font-black ${isLanding ? 'text-blue-900 dark:text-white' : 'text-white'}`} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-4">
        <nav className="hidden lg:flex items-center gap-6 mr-4">
          <NavButton to="/" label={t({ en: 'Home', kn: 'ಮುಖಪುಟ' })} active={location.pathname === '/'} light={isLanding} />
          {isLoggedIn && !session.isRestricted && (
            <>
              {userRole === UserRole.ADMIN ? (
                <NavButton to="/admin" label={t({ en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' })} active={location.pathname === '/admin'} light={isLanding} />
              ) : (
                <NavButton to="/dashboard" label={t({ en: 'Path', kn: 'ಹಾದಿ' })} active={location.pathname === '/dashboard'} light={isLanding} />
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (isExitingRef.current) return;
      // INITIAL_SESSION is handled by initialize() above — skip to avoid double-fetch
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT') {
        setSession(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const sessData = await getUserSession();
        setSession(sessData);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setIsExiting(true);
    isExitingRef.current = true;

    try {
      await signOutUser();
      localStorage.clear();
      sessionStorage.clear();
      setSession(null);

      navigate('/', { replace: true });
      window.location.hash = '#/';
      window.location.reload();
    } catch (e) {
      window.location.href = '/';
    }
  };

  if (loading || isExiting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900 transition-colors">
        <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] animate-pulse">
          {isExiting ? 'Safely Exiting...' : 'SIMPLISH LOADING...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col max-w-[1280px] mx-auto border-x border-gray-100 dark:border-slate-800 shadow-sm transition-all duration-300 overflow-x-hidden">
      <Navigation onSignOut={handleSignOut} session={session} />

      <main className={`flex-1 overflow-y-auto ${session && !session.isRestricted ? 'pb-24 md:pb-0' : ''}`}>
        {session?.isRestricted ? (
          <RestrictedView onSignOut={handleSignOut} />
        ) : (
          <Routes>
            <Route path="/" element={<LandingPage session={session} />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<RegisterPage />} />
            <Route path="/settings" element={session ? <SettingsPage /> : <Navigate to="/login" />} />
            <Route path="/placement" element={session ? <PlacementTest /> : <Navigate to="/login" />} />
            <Route path="/dashboard" element={session ? ((progress && progress.isPlacementDone) ? <Dashboard /> : <Navigate to="/placement" />) : <Navigate to="/login" />} />
            <Route path="/lesson/:id" element={session ? <LessonView /> : <Navigate to="/login" />} />
            <Route path="/coachchat" element={session ? <CoachChat /> : <Navigate to="/login" />} />
            <Route path="/talk" element={session ? <VoiceCoach /> : <Navigate to="/login" />} />
            <Route path="/admin" element={session?.role === UserRole.ADMIN ? <AdminDashboard /> : <Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </main>

      {session && !session.isRestricted && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t-2 border-slate-100 dark:border-slate-800 flex justify-around items-center px-2 py-4 shadow-[0_-5px_20px_rgba(0,0,0,0.08)]">
          <MobileNavItem icon="🏠" label={t({ en: 'Home', kn: 'ಮುಖಪುಟ' })} to="/" />
          {session?.role === UserRole.ADMIN ? (
            <>
              <MobileNavItem icon="🛡️" label={t({ en: 'Admin', kn: 'ಅಡ್ಮಿನ್' })} to="/admin" />
              <MobileNavItem icon="⚙️" label={t({ en: 'Settings', kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್' })} to="/settings" />
            </>
          ) : (
            <>
              <MobileNavItem icon="📚" label={t({ en: 'Path', kn: 'ಹಾದಿ' })} to="/dashboard" />
              <MobileNavItem icon="🎙️" label={t({ en: 'Voice Practice', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸ' })} to="/talk" />
              <MobileNavItem icon="💬" label={t({ en: 'Bilingual Chat', kn: 'AI ಚಾಟ್' })} to="/coachchat" />
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
        ? 'text-blue-900 dark:text-blue-400 scale-105'
        : 'text-slate-400 dark:text-slate-600 opacity-60'
        }`}
    >
      <div className={`text-xl mb-1 flex items-center justify-center h-8 w-8 rounded-xl transition-all ${isActive ? 'bg-blue-50 dark:bg-blue-900/30 shadow-sm' : ''}`}>
        {icon}
      </div>
      <span className={`text-[8px] font-black uppercase tracking-[0.1em] text-center px-1 ${isActive ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
      {isActive && <div className="mt-0.5 w-1 h-1 bg-blue-900 dark:bg-blue-400 rounded-full"></div>}
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
