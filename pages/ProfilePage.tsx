
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { getUserSession, updateProfile } from '../services/authService';
import { UserRole, CourseLevel } from '../types';
import { supabase } from '../lib/supabase';

const ProfilePage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    place: '',
    avatarUrl: ''
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    const init = async () => {
      const session = await getUserSession();
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

      if (session.role === UserRole.USER) {
        const { data } = await supabase
          .from('user_progress')
          .select('*')
          .eq('user_id', session.id)
          .single();
        setProgress(data);
      }
      setLoading(false);
    };
    init();
  }, [navigate]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user?.id) {
      setSaving(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `profiles/${fileName}`;

        // 1. Upload file
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get Public URL
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
        setMessage({ type: 'success', text: t({ en: 'Image uploaded! Remember to save changes.', kn: 'ಚಿತ್ರ ಅಪ್‌ಲೋಡ್ ಆಗಿದೆ! ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಲು ಮರೆಯಬೇಡಿ.' }) });
      } catch (err: any) {
        setMessage({ type: 'error', text: `Upload failed: ${err.message}` });
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    const result = await updateProfile(user.id, {
      full_name: formData.fullName,
      place: formData.place,
      avatar_url: formData.avatarUrl
    });

    if (result.success) {
      setMessage({ type: 'success', text: t({ en: 'Profile updated successfully!', kn: 'ಪ್ರೊಫೈಲ್ ಯಶಸ್ವಿಯಾಗಿ ಅಪ್‌ಡೇಟ್ ಆಗಿದೆ!' }) });
      setIsEditing(false);
      // Refresh local user state
      setUser((prev: any) => ({ ...prev, name: formData.fullName, place: formData.place, avatar_url: formData.avatarUrl }));
    } else {
      setMessage({ type: 'error', text: result.error || 'Update failed' });
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
      <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto min-h-full bg-slate-50 dark:bg-slate-900/50 transition-colors">
      <div className="mb-10 flex justify-between items-center">
        <div>
          <h2 className="text-4xl font-black text-blue-900 dark:text-slate-100 uppercase tracking-tighter">
            {t({ en: 'My Profile', kn: 'ನನ್ನ ಪ್ರೊಫೈಲ್' })}
          </h2>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">SIMPLISH DIGITAL ID</p>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-md ${isEditing
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </button>
      </div>

      {message.text && (
        <div className={`mb-8 p-5 rounded-2xl font-bold text-sm flex items-center gap-3 animate-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200'
          }`}>
          {message.type === 'success' ? '✅' : '⚠️'} {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Profile Card Sidebar */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-700 shadow-xl overflow-hidden relative transition-all group">
            {/* Header Stripe */}
            <div className={`h-24 w-full ${user.role === UserRole.ADMIN ? 'bg-amber-400' : 'bg-blue-800'} relative`}>
              <div className="absolute top-4 right-6 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest">
                Verified {user.role}
              </div>
            </div>

            <div className="px-8 pb-10 flex flex-col items-center -mt-16 relative z-10">
              <div className="w-32 h-32 rounded-full border-8 border-white dark:border-slate-800 overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-2xl mb-4">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">👤</div>
                )}
              </div>

              <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 text-center leading-tight mb-1">
                {user.name}
              </h3>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-tighter mb-6">
                {user.place || 'Karnatakas Pride'}
              </p>

              <div className="w-full space-y-4">
                <div className="flex justify-between items-center py-3 border-y border-slate-50 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{user.phone}</span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-slate-50 dark:border-slate-700">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Joined</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">JAN 2026</span>
                </div>
                {user.role === UserRole.USER && (
                  <div className="flex justify-between items-center py-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Level</span>
                    <span className="text-xs font-black text-orange-500 uppercase tracking-widest">{progress?.current_level || 'BASIC'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ID Number decoration */}
            <div className="bg-slate-50 dark:bg-slate-900/50 p-4 text-center">
              <p className="font-mono text-[9px] text-slate-300 dark:text-slate-600 tracking-[0.5em] uppercase">
                ID: {user.id.substring(0, 18).toUpperCase()}
              </p>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-7">
          {isEditing ? (
            <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-700 shadow-lg animate-in fade-in slide-in-from-right-4">
              <h3 className="text-xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight mb-8">Edit Details</h3>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col items-center mb-8">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-900 overflow-hidden border-2 border-blue-100 dark:border-slate-700">
                      {formData.avatarUrl ? <img src={formData.avatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center opacity-10">👤</div>}
                    </div>
                    <label className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15a2.25 2.25 0 0 0 2.25-2.25V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      </svg>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">Change Avatar</p>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Full Name</label>
                  <input
                    type="text"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-800 dark:text-slate-100"
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Village / City</label>
                  <input
                    type="text"
                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none transition-all font-bold text-slate-800 dark:text-slate-100"
                    value={formData.place}
                    onChange={e => setFormData({ ...formData, place: e.target.value })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-orange-500 text-white py-5 rounded-2xl font-black text-lg uppercase tracking-widest shadow-xl hover:bg-orange-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Update Profile ✨'}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
              {/* Role Specific Stats */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                <h4 className="text-sm font-black text-blue-900 dark:text-blue-300 uppercase tracking-widest mb-6 border-b pb-4">
                  {user.role === UserRole.ADMIN ? 'Platform Insights' : 'Learning Achievements'}
                </h4>

                {user.role === UserRole.ADMIN ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl">
                      <p className="text-[9px] font-black text-amber-700 dark:text-amber-500 uppercase">System Status</p>
                      <p className="text-xl font-black text-amber-900 dark:text-amber-200">SUPERIOR</p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl">
                      <p className="text-[9px] font-black text-blue-700 dark:text-blue-500 uppercase">Users Monitored</p>
                      <p className="text-xl font-black text-blue-900 dark:text-blue-200">REALTIME</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center text-xl">🏆</div>
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200">Lessons Mastered</p>
                          <p className="text-[10px] font-bold text-slate-400">Total course completion</p>
                        </div>
                      </div>
                      <span className="text-2xl font-black text-green-600">{progress?.completed_lessons?.length || 0}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center text-xl">⚡</div>
                        <div>
                          <p className="text-xs font-black text-slate-800 dark:text-slate-200">Current Level</p>
                          <p className="text-[10px] font-bold text-slate-400">Academic Standing</p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-purple-600 bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full">{progress?.current_level || 'BASIC'}</span>
                    </div>

                    <div className="pt-4 flex flex-wrap gap-2">
                      {progress?.is_placement_done && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[8px] font-black uppercase px-2 py-1 rounded-full">Scholar</span>}
                      {progress?.completed_lessons?.length > 1 && <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[8px] font-black uppercase px-2 py-1 rounded-full">Rising Star</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => navigate(user.role === UserRole.ADMIN ? '/admin' : '/dashboard')}
                  className="bg-blue-800 text-white p-6 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-lg hover:bg-blue-900 transition-all flex flex-col items-center gap-3"
                >
                  <span className="text-2xl">📊</span>
                  Go to Dashboard
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 font-black text-xs uppercase tracking-widest text-slate-500 dark:text-slate-300 shadow-lg hover:border-blue-400 transition-all flex flex-col items-center gap-3"
                >
                  <span className="text-2xl">🏠</span>
                  Home Screen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
