
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import AudioRecorder from '../components/AudioRecorder';
import { evaluatePlacement } from '../services/geminiService';
import { CourseLevel } from '../types';

import { useAppStore } from '../store/useAppStore';

const PlacementTest: React.FC = () => {
  const { session, setPlacementResult } = useAppStore();
  const onResult = setPlacementResult;
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Skip step 1 if we already have name and place from registration
  const initialStep = (session?.name && session?.place) ? 2 : 1;
  const [step, setStep] = useState(initialStep);

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: session?.name || '',
    place: session?.place || '',
    introduction: '',
    audioBlob: null as Blob | null
  });

  // Ensure formData updates if session data arrives after mount
  useEffect(() => {
    if (session?.name || session?.place) {
      setFormData(prev => ({
        ...prev,
        name: prev.name || session.name || '',
        place: prev.place || session.place || ''
      }));
      // If we are at step 1 but have the data, move to step 2 automatically
      if (step === 1 && session.name && session.place) {
        setStep(2);
      }
    }
  }, [session, step]);

  const handleSubmit = async () => {
    setLoading(true);
    const result = await evaluatePlacement({
      name: formData.name,
      place: formData.place,
      introduction: formData.introduction
    });

    onResult(result.suggestedLevel as CourseLevel);
    setLoading(false);
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center bg-white dark:bg-slate-900 transition-colors">
        <div className="relative w-32 h-32 mb-10">
          <div className="absolute inset-0 border-8 border-blue-100 dark:border-slate-800 rounded-full"></div>
          <div className="absolute inset-0 border-8 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-4xl">🤖</div>
        </div>
        <h3 className="text-3xl font-black text-blue-900 dark:text-slate-100 mb-4">{t(TRANSLATIONS.evaluationInProgress)}</h3>
        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs">{t({ en: 'Simplish AI is checking your current English level.', kn: 'ನಿಮ್ಮ ಈಗಿನ ಇಂಗ್ಲಿಷ್ ಮಟ್ಟವನ್ನು ಸಿಂಪ್ಲಿಷ್ AI ಪರೀಕ್ಷಿಸುತ್ತಿದೆ.' })}</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-md mx-auto min-h-screen bg-white dark:bg-slate-900 transition-colors">
      <div className="flex justify-between items-center mb-12">
        <div>
          <h2 className="text-3xl font-black text-blue-900 dark:text-slate-100">{t(TRANSLATIONS.placementTest)}</h2>
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">Assessment Phase</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-black text-orange-500">{step}<span className="text-slate-200 dark:text-slate-700">/3</span></span>
          <div className="h-1.5 w-12 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }}></div>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-blue-50 dark:bg-slate-800 p-6 rounded-[2rem] border border-blue-100 dark:border-slate-700 mb-8 transition-colors">
              <p className="text-blue-900 dark:text-blue-300 font-bold text-sm">
                {t({ en: 'Let\'s start with some basics!', kn: 'ಕೆಲವು ಮೂಲಭೂತ ವಿಷಯಗಳಿಂದ ಪ್ರಾರಂಭಿಸೋಣ!' })}
              </p>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-2">{t({ en: 'Full Name', kn: 'ಪೂರ್ಣ ಹೆಸರು' })}</label>
              <input
                type="text"
                className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-bold text-blue-900 dark:text-slate-100"
                placeholder="..."
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-2">{t({ en: 'City/Place', kn: 'ಊರು' })}</label>
              <input
                type="text"
                className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-bold text-blue-900 dark:text-slate-100"
                placeholder="..."
                value={formData.place}
                onChange={e => setFormData({ ...formData, place: e.target.value })}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-[2rem] border-2 border-amber-100 dark:border-amber-900/30 transition-colors">
              <p className="text-amber-900 dark:text-amber-300 font-bold text-sm leading-relaxed">
                {t({
                  en: 'Click the mic and tell us about yourself. Don\'t worry about mistakes!',
                  kn: 'ಮೈಕ್ ಒತ್ತಿ ಮತ್ತು ನಿಮ್ಮ ಬಗ್ಗೆ ತಿಳಿಸಿ. ತಪ್ಪುಗಳ ಬಗ್ಗೆ ಚಿಂತಿಸಬೇಡಿ!'
                })}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
              <AudioRecorder onRecordingComplete={(blob) => setFormData({ ...formData, audioBlob: blob })} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div>
              <label className="block text-sm font-black text-blue-900 dark:text-slate-100 mb-4 leading-relaxed">
                {t({ en: 'Why do you want to master English?', kn: 'ನೀವು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಪರಿಣಿತಿ ಪಡೆಯಲು ಏಕೆ ಬಯಸುತ್ತೀರಿ?' })}
              </label>
              <textarea
                rows={5}
                className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] focus:border-blue-500 focus:bg-white dark:focus:bg-slate-700 outline-none transition-all font-medium text-slate-700 dark:text-slate-200 resize-none"
                placeholder={t({ en: 'Type here...', kn: 'ಇಲ್ಲಿ ಬರೆಯಿರಿ...' })}
                value={formData.introduction}
                onChange={e => setFormData({ ...formData, introduction: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-slate-800/50 rounded-2xl transition-colors">
              <span className="text-xl">✨</span>
              <p className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-tighter">AI will use this to find your starting level.</p>
            </div>
          </div>
        )}

        <div className="flex gap-4 pt-10">
          {/* Only show back button if we are not at the very first starting step */}
          {step > initialStep && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-4 px-6 border-2 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t(TRANSLATIONS.back)}
            </button>
          )}
          <button
            onClick={() => step < 3 ? setStep(step + 1) : handleSubmit()}
            className="flex-[2] py-4 px-6 bg-orange-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-orange-500/20 hover:bg-orange-600 active:scale-95 transition-all"
          >
            {step < 3 ? t({ en: 'Next Step', kn: 'ಮುಂದಿನ ಹಂತ' }) : t(TRANSLATIONS.submit)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlacementTest;
