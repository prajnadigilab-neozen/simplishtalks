
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { useTheme } from '../components/ThemeContext';
import { getUserSession, updateProfile, getAllUsers, deleteUser, deleteOwnAccount } from '../services/authService';
import { UserRole } from '../types';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';
import { getSystemConfig } from '../services/systemConfigService';
import { clearProfileCache } from '../services/authService';

const SettingsPage: React.FC = () => {
  const { t, lang, toggleLang } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [adminStats, setAdminStats] = useState({ totalUsers: 0, completions: 0 });

  const [formData, setFormData] = useState({
    fullName: '',
    place: '',
    avatarUrl: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [costPerMinute, setCostPerMinute] = useState(2.0);
  const [topUpAmount, setTopUpAmount] = useState<number>(0);
  const [isTopUpProcessing, setIsTopUpProcessing] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const session = await getUserSession();
        if (!mounted) return;

        if (!session) {
          navigate('/login');
          return;
        }
        setUser(session);
        setFormData({
          fullName: session.name || '',
          place: session.place || '',
          avatarUrl: session.avatar_url || ''
        });

        if (session.role === UserRole.STUDENT) {
          const { data } = await supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', session.id)
            .single();
          if (mounted) setProgress(data);
        } else if (session.role === UserRole.SUPER_ADMIN) {
          const users = await getAllUsers();
          if (mounted) {
            setAdminStats({
              totalUsers: users.length,
              completions: users.filter(u => u.role === UserRole.STUDENT).length
            });
          }
        }
      } catch (e) {
        console.error("Settings init error:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();

    getSystemConfig().then(cfg => {
        if (cfg) setCostPerMinute(cfg.cost_per_minute);
    });

    return () => { mounted = false; };
  }, [navigate]);

  const handleTopUp = async () => {
    if (!user || topUpAmount <= 0) return;
    setIsTopUpProcessing(true);
    
    // Mock Payment Step
    await new Promise(r => setTimeout(r, 1500));
    
    const addedMinutes = Math.floor(topUpAmount / costPerMinute);
    const currentCredits = user.agent_credits || 0;
    const newCredits = currentCredits + addedMinutes;
    
    const { error } = await supabase
        .from('profiles')
        .update({ agent_credits: newCredits })
        .eq('id', user.id);
        
    if (!error) {
        setMessage({ type: 'success', text: t({ en: `Successfully added ${addedMinutes} minutes!`, kn: `${addedMinutes} ನಿಮಿಷಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸೇರಿಸಲಾಗಿದೆ!` }) });
        setUser({ ...user, agent_credits: newCredits });
        // Update store
        const sess = useAppStore.getState().session;
        if (sess) {
            useAppStore.getState().setSession({ ...sess, agentCredits: newCredits });
        }
        clearProfileCache();
    } else {
        setMessage({ type: 'error', text: t({ en: 'Top-up failed. Please try again.', kn: 'ಟಾಪ್-ಅಪ್ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }) });
    }
    setIsTopUpProcessing(false);
    setTopUpAmount(0);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        setMessage({ type: 'error', text: t({ en: 'Image too large (Max 1MB)', kn: 'ಚಿತ್ರ ತುಂಬಾ ದೊಡ್ಡದಿದೆ (ಗರಿಷ್ಠ 1MB)' }) });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage({ type: '', text: '' });

    const result = await updateProfile(user.id, {
      full_name: formData.fullName,
      place: formData.place,
      avatar_url: formData.avatarUrl
    });

    if (result.success) {
      setMessage({
        type: result.error ? 'warning' : 'success',
        text: result.error || t({ en: 'Profile updated successfully!', kn: 'ಪ್ರೊಫೈಲ್ ಯಶಸ್ವಿಯಾಗಿ ಅಪ್‌ಡೇಟ್ ಆಗಿದೆ!' })
      });
    } else {
      setMessage({ type: 'error', text: result.error || t({ en: 'Update failed', kn: 'ಅಪ್‌ಡೇಟ್ ವಿಫಲವಾಗಿದೆ' }) });
    }
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    const confirmed = window.confirm(
      t({
        en: "Are you sure you want to delete your account? All your progress will be lost permanently.",
        kn: "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಅಳಿಸಲು ನೀವು ಖಚಿತವಾಗಿದ್ದೀರಾ? ನಿಮ್ಮ ಎಲ್ಲಾ ಪ್ರಗತಿಯು ಶಾಶ್ವತವಾಗಿ ಕಳೆದುಹೋಗುತ್ತದೆ."
      })
    );

    if (confirmed) {
      setSaving(true);
      const result = await deleteOwnAccount();
      if (result.success) {
        navigate('/');
      } else {
        setMessage({ type: 'error', text: result.error || t({ en: 'Failed to delete account', kn: 'ಖಾತೆ ಅಳಿಸಲು ವಿಫಲವಾಗಿದೆ' }) });
        setSaving(false);
      }
    }
  };

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="p-6 md:p-12 max-w-5xl mx-auto min-h-full bg-white dark:bg-slate-900 transition-colors">
      <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-5xl font-black text-blue-900 dark:text-slate-100 uppercase tracking-tighter">
            {t({ en: 'Settings', kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್' })}
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.4em] mt-2">
            {t({ en: 'Personalize your Simplish journey', kn: 'ನಿಮ್ಮ ಸಿಂಪ್ಲಿಷ್ ಪ್ರಯಾಣವನ್ನು ವೈಯಕ್ತೀಕರಿಸಿ' })}
          </p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all dark:text-slate-300"
        >
          {t({ en: 'Back', kn: 'ಹಿಂದಕ್ಕೆ' })}
        </button>
      </div>

      {message.text && (
        <div className={`mb-8 p-5 rounded-2xl font-bold text-sm flex items-center gap-3 animate-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100' :
          message.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-100' :
            'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100'
          }`}>
          {message.type === 'success' ? '✅' : message.type === 'warning' ? 'ℹ️' : '⚠️'} {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="space-y-8">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col items-center">
            <div className="relative group">
              <div className="w-44 h-44 rounded-full border-8 border-white dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 shadow-2xl transition-transform group-hover:scale-105">
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-7xl opacity-10">👤</div>
                )}
              </div>
              <label className="absolute bottom-2 right-2 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-blue-700 transition-colors border-4 border-white dark:border-slate-800">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                </svg>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
            </div>
            <h3 className="mt-6 text-2xl font-black text-slate-800 dark:text-slate-100">{formData.fullName || t({ en: 'New Learner', kn: 'ಹೊಸ ವಿದ್ಯಾರ್ಥಿ' })}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{user?.phone || t({ en: 'No Phone', kn: 'ಫೋನ್ ಇಲ್ಲ' })}</p>

            <div className="w-full mt-8 pt-8 border-t border-slate-100 dark:border-slate-700 space-y-4">
              <button onClick={toggleTheme} className="w-full flex justify-between items-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-400 transition-all group">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t({ en: 'Dark Mode', kn: 'ಡಾರ್ಕ್ ಮೋಡ್' })}</span>
                <span className="text-xl group-hover:scale-125 transition-transform">{theme === 'light' ? '🌙' : '☀️'}</span>
              </button>
              <button onClick={toggleLang} className="w-full flex justify-between items-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-400 transition-all group">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t({ en: 'Language', kn: 'ಭಾಷೆ' })}</span>
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">{lang === 'en' ? 'ENGLISH' : 'ಕನ್ನಡ'}</span>
              </button>
              <button
                onClick={() => useAppStore.getState().setDataSaverMode(!useAppStore.getState().dataSaverMode)}
                className="w-full flex justify-between items-center p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-400 transition-all group"
              >
                <div className="flex flex-col items-start">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{t({ en: 'Data Saver', kn: 'ಡೇಟಾ ಉಳಿತಾಯ' })}</span>
                  <span className="text-[9px] font-bold text-slate-400 lowercase">{t({ en: 'Lowers data usage', kn: 'ಡೇಟಾ ಬಳಕೆಯನ್ನು ಕಡಿಮೆ ಮಾಡುತ್ತದೆ' })}</span>
                </div>
                <div className={`w-10 h-5 rounded-full relative transition-colors ${useAppStore.getState().dataSaverMode ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${useAppStore.getState().dataSaverMode ? 'left-6' : 'left-1'}`} />
                </div>
              </button>
            </div>
          </div>

          <div className="bg-blue-600 p-8 rounded-[3rem] text-white shadow-xl shadow-blue-500/20">
            {user?.role === UserRole.SUPER_ADMIN ? (
              <>
                <h4 className="font-black uppercase tracking-[0.2em] text-xs opacity-70 mb-6">{t({ en: 'Platform Overview', kn: 'ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಅವಲೋಕನ' })}</h4>
                <div className="grid grid-cols-1 gap-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold opacity-80">{t({ en: 'Total Users', kn: 'ಒಟ್ಟು ಬಳಕೆದಾರರು' })}</span>
                    <span className="text-3xl font-black">{adminStats.totalUsers}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold opacity-80">{t({ en: 'Active Students', kn: 'ಸಕ್ರಿಯ ವಿದ್ಯಾರ್ಥಿಗಳು' })}</span>
                    <span className="text-3xl font-black">{adminStats.completions}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h4 className="font-black uppercase tracking-[0.2em] text-xs opacity-70 mb-6">{t({ en: 'Your Proficiency', kn: 'ನಿಮ್ಮ ಪ್ರಾವೀಣ್ಯತೆ' })}</h4>
                <div className="space-y-6">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">{t({ en: 'Current Level', kn: 'ಪ್ರಸ್ತುತ ಹಂತ' })}</p>
                      <h5 className="text-3xl font-black uppercase">{progress?.current_level || 'BASIC'}</h5>
                    </div>
                    <span className="text-4xl">🚀</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                      <span>{t({ en: 'Lessons Done', kn: 'ಮುಗಿಸಿದ ಪಾಠಗಳು' })}</span>
                      <span>{progress?.completed_lessons?.length || 0}</span>
                    </div>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-white transition-all duration-1000" style={{ width: `${Math.min(100, (progress?.completed_lessons?.length || 0) * 10)}%` }}></div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-slate-50 dark:bg-slate-800/50 p-10 md:p-14 rounded-[4rem] border-2 border-slate-100 dark:border-slate-800 space-y-10 shadow-inner">
            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-8">
              <span className="text-4xl bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm">✏️</span>
              <div>
                <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">{t({ en: 'Edit Profile', kn: 'ಪ್ರೊಫೈಲ್ ತಿದ್ದಿ' })}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t({ en: 'Keep your details updated', kn: 'ಮಾಹಿತಿಯನ್ನು ನವೀಕರಿಸಿ' })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">{t({ en: 'Full Name', kn: 'ಪೂರ್ಣ ಹೆಸರು' })}</label>
                <input type="text" className="w-full p-6 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] focus:border-blue-500 outline-none transition-all font-bold text-slate-800 dark:text-slate-100 shadow-sm" value={formData.fullName} onChange={e => setFormData({ ...formData, fullName: e.target.value })} />
              </div>
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">{t({ en: 'Village / City', kn: 'ಊರು / ನಗರ' })}</label>
                <input type="text" className="w-full p-6 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] focus:border-blue-500 outline-none transition-all font-bold text-slate-800 dark:text-slate-100 shadow-sm" value={formData.place} onChange={e => setFormData({ ...formData, place: e.target.value })} />
              </div>
            </div>

            <div className="pt-6">
              <button type="submit" disabled={saving} className="w-full bg-orange-500 text-white py-8 rounded-[2.5rem] font-black text-2xl uppercase tracking-widest shadow-2xl hover:bg-orange-600 hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50 border-b-8 border-orange-700">
                {saving ? <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div> : <> {t({ en: 'Update Settings', kn: 'ಸೆಟ್ಟಿಂಗ್ಸ್ ನವೀಕರಿಸಿ' })} <span>✨</span> </>}
              </button>
            </div>
          </form>

          {/* Voice Time Top-up Section */}
          <div className="mt-12 bg-blue-50 dark:bg-blue-900/10 p-10 md:p-14 rounded-[4rem] border-2 border-blue-100 dark:border-blue-900/30">
            <div className="flex items-center gap-4 mb-8">
              <span className="text-4xl bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm">🎙️</span>
              <div>
                <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">{t({ en: 'Voice Time Top-up', kn: 'ಧ್ವನಿ ಸಮಯ ಟಾಪ್-ಅಪ್' })}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t({ en: 'Add custom voice practice minutes', kn: 'ಹೆಚ್ಚುವರಿ ಧ್ವನಿ ಅಭ್ಯಾಸದ ನಿಮಿಷಗಳನ್ನು ಸೇರಿಸಿ' })}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div className="space-y-4">
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">{t({ en: 'Enter Amount (₹)', kn: 'ಮೊತ್ತವನ್ನು ನಮೂದಿಸಿ (₹)' })}</label>
                <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">₹</span>
                    <input 
                      type="number" 
                      value={topUpAmount || ''} 
                      onChange={e => setTopUpAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full p-6 pl-12 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] focus:border-blue-500 outline-none transition-all font-black text-2xl text-slate-800 dark:text-slate-100 shadow-sm" 
                      placeholder="0"
                    />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t({ en: 'Estimated Time', kn: 'ಅಂದಾಜು ಸಮಯ' })}</p>
                 <p className="text-3xl font-black text-blue-600 dark:text-blue-400">
                   {Math.floor(topUpAmount / costPerMinute)} <span className="text-sm uppercase tracking-tighter opacity-60">Min</span>
                 </p>
                 <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">@ ₹{costPerMinute}/minute</p>
              </div>
            </div>

            <button 
                onClick={handleTopUp}
                disabled={isTopUpProcessing || topUpAmount <= 0}
                className="w-full mt-8 bg-blue-600 text-white py-6 rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-xl hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isTopUpProcessing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '💳'} {t({ en: 'Buy Minutes Now', kn: 'ನಿಮಿಷಗಳನ್ನು ಈಗಲೇ ಖರೀದಿಸಿ' })}
            </button>
          </div>

          <div className="mt-12 p-10 bg-red-50 dark:bg-red-900/10 rounded-[4rem] border-2 border-red-100 dark:border-red-900/30">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-xl font-black text-red-700 dark:text-red-400 uppercase tracking-tight">{t({ en: 'Danger Zone', kn: 'ಅಪಾಯಕಾರಿ ವಲಯ' })}</h3>
                <p className="text-xs font-bold text-red-500/60 uppercase tracking-widest">{t({ en: 'Account Management', kn: 'ಖಾತೆ ನಿರ್ವಹಣೆ' })}</p>
              </div>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400/70 font-medium mb-8 leading-relaxed">
              {t({
                en: "Deleting your account will remove your personal progress, profile, and chat messages. Note: Your initial registration date, revenue, and total usage time will be retained for platform reports. Your chat/voice messages will be archived for AI training purposes. You can re-register with the same phone number at any time.",
                kn: "ನಿಮ್ಮ ಖಾತೆಯನ್ನು ಅಳಿಸುವುದರಿಂದ ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಪ್ರಗತಿ, ಪ್ರೊಫೈಲ್ ಮತ್ತು ಚಾಟ್ ಸಂದೇಶಗಳನ್ನು ತೆಗೆದುಹಾಕಲಾಗುತ್ತದೆ. ಗಮನಿಸಿ: ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ವರದಿಗಳಿಗಾಗಿ ನಿಮ್ಮ ಆರಂಭಿಕ ನೋಂದಣಿ ದಿನಾಂಕ, ಆದಾಯ ಮತ್ತು ಒಟ್ಟು ಬಳಕೆಯ ಸಮಯವನ್ನು ಉಳಿಸಿಕೊಳ್ಳಲಾಗುತ್ತದೆ. ನಿಮ್ಮ ಚಾಟ್/ಧ್ವನಿ ಸಂದೇಶಗಳನ್ನು AI ತರಬೇತಿ ಉದ್ದೇಶಗಳಿಗಾಗಿ ಆರ್ಕೈವ್ ಮಾಡಲಾಗುತ್ತದೆ. ನೀವು ಯಾವುದೇ ಸಮಯದಲ್ಲಿ ಅದೇ ಫೋನ್ ಸಂಖ್ಯೆಯೊಂದಿಗೆ ಮರು-ನೋಂದಾಯಿಸಿಕೊಳ್ಳಬಹುದು."
              })}
            </p>
            <button
              onClick={handleDeleteAccount}
              disabled={saving}
              className="px-8 py-4 bg-white dark:bg-slate-900 border-2 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {t({ en: 'Delete My Account Permanently', kn: 'ನನ್ನ ಖಾತೆಯನ್ನು ಶಾಶ್ವತವಾಗಿ ಅಳಿಸಿ' })}
            </button>
          </div>
        </div>
      </div >
    </div >
  );
};

export default SettingsPage;
