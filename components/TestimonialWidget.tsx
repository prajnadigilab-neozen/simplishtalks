import React, { useEffect, useState } from 'react';
import { getPublicTestimonials } from '../services/feedbackService';
import { CourseFeedback } from '../types';

const TestimonialWidget: React.FC = () => {
  const [testimonials, setTestimonials] = useState<CourseFeedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTestimonials = async () => {
      try {
        const data = await getPublicTestimonials();
        setTestimonials(data);
      } catch (err) {
        console.error("Failed to load public testimonials:", err);
      } finally {
        setLoading(false);
      }
    };
    loadTestimonials();
  }, []);

  const formatName = (fullName: string | undefined) => {
    if (!fullName) return 'Verified Learner';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
  };

  const formatDate = (dateString: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
      return new Date(dateString).toLocaleDateString('en-US', options);
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (testimonials.length === 0) {
    return null; // Don't show the widget if there are no testimonials yet
  }

  return (
    <section className="py-20 bg-slate-50 dark:bg-slate-900/40 relative overflow-hidden transition-all">
      {/* Decorative Gradients */}
      <div className="absolute top-1/4 left-1/10 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-full">
            Success Stories
          </span>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mt-4 uppercase tracking-tighter">
            What Our Learners Say
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-bold max-w-xl mx-auto mt-3">
            Real stories and reviews from graduates who mastered English speaking with Namma Simplish.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div 
              key={t.id} 
              className={`bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700/80 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between ${t.is_pinned ? 'ring-2 ring-blue-500/50 relative' : ''}`}
            >
              {t.is_pinned && (
                <span className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-[9px] font-black uppercase rounded-full tracking-wider shadow-md">
                  📌 Featured Review
                </span>
              )}
              
              <div>
                {/* Stars Output */}
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <span 
                      key={idx} 
                      className={`text-lg ${idx < t.overall_rating ? 'text-amber-400' : 'text-slate-200 dark:text-slate-600'}`}
                    >
                      ★
                    </span>
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6 font-medium italic">
                  "{t.review_text}"
                </p>

                {t.success_story && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Success Story</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed font-medium">
                      {t.success_story}
                    </p>
                  </div>
                )}
              </div>

              {/* User Bio and Verified Badge */}
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100 dark:border-slate-700/50">
                <div>
                  <h4 className="font-black text-slate-800 dark:text-slate-100 text-xs uppercase tracking-wider">
                    {formatName(t.profiles?.full_name)}
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                    Completed {formatDate(t.completion_date)}
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider">
                  <span>✓</span> Verified Learner
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialWidget;
