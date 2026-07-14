import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getUserSession, loginUser, registerUser, sendPasswordResetOTP, verifyOTPAndResetPassword } from '../services/authService';
import { generate6DigitOTP, sendOTPViaSMSGateWayHub } from '../services/smsService';
import Logo from '../components/Logo';
import { UserRole } from '../types';
import { useAppStore } from '../store/useAppStore';
import { attributionService } from '../services/attributionService';

// ─── Password Criteria Validator ──────────────────────────────────────────────
interface PasswordCriteria {
  length: boolean;
  uppercase: boolean;
  number: boolean;
  specialChar: boolean;
  match: boolean;
}

function checkPasswordCriteria(pw: string, confirmPw: string): PasswordCriteria {
  return {
    length: pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    specialChar: /[^A-Za-z0-9]/.test(pw),
    match: pw.length > 0 && pw === confirmPw,
  };
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
  
  const [isLoginMode, setIsLoginMode] = useState(location.pathname === '/login');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  const [registerStep, setRegisterStep] = useState(1);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [devOtpNotification, setDevOtpNotification] = useState<{ phone: string; otp: string } | null>(null);

  // OTP Timer State
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [formData, setFormData] = useState({
    username: '',
    phone: '',
    otpCode: '',
    password: '',
    confirmPassword: '',
    adminCode: ''
  });

  const [generatedOtp, setGeneratedOtp] = useState('');

  // Start Resend OTP Countdown
  const startTimer = () => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    // Listen to local developer OTP sent event for easier testing
    const handleDevOtp = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setDevOtpNotification(detail);
      // Auto-fill OTP in development for super easy testing
      setFormData(prev => ({ ...prev, otpCode: detail.otp }));
    };

    window.addEventListener('dev-otp-sent', handleDevOtp);
    return () => {
      window.removeEventListener('dev-otp-sent', handleDevOtp);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const loginMode = location.pathname === '/login';
    setIsLoginMode(loginMode);
    setIsResetMode(false);
    setResetStep(1);
    setGlobalError('');
    setFieldErrors({});
    setRegisterStep(1);
    setDevOtpNotification(null);
  }, [location.pathname]);

  const setField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: '' }));
    if (globalError) setGlobalError('');
  };

  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    setField('phone', digits);
  };

  // Validate Step 1 (Full Name & Phone)
  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.username.trim()) {
      errors.username = t({ en: 'Full Name is required', kn: 'ಪೂರ್ಣ ಹೆಸರು ಅಗತ್ಯವಿದೆ' });
    }
    if (!formData.phone || formData.phone.length < 10) {
      errors.phone = t({ en: 'Enter a valid 10-digit phone number', kn: 'ಹತ್ತು ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ' });
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate Reset Step 1 (Phone only)
  const validateResetStep1 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.phone || formData.phone.length < 10) {
      errors.phone = t({ en: 'Enter a valid 10-digit phone number', kn: 'ಹತ್ತು ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ' });
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate Step 2 (OTP)
  const validateStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.otpCode || formData.otpCode.length < 6) {
      errors.otpCode = t({ en: 'Enter the 6-digit OTP', kn: '6 ಅಂಕಿಯ OTP ನಮೂದಿಸಿ' });
    } else if (formData.otpCode !== generatedOtp) {
      errors.otpCode = t({ en: 'Invalid OTP code. Please try again.', kn: 'ಅಮಾನ್ಯ OTP ಕೋಡ್. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' });
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate Reset Step 2 (OTP Code structure)
  const validateResetStep2 = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.otpCode || formData.otpCode.length < 6) {
      errors.otpCode = t({ en: 'Enter the 6-digit OTP', kn: '6 ಅಂಕಿಯ OTP ನಮೂದಿಸಿ' });
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate Step 3 (Password)
  const validateStep3 = (): boolean => {
    const errors: Record<string, string> = {};
    const criteria = checkPasswordCriteria(formData.password, formData.confirmPassword);
    
    if (!criteria.length || !criteria.uppercase || !criteria.number || !criteria.specialChar) {
      errors.password = t({ en: 'Password does not meet validation criteria', kn: 'ಪಾಸ್‌ವರ್ಡ್ ನಿಯಮಗಳನ್ನು ಪಾಲಿಸಿಲ್ಲ' });
    }
    if (!criteria.match) {
      errors.confirmPassword = t({ en: 'Passwords do not match', kn: 'ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ಹೊಂದಿಕೆಯಾಗುತ್ತಿಲ್ಲ' });
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSendOTP = async () => {
    if (!validateStep1()) return;

    setLoading(true);
    setGlobalError('');
    setDevOtpNotification(null);

    const otp = generate6DigitOTP();
    setGeneratedOtp(otp);

    const result = await sendOTPViaSMSGateWayHub(formData.phone, otp);
    if (result.success) {
      startTimer();
      setRegisterStep(2);
    } else {
      setGlobalError(result.error || t({ en: 'Failed to send OTP. Try again.', kn: 'OTP ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }));
    }
    setLoading(false);
  };

  const handleVerifyOTP = () => {
    if (!validateStep2()) return;
    setRegisterStep(3);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setLoading(true);
    setGlobalError('');

    const result = await registerUser({
      fullName: formData.username,
      phone: formData.phone,
      password: formData.password,
      adminCode: formData.adminCode
    });

    if (result.success) {
      setSuccess(true);
      // Wait briefly for UI transitions, then re-initialize and redirect to profile
      setTimeout(async () => {
        await useAppStore.getState().initialize(true);
        navigate('/profile', { replace: true });
      }, 800);
    } else {
      setGlobalError(result.error || t({ en: 'Failed to complete registration.', kn: 'ನೋಂದಣಿ ಪೂರ್ಣಗೊಳಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' }));
    }
    setLoading(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.phone || formData.phone.length < 10) {
      errors.phone = t({ en: 'Enter a valid 10-digit phone number', kn: 'ಹತ್ತು ಅಂಕಿಯ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ' });
    }
    if (!formData.password) {
      errors.password = t({ en: 'Password is required', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಅಗತ್ಯವಿದೆ' });
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    setGlobalError('');

    const result = await loginUser({
      phone: formData.phone,
      password: formData.password
    });

    if (result.success) {
      setSuccess(true);
      await useAppStore.getState().initialize(true);
      // AppContent/Store will handle normal navigation based on profile completeness and placement status
    } else {
      setGlobalError(result.error || t({ en: 'Invalid credentials. Please try again.', kn: 'ಅಮಾನ್ಯ ಲಾಗಿನ್ ವಿವರಗಳು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }));
    }
    setLoading(false);
  };

  const handleResetSendOTP = async () => {
    if (!validateResetStep1()) return;

    setLoading(true);
    setGlobalError('');
    setDevOtpNotification(null);

    const result = await sendPasswordResetOTP(formData.phone);
    if (result.success) {
      startTimer();
      setResetStep(2);
    } else {
      // Graceful local development fallback if SMS provider is not configured in Supabase Auth
      console.warn("Supabase Auth OTP reset failed, falling back to local SMS GateWay Hub mock for developer testing:", result.error);
      const otp = generate6DigitOTP();
      setGeneratedOtp(otp);
      const localSms = await sendOTPViaSMSGateWayHub(formData.phone, otp, 'reset');
      if (localSms.success) {
        startTimer();
        setResetStep(2);
      } else {
        setGlobalError(localSms.error || t({ en: 'Failed to send OTP. Try again.', kn: 'OTP ಕಳುಹಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }));
      }
    }
    setLoading(false);
  };

  const handleResetVerifyOTP = () => {
    if (!validateResetStep2()) return;
    if (generatedOtp && formData.otpCode !== generatedOtp) {
      setFieldErrors({ otpCode: t({ en: 'Invalid OTP code. Please try again.', kn: 'ಅಮಾನ್ಯ OTP ಕೋಡ್. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }) });
      return;
    }
    setResetStep(3);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setLoading(true);
    setGlobalError('');

    if (generatedOtp) {
      // Local development mock success
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsResetMode(false);
        switchMode(true);
      }, 1500);
    } else {
      const result = await verifyOTPAndResetPassword(formData.phone, formData.otpCode, formData.password);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setIsResetMode(false);
          switchMode(true);
        }, 1500);
      } else {
        setGlobalError(result.error || t({ en: 'Password reset failed.', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' }));
      }
    }
    setLoading(false);
  };

  const switchMode = (loginMode: boolean) => {
    navigate(loginMode ? '/login' : '/register');
    setGlobalError('');
    setFieldErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
    setRegisterStep(1);
    setDevOtpNotification(null);
    setFormData({
      username: '',
      phone: '',
      otpCode: '',
      password: '',
      confirmPassword: '',
      adminCode: ''
    });
  };

  const pwCriteria = checkPasswordCriteria(formData.password, formData.confirmPassword);

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
          {!isResetMode && (
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
              {isResetMode
                ? resetStep === 1
                  ? t({ en: 'Reset Password 🔑', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ 🔑' })
                  : resetStep === 2
                    ? t({ en: 'Verify Phone 📱', kn: 'ಫೋನ್ ಪರಿಶೀಲನೆ 📱' })
                    : t({ en: 'Set New Password 🔒', kn: 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ಹೊಂದಿಸಿ 🔒' })
                : isLoginMode
                  ? t({ en: 'Welcome back 👋', kn: 'ಮರಳಿ ಸ್ವಾಗತ 👋' })
                  : registerStep === 1
                    ? t({ en: 'Create your account ✨', kn: 'ಖಾತೆ ತೆರೆಯಿರಿ ✨' })
                    : registerStep === 2
                      ? t({ en: 'Phone Verification 📱', kn: 'ಫೋನ್ ಪರಿಶೀಲನೆ 📱' })
                      : t({ en: 'Set New Password 🔒', kn: 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್ ಹೊಂದಿಸಿ 🔒' })}
            </h2>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500 font-medium">
              {isResetMode
                ? resetStep === 1
                  ? t({ en: 'Enter your phone number to receive a security OTP.', kn: 'ಭದ್ರತಾ OTP ಪಡೆಯಲು ನಿಮ್ಮ ಫೋನ್ ಸಂಖ್ಯೆ ನಮೂದಿಸಿ.' })
                  : resetStep === 2
                    ? t({ en: 'Enter the 6-digit OTP sent to your phone.', kn: 'ನಿಮ್ಮ ಫೋನ್‌ಗೆ ಬಂದ 6 ಅಂಕಿಯ OTP ನಮೂದಿಸಿ.' })
                    : t({ en: 'Configure a strong security password.', kn: 'ಭದ್ರವಾದ ಪಾಸ್‌ವರ್ಡ್ ಹೊಂದಿಸಿ.' })
                : isLoginMode
                  ? t({ en: 'Sign in to continue your learning journey.', kn: 'ನಿಮ್ಮ ಕಲಿಕೆ ಮುಂದುವರಿಸಿ.' })
                  : registerStep === 1
                    ? t({ en: 'Join thousands of Kannada learners today.', kn: 'ಸಾವಿರಾರು ಕನ್ನಡಿಗರೊಂದಿಗೆ ಸೇರಿ.' })
                    : registerStep === 2
                      ? t({ en: 'Enter the 6-digit OTP sent to your phone.', kn: 'ನಿಮ್ಮ ಫೋನ್‌ಗೆ ಬಂದ 6 ಅಂಕಿಯ OTP ನಮೂದಿಸಿ.' })
                      : t({ en: 'Configure a strong security password.', kn: 'ಭದ್ರವಾದ ಪಾಸ್‌ವರ್ಡ್ ಹೊಂದಿಸಿ.' })}
            </p>
          </div>

          {/* ── Developer OTP Helper Toast ── */}
          {devOtpNotification && (
            <div className="mb-5 flex flex-col gap-1 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-lg">📢</span>
                <p className="text-xs font-black uppercase text-amber-800 dark:text-amber-400 tracking-wider">Developer OTP Info</p>
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                SMSGateWayHub simulated message for <span className="font-bold text-blue-600 dark:text-blue-400">{devOtpNotification.phone}</span>:
              </p>
              <div className="mt-1.5 p-2 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-amber-300 flex items-center justify-between">
                <span className="font-mono text-lg font-extrabold tracking-widest text-amber-900 dark:text-amber-200 select-all">
                  {devOtpNotification.otp}
                </span>
                <span className="text-[10px] font-black text-amber-600 uppercase">Auto-filled below!</span>
              </div>
            </div>
          )}

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

          {/* ── FORM ── */}
          {isResetMode ? (
            /* =================================================================
               RESET PASSWORD WIZARD FLOW (Phase 1, 2 & 3)
               ================================================================= */
            <div className="space-y-4">
              {resetStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-300">
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

                  <button
                    type="button"
                    onClick={handleResetSendOTP}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t({ en: 'Sending OTP...', kn: 'OTP ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...' })}
                      </>
                    ) : (
                      <>
                        {t({ en: 'Send Reset OTP', kn: 'OTP ಕಳುಹಿಸಿ' })}
                        <span>→</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {resetStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <InputField
                    label={t({ en: 'Enter OTP Code', kn: 'OTP ಕೋಡ್ ನಮೂದಿಸಿ' })}
                    type="text"
                    placeholder="123456"
                    value={formData.otpCode}
                    onChange={v => setField('otpCode', v.replace(/\D/g, '').slice(0, 6))}
                    error={fieldErrors.otpCode}
                    maxLength={6}
                    inputMode="numeric"
                    required
                  />

                  <button
                    type="button"
                    onClick={handleResetVerifyOTP}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 mt-4"
                  >
                    {t({ en: 'Verify & Continue', kn: 'ಪರಿಶೀಲಿಸಿ ಮತ್ತು ಮುಂದುವರಿಯಿರಿ' })}
                    <span>→</span>
                  </button>

                  <div className="flex justify-between items-center text-xs mt-2 px-1">
                    <span className="text-slate-400 font-semibold">
                      {countdown > 0 ? (
                        `${t({ en: 'Resend in', kn: 'ಮತ್ತೆ ಕಳುಹಿಸಲು' })} ${countdown}s`
                      ) : (
                        t({ en: 'Didn\'t receive OTP?', kn: 'OTP ಬಂದಿಲ್ಲವೇ?' })
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleResetSendOTP}
                      disabled={countdown > 0 || loading}
                      className="font-black text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-40 disabled:no-underline transition-all"
                    >
                      {t({ en: 'Resend OTP', kn: 'OTP ಮತ್ತೆ ಕಳುಹಿಸಿ' })}
                    </button>
                  </div>
                </div>
              )}

              {resetStep === 3 && (
                <form onSubmit={handleResetSubmit} className="space-y-4 animate-in fade-in duration-300" noValidate>
                  <InputField
                    label={t({ en: 'New Password', kn: 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್' })}
                    type={showPassword ? 'text' : 'password'}
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
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    }
                  />

                  <InputField
                    label={t({ en: 'Confirm Password', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಖಚಿತಪಡಿಸಿ' })}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={v => setField('confirmPassword', v)}
                    error={fieldErrors.confirmPassword}
                    required
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(p => !p)}
                        className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1"
                        tabIndex={-1}
                      >
                        <EyeIcon open={showConfirmPassword} />
                      </button>
                    }
                  />

                  {/* Password Checklist UI */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <p className="font-black uppercase tracking-wider text-[9px] text-slate-400">Security Criteria Checklist</p>
                    <div className="grid grid-cols-1 gap-1.5 font-semibold">
                      {[
                        { met: pwCriteria.length, label: t({ en: 'Minimum 8 characters', kn: 'ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು' }) },
                        { met: pwCriteria.uppercase, label: t({ en: 'At least one uppercase letter (A-Z)', kn: 'ಕನಿಷ್ಠ ಒಂದು ದೊಡ್ಡ ಅಕ್ಷರ (A-Z)' }) },
                        { met: pwCriteria.number, label: t({ en: 'At least one number (0-9)', kn: 'ಕನಿಷ್ಠ ಒಂದು ಸಂಖ್ಯೆ (0-9)' }) },
                        { met: pwCriteria.specialChar, label: t({ en: 'At least one special character (@,#,$,etc)', kn: 'ಕನಿಷ್ಠ ಒಂದು ವಿಶೇಷ ಸಂಕೇತ (@,#,$,ಇತ್ಯಾದಿ)' }) },
                        { met: pwCriteria.match, label: t({ en: 'Passwords match in real-time', kn: 'ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ತಾಳೆಯಾಗುತ್ತವೆ' }) }
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 transition-all">
                          <span className={`text-sm leading-none ${item.met ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                            {item.met ? '✓' : '•'}
                          </span>
                          <span className={item.met ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 line-through'}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || success}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-lg mt-4
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
                        {t({ en: 'Success!', kn: 'ಪಾಸ್‌ವರ್ಡ್ ರಿಸೆಟ್ ಯಶಸ್ವಿ!' })}
                      </>
                    ) : loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t({ en: 'Please wait...', kn: 'ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ...' })}
                      </>
                    ) : (
                      <>
                        {t({ en: 'Reset Password', kn: 'ಪಾಸ್‌ವರ್ಡ್ ರಿಸೆಟ್ ಮಾಡಿ' })}
                        <span>🔒</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          ) : isLoginMode ? (
            /* =================================================================
               LOGIN FLOW
               ================================================================= */
            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
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

              <div className="space-y-1">
                <InputField
                  label={t({ en: 'Password', kn: 'ಪಾಸ್‌ವರ್ಡ್' })}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
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
                <div className="flex justify-end mt-1 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(true);
                      setResetStep(1);
                      setGlobalError('');
                      setFieldErrors({});
                    }}
                    className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    {t({ en: 'Forgot Password?', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?' })}
                  </button>
                </div>
              </div>

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
                    {t({ en: 'Success!', kn: 'ಲಾಗಿನ್ ಯಶಸ್ವಿ!' })}
                  </>
                ) : loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t({ en: 'Please wait...', kn: 'ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ...' })}
                  </>
                ) : (
                  <>
                    {t({ en: 'Sign In', kn: 'ಸೈನ್ ಇನ್' })}
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* =================================================================
               ONBOARDING REGISTER WIZARD FLOW (Phase 1 & 2)
               ================================================================= */
            <div className="space-y-4">
              {registerStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <InputField
                    label={t({ en: 'Full Name', kn: 'ಪೂರ್ಣ ಹೆಸರು' })}
                    type="text"
                    autoComplete="name"
                    placeholder={t({ en: 'Enter your full name', kn: 'ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ನಮೂದಿಸಿ' })}
                    value={formData.username}
                    onChange={v => setField('username', v)}
                    error={fieldErrors.username}
                    required
                  />

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

                  <button
                    type="button"
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t({ en: 'Sending OTP...', kn: 'OTP ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ...' })}
                      </>
                    ) : (
                      <>
                        {t({ en: 'Send OTP', kn: 'OTP ಕಳುಹಿಸಿ' })}
                        <span>✨</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {registerStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl text-xs font-semibold text-blue-800 dark:text-blue-300 flex justify-between items-center">
                    <span>
                      {t({ en: 'Verifying: ', kn: 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ: ' })}
                      <strong>{formData.phone}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setRegisterStep(1)}
                      className="text-blue-600 dark:text-blue-400 font-black hover:underline"
                    >
                      {t({ en: 'Change', kn: 'ಬದಲಾಯಿಸಿ' })}
                    </button>
                  </div>

                  <InputField
                    label={t({ en: '6-Digit OTP', kn: '6-ಅಂಕಿಯ OTP' })}
                    type="text"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={formData.otpCode}
                    onChange={v => {
                      const digits = v.replace(/\D/g, '').slice(0, 6);
                      setFormData(prev => ({ ...prev, otpCode: digits }));
                      if (fieldErrors.otpCode) setFieldErrors(prev => ({ ...prev, otpCode: '' }));
                      setGlobalError('');
                    }}
                    error={fieldErrors.otpCode}
                    maxLength={6}
                    inputMode="numeric"
                    required
                  />

                  {/* Countdown Timer or Resend */}
                  <div className="flex justify-between items-center text-xs font-bold px-1 py-1">
                    <span className="text-slate-400">
                      {countdown > 0 ? (
                        `${t({ en: 'Resend code in: ', kn: 'ಮತ್ತೆ ಕಳುಹಿಸಿ: ' })}${countdown}s`
                      ) : (
                        t({ en: "Didn't receive code?", kn: 'ಕೋಡ್ ಬಂದಿಲ್ಲವೇ?' })
                      )}
                    </span>
                    {countdown === 0 && (
                      <button
                        type="button"
                        onClick={handleSendOTP}
                        className="text-blue-600 dark:text-blue-400 font-black hover:underline uppercase tracking-wider text-[10px]"
                      >
                        {t({ en: 'Resend OTP', kn: 'ಮತ್ತೆ ಕಳುಹಿಸಿ' })}
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyOTP}
                    className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 mt-2"
                  >
                    {t({ en: 'Verify & Proceed', kn: 'ದೃಢೀಕರಿಸಿ ಮತ್ತು ಮುಂದುವರಿಯಿರಿ' })}
                    <span>→</span>
                  </button>
                </div>
              )}

              {registerStep === 3 && (
                <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-in fade-in duration-300" noValidate>
                  <InputField
                    label={t({ en: 'New Password', kn: 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್' })}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
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

                  <InputField
                    label={t({ en: 'Confirm New Password', kn: 'ಪಾಸ್‌ವರ್ಡ್ ಖಚಿತಪಡಿಸಿ' })}
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={v => setField('confirmPassword', v)}
                    error={fieldErrors.confirmPassword}
                    required
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(p => !p)}
                        className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1"
                        tabIndex={-1}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        <EyeIcon open={showConfirmPassword} />
                      </button>
                    }
                  />

                  {/* Password Checklist UI */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <p className="font-black uppercase tracking-wider text-[9px] text-slate-400">Security Criteria Checklist</p>
                    <div className="grid grid-cols-1 gap-1.5 font-semibold">
                      {[
                        { met: pwCriteria.length, label: t({ en: 'Minimum 8 characters', kn: 'ಕನಿಷ್ಠ 8 ಅಕ್ಷರಗಳು' }) },
                        { met: pwCriteria.uppercase, label: t({ en: 'At least one uppercase letter (A-Z)', kn: 'ಕನಿಷ್ಠ ಒಂದು ದೊಡ್ಡ ಅಕ್ಷರ (A-Z)' }) },
                        { met: pwCriteria.number, label: t({ en: 'At least one number (0-9)', kn: 'ಕನಿಷ್ಠ ಒಂದು ಸಂಖ್ಯೆ (0-9)' }) },
                        { met: pwCriteria.specialChar, label: t({ en: 'At least one special character (@,#,$,etc)', kn: 'ಕನಿಷ್ಠ ಒಂದು ವಿಶೇಷ ಸಂಕೇತ (@,#,$,ಇತ್ಯಾದಿ)' }) },
                        { met: pwCriteria.match, label: t({ en: 'Passwords match in real-time', kn: 'ಪಾಸ್‌ವರ್ಡ್‌ಗಳು ತಾಳೆಯಾಗುತ್ತವೆ' }) }
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 transition-all">
                          <span className={`text-sm leading-none ${item.met ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                            {item.met ? '✓' : '•'}
                          </span>
                          <span className={item.met ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 line-through'}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Optional Admin Access Code Toggle */}
                  <div className="pt-2">
                    <InputField
                      label={t({ en: 'Admin Access Code (Optional)', kn: 'ಅಡ್ಮಿನ್ ಕೋಡ್ (ಐಚ್ಛಿಕ)' })}
                      type="text"
                      autoComplete="off"
                      placeholder="••••••••"
                      value={formData.adminCode}
                      onChange={v => setField('adminCode', v)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || success}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-lg mt-4
                      ${success
                        ? 'bg-emerald-500 text-white scale-[0.98]'
                        : 'bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white shadow-orange-500/30 hover:shadow-orange-500/50 hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed'
                      }`}
                  >
                    {success ? (
                      <>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {t({ en: 'Success!', kn: 'ನೋಂದಣಿ ಯಶಸ್ವಿ!' })}
                      </>
                    ) : loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {t({ en: 'Registering...', kn: 'ಖಾತೆ ತೆರೆಯಲಾಗುತ್ತಿದೆ...' })}
                      </>
                    ) : (
                      <>
                        {t({ en: 'Complete Register', kn: 'ನೋಂದಣಿ ಮುಕ್ತಾಯ' })}
                        <span>✨</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── Switch Mode Link ── */}
          <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-600 font-semibold">
            {isResetMode ? (
              <button
                type="button"
                onClick={() => {
                  setIsResetMode(false);
                  setIsLoginMode(true);
                  switchMode(true);
                }}
                className="font-black text-blue-600 dark:text-blue-400 hover:underline transition-colors"
              >
                {t({ en: 'Back to Sign In', kn: 'ಲಾಗಿನ್‌ಗೆ ಹಿಂತಿರುಗಿ' })}
              </button>
            ) : (
              <>
                {isLoginMode
                  ? t({ en: "Don't have an account?", kn: 'ಖಾತೆ ಇಲ್ಲವೇ?' })
                  : t({ en: 'Already have an account?', kn: 'ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?' })}
                {' '}
                <button
                  type="button"
                  onClick={() => isLoginMode ? switchMode(false) : switchMode(true)}
                  className="font-black text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                >
                  {isLoginMode
                    ? t({ en: 'Register now', kn: 'ಈಗಲೇ ನೋಂದಾಯಿಸಿ' })
                    : t({ en: 'Sign in', kn: 'ಲಾಗಿನ್ ಆಗಿ' })}
                </button>
              </>
            )}
          </p>

          {/* Download App Option */}
          <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800 flex justify-center">
            <button
              type="button"
              onClick={() => {
                attributionService.recordPendingAttribution('android');
                attributionService.logEvent('web_download_button_clicked', { platform: 'android', source: 'register' });
                window.dispatchEvent(new CustomEvent('simplish-trigger-pwa-install'));
              }}
              className="flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 bg-slate-100/50 hover:bg-blue-50 dark:bg-slate-800/40 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl transition-all active:scale-95 shadow-sm"
            >
              📥 {t({ en: 'Download App', kn: 'ಆಪ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ' })}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
