import React from 'react';
import { useInView } from 'react-intersection-observer';
import { VisualContent } from '../types';
import { getOptimizedImageUrl } from '../services/visualContentService';

interface VisualCardProps {
  content: VisualContent;
  index: number;
  onOpen: (index: number) => void;
}

export const VisualCard: React.FC<VisualCardProps> = ({ content, index, onOpen }) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    rootMargin: '200px 0px', // Load slightly before it comes into view
  });

  const categoryLabels: Record<string, { label: string, color: string }> = {
    jokes: { label: 'Joke 😆', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    fun_facts: { label: 'Fact 💡', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    describe_image: { label: 'Describe 🗣️', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    identify_image: { label: 'Identify 🔎', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    complete_sentence: { label: 'Complete ✍️', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
  };

  const badgeInfo = categoryLabels[content.category] || { label: content.category, color: 'bg-gray-100 text-gray-700' };

  return (
    <div 
      ref={ref}
      onClick={() => onOpen(index)}
      className="mb-4 sm:mb-6 break-inside-avoid shadow-sm rounded-2xl md:rounded-[2rem] overflow-hidden bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 cursor-pointer hover:shadow-lg transition-all active:scale-[0.98] group relative"
    >
      {/* Skeleton while waiting for inView or image load. */}
      {inView ? (
        <div className="relative">
          <img 
            src={getOptimizedImageUrl(content.image_url, 300)} 
            alt={content.caption || 'Visual'} 
            className="w-full h-auto object-cover transition-opacity duration-300 min-h-[150px] bg-slate-50 dark:bg-slate-800"
            loading="lazy"
            decoding="async"
          />
          {content.access_level === 'premium' && (
             <div className="absolute top-3 left-3 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
               PREMIUM
             </div>
          )}
        </div>
      ) : (
        <div className="w-full min-h-[250px] bg-slate-100 dark:bg-slate-800 animate-pulse"></div>
      )}

      {content.caption && (
        <div className="p-3 sm:p-5">
           <div className={`inline-block px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest mb-2 ${badgeInfo.color}`}>
              {badgeInfo.label}
           </div>
           <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-3">
             {content.caption}
           </p>
        </div>
      )}
    </div>
  );
};
