
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { TRANSLATIONS } from '../constants';
import AudioRecorder from '../components/AudioRecorder';
import { evaluatePlacement, evaluateSpeech } from '../services/geminiService';
import { CourseLevel, PackageType, PackageStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';

const MCQ_QUESTIONS = [
  {
    id: 1,
    question: { en: "I ___ to the market yesterday.", kn: "ನಾನು ನಿನ್ನೆ ಮಾರುಕಟ್ಟೆಗೆ ___." },
    options: ["go", "went", "gone", "going"],
    correct: 1
  },
  {
    id: 2,
    question: { en: "She ___ a book now.", kn: "ಅವಳು ಈಗ ಪುಸ್ತಕವನ್ನು ___." },
    options: ["is reading", "read", "reads", "has read"],
    correct: 0
  },
  {
    id: 3,
    question: { en: "How ___ you?", kn: "ನೀವು ಹೇಗಿದ್ದೀರಿ?" },
    options: ["is", "are", "am", "be"],
    correct: 1
  },
  {
    id: 4,
    question: { en: "They ___ happy to see us.", kn: "ಅವರು ನಮ್ಮನ್ನು ನೋಡಿ ಸಂತೋಷಪಟ್ಟರು." },
    options: ["was", "were", "is", "am"],
    correct: 1
  },
  {
    id: 5,
    question: { en: "This is ___ apple.", kn: "ಇದು ___ ಸೇಬು." },
    options: ["a", "an", "the", "some"],
    correct: 1
  }
];

const READING_PARAGRAPH = {
  en: "Welcome to Simplish! Learning English is very important in today's world. It helps us communicate with people from different places and opens up many job opportunities.",
  kn: "ಸಿಂಪ್ಲಿಷ್‌ಗೆ ಸುಸ್ವಾಗತ! ಇಂದಿನ ಜಗತ್ತಿನಲ್ಲಿ ಇಂಗ್ಲಿಷ್ ಕಲಿಯುವುದು ಬಹಳ ಮುಖ್ಯ. ಇದು ವಿವಿಧ ಸ್ಥಳಗಳ ಜನರೊಂದಿಗೆ ಸಂವಹನ ನಡೆಸಲು ನಮಗೆ ಸಹಾಯ ಮಾಡುತ್ತದೆ ಮತ್ತು ಅನೇಕ ಉದ್ಯೋಗಾವಕಾಶಗಳನ್ನು ತೆರೆಯುತ್ತದೆ."
};

const PlacementTest: React.FC = () => {
  const { session, setPlacementResult } = useAppStore();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    suggestedLevel: CourseLevel;
    reasoning: string;
    reasoningKn: string;
    score: number;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: session?.name || '',
    place: session?.place || '',
    introduction: '',
    mcqAnswers: {} as Record<number, number>,
    readingSpeech: null as any | null
  });

  // Automatically skip step 1 if session has basic info
  useEffect(() => {
    if (step === 1 && session?.name && session?.place) {
      setFormData(prev => ({ ...prev, name: session.name, place: session.place }));
      setStep(2);
    }
  }, [session, step]);

  const handleAudioComplete = async (blob: Blob) => {
    setLoading(true);
    try {
      const result = await evaluateSpeech(blob, READING_PARAGRAPH.en);
      setFormData({ ...formData, readingSpeech: result });
      setStep(4);
    } catch (err) {
      console.error("Speech eval error:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMCQScore = () => {
    let score = 0;
    MCQ_QUESTIONS.forEach(q => {
      if (formData.mcqAnswers[q.id] === q.correct) score++;
    });
    return score;
  };

  const runFinalEvaluation = async () => {
    setLoading(true);
    try {
      const result = await evaluatePlacement({
        name: formData.name,
        place: formData.place,
        introduction: formData.introduction,
        mcqScore: calculateMCQScore(),
        readingTranscription: formData.readingSpeech?.transcription,
        readingAccuracy: formData.readingSpeech?.accuracy
      });
      setEvaluationResult(result);
      setStep(5);
    } catch (err) {
      console.error("Placement evaluation error:", err);
    } finally {
      setLoading(false);
    }
  };



  const handleFinish = async () => {
    if (!session?.id || !evaluationResult) return;
    setLoading(true);
    try {
      // Save suggested level to user_progress
      await setPlacementResult(evaluationResult.suggestedLevel);

      // Also save the score to profiles for recommendation logic on dashboard
      await supabase
        .from('profiles')
        .update({ system_prompt_focus: `Placement Score: ${evaluationResult.score}` }) // Using an existing field for metadata or I could have added a score field.
        .eq('id', session.id);

      navigate('/dashboard');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center bg-white dark:bg-slate-900">
        <div className="relative w-32 h-32 mb-10">
          <div className="absolute inset-0 border-8 border-blue-100 dark:border-slate-800 rounded-full"></div>
          <div className="absolute inset-0 border-8 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-4xl">🤖</div>
        </div>
        <h3 className="text-3xl font-black text-blue-900 dark:text-slate-100 mb-4 tracking-tighter">AI Analysis...</h3>
        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-xs">{t({ en: 'Calculating your English level based on your performance.', kn: 'ನಿಮ್ಮ ಕಾರ್ಯಕ್ಷಮತೆಯ ಆಧಾರದ ಮೇಲೆ ಇಂಗ್ಲಿಷ್ ಮಟ್ಟವನ್ನು ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ.' })}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto min-h-screen bg-white dark:bg-slate-900 transition-colors">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h2 className="text-3xl font-black text-blue-900 dark:text-slate-100 tracking-tighter">
            {step === 5 ? 'Your Result' : step === 6 ? 'Choose Your Package' : 'Placement Test (ಪ್ರವೇಶ ಪರೀಕ್ಷೆ)'}
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Step {step} of 5</p>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`h-1.5 w-6 rounded-full transition-all duration-500 ${step >= i ? 'bg-orange-500' : 'bg-slate-100 dark:bg-slate-800'}`}></div>
          ))}
        </div>
      </div>

      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-blue-50 dark:bg-slate-800 p-6 rounded-[2rem] border-2 border-blue-100 dark:border-slate-700">
              <p className="text-blue-900 dark:text-blue-300 font-bold text-sm leading-relaxed">
                Welcome! Let's find the best starting point for your English journey. (ಸ್ವಾಗತ! ನಿಮ್ಮ ಇಂಗ್ಲಿಷ್ ಕಲಿಕೆಯ ಪ್ರಯಾಣಕ್ಕೆ ಉತ್ತಮ ಆರಂಭಿಕ ಹಂತವನ್ನು ಕಂಡುಹಿಡಿಯೋಣ.)
              </p>
            </div>
            <div className="space-y-4">
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Name</label>
                <input className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl focus:border-blue-500 outline-none transition-all font-bold" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="group">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-2">Place</label>
                <input className="w-full p-5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-3xl focus:border-blue-500 outline-none transition-all font-bold" value={formData.place} onChange={e => setFormData({ ...formData, place: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="flex-1 py-5 bg-blue-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-blue-900/20">Next: Quick Quiz (ಮುಂದೆ: ರಸಪ್ರಶ್ನೆ)</button>
              <button onClick={() => setStep(2)} className="px-8 py-5 border-2 border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Skip (ನಂತರ )</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-blue-900 dark:text-slate-100">Quick Grammar Quiz</h3>
            <div className="space-y-8">
              {MCQ_QUESTIONS.map((q, idx) => (
                <div key={q.id} className="space-y-4">
                  <p className="font-bold text-slate-800 dark:text-slate-200">
                    <span className="text-orange-500 mr-2">{idx + 1}.</span>
                    {q.question.en} ({q.question.kn})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.options.map((opt, oIdx) => (
                      <button
                        key={oIdx}
                        onClick={() => setFormData({ ...formData, mcqAnswers: { ...formData.mcqAnswers, [q.id]: oIdx } })}
                        className={`p-4 rounded-2xl border-2 text-left font-bold transition-all ${formData.mcqAnswers[q.id] === oIdx ? 'bg-orange-50 border-orange-500 text-orange-900 shadow-md' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(3)} className="flex-1 py-5 bg-blue-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-blue-900/20">Next: Speaking Test (ಮುಂದೆ: ಮಾತನಾಡುವ ಪರೀಕ್ಷೆ)</button>
              <button onClick={() => setStep(3)} className="px-8 py-5 border-2 border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Skip (ನಂತರ )</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-[2rem] border-2 border-amber-100 dark:border-amber-800">
              <h4 className="font-black text-amber-900 dark:text-amber-400 uppercase text-xs tracking-widest mb-2">Reading Task</h4>
              <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed italic">
                "{READING_PARAGRAPH.en}" ({READING_PARAGRAPH.kn})
              </p>
            </div>
            <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-[3rem] border-2 border-slate-100 dark:border-slate-700 text-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Click to Record & Read Aloud</p>
              <AudioRecorder onRecordingComplete={handleAudioComplete} hideHistory={true} />
            </div>
            <button onClick={() => setStep(4)} className="w-full py-5 border-2 border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Skip (ನಂತರ )</button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-xl font-black text-blue-900 dark:text-slate-100">One final thing...</h3>
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-600 dark:text-slate-400">
                Why do you want to learn English? (ನೀವು ಇಂಗ್ಲಿಷ್ ಕಲಿಯಲು ಯಾಕೆ ಇಷ್ಟಪಡುತ್ತೀರಿ?)
              </label>
              <textarea
                className="w-full p-6 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2.5rem] h-40 focus:border-blue-500 outline-none font-medium"
                placeholder="..."
                value={formData.introduction}
                onChange={e => setFormData({ ...formData, introduction: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={runFinalEvaluation} className="w-full py-5 bg-orange-600 text-white rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-orange-600/20 flex items-center justify-center gap-3">
                ✨ Get AI Evaluation (AI ಮೌಲ್ಯಮಾಪನ ಪಡೆಯಿರಿ)
              </button>
              <button onClick={runFinalEvaluation} className="w-full py-5 border-2 border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded-3xl font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Skip (ನಂತರ )
              </button>
            </div>
          </div>
        )}

        {step === 5 && evaluationResult && (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <div className="inline-block p-6 rounded-full bg-orange-50 dark:bg-orange-900/30 border-4 border-orange-500 mb-2">
                <span className="text-6xl">🏆</span>
              </div>
              <h3 className="text-4xl font-black text-blue-950 dark:text-white tracking-tighter">
                {evaluationResult.suggestedLevel}
              </h3>
              <div className="flex justify-center gap-1">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className={`h-1.5 w-4 rounded-full ${i < evaluationResult.score ? 'bg-green-500' : 'bg-slate-200 dark:bg-slate-800'}`}></div>
                ))}
              </div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Fluency Score: {evaluationResult.score}/10</p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-8 rounded-[3rem] border-2 border-slate-100 dark:border-slate-700 space-y-4">
              <p className="text-blue-900 dark:text-blue-300 font-bold leading-relaxed">{evaluationResult.reasoning}</p>
              <div className="h-px bg-slate-200 dark:bg-slate-700 w-12"></div>
              <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{evaluationResult.reasoningKn}</p>
            </div>

            <button onClick={handleFinish} className="w-full py-5 bg-blue-900 text-white rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-black transition-all">Continue to Packages (ಮುಂದಿನ ಹಂತಕ್ಕೆ)</button>
          </div>
        )}


      </div>
    </div>
  );
};

export default PlacementTest;
