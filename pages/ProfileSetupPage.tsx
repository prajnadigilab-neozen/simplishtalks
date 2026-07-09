import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getUserSession, updateProfile } from '../services/authService';
import { useAppStore } from '../store/useAppStore';
import Logo from '../components/Logo';

const ProfileSetupPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { session, refreshSession } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    dob: '',
    employmentStatus: 'Student',
    personalAddress: '',
    place: '',
    pincode: ''
  });

  // Today's date formatted as YYYY-MM-DD for date-picker max limit
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const init = async () => {
      const activeSession = await getUserSession();
      if (!activeSession) {
        navigate('/login', { replace: true });
        return;
      }
      
      // If user has already completed onboarding, skip directly to placement or dashboard
      if (activeSession.dateOfBirth) {
        navigate('/placement', { replace: true });
        return;
      }

      setFormData(prev => ({
        ...prev,
        place: activeSession.place || ''
      }));
      setLoading(false);
    };
    
    init();
  }, [navigate]);

  const setField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: '' }));
    if (globalError) setGlobalError('');
  };

  const handlePincodeChange = (raw: string) => {
    // Keep only digits and limit to 6 digits maximum
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setField('pincode', digits);
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. Date of Birth Validation (Mandatory & Past only)
    if (!formData.dob) {
      errors.dob = t({ en: 'Date of birth is required', kn: 'ಹುಟ್ಟಿದ ದಿನಾಂಕ ಕಡ್ಡಾಯವಾಗಿದೆ' });
    } else {
      const selectedDate = new Date(formData.dob);
      const today = new Date();
      if (selectedDate > today) {
        errors.dob = t({ en: 'Date of birth cannot be in the future', kn: 'ಹುಟ್ಟಿದ ದಿನಾಂಕ ಭವಿಷ್ಯದ್ದಾಗಿರಲು ಸಾಧ್ಯವಿಲ್ಲ' });
      }
    }

    // 2. Employment Status Validation (Mandatory)
    const validStatus = ['Student', 'Job Seeker', 'Employed', 'Self-Employed', 'Other'];
    if (!formData.employmentStatus || !validStatus.includes(formData.employmentStatus)) {
      errors.employmentStatus = t({ en: 'Select a valid employment status', kn: 'ಸರಿಯಾದ ಉದ್ಯೋಗ ಸ್ಥಿತಿಯನ್ನು ಆರಿಸಿ' });
    }

    // 3. Place Validation (Mandatory)
    if (!formData.place.trim()) {
      errors.place = t({ en: 'Village / City is required', kn: 'ಊರು/ನಗರ ಕಡ್ಡಾಯವಾಗಿದೆ' });
    }

    // 4. Pincode Validation (Strictly 6 digits for India or 5 digits for US)
    if (!formData.pincode) {
      errors.pincode = t({ en: 'Pincode is required', kn: 'ಪಿನ್‌ಕೋಡ್ ಕಡ್ಡಾಯವಾಗಿದೆ' });
    } else if (formData.pincode.length !== 5 && formData.pincode.length !== 6) {
      errors.pincode = t({ en: 'Pincode must be 5 digits (US) or 6 digits (India)', kn: 'ಪಿನ್‌ಕೋಡ್ 5 ಅಂಕಿ (US) ಅಥವಾ 6 ಅಂಕಿ (ಭಾರತ) ಇರಬೇಕು' });
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    setGlobalError('');

    if (!session?.id) {
      setGlobalError(t({ en: 'Session expired. Please sign in again.', kn: 'ಸೆಷನ್ ಅವಧಿ ಮುಗಿದಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಲಾಗಿನ್ ಆಗಿ.' }));
      setSaving(false);
      return;
    }

    const result = await updateProfile(session.id, {
      date_of_birth: formData.dob,
      employment_status: formData.employmentStatus,
      personal_address: formData.personalAddress,
      place: formData.place,
      pincode: formData.pincode
    });

    if (result.success) {
      // Refresh the session in the app store to reflect complete onboarding status
      await refreshSession();
      // Instantly redirect to placement
      navigate('/placement', { replace: true });
    } else {
      setGlobalError(result.error || t({ en: 'Failed to update profile details.', kn: 'ಪ್ರೊಫೈಲ್ ವಿವರಗಳನ್ನು ಅಪ್‌ಡೇಟ್ ಮಾಡಲು ಸಾಧ್ಯವಾಗಲಿಲ್ಲ.' }));
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      
      {/* Brand Header */}
      <div className="flex flex-col items-center mb-8">
        <Logo symbolOnly className="w-16 h-16 mb-2" />
        <h1 className="text-2xl font-black text-blue-900 dark:text-white tracking-tight flex items-center gap-1.5">
          SIMPLISH <span className="font-script italic text-amber-500 normal-case text-3xl">Talks</span>
        </h1>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Profile Onboarding</p>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-700 shadow-xl max-w-md w-full animate-in zoom-in-95">
        <div className="mb-6">
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {t({ en: 'Tell us about yourself 📝', kn: 'ನಿಮ್ಮ ಬಗ್ಗೆ ತಿಳಿಸಿ 📝' })}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-1">
            {t({ en: 'Please fill in these final details to activate your account.', kn: 'ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಲು ಕೊನೆಯ ಹಂತದ ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ.' })}
          </p>
        </div>

        {globalError && (
          <div className="mb-5 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 animate-shake">
            <span className="text-red-500 text-lg shrink-0">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-red-600 dark:text-red-400">{globalError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          
          {/* Date of Birth Picker */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
              {t({ en: 'Date of Birth (Mandatory)', kn: 'ಹುಟ್ಟಿದ ದಿನಾಂಕ (ಕಡ್ಡಾಯ)' })}
            </label>
            <div className={`flex items-center rounded-2xl border-2 transition-all duration-200 overflow-hidden
              ${fieldErrors.dob
                ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-700'
              }`}>
              <input
                type="date"
                required
                max={todayStr}
                value={formData.dob}
                onChange={e => setField('dob', e.target.value)}
                className="flex-1 px-4 py-4 bg-transparent outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
              />
            </div>
            {fieldErrors.dob && (
              <p className="text-[11px] font-bold text-red-500 dark:text-red-400 pl-1">{fieldErrors.dob}</p>
            )}
          </div>

          {/* Employment Status Select */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
              {t({ en: 'Employment Status (Mandatory)', kn: 'ಉದ್ಯೋಗ ಸ್ಥಿತಿ (ಕಡ್ಡಾಯ)' })}
            </label>
            <div className={`flex items-center rounded-2xl border-2 transition-all duration-200 overflow-hidden
              ${fieldErrors.employmentStatus
                ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-700'
              }`}>
              <select
                value={formData.employmentStatus}
                onChange={e => setField('employmentStatus', e.target.value)}
                className="flex-1 px-4 py-4 bg-transparent outline-none text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="Student">{t({ en: 'Student', kn: 'ವಿದ್ಯಾರ್ಥಿ' })}</option>
                <option value="Job Seeker">{t({ en: 'Job Seeker', kn: 'ಕೆಲಸ ಹುಡುಕುತ್ತಿರುವವರು' })}</option>
                <option value="Employed">{t({ en: 'Employed', kn: 'ಉದ್ಯೋಗಿ' })}</option>
                <option value="Self-Employed">{t({ en: 'Self-Employed', kn: 'ಸ್ವಯಂ ಉದ್ಯೋಗಿ' })}</option>
                <option value="Other">{t({ en: 'Other', kn: 'ಇತರೆ' })}</option>
              </select>
            </div>
            {fieldErrors.employmentStatus && (
              <p className="text-[11px] font-bold text-red-500 dark:text-red-400 pl-1">{fieldErrors.employmentStatus}</p>
            )}
          </div>

          {/* Personal Address Textarea */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
              {t({ en: 'Personal Address (Optional)', kn: 'ಮನೆಯ ವಿಳಾಸ (ಐಚ್ಛಿಕ)' })}
            </label>
            <div className="flex items-center rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-700 transition-all duration-200 overflow-hidden">
              <textarea
                placeholder={t({ en: 'Your local address details', kn: 'ನಿಮ್ಮ ವಿಳಾಸ ವಿವರಗಳು' })}
                value={formData.personalAddress}
                onChange={e => setField('personalAddress', e.target.value)}
                rows={3}
                className="flex-1 px-4 py-3 bg-transparent outline-none text-sm font-semibold text-slate-800 dark:text-slate-100 resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Place (Village/City) Input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
              {t({ en: 'Place / Village / City (Mandatory)', kn: 'ಸ್ಥಳ / ಊರು / ನಗರ (ಕಡ್ಡಾಯ)' })}
            </label>
            <div className={`flex items-center rounded-2xl border-2 transition-all duration-200 overflow-hidden
              ${fieldErrors.place
                ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-700'
              }`}>
              <input
                type="text"
                placeholder="e.g. Mysuru, Bengaluru"
                value={formData.place}
                onChange={e => setField('place', e.target.value)}
                className="flex-1 px-4 py-4 bg-transparent outline-none text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
            {fieldErrors.place && (
              <p className="text-[11px] font-bold text-red-500 dark:text-red-400 pl-1">{fieldErrors.place}</p>
            )}
          </div>

          {/* Pincode Input */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em]">
              {t({ en: 'Pincode (Mandatory)', kn: 'ಪಿನ್‌ಕೋಡ್ (ಕಡ್ಡಾಯ)' })}
            </label>
            <div className={`flex items-center rounded-2xl border-2 transition-all duration-200 overflow-hidden
              ${fieldErrors.pincode
                ? 'border-red-400 dark:border-red-500 bg-red-50 dark:bg-red-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:bg-white dark:focus-within:bg-slate-700'
              }`}>
              <input
                type="text"
                placeholder="560001 or 90210"
                value={formData.pincode}
                onChange={e => handlePincodeChange(e.target.value)}
                maxLength={6}
                inputMode="numeric"
                className="flex-1 px-4 py-4 bg-transparent outline-none text-sm font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
            </div>
            {fieldErrors.pincode && (
              <p className="text-[11px] font-bold text-red-500 dark:text-red-400 pl-1">{fieldErrors.pincode}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all flex items-center justify-center gap-2 mt-6 disabled:opacity-60"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t({ en: 'Saving details...', kn: 'ಉಳಿಸಲಾಗುತ್ತಿದೆ...' })}
              </>
            ) : (
              <>
                {t({ en: 'Save & Continue', kn: 'ಉಳಿಸಿ ಮತ್ತು ಮುಂದುವರಿಯಿರಿ' })}
                <span>→</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
