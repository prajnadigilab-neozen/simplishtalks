
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getUserSession, loginUser, registerUser, sendPasswordResetOTP, verifyOTPAndResetPassword } from '../services/authService';
import Logo from '../components/Logo';
import { UserRole } from '../types';
import { useAppStore } from '../store/useAppStore';

// ─── Password Strength ────────────────────────────────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 3) return { score, label: 'Fair', color: 'bg-amber-400' };
  return { score, label: 'Strong', color: 'bg-emerald-500' };
}

// ─── Eye Icon ─────────────────────────────────────────────────────────────────
const EyeIcon: React.FC<{ open: boolean }> = ({ open }) =>
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

// ─── Input Field ──────────────────────────────────────────────────────────────
interface InputFieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  prefix?: string;
  suffix?: React.ReactNode;
  error?: string;
  maxLength?: number;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'url' | 'search' | 'decimal' | 'none';
}

const InputField: React.FC<InputFieldProps> = ({
  label, type, value, onChange, placeholder, autoComplete, required, prefix, suffix, error, maxLength, inputMode
}) => (
  <div className="space-y-1.5">
    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
      {label}
    </label>
    <div className={`flex items-center rounded-2xl border-2 transition-all duration-200 overflow-hidden
      ${error
        ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-700 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)]'
      }`}>
      {prefix && (
        <span className="pl-4 pr-1 text-sm font-bold text-slate-400 dark:text-slate-500 select-none shrink-0">
          {prefix}
        </span>
      )}
      <input
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={e => onChange(e.target.value)}
        className="flex-1 px-4 py-4 bg-transparent outline-none text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 min-w-0"
      />
      {suffix && (
        <div className="pr-3 shrink-0">{suffix}</div>
      )}
    </div>
    {error && (
      <p className="text-[11px] font-bold text-red-500 dark:text-red-400 pl-1">{error}</p>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const RegisterPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAppStore();

  const [isLoginMode, setIsLoginMode] = useState(location.pathname === '/login');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdminField, setShowAdminField] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    password: '',
    place: '',
    adminCode: ''
  });



  useEffect(() => {
    const loginMode = location.pathname === '/login';
    setIsLoginMode(loginMode);
    setGlobalError('');
    setFieldErrors({});
  }, [location.pathname]);

  const setField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: '' }));
    if (globalError) setGlobalError('');
  };

  // Phone: strip non-digits, limit to 10 digits
  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    setField('phone', digits);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.phone || formData.phone.length < 10)
      errors.phone = t({ en: 'Enter a valid 10-digit phone number', kn: 'ಹತ್ತು ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ' });
    
    if (!(isForgotPasswordMode && !otpSent)) {
      if (!formData.password || formData.password.length < 6)
        errors.password = t({ en: 'Password must be at least 6 characters', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಕನಿಷ್ಠ 6 ಅಕ್ಷರ ಇರಬೇಕು' });
    }
 
    if (!isLoginMode && !isForgotPasswordMode) {
      if (!formData.fullName.trim()) errors.fullName = t({ en: 'Full name is required', kn: 'ಪೂರ್ಣ ಹೆಸರು ಅಗತ್ಯವಿದೆ' });
      if (!formData.place.trim()) errors.place = t({ en: 'Village/City is required', kn: 'ಊರು/ನಗರ ಅಗತ್ಯವಿದೆ' });
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setGlobalError('');

    let result;
    if (isForgotPasswordMode) {
      if (!otpSent) {
        if (!formData.phone || formData.phone.length < 10) {
          setFieldErrors({ phone: t({ en: 'Enter a valid 10-digit phone number', kn: 'ಹತ್ತು ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ' }) });
          setLoading(false);
          return;
        }
        result = await sendPasswordResetOTP(formData.phone);
        if (result.success) {
          setOtpSent(true);
          setLoading(false);
          return; // Stop execution here, wait for OTP
        }
      } else {
        if (!otpCode || otpCode.length < 6) {
          setFieldErrors({ otpCode: t({ en: 'Enter the 6-digit OTP', kn: '6 ಅಂಕಿಯ OTP ನಮೂದಿಸಿ' }) });
          setLoading(false);
          return;
        }
        if (!formData.password || formData.password.length < 6) {
          setFieldErrors({ password: t({ en: 'Password must be at least 6 characters', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಕನಿಷ್ಠ 6 ಅಕ್ಷರ ಇರಬೇಕು' }) });
          setLoading(false);
          return;
        }
        result = await verifyOTPAndResetPassword(formData.phone, otpCode, formData.password);
      }
    } else if (isLoginMode) {
      result = await loginUser({ phone: formData.phone, password: formData.password });
    } else {
      result = await registerUser({ ...formData, phone: formData.phone });
    }

    if (result && result.success) {
      setSuccess(true);
      // Force store to fetch the logged in user's progress and modules.
      // App.tsx will detect the session change and navigate accordingly.
      await useAppStore.getState().initialize(true);
    } else if (result) {
      setGlobalError(result.error || t({ en: 'Something went wrong. Please try again.', kn: 'ಏನೋ ತಪ್ಪಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }));
    }
    setLoading(false);
  };

  const switchMode = (loginMode: boolean) => {
    navigate(loginMode ? '/login' : '/register');
    setGlobalError('');
    setFieldErrors({});
    setShowPassword(false);
    setShowAdminField(false);
    setIsForgotPasswordMode(false);
    setOtpSent(false);
    setOtpCode('');
  };

  const pwStrength = getPasswordStrength(formData.password);

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900 transition-colors duration-300">

      {/* ── Left Brand Panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 p-10 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/5 rounded-full" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-amber-400/10 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full" />

        {/* Logo */}
        <div className="relative z-10">
          <Logo symbolOnly className="w-16 h-16 mb-4" />
          <h1 className="text-3xl font-black text-white leading-tight tracking-tight flex items-baseline gap-2 whitespace-nowrap">
            SIMPLISH
            <span className="font-script italic text-amber-400 normal-case text-4xl">Talks</span>
          </h1>
          <p className="mt-3 text-blue-200 dark:text-slate-400 text-sm font-medium leading-relaxed">
            {t({ en: 'Learn English the Kannada way.', kn: 'ಕನ್ನಡದಲ್ಲಿ ಇಂಗ್ಲಿಷ್ ಕಲಿಯಿರಿ.' })}
          </p>
        </div>

        {/* Feature list */}
        <div className="relative z-10 space-y-4">
          {[
            { icon: '🎙️', en: 'Voice-based practice sessions', kn: 'ಧ್ವನಿ ಅಭ್ಯಾಸ ಸೆಷನ್‌ಗಳು' },
            { icon: '💬', en: 'Bilingual AI coach', kn: 'ದ್ವಿಭಾಷಾ AI ತರಬೇತಿ' },
            { icon: '📚', en: 'Structured learning path', kn: 'ಕ್ರಮಬದ್ಧ ಕಲಿಕೆ' },
          ].map(f => (
            <div key={f.en} className="flex items-center gap-3">
              <span className="text-2xl">{f.icon}</span>
              <span className="text-sm font-semibold text-blue-100 dark:text-slate-300">
                {t({ en: f.en, kn: f.kn })}
              </span>
            </div>
          ))}
        </div>

        {/* Bottom tagline */}
        <p className="relative z-10 text-[11px] font-bold text-blue-300/60 dark:text-slate-600 uppercase tracking-widest">
          {t({ en: 'English for Kannadigas', kn: 'ಕನ್ನಡಿಗರಿಗಾಗಿ ಇಂಗ್ಲಿಷ್' })}
        </p>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto">

        {/* Mobile logo */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <Logo symbolOnly className="w-20 h-20 mb-3" />
          <h1 className="text-2xl font-black text-blue-900 dark:text-white tracking-tight flex items-center gap-1.5 whitespace-nowrap">
            SIMPLISH <span className="font-script italic text-amber-500 normal-case text-3xl">Talks</span>
          </h1>
        </div>

        <div className="w-full max-w-sm">

          {/* ── Tab Switcher ── */}
          {!isForgotPasswordMode && (
            <div className="relative flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 mb-8">
              <div
                className={`absolute top-1 bottom-1 w-1/2 bg-white dark:bg-slate-700 rounded-xl shadow-sm transition-transform duration-300 ease-out ${isLoginMode ? 'translate-x-0' : 'translate-x-full'}`}
              />
              {[
                { label: t({ en: 'Sign In', kn: 'ಲಾಗಿನ್' }), login: true },
                { label: t({ en: 'Register', kn: 'ನೋಂದಣಿ' }), login: false },
              ].map(tab => (
                <button
                  key={String(tab.login)}
                  type="button"
                  onClick={() => switchMode(tab.login)}
                  className={`relative z-10 flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-colors duration-200 ${isLoginMode === tab.login
                    ? 'text-blue-900 dark:text-white'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Heading ── */}
          <div className="mb-7">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isForgotPasswordMode 
                ? t({ en: 'Reset Password 🔒', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ 🔒' })
                : isLoginMode
                  ? t({ en: 'Welcome back 👋', kn: 'ಮರಳಿ ಸ್ವಾಗತ 👋' })
                  : t({ en: 'Create your account ✨', kn: 'ಖಾತೆ ತೆರೆಯಿರಿ ✨' })}
            </h2>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500 font-medium">
              {isForgotPasswordMode
                ? (otpSent ? t({ en: 'Enter the 6-digit OTP sent to your phone.', kn: 'ನಿಮ್ಮ ಫೋನ್‌ಗೆ ಬಂದ OTP ನಮೂದಿಸಿ.' }) : t({ en: 'We will send a code to your phone.', kn: 'ನಿಮ್ಮ ಫೋನ್‌ಗೆ OTP ಕಳುಹಿಸುತ್ತೇವೆ.' }))
                : isLoginMode
                  ? t({ en: 'Sign in to continue your learning journey.', kn: 'ನಿಮ್ಮ ಕಲಿಕೆ ಮುಂದುವರಿಸಿ.' })
                  : t({ en: 'Join thousands of Kannada learners today.', kn: 'ಸಾವಿರಾರು ಕನ್ನಡಿಗರೊಂದಿಗೆ ಸೇರಿ.' })}
            </p>
          </div>

          {/* ── Global Error ── */}
          {globalError && (
            <div className="mb-5 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 animate-shake">
              <span className="text-red-500 text-lg shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{globalError}</p>
              </div>
              <button
                type="button"
                onClick={() => setGlobalError('')}
                className="text-red-400 hover:text-red-600 transition-colors shrink-0 text-lg leading-none"
              >
                ×
              </button>
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Full Name — register only */}
            {!isLoginMode && !isForgotPasswordMode && (
              <div className="animate-in fade-in duration-300">
                <InputField
                  label={t({ en: 'Full Name', kn: 'ಪೂರ್ಣ ಹೆಸರು' })}
                  type="text"
                  autoComplete="name"
                  placeholder={t({ en: 'Your full name', kn: 'ನಿಮ್ಮ ಹೆಸರು' })}
                  value={formData.fullName}
                  onChange={v => setField('fullName', v)}
                  error={fieldErrors.fullName}
                  required
                />
              </div>
            )}

            {/* Phone */}
            {(!isForgotPasswordMode || !otpSent) && (
              <InputField
                label={t({ en: 'Phone Number', kn: 'ಫೋನ್ ಸಂಖ್ಯೆ' })}
                type="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                value={formData.phone}
                onChange={handlePhoneChange}
                error={fieldErrors.phone}
                maxLength={10}
                inputMode="numeric"
                required
              />
            )}

            {/* OTP Code Input */}
            {isForgotPasswordMode && otpSent && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <InputField
                  label={t({ en: '6-Digit OTP', kn: '6-ಅಂಕಿಯ OTP' })}
                  type="text"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={otpCode}
                  onChange={v => {
                    const digits = v.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(digits);
                    if (fieldErrors.otpCode) setFieldErrors(prev => ({ ...prev, otpCode: '' }));
                    setGlobalError('');
                  }}
                  error={fieldErrors.otpCode}
                  maxLength={6}
                  inputMode="numeric"
                  required
                />
              </div>
            )}

            {/* Password */}
            {(!isForgotPasswordMode || otpSent) && (
              <div className="space-y-2 animate-in fade-in duration-300">
                <InputField
                  label={isForgotPasswordMode ? t({ en: 'New Password', kn: 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್' }) : t({ en: 'Password', kn: 'ಪಾಸ್‌ವರ್ಡ್' })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isLoginMode && !isForgotPasswordMode ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={v => setField('password', v)}
                  error={fieldErrors.password}
                  required
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  }
                />

                {/* Forgot Password Link Button in Login Mode */}
                {isLoginMode && !isForgotPasswordMode && (
                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => {
                        setIsForgotPasswordMode(true);
                        setGlobalError('');
                        setFieldErrors({});
                      }}
                      className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 hover:underline hover:text-blue-800 transition-colors"
                    >
                      {t({ en: 'Forgot Password?', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?' })}
                    </button>
                  </div>
                )}

                {/* Password strength — register & reset password */}
                {(!isLoginMode || isForgotPasswordMode) && formData.password && (
                  <div className="px-1 animate-in fade-in duration-200">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwStrength.score ? pwStrength.color : 'bg-slate-200 dark:bg-slate-700'}`}
                        />
                      ))}
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${pwStrength.score <= 1 ? 'text-red-500' : pwStrength.score <= 3 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {t({ 
                        en: pwStrength.label, 
                        kn: pwStrength.label === 'Weak' ? 'ದುರ್ಬಲ' : pwStrength.label === 'Fair' ? 'ಪರವಾಗಿಲ್ಲ' : 'ಬಲವಾಗಿದೆ' 
                      })}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Village/City — register only */}
            {!isLoginMode && !isForgotPasswordMode && (
              <div className="animate-in fade-in duration-300">
                <InputField
                  label={t({ en: 'Village / City', kn: 'ನಿಮ್ಮ ಊರು' })}
                  type="text"
                  autoComplete="address-level2"
                  placeholder={t({ en: 'e.g. Mysuru, Bengaluru...', kn: 'ಉದಾ: ಮೈಸೂರು, ಬೆಂಗಳೂರು...' })}
                  value={formData.place}
                  onChange={v => setField('place', v)}
                  error={fieldErrors.place}
                  required
                />
              </div>
            )}

            {/* Admin code — register only */}
            {!isLoginMode && !isForgotPasswordMode && (
              <div className="animate-in fade-in duration-300">
                <button
                  type="button"
                  onClick={() => setShowAdminField(p => !p)}
                  className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest hover:text-blue-500 dark:hover:text-blue-400 transition-colors flex items-center gap-1"
                >
                  <span>{showAdminField ? '▾' : '▸'}</span>
                  {t({ en: 'Have an admin access code?', kn: 'ಅಡ್ಮಿನ್ ಕೋಡ್ ಇದೆಯೇ?' })}
                </button>
                {showAdminField && (
                  <div className="mt-2 animate-in fade-in slide-in-from-top-2">
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder={t({ en: 'Enter secret code', kn: 'ರಹಸ್ಯ ಕೋಡ್ ನಮೂದಿಸಿ' })}
                      value={formData.adminCode}
                      onChange={e => setField('adminCode', e.target.value)}
                      className="w-full px-4 py-3 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-200 dark:border-amber-900/30 rounded-2xl focus:border-amber-400 outline-none transition-all font-mono text-xs text-amber-900 dark:text-amber-300 uppercase tracking-widest"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-lg mt-2
                ${success
                  ? 'bg-emerald-500 text-white scale-[0.98]'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-blue-500/30 hover:shadow-blue-500/50 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed'
                }`}
            >
              {success ? (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {t({ en: 'Success!', kn: 'ಯಶಸ್ವಿ ಆಗಿದೆ!' })}
                </>
              ) : loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t({ en: 'Please wait...', kn: 'ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ...' })}
                </>
              ) : (
                <>
                  {isForgotPasswordMode
                    ? (otpSent ? t({ en: 'Verify & Reset', kn: 'ಪರಿಶೀಲಿಸಿ' }) : t({ en: 'Send OTP', kn: 'OTP ಕಳುಹಿಸಿ' }))
                    : isLoginMode
                      ? t({ en: 'Sign In', kn: 'ಸೈನ್ ಇನ್' })
                      : t({ en: 'Create Account', kn: 'ಖಾತೆ ತೆರೆಯಿರಿ' })}
                  <span>{isLoginMode && !isForgotPasswordMode ? '→' : '✨'}</span>
                </>
              )}
            </button>
          </form>

          {/* ── Switch Mode Link ── */}
          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600 font-semibold">
            {isForgotPasswordMode 
              ? t({ en: "Remembered your password?", kn: 'ಪಾಸ್‌ವರ್ಡ್ ನೆನಪಿದೆಯೇ?' })
              : isLoginMode
                ? t({ en: "Don't have an account?", kn: 'ಖಾತೆ ಇಲ್ಲವೇ?' })
                : t({ en: 'Already have an account?', kn: 'ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?' })}
            {' '}
            <button
              type="button"
              onClick={() => isForgotPasswordMode ? switchMode(true) : switchMode(!isLoginMode)}
              className="font-black text-blue-600 dark:text-blue-400 hover:underline transition-colors"
            >
              {isForgotPasswordMode 
                ? t({ en: 'Sign in instead', kn: 'ಲಾಗಿನ್ ಆಗಿ' })
                : isLoginMode
                  ? t({ en: 'Register now', kn: 'ಈಗಲೇ ನೋಂದಾಯಿಸಿ' })
                  : t({ en: 'Sign in', kn: 'ಲಾಗಿನ್ ಆಗಿ' })}
            </button>
          </p>

        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
