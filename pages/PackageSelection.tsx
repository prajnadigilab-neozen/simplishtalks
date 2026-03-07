import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { PackageType } from '../types';
import { useAppStore } from '../store/useAppStore';

const PackageSelection: React.FC = () => {
    const { session } = useAppStore();
    const { t } = useLanguage();
    const navigate = useNavigate();

    // If there's no session, they shouldn't be here
    useEffect(() => {
        if (!session) {
            navigate('/login');
        }
    }, [session, navigate]);

    if (!session) return null;

    const scoreMatch = session?.systemPromptFocus?.match(/Placement Score: (\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    const isAdvanced = score >= 7;

    const isExpired = session?.packageEndDate && new Date(session.packageEndDate) < new Date();

    // Determine what they already own (and is currently active)
    const hasTalks = !isExpired && (session.packageType === PackageType.TALKS || session.packageType === PackageType.BOTH);
    const hasSangaathi = !isExpired && (session.packageType === PackageType.SANGAATHI || session.packageType === PackageType.BOTH);
    const hasBoth = !isExpired && session.packageType === PackageType.BOTH;

    // Handle Package Activation (Navigate to Payment)
    const handleActivatePackage = (selectedPackage: PackageType) => {
        if (!session?.id) return;
        navigate(`/payment?package=${selectedPackage}`);
    };

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] dark:bg-slate-950 min-h-[80vh] transition-all flex flex-col items-center justify-center animate-in fade-in duration-700">

            {/* Header logic */}
            <div className="max-w-4xl w-full text-center mb-10">
                {!hasTalks && !hasSangaathi ? (
                    <div className="inline-block px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                        Step 2: Activation
                    </div>
                ) : hasBoth ? (
                    <div className="inline-block px-4 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                        Fully Unlocked
                    </div>
                ) : (
                    <div className="inline-block px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                        Upgrade Your Path
                    </div>
                )}

                <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-4 leading-tight">
                    {hasBoth ? 'You have access to ' : 'Pick your path to '}
                    <span className="text-blue-600">Fluency.</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold max-w-xl mx-auto text-sm md:text-base mb-6">
                    {hasBoth ? "You've unlocked the complete Namma Simplish ecosystem. Great job!" : `Based on your placement score (${score}/10), we've identified the best learning models for your current level.`}
                </p>

                {(hasTalks || hasSangaathi) && (
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-sm hover:shadow-md transition-all mb-4"
                    >
                        Return to Dashboard
                    </button>
                )}
            </div>

            {/* Package Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full max-w-5xl">
                <PackageCard
                    type={PackageType.TALKS}
                    isRecommended={!hasBoth && !isAdvanced}
                    isActive={hasTalks}
                    disabled={hasTalks}
                    onSelect={() => handleActivatePackage(PackageType.TALKS)}
                />
                <PackageCard
                    type={PackageType.SANGAATHI}
                    isRecommended={!hasBoth && isAdvanced}
                    isActive={hasSangaathi}
                    disabled={hasSangaathi}
                    onSelect={() => handleActivatePackage(PackageType.SANGAATHI)}
                />
            </div>
        </div>
    );
};

export default PackageSelection;

const PackageCard: React.FC<{ type: PackageType; isRecommended: boolean; isActive: boolean; disabled: boolean; onSelect: () => void }> = ({ type, isRecommended, isActive, disabled, onSelect }) => {
    const isTalks = type === PackageType.TALKS;

    // Visual tweaks for disabled cards
    const containerClasses = disabled
        ? 'opacity-50 grayscale scale-[0.98] pointer-events-none'
        : 'hover:border-blue-500 hover:scale-[1.02] shadow-xl';

    const buttonText = disabled ? 'Active Subscription' : (isTalks ? 'Start Learning' : 'Choose Voice Path');
    const buttonStyle = disabled
        ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed border border-slate-200 dark:border-slate-700'
        : (isTalks ? 'bg-blue-600 text-white shadow-xl hover:opacity-90' : 'bg-orange-500 text-white shadow-xl hover:opacity-90');

    return (
        <div className={`group relative transition-all duration-300 ${isActive && !disabled ? 'ring-4 ring-blue-500 scale-[1.02]' : ''} ${containerClasses}`}>
            {!disabled && (
                <div className={`absolute inset-0 ${isTalks ? 'bg-blue-600' : 'bg-orange-600'} rounded-[2.5rem] ${isTalks ? 'rotate-1' : '-rotate-1'} group-hover:rotate-0 transition-transform opacity-10`}></div>
            )}
            <div className="relative bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-8 rounded-[2.5rem] transition-all flex flex-col h-full overflow-hidden">

                <div className="flex justify-between items-start mb-6">
                    <div className={`w-14 h-14 ${isTalks ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'} rounded-2xl flex items-center justify-center text-3xl opacity-90`}>
                        {isTalks ? '📚' : '🎙️'}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {isRecommended && !disabled && (
                            <span className={`${isTalks ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'} px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest`}>Recommended</span>
                        )}
                        {disabled && (
                            <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                <span className="text-[10px]">✓</span> Owned
                            </span>
                        )}
                        <span className="font-black text-slate-900 dark:text-white text-lg">
                            {isTalks ? '₹299' : '₹499'} <span className="text-[9px] text-slate-400">/mo</span>
                        </span>
                    </div>
                </div>

                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{isTalks ? 'SIMPLISH - TALKS' : 'Simplish SANGAATHI'}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-8 leading-relaxed">
                    {isTalks ? 'Structural English path with gated levels and bilingual chat support.' : 'Direct voice practice with AI personas. Focus on fluency.'}
                </p>

                <ul className="space-y-3 mb-10 flex-1 opacity-90">
                    {(isTalks ? ['4-Tier Roadmap', 'Bilingual AI Tutor', 'Topic Progress'] : ['Direct Voice Call', 'Visual Personas', 'Call Records']).map(f => (
                        <li key={f} className="flex items-center gap-3 text-[11px] font-black text-slate-700 dark:text-slate-300">
                            <span className={`w-5 h-5 rounded-full ${isTalks ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} flex items-center justify-center text-[10px]`}>✓</span>
                            {f}
                        </li>
                    ))}
                </ul>

                <button
                    onClick={disabled ? undefined : onSelect}
                    disabled={disabled}
                    className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${buttonStyle}`}
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
};
