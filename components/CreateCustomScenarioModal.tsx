import React, { useState } from 'react';
import { useLanguage } from './LanguageContext';
import { useNotificationStore } from '../store/useNotificationStore';
import { generateCustomScenario } from '../services/geminiService';
import { useAppStore } from '../store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { CourseLevel, SnehiScenario } from '../types';

const CATEGORIES = [
  'Retail & Sales',
  'Daily Life',
  'Travel & Commute',
  'Services & Healthcare',
  'Food & Dining',
  'Social & Workplace',
  'Professionalism',
  'Logistics & Delivery'
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateCustomScenarioModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { showSuccess, showError } = useNotificationStore();
  const { addCustomScenario, setCurrentScenario, setClearChatRequested } = useAppStore();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[1]); // Default to Daily Life
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);

  if (!isOpen) return null;

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showError(t({ en: 'Speech Recognition not supported in this browser.', kn: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ.' }));
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'kn-IN'; // Default to Kannada as requested
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      showError(t({ en: 'Error listening. Please try again.', kn: 'ಕೇಳುವಲ್ಲಿ ದೋಷವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }));
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.start();
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.length < 5) {
      showError(t({ en: 'Please provide more details.', kn: 'ದಯವಿಟ್ಟು ಹೆಚ್ಚಿನ ವಿವರಗಳನ್ನು ಒದಗಿಸಿ.' }));
      return;
    }

    setIsGenerating(true);
    try {
      const generated = await generateCustomScenario(category, prompt);
      
      const newScenario: SnehiScenario = {
        id: crypto.randomUUID(),
        title: title.trim() ? { en: title, kn: title } : generated.title,
        category: { en: 'Custom', kn: 'ಕಸ್ಟಮ್' },
        level: CourseLevel.CUSTOM,
        systemInstruction: generated.systemInstruction,
        initialMessage: generated.initialMessage,
        order_index: 999
      };

      addCustomScenario(newScenario);
      showSuccess(
        t({ en: 'Scenario Created successfully!', kn: 'ಸನ್ನಿವೇಶವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ!' }),
        t({ en: 'Starting practice...', kn: 'ಅಭ್ಯಾಸ ಪ್ರಾರಂಭವಾಗುತ್ತಿದೆ...' })
      );
      
      setClearChatRequested(true);
      setCurrentScenario(newScenario.id);
      onClose();
      navigate('/talk');
    } catch (err: any) {
      showError(t({ en: 'Failed to generate', kn: 'ರಚಿಸಲು ವಿಫಲವಾಗಿದೆ' }), err.message || 'Error communicating with AI');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md font-outfit">
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">
            {t({ en: 'Create Custom Scenario', kn: 'ಕಸ್ಟಮ್ ಸನ್ನಿವೇಶವನ್ನು ರಚಿಸಿ' })}
          </h2>
          <button onClick={onClose} className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-500 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t({ en: '1. Give it a Title (Optional)', kn: '1. ಶೀರ್ಷಿಕೆ ನೀಡಿ (ಐಚ್ಛಿಕ)' })}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t({ en: 'E.g. Coffee Shop Talk', kn: 'ಉದಾ: ಕಾಫಿ ಶಾಪ್ ಸಂಭಾಷಣೆ' })}
              className="w-full p-3 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:border-blue-500 outline-none font-medium transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t({ en: '2. Select Category', kn: '2. ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ' })}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-3 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:border-blue-500 outline-none font-medium"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {t({ en: '3. Describe Your Scenario', kn: '3. ನಿಮ್ಮ ಸನ್ನಿವೇಶವನ್ನು ವಿವರಿಸಿ' })}
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={t({ en: 'E.g. I need to practice returning a defective product to a store manager...', kn: 'ಉದಾ: ನಾನು ಅಂಗಡಿ ಮ್ಯಾನೇಜರ್‌ಗೆ ದೋಷಯುಕ್ತ ಉತ್ಪನ್ನವನ್ನು ಹಿಂದಿರುಗಿಸುವುದನ್ನು ಅಭ್ಯಾಸ ಮಾಡಬೇಕು...' })}
                rows={4}
                className="w-full p-3 pr-12 rounded-xl border-2 border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:border-blue-500 outline-none font-medium resize-none transition-all"
              />
              <button
                onClick={startListening}
                disabled={isGenerating}
                className={`absolute right-3 bottom-3 p-2 rounded-lg transition-all ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 hover:text-blue-600'
                }`}
                title="Speak in Kannada"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              💡 {t({ en: 'You can type in Kannada or English. Use the mic to speak in Kannada.', kn: 'ನೀವು ಕನ್ನಡ ಅಥವಾ ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಟೈಪ್ ಮಾಡಬಹುದು. ಕನ್ನಡದಲ್ಲಿ ಮಾತನಾಡಲು ಮೈಕ್ ಬಳಸಿ.' })}
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:dark:bg-slate-700 text-white font-black uppercase tracking-widest text-sm transition-all flex justify-center items-center shadow-lg hover:shadow-xl active:scale-95 gap-2"
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {t({ en: 'Generating...', kn: 'ರಚಿಸಲಾಗುತ್ತಿದೆ...' })}
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z" clipRule="evenodd" />
                </svg>
                {t({ en: 'Generate & Start', kn: 'ರಚಿಸಿ ಮತ್ತು ಪ್ರಾರಂಭಿಸಿ' })}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
