
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { registerUser, loginUser, getUserSession } from '../services/authService';
import Logo from '../components/Logo';
import { UserRole } from '../types';
import { useAppStore } from '../store/useAppStore';

const RegisterPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAppStore();
  const [isLoginMode, setIsLoginMode] = useState(location.pathname === '/login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAdminField, setShowAdminField] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    password: '',
    place: '',
    adminCode: ''
  });

  useEffect(() => {
    setIsLoginMode(location.pathname === '/login');
  }, [location.pathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let result;
    if (isLoginMode) {
      result = await loginUser({ phone: formData.phone, password: formData.password });
    } else {
      result = await registerUser(formData);
    }

    if (result.success) {
      // Re-fetch the session directly from Supabase
      const session = await getUserSession();

      // Immediately sync the store so navigation guards work correctly
      setSession(session);

      if (session?.role === UserRole.ADMIN) {
        navigate('/admin');
      } else if (session) {
        navigate('/dashboard');
      }
    } else {
      setError(result.error || 'Operation failed');
    }
    setLoading(false);
  };

  const toggleMode = () => {
    const newMode = !isLoginMode;
    setIsLoginMode(newMode);
    navigate(newMode ? '/login' : '/register');
    setError('');
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300">
      <div className="bg-blue-900 dark:bg-slate-950 p-8 text-center border-b-8 border-amber-400">
        <div className="flex justify-center mb-4">
          <Logo className="w-20 h-20 shadow-lg rounded-full border-2 border-white dark:border-slate-800" />
        </div>
        <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
          {isLoginMode
            ? t({ en: 'Welcome Back', kn: 'ನಮಸ್ಕಾರ, ಸ್ವಾಗತ' })
            : t({ en: 'Create Account', kn: 'ಖಾತೆ ತೆರೆಯಿರಿ' })}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 p-6 max-w-md mx-auto w-full space-y-6">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900/30 p-4 rounded-2xl text-red-600 dark:text-red-400 font-bold text-sm animate-shake">
            ⚠️ {error}
          </div>
        )}

        {!isLoginMode && (
          <div className="animate-in fade-in duration-300">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-2">
              {t({ en: 'Full Name', kn: 'ಪೂರ್ಣ ಹೆಸರು' })}
            </label>
            <input
              required
              type="text"
              autoComplete="name"
              className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-bold text-blue-900 dark:text-slate-100"
              placeholder="..."
              value={formData.fullName}
              onChange={e => setFormData({ ...formData, fullName: e.target.value })}
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-2">
            {t({ en: 'Phone Number', kn: 'ಫೋನ್ ಸಂಖ್ಯೆ' })}
          </label>
          <input
            required
            type="tel"
            autoComplete="tel"
            className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-bold text-blue-900 dark:text-slate-100"
            placeholder="00000 00000"
            value={formData.phone}
            onChange={e => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-2">
            {t({ en: 'Password', kn: 'ಪಾಸ್‌ವರ್ಡ್' })}
          </label>
          <input
            required
            type="password"
            autoComplete={isLoginMode ? 'current-password' : 'new-password'}
            className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-bold text-blue-900 dark:text-slate-100"
            placeholder="••••••"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
          />
        </div>

        {!isLoginMode && (
          <div className="animate-in fade-in duration-300">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-2">
              {t({ en: 'Your Village/City', kn: 'ನಿಮ್ಮ ಊರು' })}
            </label>
            <input
              required
              type="text"
              autoComplete="address-level2"
              className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-blue-600 dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-bold text-blue-900 dark:text-slate-100"
              placeholder="..."
              value={formData.place}
              onChange={e => setFormData({ ...formData, place: e.target.value })}
            />
          </div>
        )}

        {!isLoginMode && (
          <div className="pt-2 animate-in fade-in duration-300">
            <button
              type="button"
              onClick={() => setShowAdminField(!showAdminField)}
              className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-500 transition-colors"
            >
              {showAdminField ? '[-] Hide Admin Code' : '[+] Have an Admin Access Code?'}
            </button>

            {showAdminField && (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                <input
                  type="text"
                  autoComplete="off"
                  className="w-full p-4 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-900/30 rounded-2xl focus:border-amber-500 outline-none transition-all font-mono text-xs text-amber-900 dark:text-amber-200 uppercase"
                  placeholder="Enter Secret Code"
                  value={formData.adminCode}
                  onChange={e => setFormData({ ...formData, adminCode: e.target.value })}
                />
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-6 rounded-2xl font-black text-xl uppercase tracking-widest shadow-xl hover:bg-orange-600 active:translate-y-1 transition-all flex items-center justify-center gap-3"
        >
          {loading ? (
            <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              {isLoginMode
                ? t({ en: 'Sign In', kn: 'ಸೈನ್ ಇನ್' })
                : t({ en: 'Join Simplish', kn: 'ಸಿಂಪ್ಲಿಷ್‌ಗೆ ಸೇರಿ' })}
              <span>{isLoginMode ? '➜' : '✨'}</span>
            </>
          )}
        </button>

        <p className="text-center text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest pt-4 transition-colors">
          {isLoginMode
            ? t({ en: "Don't have an account?", kn: 'ಖಾತೆ ಇಲ್ಲವೇ?' })
            : t({ en: 'Already have an account?', kn: 'ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?' })}
          <button
            type="button"
            onClick={toggleMode}
            className="ml-2 text-blue-600 dark:text-blue-400 underline font-black"
          >
            {isLoginMode
              ? t({ en: 'Register Now', kn: 'ಈಗಲೇ ನೋಂದಾಯಿಸಿ' })
              : t({ en: 'Sign In', kn: 'ಲಾಗಿನ್ ಆಗಿ' })}
          </button>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;
