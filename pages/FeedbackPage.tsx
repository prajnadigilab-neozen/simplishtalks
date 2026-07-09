import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useLanguage } from '../components/LanguageContext';
import { submitFeedback } from '../services/feedbackService';
import Logo from '../components/Logo';

const LOGICAL_COURSE_ID = '00000000-0000-0000-0000-000000000000';

const FeedbackPage: React.FC = () => {
  const { session, modules, progress, feedback, initialized, fetchMyFeedback } = useAppStore();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get('preview') === 'true';

  // Form State
  const [overallRating, setOverallRating] = useState(0);
  const [contentRating, setContentRating] = useState(0);
  const [mentorRating, setMentorRating] = useState(0);
  const [learningRating, setLearningRating] = useState(0);
  const [confidenceImprovement, setConfidenceImprovement] = useState('');
  const [recommendationScore, setRecommendationScore] = useState<number | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [successStory, setSuccessStory] = useState('');
  const [testimonialPermission, setTestimonialPermission] = useState<boolean | null>(null);
  
  // File upload state (mock)
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Submission Status
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 100% Completion Gate
  useEffect(() => {
    if (initialized && !isPreview) {
      const totalLessons = modules.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0);
      const completedLessons = progress?.completedLessons.length || 0;
      const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

      if (progressPercentage < 100) {
        navigate('/dashboard');
      }
    }
  }, [initialized, modules, progress, navigate, isPreview]);

  // Set local state if feedback already exists in DB
  useEffect(() => {
    if (feedback && !isPreview) {
      setSuccess(true);
    }
  }, [feedback, isPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        alert("File size exceeds 50MB limit!");
        return;
      }
      setMediaFile(file);
    }
  };

  const generateCertificate = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1120;
    canvas.height = 792;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background border/frame
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#1e3a8a'; // Deep blue
    ctx.lineWidth = 20;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.strokeStyle = '#d97706'; // Gold inner border
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

    // Decorative corners
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(40, 40, 40, 8);
    ctx.fillRect(40, 40, 8, 40);

    ctx.fillRect(canvas.width - 80, 40, 40, 8);
    ctx.fillRect(canvas.width - 48, 40, 8, 40);

    ctx.fillRect(40, canvas.height - 48, 40, 8);
    ctx.fillRect(40, canvas.height - 80, 8, 40);

    ctx.fillRect(canvas.width - 80, canvas.height - 48, 40, 8);
    ctx.fillRect(canvas.width - 48, canvas.height - 80, 8, 40);

    // Title
    ctx.font = '900 48px Georgia, serif';
    ctx.fillStyle = '#1e3a8a';
    ctx.textAlign = 'center';
    ctx.fillText('CERTIFICATE OF GRADUATION', canvas.width / 2, 160);

    // Subtitle
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#b45309'; // Gold-brown
    ctx.fillText('THIS IS PROUDLY PRESENTED TO', canvas.width / 2, 230);

    // Student Name
    ctx.font = 'italic bold 44px Georgia, serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(session?.name || 'Simplish Graduate', canvas.width / 2, 310);

    // Divider line
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 200, 340);
    ctx.lineTo(canvas.width / 2 + 200, 340);
    ctx.stroke();

    // Body text
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText('for successfully completing the entire curriculum of Namma Simplish,', canvas.width / 2, 390);
    ctx.fillText('demonstrating excellence in English speaking, listening, and real-world interactions.', canvas.width / 2, 420);

    // Date
    const today = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Awarded on: ${today}`, canvas.width / 2, 480);

    // Verifiable Hash
    const hashPayload = `${session?.id || 'guest'}-${today}`;
    let hashVal = 5381;
    for (let i = 0; i < hashPayload.length; i++) {
      hashVal = (hashVal * 33) ^ hashPayload.charCodeAt(i);
    }
    const hexHash = Math.abs(hashVal).toString(16).toUpperCase().padStart(8, '0');
    const verificationCode = `SMPL-${hexHash}`;

    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Verification Code: ${verificationCode}`, canvas.width / 2, 520);

    // Signatures
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(150, 640);
    ctx.lineTo(350, 640);
    ctx.stroke();
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('PRADEEP K', 250, 665);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Founder & Head Coach', 250, 685);

    ctx.beginPath();
    ctx.moveTo(canvas.width - 350, 640);
    ctx.lineTo(canvas.width - 150, 640);
    ctx.stroke();
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText('NAMMA SIMPLISH TALKS', canvas.width - 250, 665);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Verified Certificate of Completion', canvas.width - 250, 685);

    // Gold Seal
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, 630, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.font = '900 9px sans-serif';
    ctx.fillText('SIMPLISH', canvas.width / 2, 625);
    ctx.fillText('GRADUATE', canvas.width / 2, 640);

    // Download PNG
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Simplish_Graduate_Certificate_${session?.name || 'Student'}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.id) return;
    
    // Validations
    if (!overallRating || !contentRating || !mentorRating || !learningRating) {
      setErrorMessage(t({ en: 'Please fill in all the ratings!', kn: 'ದಯವಿಟ್ಟು ಎಲ್ಲಾ ರೇಟಿಂಗ್‌ಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ!' }));
      return;
    }
    if (confidenceImprovement === '') {
      setErrorMessage(t({ en: 'Please select confidence improvement level.', kn: 'ದಯವಿಟ್ಟು ಆತ್ಮವಿಶ್ವಾಸ ಸುಧಾರಣಾ ಮಟ್ಟವನ್ನು ಆಯ್ಕೆಮಾಡಿ.' }));
      return;
    }
    if (recommendationScore === null) {
      setErrorMessage(t({ en: 'Please select an NPS score.', kn: 'ದಯವಿಟ್ಟು NPS ಸ್ಕೋರ್ ಆಯ್ಕೆಮಾಡಿ.' }));
      return;
    }
    if (reviewText.trim().length < 30) {
      setErrorMessage(t({ en: 'Your review must be at least 30 characters long!', kn: 'ನಿಮ್ಮ ವಿಮರ್ಶೆ ಕನಿಷ್ಠ 30 ಅಕ್ಷರಗಳನ್ನು ಹೊಂದಿರಬೇಕು!' }));
      return;
    }
    if (testimonialPermission === null) {
      setErrorMessage(t({ en: 'Please select testimonial privacy option.', kn: 'ದಯವಿಟ್ಟು ಗೌಪ್ಯತೆ ಆಯ್ಕೆಯನ್ನು ಆರಿಸಿ.' }));
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    const res = await submitFeedback(session.id, {
      overallRating,
      contentRating,
      mentorRating,
      learningRating,
      confidenceImprovement,
      recommendationScore,
      reviewText,
      successStory,
      testimonialPermission
    });

    setSubmitting(false);

    if (res.success) {
      setSuccess(true);
      await fetchMyFeedback();
    } else {
      setErrorMessage(res.error || 'Failed to submit feedback.');
    }
  };

  const StarRating = ({ value, onChange, label }: { value: number, onChange: (v: number) => void, label: string }) => (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 border-b border-slate-100 dark:border-slate-800">
      <span className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 sm:mb-0">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="text-2xl hover:scale-125 transition-transform"
          >
            <span className={star <= value ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}>★</span>
          </button>
        ))}
      </div>
    </div>
  );

  // Success view (Rewards Panel)
  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6 md:p-12 flex flex-col justify-center items-center">
        <div className="max-w-xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 p-8 text-center shadow-xl animate-in zoom-in-95 duration-500">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-950 text-green-600 rounded-full flex items-center justify-center text-4xl mb-6 mx-auto animate-bounce">
            ✓
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase mb-2">
            {t({ en: '🙏 Thank You!', kn: '🙏 ಧನ್ಯವಾದಗಳು!' })}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 font-bold mb-8 text-sm leading-relaxed">
            {t({ 
              en: 'Your feedback has been submitted successfully. Your opinion helps us improve the learning experience for future students.', 
              kn: 'ನಿಮ್ಮ ಪ್ರತಿಕ್ರಿಯೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಸಲಾಗಿದೆ. ನಿಮ್ಮ ಅಭಿಪ್ರಾಯವು ಭವಿಷ್ಯದ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಕಲಿಕೆಯ ಅನುಭವವನ್ನು ಸುಧಾರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತದೆ.' 
            })}
          </p>

          <div className="border-t border-b border-slate-100 dark:border-slate-800 py-6 my-6 space-y-4 text-left">
            <h3 className="font-black text-slate-800 dark:text-slate-200 text-xs uppercase tracking-widest mb-4">🏆 Graduation Rewards</h3>
            
            {/* Reward 1: Profile Badge */}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div className="text-3xl">🏅</div>
              <div>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">Graduate Badge Unlocked</h4>
                <p className="text-[10px] text-slate-400 font-bold">Featured on your profile card.</p>
              </div>
            </div>

            {/* Reward 2: Certificate */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-4">
                <div className="text-3xl">📜</div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">SIMPLISH Graduate Certificate</h4>
                  <p className="text-[10px] text-slate-400 font-bold">Verifiable completion credential.</p>
                </div>
              </div>
              <button
                onClick={generateCertificate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
              >
                Download PNG
              </button>
            </div>

            {/* Reward 3: Alumni community */}
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 opacity-60">
              <div className="flex items-center gap-4">
                <div className="text-3xl">🎁</div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">
                    Exclusive Alumni Club
                    <span className="text-[8px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded-md ml-2 normal-case font-bold">Coming Soon</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold">Connect with other graduates.</p>
                </div>
              </div>
              <button
                disabled
                className="px-4 py-2 bg-slate-300 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-not-allowed"
              >
                Join Discord
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Active form view
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 p-4 md:p-8 flex justify-center items-center">
      <div className="max-w-2xl w-full bg-white dark:bg-slate-900 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
        
        {/* Header Celebration */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white relative">
          <div className="absolute right-6 top-6 text-6xl opacity-20">🎉</div>
          <Logo className="invert mb-4" />
          <h1 className="text-3xl font-black uppercase tracking-tight">Congratulations!</h1>
          <p className="text-sm text-blue-100 font-medium leading-relaxed mt-2">
            You have successfully completed your Namma Simplish learning journey. We would love to hear about your experience. Your feedback helps us improve and inspire future learners.
          </p>
        </div>

        {/* Feedback Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <h3 className="font-black text-xs uppercase tracking-widest text-slate-400 mb-4 border-b pb-2">Feedback Questionnaire</h3>

          {errorMessage && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-2xl border border-red-200/50">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Section 1-4: Star Ratings */}
          <div className="space-y-2">
            <StarRating 
              value={overallRating} 
              onChange={setOverallRating} 
              label={t({ en: '1. Overall Learning Experience', kn: '1. ಒಟ್ಟಾರೆ ಕಲಿಕೆಯ ಅನುಭವ' })} 
            />
            <StarRating 
              value={contentRating} 
              onChange={setContentRating} 
              label={t({ en: '2. Course Content Utility', kn: '2. ಕೋರ್ಸ್ ವಿಷಯದ ಉಪಯುಕ್ತತೆ' })} 
            />
            <StarRating 
              value={mentorRating} 
              onChange={setMentorRating} 
              label={t({ en: '3. Mentor Guidance & Support', kn: '3. ಮಾರ್ಗದರ್ಶಕರ ಬೆಂಬಲ ಮತ್ತು ಮಾರ್ಗದರ್ಶನ' })} 
            />
            <StarRating 
              value={learningRating} 
              onChange={setLearningRating} 
              label={t({ en: '4. Localization Ease (Kannada to English)', kn: '4. ಕನ್ನಡದ ಮೂಲಕ ಇಂಗ್ಲಿಷ್ ಕಲಿಕೆಯ ಸುಲಭತೆ' })} 
            />
          </div>

          {/* Section 5: Impact */}
          <div className="space-y-3">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {t({ en: '5. Did Namma Simplish improve your confidence in speaking English?', kn: '5. ನಮ್ಮ ಸಿಂಪ್ಲಿಷ್ ನಿಮ್ಮ ಇಂಗ್ಲಿಷ್ ಮಾತನಾಡುವ ಆತ್ಮವಿಶ್ವಾಸವನ್ನು ಸುಧಾರಿಸಿದೆಯೇ?' })}
            </span>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'Significantly Improved', label: t({ en: 'Significantly Improved', kn: 'ಗಣನೀಯವಾಗಿ ಸುಧಾರಿಸಿದೆ' }) },
                { value: 'Improved', label: t({ en: 'Improved', kn: 'ಸುಧಾರಿಸಿದೆ' }) },
                { value: 'Slightly Improved', label: t({ en: 'Slightly Improved', kn: 'ಸ್ವಲ್ಪ ಸುಧಾರಿಸಿದೆ' }) },
                { value: 'No Change', label: t({ en: 'No Change', kn: 'ಯಾವುದೇ ಬದಲಾವಣೆ ಇಲ್ಲ' }) }
              ].map((opt) => (
                <label 
                  key={opt.value}
                  className={`flex items-center gap-3 p-4 border rounded-2xl cursor-pointer transition-all ${
                    confidenceImprovement === opt.value 
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 font-bold' 
                      : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="confidence"
                    value={opt.value}
                    checked={confidenceImprovement === opt.value}
                    onChange={() => setConfidenceImprovement(opt.value)}
                    className="accent-blue-600"
                  />
                  <span className="text-xs uppercase font-black tracking-wider">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 6: Review Text */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
              {t({ en: '6. Tell us about your experience with SIMPLISH (Min 30, Max 1000 chars) *', kn: '6. ಸಿಂಪ್ಲಿಷ್‌ನೊಂದಿಗಿನ ನಿಮ್ಮ ಅನುಭವದ ಬಗ್ಗೆ ನಮಗೆ ತಿಳಿಸಿ (ಕನಿಷ್ಠ 30, ಗರಿಷ್ಠ 1000 ಅಕ್ಷರಗಳು) *' })}
            </label>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder={t({
                en: 'Share your learning journey, challenges you overcame, and how SIMPLISH helped you.',
                kn: 'ನಿಮ್ಮ ಕಲಿಕೆಯ ಪ್ರಯಾಣ, ನೀವು ಎದುರಿಸಿದ ಸವಾಲುಗಳು ಮತ್ತು ಸಿಂಪ್ಲಿಷ್ ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಿತು ಎಂಬುದನ್ನು ಹಂಚಿಕೊಳ್ಳಿ.'
              })}
              maxLength={1000}
              rows={4}
              className="w-full p-4 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-medium"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
              <span>{reviewText.trim().length >= 30 ? t({ en: '✅ Valid length', kn: '✅ ಸೂಕ್ತ ಉದ್ದ' }) : t({ en: '⚠️ Min 30 characters', kn: '⚠️ ಕನಿಷ್ಠ 30 ಅಕ್ಷರಗಳು' })}</span>
              <span>{reviewText.length}/1000</span>
            </div>
          </div>

          {/* Section 7: NPS */}
          <div className="space-y-3">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
              {t({ en: '7. How likely are you to recommend SIMPLISH to your friends and family? (0-10) *', kn: '7. ನಿಮ್ಮ ಸ್ನೇಹಿತರು ಮತ್ತು ಕುಟುಂಬಕ್ಕೆ ಸಿಂಪ್ಲಿಷ್ ಅನ್ನು ಶಿಫಾರಸು ಮಾಡಲು ನೀವು ಎಷ್ಟು ಇಷ್ಟಪಡುತ್ತೀರಿ? (0-10) *' })}
            </span>
            <div className="flex justify-between gap-1 overflow-x-auto pb-2">
              {Array.from({ length: 11 }).map((_, score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() => setRecommendationScore(score)}
                  className={`w-10 h-10 shrink-0 rounded-xl font-black text-xs transition-all ${
                    recommendationScore === score
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 font-bold uppercase tracking-wider">
              <span>{t({ en: 'Not Likely', kn: 'ಸಾಧ್ಯತೆಯಿಲ್ಲ' })}</span>
              <span>{t({ en: 'Extremely Likely', kn: 'ಖಂಡಿತವಾಗಿಯೂ ಶಿಫಾರಸು ಮಾಡುತ್ತೇನೆ' })}</span>
            </div>
          </div>

          {/* Section 8: Public Testimonial Consent */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
              {t({ en: '8. May we display your review publicly on our website and marketing materials? *', kn: '8. ನಿಮ್ಮ ವಿಮರ್ಶೆಯನ್ನು ನಮ್ಮ ವೆಬ್‌ಸೈಟ್ ಮತ್ತು ಮಾರ್ಕೆಟಿಂಗ್ ವಸ್ತುಗಳಲ್ಲಿ ಸಾರ್ವಜನಿಕವಾಗಿ ಪ್ರದರ್ಶಿಸಬಹುದೇ? *' })}
            </span>
            <div className="flex gap-4">
              <label 
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer text-xs uppercase font-black transition-all ${
                  testimonialPermission === true
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-slate-100 dark:border-slate-800 text-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="consent"
                  checked={testimonialPermission === true}
                  onChange={() => setTestimonialPermission(true)}
                  className="hidden"
                />
                {t({ en: 'Yes, I consent', kn: 'ಹೌದು, ನಾನು ಒಪ್ಪುತ್ತೇನೆ' })}
              </label>
              <label 
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer text-xs uppercase font-black transition-all ${
                  testimonialPermission === false
                    ? 'border-slate-600 bg-slate-50 text-slate-700'
                    : 'border-slate-100 dark:border-slate-800 text-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name="consent"
                  checked={testimonialPermission === false}
                  onChange={() => setTestimonialPermission(false)}
                  className="hidden"
                />
                {t({ en: 'Keep Private', kn: 'ಖಾಸಗಿಯಾಗಿ ಇರಿಸಿ' })}
              </label>
            </div>
          </div>

          {/* Section 9: Success story */}
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
              {t({ en: '9. [Optional] Would you like to share your success story?', kn: '9. [ಐಚ್ಛಿಕ] ನಿಮ್ಮ ಯಶಸ್ಸಿನ ಕಥೆಯನ್ನು ಹಂಚಿಕೊಳ್ಳಲು ನೀವು ಬಯಸುವಿರಾ?' })}
            </label>
            <textarea
              value={successStory}
              onChange={(e) => setSuccessStory(e.target.value)}
              placeholder={t({
                en: 'Tell us about professional/personal opportunities unlocked, new jobs, or interviews cracked.',
                kn: 'ಅನ್‌ಲಾಕ್ ಮಾಡಲಾದ ವೃತ್ತಿಪರ/ವೈಯಕ್ತಿಕ ಅವಕಾಶಗಳು, ಹೊಸ ಉದ್ಯೋಗಗಳು ಅಥವಾ ಯಶಸ್ಸಿಯಾದ ಸಂದರ್ಶನಗಳ ಬಗ್ಗೆ ನಮಗೆ ತಿಳಿಸಿ.'
              })}
              rows={3}
              className="w-full p-4 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm font-medium"
            />
          </div>

          {/* Section 10: Media Upload */}
          <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">
              {t({ en: '10. [Optional] Upload supporting media (Photo, Video, Audio)', kn: '10. [ಐಚ್ಛಿಕ] ಪೂರಕ ಮಾಧ್ಯಮವನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ (ಫೋಟೋ, ವಿಡಿಯೋ, ಆಡಿಯೋ)' })}
            </label>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-2xl cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                  <span className="text-2xl mb-1">📁</span>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
                    {mediaFile ? mediaFile.name : t({ en: 'Choose file (Max 50MB)', kn: 'ಫೈಲ್ ಆಯ್ಕೆಮಾಡಿ (ಗರಿಷ್ಠ 50MB)' })}
                  </p>
                  <p className="text-[9px] text-slate-400 font-bold mt-1">
                    {t({ en: 'Accepts: JPG, PNG, MP4, MP3', kn: 'ಸ್ವೀಕರಿಸಲಾಗುವ ಫೈಲ್‌ಗಳು: JPG, PNG, MP4, MP3' })}
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".jpg,.png,.mp4,.mp3"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              {t({ en: 'Cancel', kn: 'ರದ್ದುಗೊಳಿಸಿ' })}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/10 active:scale-95 disabled:opacity-50"
            >
              {submitting ? t({ en: 'Submitting...', kn: 'ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...' }) : t({ en: 'Submit Feedback', kn: 'ಪ್ರತಿಕ್ರಿಯೆ ಸಲ್ಲಿಸಿ' })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackPage;
