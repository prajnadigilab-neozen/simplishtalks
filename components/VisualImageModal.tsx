import React, { useEffect, useState } from 'react';
import { useVisualStore } from '../store/useVisualStore';
import { getOptimizedImageUrl, checkAnswer } from '../services/visualContentService';

export const VisualImageModal: React.FC = () => {
  const { feed, activeIndex, closeImage, navigate } = useVisualStore();
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'incorrect'>('none');

  const content = activeIndex !== null ? feed[activeIndex] : null;

  useEffect(() => {
    // Reset state on content change
    setUserAnswer('');
    setFeedback('none');

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeImage();
      if (e.key === 'ArrowRight') navigate('next');
      if (e.key === 'ArrowLeft') navigate('prev');
    };
    
    if (activeIndex !== null) {
      window.addEventListener('keydown', handleKeyDown);
      // Disable background scroll
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [activeIndex, closeImage, navigate]);

  if (!content || activeIndex === null) return null;

  const handleCheck = () => {
    if (!content.metadata.expected_answer) return;
    const isCorrect = checkAnswer(userAnswer, content.metadata.expected_answer);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8">
      {/* Close Button */}
      <button 
        onClick={closeImage}
        className="absolute top-4 right-4 sm:top-8 sm:right-8 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors z-10"
      >
        ✕
      </button>

      {/* Prev Navigation */}
      <button 
        onClick={(e) => { e.stopPropagation(); navigate('prev'); }}
        className="absolute left-2 sm:left-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all z-10 text-xl font-bold border border-white/10"
      >
        ❮
      </button>

      {/* Main Content Pane */}
      <div 
        className="relative max-w-4xl w-full h-auto max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Area - use flex-1 but with a min-height fallback */}
        <div className="relative flex-1 bg-slate-100 dark:bg-slate-950 min-h-[300px] sm:min-h-[500px] overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-6">
            <img 
              src={getOptimizedImageUrl(content.image_url, 800)} 
              alt={content.caption || 'Visual Content'}
              className="max-w-full max-h-full object-contain shadow-sm"
              style={{ display: 'block' }}
            />
          </div>
        </div>

        {/* Footer / Interaction Area */}
        <div className="p-4 sm:p-6 sm:px-8 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
            <div className="flex-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1 block">
                {content.category.replace('_', ' ')}
              </span>
              {content.caption && (
                <p className="text-sm sm:text-base font-medium text-slate-800 dark:text-slate-200">
                  {content.caption}
                </p>
              )}
            </div>
            
            {/* Interactive Element (Complete Sentence) */}
            {content.category === 'complete_sentence' && content.metadata.expected_answer && (
              <div className="w-full sm:w-72 shrink-0 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Complete the Sentence</p>
                <div className="flex flex-col gap-2">
                  <textarea 
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-xs font-bold ${
                      feedback === 'correct' ? 'text-green-500' : 
                      feedback === 'incorrect' ? 'text-rose-500' : 'text-transparent'
                    }`}>
                      {feedback === 'correct' ? 'Correct! 🎉' : 'Try again! 🔄'}
                    </span>
                    <button 
                      onClick={handleCheck}
                      className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Check Answer
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Next Navigation */}
      <button 
        onClick={(e) => { e.stopPropagation(); navigate('next'); }}
        className="absolute right-2 sm:right-8 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-all z-10 text-xl font-bold border border-white/10"
      >
        ❯
      </button>

      {/* Click outside to close (invisible overlay) */}
      <div className="absolute inset-0 -z-10" onClick={closeImage}></div>
    </div>
  );
};
