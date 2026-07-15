import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { PackageType, PackageStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getSystemConfig, SystemConfig } from '../services/systemConfigService';
import { supabase } from '../lib/supabase';
import { clearProfileCache } from '../services/authService';
import { getMyAccessRequestStatus, submitSnehiRequest } from '../services/snehiAccessService';
import SnehiCheckoutModal from '../components/SnehiCheckoutModal';
import { validateCoupon } from '../services/discountService';

interface CombinedTransactionItem {
  id: string;
  date: string;
  amount: number;
  type: 'membership' | 'topup';
  packageName?: string;
  provider?: string;
  minutes?: number;
  refundable: boolean;
  refundRecord?: any;
  statusLabel: string;
}

const PackageSelection: React.FC = () => {
    const { session } = useAppStore();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);

    const [talksTopUpAmount, setTalksTopUpAmount] = useState<number>(0);
    const [snehiTopUpAmount, setSnehiTopUpAmount] = useState<number>(0);
    const [isTopUpProcessing, setIsTopUpProcessing] = useState(false);
    const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
    const [costPerMinute, setCostPerMinute] = useState(2.0);
    const [snehiRequest, setSnehiRequest] = useState<any>(null);
    const [loadingRequest, setLoadingRequest] = useState(false);
    const [showCheckoutModal, setShowCheckoutModal] = useState(false);

    // Coupon States
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
    const [couponError, setCouponError] = useState('');
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

    const getDiscountedPrice = (base: number) => {
        if (!appliedCoupon) return base;
        if (appliedCoupon.discount_type === 'PERCENTAGE') {
            return base * (1 - appliedCoupon.discount_value / 100);
        } else if (appliedCoupon.discount_type === 'FREE_ACCESS') {
            return 0;
        }
        return base;
    };

    const talksOriginalPrice = sysConfig?.price_talks || 299;
    const talksPrice = getDiscountedPrice(talksOriginalPrice);

    const snehiOriginalPrice = sysConfig?.price_snehi || 499;
    const snehiPrice = getDiscountedPrice(snehiOriginalPrice);

    const handleApplyCoupon = async () => {
        setCouponError('');
        if (!couponCode.trim() || !session?.id) return;
        setIsValidatingCoupon(true);
        try {
            const res = await validateCoupon(couponCode, session.id, 'NEW', 100);
            if (res.is_valid) {
                setAppliedCoupon(res);
                setCouponError('');
                setMessage({ type: 'success', text: t({ en: 'Coupon applied successfully!', kn: 'ಕೂಪನ್ ಯಶಸ್ವಿಯಾಗಿ ಅನ್ವಯಿಸಲಾಗಿದೆ!' }) });
            } else {
                setCouponError(res.error_message);
                setAppliedCoupon(null);
            }
        } catch (err: any) {
            setCouponError(err.message || 'Validation failed');
            setAppliedCoupon(null);
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null);
        setCouponCode('');
        setCouponError('');
    };

    // Transaction History & Refunds States
    const [packageTransactions, setPackageTransactions] = useState<any[]>([]);
    const [topupTransactions, setTopupTransactions] = useState<any[]>([]);
    const [refunds, setRefunds] = useState<any[]>([]);
    const [fetchingTransactions, setFetchingTransactions] = useState(false);
    const [selectedRefundTx, setSelectedRefundTx] = useState<any>(null);
    const [refundReason, setRefundReason] = useState('Duplicate payment / Charged twice');
    const [refundNotes, setRefundNotes] = useState('');
    const [submittingRefund, setSubmittingRefund] = useState(false);

    const fetchTransactions = async (userId: string) => {
        setFetchingTransactions(true);
        try {
            const [pkgs, topups, refnds] = await Promise.all([
                supabase
                    .from('package_transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('topup_transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('refunds')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
            ]);

            if (pkgs.data) setPackageTransactions(pkgs.data);
            if (topups.data) setTopupTransactions(topups.data);
            if (refnds.data) setRefunds(refnds.data);
        } catch (err) {
            console.error("Error fetching transactions:", err);
        } finally {
            setFetchingTransactions(false);
        }
    };

    useEffect(() => {
        getSystemConfig().then(cfg => {
            setSysConfig(cfg);
            if (cfg) {
                setCostPerMinute(cfg.cost_per_minute);
            }
        });
    }, []);

    // If there's no session, they shouldn't be here
    useEffect(() => {
        if (!session) {
            navigate('/login');
        } else {
            fetchTransactions(session.id);
            // Fetch SNEHI Access Request Status
            setLoadingRequest(true);
            getMyAccessRequestStatus(session.id).then(req => {
                setSnehiRequest(req);
                setLoadingRequest(false);
            }).catch(err => {
                console.error("Error fetching SNEHI access status:", err);
                setLoadingRequest(false);
            });
        }
    }, [session, navigate]);

    const handleRequestAccess = async () => {
        if (!session?.id) return;
        setLoadingRequest(true);
        const success = await submitSnehiRequest(session.id);
        if (success) {
            setMessage({
                type: 'success',
                text: t({
                    en: "Your request has been submitted. Access will be granted after review.",
                    kn: "ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಲಾಗಿದೆ. ಪರಿಶೀಲನೆಯ ನಂತರ ಪ್ರವೇಶವನ್ನು ನೀಡಲಾಗುವುದು."
                })
            });
            const req = await getMyAccessRequestStatus(session.id);
            setSnehiRequest(req);
        } else {
            setMessage({
                type: 'error',
                text: t({
                    en: "Failed to submit request. Please try again.",
                    kn: "ವಿನಂತಿ ಸಲ್ಲಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
                })
            });
        }
        setLoadingRequest(false);
    };

    if (!session) return null;

    const isExpired = session?.packageEndDate && new Date(session.packageEndDate) < new Date();
    const hasBoth = !isExpired && session.packageType === PackageType.BOTH;

    const scoreMatch = session?.systemPromptFocus?.match(/Placement Score: (\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
    const isAdvanced = score >= 7;

    // Determine what they already own (and is currently active)
    const hasTalks = !isExpired && (session.packageType === PackageType.TALKS || session.packageType === PackageType.BOTH);
    const hasSnehi = !isExpired && (session.packageType === PackageType.SNEHI || session.packageType === PackageType.BOTH || session.snehiAccessEnabled);
    const ownsTalks = session.packageType === PackageType.TALKS || session.packageType === PackageType.BOTH;
    const ownsSnehi = session.packageType === PackageType.SNEHI || session.packageType === PackageType.BOTH || session.snehiAccessEnabled;

    // Handle Package Activation (Navigate to Payment)
    const handleActivatePackage = (selectedPackage: PackageType) => {
        if (!session?.id) return;
        const couponParam = appliedCoupon ? `&coupon=${appliedCoupon.coupon_code}` : '';
        navigate(`/payment?package=${selectedPackage}${couponParam}`);
    };

    const handleTopUp = async (type: 'talks' | 'snehi', amount: number) => {
        if (!session?.id || amount <= 0) return;
        setIsTopUpProcessing(true);
        setMessage(null);
        
        // Mock Payment Step
        await new Promise(r => setTimeout(r, 1500));
        
        const addedMinutes = type === 'snehi' ? (sysConfig?.snehi_topup_duration_mins || 60) : 0;
        
        const { error } = await supabase.rpc('process_user_topup_v2', {
            p_user_id: session.id,
            p_amount: amount,
            p_minutes: addedMinutes,
            p_coupon_code: appliedCoupon ? appliedCoupon.coupon_code : null
        });
            
        if (!error) {
            const newCredits = (session.agentCredits || 0) + addedMinutes;
            const newTopup = (session.topupAmount || 0) + amount;
            
            // Calculate new package_end_date optimistically
            const now = new Date();
            const currentEndDate = session.packageEndDate ? new Date(session.packageEndDate) : now;
            const baseDate = currentEndDate > now ? currentEndDate : now;
            const topupDays = sysConfig?.topup_duration_days || 30;
            const newEndDate = new Date(baseDate.getTime() + topupDays * 24 * 60 * 60 * 1000).toISOString();

            setMessage({ 
              type: 'success', 
              text: type === 'snehi' 
                ? t({ en: `Successfully added ${addedMinutes} minutes and topped up wallet!`, kn: `${addedMinutes} ನಿಮಿಷಗಳನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಸೇರಿಸಲಾಗಿದೆ!` })
                : t({ en: `Successfully topped up wallet by ₹${amount} and extended subscription!`, kn: `ವಾಲೆಟ್ ಅನ್ನು ₹${amount} ಯಶಸ್ವಿಯಾಗಿ ಟಾಪ್-ಅಪ್ ಮಾಡಲಾಗಿದೆ!` })
            });
            
            // Update store
            const sess = useAppStore.getState().session;
            if (sess) {
                useAppStore.getState().setSession({ 
                  ...sess, 
                  agentCredits: newCredits,
                  topupAmount: newTopup,
                  packageEndDate: newEndDate
                });
            }
            clearProfileCache();
            try {
                 await useAppStore.getState().refreshSession();
            } catch (e) {
                 console.error("Failed to refresh session", e);
            }
            if (type === 'talks') setTalksTopUpAmount(0);
            else setSnehiTopUpAmount(0);
            fetchTransactions(session.id);
        } else {
            setMessage({ type: 'error', text: t({ en: 'Top-up failed. Please try again.', kn: 'ಟಾಪ್-ಅಪ್ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }) });
        }
        setIsTopUpProcessing(false);
    };

    const handleRequestRefund = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || !selectedRefundTx) return;

        if (refundReason === 'Other' && refundNotes.trim().length < 10) {
            alert(t({ en: 'Please enter at least 10 characters for other reason.', kn: 'ದಯವಿಟ್ಟು ಕನಿಷ್ಠ 10 ಅಕ್ಷರಗಳನ್ನು ನಮೂದಿಸಿ.' }));
            return;
        }

        setSubmittingRefund(true);
        try {
            const { error } = await supabase.rpc('process_user_refund', {
                p_user_id: session.id,
                p_payment_id: selectedRefundTx.id,
                p_refund_amount: selectedRefundTx.amount,
                p_refund_type: 'full',
                p_reason_category: refundReason,
                p_reason_notes: refundReason === 'Other' ? refundNotes : ''
            });

            if (error) throw error;

            setMessage({
                type: 'success',
                text: t({ en: 'Refund request processed successfully!', kn: 'ಮರುಪಾವತಿ ವಿನಂತಿಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲಾಗಿದೆ!' })
            });

            // Optimistically update Zustand store & local state
            const costMin = costPerMinute || 2.0;
            const deductMins = Math.floor(selectedRefundTx.amount / costMin);
            const newCredits = Math.max(0, (session.agentCredits || 0) - deductMins);
            const newTopup = Math.max(0, (session.topupAmount || 0) - selectedRefundTx.amount);

            const sess = useAppStore.getState().session;
            if (sess) {
                useAppStore.getState().setSession({
                    ...sess,
                    agentCredits: newCredits,
                    topupAmount: newTopup
                });
            }

            clearProfileCache();
            try {
                await useAppStore.getState().refreshSession();
            } catch (e) {
                console.error("Failed to refresh session", e);
            }

            setSelectedRefundTx(null);
            setRefundNotes('');
            fetchTransactions(session.id);
        } catch (err: any) {
            console.error("Refund error:", err);
            alert(err.message || 'Failed to process refund request.');
        } finally {
            setSubmittingRefund(false);
        }
    };

    const combinedTransactions: CombinedTransactionItem[] = [
        ...packageTransactions.map(tx => ({
            id: tx.id,
            date: tx.created_at,
            amount: tx.amount,
            type: 'membership' as const,
            packageName: tx.package_type,
            provider: tx.payment_provider,
            refundable: false,
            statusLabel: t({ en: 'Non-Refundable', kn: 'ಮರುಪಾವತಿ ಮಾಡಲಾಗುವುದಿಲ್ಲ' })
        })),
        ...topupTransactions.map(tx => {
            const refundRecord = refunds.find(r => r.payment_id === tx.id);
            const daysDiff = (new Date().getTime() - new Date(tx.created_at).getTime()) / (1000 * 60 * 60 * 24);
            const isExpired = daysDiff > 30;
            
            let statusLabel = '';
            let isEligible = false;

            if (refundRecord) {
                statusLabel = t({ en: 'Refunded', kn: 'ಮರುಪಾವತಿ ಮಾಡಲಾಗಿದೆ' });
            } else if (isExpired) {
                statusLabel = t({ en: 'Expired (>30 Days)', kn: 'ಅವಧಿ ಮುಗಿದಿದೆ' });
            } else {
                statusLabel = t({ en: 'Refund Eligible', kn: 'ಮರುಪಾವತಿ ಅರ್ಹವಾಗಿದೆ' });
                isEligible = true;
            }

            return {
                id: tx.id,
                date: tx.created_at,
                amount: tx.amount,
                type: 'topup' as const,
                minutes: tx.minutes,
                refundable: isEligible,
                refundRecord,
                statusLabel
            };
        })
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="p-4 md:p-8 bg-[#F8FAFC] dark:bg-slate-950 min-h-[80vh] transition-all flex flex-col items-center justify-center animate-in fade-in duration-700">

            {/* Header logic */}
            <div className="max-w-4xl w-full text-center mb-10">
                {!hasTalks && !hasSnehi ? (
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

                {(hasTalks || hasSnehi) && (
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-6 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-sm hover:shadow-md transition-all mb-4"
                    >
                        Return to Dashboard
                    </button>
                )}
            </div>

            {/* Alert Message */}
            {message && (
                <div className={`w-full max-w-5xl mb-8 p-5 rounded-2xl font-bold text-sm flex items-center gap-3 animate-in slide-in-from-top-4 ${message.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-100' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-100'}`}>
                    {message.type === 'success' ? '✅' : '⚠️'} {message.text}
                </div>
            )}

            {/* Package Selection Cards & Topups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 w-full max-w-5xl items-stretch">
                {/* TALKS COLUMN */}
                <div className="flex flex-col gap-6">
                    <PackageCard
                        type={PackageType.TALKS}
                        isRecommended={!hasBoth && !isAdvanced}
                        isActive={hasTalks}
                        disabled={hasTalks}
                        price={talksPrice}
                        originalPrice={talksOriginalPrice}
                        gstPercent={sysConfig?.gst_percentage || 18}
                        onSelect={() => handleActivatePackage(PackageType.TALKS)}
                    />
                    
                    <div className={`relative bg-white dark:bg-slate-900 border-2 ${ownsTalks ? 'border-blue-100 dark:border-blue-900/30' : 'border-slate-200 dark:border-slate-700'} p-8 rounded-[2.5rem] shadow-xl animate-in fade-in duration-500 flex flex-col flex-1 transition-all ${!ownsTalks ? 'opacity-50 grayscale' : ''}`}>
                        {!ownsTalks && (
                            <div className="absolute inset-0 bg-slate-100/40 dark:bg-slate-800/40 rounded-[2.5rem] z-10 flex items-center justify-center backdrop-blur-[1px]">
                                <span className="bg-slate-800/80 text-white text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-full shadow-lg">🔒 Purchase Talks First</span>
                            </div>
                        )}
                        <div className="flex items-center gap-4 mb-6">
                            <span className="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl">⚡</span>
                            <div>
                                <h4 className="text-lg font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">
                                    {t({ en: 'SIMPLISH TALKS - Topup', kn: 'ಸಿಂಪ್ಲಿಷ್ ಟಾಕ್ಸ್ - ಟಾಪ್-ಅಪ್' })}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {t({ en: 'Extend Talks subscription', kn: 'ಟಾಕ್ಸ್ ಚಂದಾದಾರಿಕೆಯನ್ನು ವಿಸ್ತರಿಸಿ' })}
                                </p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 flex-1">
                            <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                    {t({ en: 'Top-up Price', kn: 'ಟಾಪ್-ಅಪ್ ಬೆಲೆ' })}
                                </p>
                                <p className="text-2xl font-black text-blue-600 dark:text-blue-400 flex flex-col">
                                    {appliedCoupon && appliedCoupon.discount_type !== 'FREE_MONTHS' && (
                                        <span className="line-through text-slate-400 text-xs font-bold">₹{Math.round((sysConfig?.subscription_price || 99) * (1 + (sysConfig?.gst_percentage || 18) / 100))}</span>
                                    )}
                                    <span>₹{Math.round(getDiscountedPrice(sysConfig?.subscription_price || 99) * (1 + (sysConfig?.gst_percentage || 18) / 100))}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">(GST Included)</span>
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                    {t({ en: 'Topup Duration', kn: 'ಟಾಪ್‌ಅಪ್ ಅವಧಿ' })}
                                </p>
                                <p className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                    {sysConfig?.topup_duration_days || 30} <span className="text-xs uppercase tracking-tighter opacity-60">Days</span>
                                </p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => handleTopUp('talks', sysConfig?.subscription_price || 99)}
                            disabled={isTopUpProcessing || !ownsTalks}
                            className="w-full mt-auto bg-blue-600 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl hover:bg-blue-700 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border-b-4 border-blue-800"
                        >
                            {isTopUpProcessing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '💳'} {
                                ownsTalks 
                                    ? t({ en: 'Extend Access', kn: 'ವಿಸ್ತರಿಸಿ' })
                                    : t({ en: 'Requires Talks Subscription', kn: 'ಟಾಕ್ಸ್ ಚಂದಾದಾರಿಕೆ ಅಗತ್ಯವಿದೆ' })
                            }
                        </button>
                    </div>
                </div>

                {/* SNEHI COLUMN */}
                <div className="flex flex-col gap-6">
                    {/* Dynamic SNEHI card based on request status */}
                    {(() => {
                        const snehiStatus = session?.snehiAccessEnabled ? 'ACTIVE' : (snehiRequest?.status || 'None');
                        return (
                            <div className={`group relative transition-all duration-300 ${hasSnehi ? 'ring-4 ring-blue-500 scale-[1.02]' : 'hover:border-blue-500 hover:scale-[1.02] shadow-xl'}`}>
                                <div className="absolute inset-0 bg-orange-600 rounded-[2.5rem] -rotate-1 group-hover:rotate-0 transition-transform opacity-10"></div>
                                <div className="relative bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-8 rounded-[2.5rem] transition-all flex flex-col h-full overflow-hidden min-h-[460px]">
                                    
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-14 h-14 bg-orange-50 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center text-3xl opacity-90">
                                            🎙️
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            {!hasSnehi && !session?.snehiAccessEnabled && (
                                                <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                                                    {snehiStatus === 'None' ? 'Access by Request' : 
                                                     snehiStatus === 'PENDING' ? 'Under Review' : 
                                                     snehiStatus === 'AWAITING_PMT' ? 'Approval Granted' : 'Restricted'}
                                                </span>
                                            )}
                                            {session?.snehiAccessEnabled && (
                                                <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                                    <span className="text-[10px]">✓</span> Approved
                                                </span>
                                            )}
                                            <span className="font-black text-slate-900 dark:text-white text-lg text-right flex flex-col items-end">
                                                {appliedCoupon && (
                                                    <span className="line-through text-slate-400 text-xs font-bold">
                                                        ₹{Math.round((sysConfig?.price_snehi || 499) * (1 + (sysConfig?.gst_percentage || 18) / 100))}
                                                    </span>
                                                )}
                                                <span>
                                                    ₹{Math.round(snehiPrice * (1 + (sysConfig?.gst_percentage || 18) / 100))} <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">/mo</span>
                                                </span>
                                                <span className="text-[8px] text-slate-400 block font-black uppercase tracking-widest mt-0.5">(GST Included)</span>
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                                        {snehiStatus === 'ACTIVE' ? '✅ Access Activated' : 
                                         snehiStatus === 'PENDING' ? '⏳ Request Under Review' : 
                                         snehiStatus === 'AWAITING_PMT' ? '💳 Approval Granted' : 
                                         snehiStatus === 'REJECTED' ? '❌ Request Rejected' : 
                                         snehiStatus === 'DISABLED' ? '🔒 Access Disabled' : 
                                         '🔒 SIMPLISH-SNEHI'}
                                    </h3>
                                    
                                    <p className="text-slate-500 dark:text-slate-400 text-xs font-bold mb-8 leading-relaxed">
                                        {snehiStatus === 'ACTIVE' ? 'Your SIMPLISH-SNEHI access is active. Click below to start voice practice.' : 
                                         snehiStatus === 'PENDING' ? 'Your request has been submitted and is currently under administrative review.' : 
                                         snehiStatus === 'AWAITING_PMT' ? 'Your request has been approved! Complete payment to activate your access.' : 
                                         snehiStatus === 'REJECTED' ? 'Your previous request was rejected. You may request approval again.' : 
                                         snehiStatus === 'DISABLED' ? 'Please contact support for assistance.' : 
                                         'Exclusive guided voice service. Submit a request to initiate administrative approval.'}
                                    </p>

                                    <ul className="space-y-3 mb-10 flex-1 opacity-90">
                                        {['Direct Voice Call', 'Visual Personas', 'Call Records'].map(f => (
                                            <li key={f} className="flex items-center gap-3 text-[11px] font-black text-slate-700 dark:text-slate-300">
                                                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px]">✓</span>
                                                {f}
                                            </li>
                                        ))}
                                    </ul>

                                    {snehiStatus === 'ACTIVE' ? (
                                        <button
                                            onClick={() => navigate('/talk')}
                                            className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all bg-orange-500 text-white shadow-xl hover:bg-orange-600 cursor-pointer"
                                        >
                                            Open SIMPLISH-SNEHI
                                        </button>
                                    ) : snehiStatus === 'PENDING' ? (
                                        <button
                                            disabled
                                            className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                                        >
                                            Under Review
                                        </button>
                                    ) : snehiStatus === 'AWAITING_PMT' ? (
                                        <button
                                            onClick={() => setShowCheckoutModal(true)}
                                            className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all bg-blue-600 text-white shadow-xl hover:bg-blue-700 cursor-pointer animate-pulse"
                                        >
                                            Pay Now
                                        </button>
                                    ) : snehiStatus === 'REJECTED' ? (
                                        <button
                                            onClick={handleRequestAccess}
                                            disabled={loadingRequest}
                                            className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all bg-red-600 text-white shadow-xl hover:bg-red-700 cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            {loadingRequest ? 'Submitting...' : 'Request Again'}
                                        </button>
                                    ) : snehiStatus === 'DISABLED' ? (
                                        <button
                                            disabled
                                            className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed border border-slate-200 dark:border-slate-700"
                                        >
                                            Access Disabled
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleRequestAccess}
                                            disabled={loadingRequest}
                                            className="w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all bg-orange-500 text-white shadow-xl hover:bg-orange-600 cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            {loadingRequest && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                                            Request Access
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })()}
                    
                    <div className={`relative bg-white dark:bg-slate-900 border-2 ${ownsSnehi ? 'border-orange-100 dark:border-orange-900/30' : 'border-slate-200 dark:border-slate-700'} p-8 rounded-[2.5rem] shadow-xl animate-in fade-in duration-500 flex flex-col flex-1 transition-all ${!ownsSnehi ? 'opacity-50 grayscale' : ''}`}>
                        {!ownsSnehi && (
                            <div className="absolute inset-0 bg-slate-100/40 dark:bg-slate-800/40 rounded-[2.5rem] z-10 flex items-center justify-center backdrop-blur-[1px]">
                                <span className="bg-slate-800/80 text-white text-[10px] font-black uppercase tracking-widest px-5 py-2.5 rounded-full shadow-lg">🔒 Requires SNEHI Approval</span>
                            </div>
                        )}
                        <div className="flex items-center gap-4 mb-6">
                            <span className="text-3xl bg-orange-50 dark:bg-orange-900/30 p-3 rounded-2xl">🎙️</span>
                            <div>
                                <h4 className="text-lg font-black text-orange-900 dark:text-orange-300 uppercase tracking-tight">
                                    {t({ en: 'SIMPLISH SNEHI - Topup', kn: 'ಸಿಂಪ್ಲಿಷ್ ಸ್ನೇಹಿ - ಟಾಪ್-ಅಪ್' })}
                                </h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {t({ en: 'Add voice practice minutes & duration', kn: 'ಹೆಚ್ಚುವರಿ ಧ್ವನಿ ನಿಮಿಷಗಳು ಮತ್ತು ಅವಧಿಯನ್ನು ಸೇರಿಸಿ' })}
                                </p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 flex-1">
                            <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                    {t({ en: 'Top-up Price', kn: 'ಟಾಪ್-ಅಪ್ ಬೆಲೆ' })}
                                </p>
                                <p className="text-2xl font-black text-orange-500 dark:text-orange-400 flex flex-col">
                                    {appliedCoupon && appliedCoupon.discount_type !== 'FREE_MONTHS' && (
                                        <span className="line-through text-slate-400 text-xs font-bold">₹{Math.round((sysConfig?.snehi_subscription_price || 99) * (1 + (sysConfig?.gst_percentage || 18) / 100))}</span>
                                    )}
                                    <span>₹{Math.round(getDiscountedPrice(sysConfig?.snehi_subscription_price || 99) * (1 + (sysConfig?.gst_percentage || 18) / 100))}</span>
                                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">(GST Included)</span>
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 p-5 rounded-[2rem] border-2 border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
                                    {t({ en: 'Topup Duration', kn: 'ಟಾಪ್‌ಅಪ್ ಅವಧಿ (ನಿಮಿಷಗಳು)' })}
                                </p>
                                <p className="text-2xl font-black text-orange-500 dark:text-orange-400">
                                    {sysConfig?.snehi_topup_duration_mins || 60} <span className="text-xs uppercase tracking-tighter opacity-60">Min</span>
                                </p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => handleTopUp('snehi', sysConfig?.snehi_subscription_price || 99)}
                            disabled={isTopUpProcessing || !ownsSnehi}
                            className="w-full mt-auto bg-orange-500 text-white py-5 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl hover:bg-orange-600 hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer border-b-4 border-orange-700"
                        >
                            {isTopUpProcessing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : '💳'} {
                                ownsSnehi 
                                    ? t({ en: 'Buy Minutes Now', kn: 'ಖರೀದಿಸಿ' })
                                    : t({ en: 'Requires SNEHI Access Approved', kn: 'ಸ್ನೇಹಿ ಪ್ರವೇಶ ಅನುಮೋದನೆ ಅಗತ್ಯವಿದೆ' })
                            }
                        </button>
                    </div>
                </div>
            </div>

            {/* Coupon Code section */}
            <div className="w-full max-w-5xl mt-8 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <span className="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl">🎟️</span>
                        <div>
                            <h4 className="text-lg font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">Have a Coupon Code?</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apply a promo code to discount your subscription or top-up</p>
                        </div>
                    </div>
                    <div className="flex-1 max-w-md w-full">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={couponCode}
                                disabled={!!appliedCoupon || isValidatingCoupon}
                                onChange={e => setCouponCode(e.target.value.toUpperCase())}
                                placeholder={t({ en: "Enter Coupon Code (e.g. STUDENT50)", kn: "ಕೂಪನ್ ಕೋಡ್ ನಮೂದಿಸಿ" })}
                                className="flex-1 px-4 py-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                            {appliedCoupon ? (
                                <button
                                    onClick={handleRemoveCoupon}
                                    className="px-6 py-4 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-2xl text-xs font-black uppercase hover:bg-red-100 dark:hover:bg-red-950/40 transition-all cursor-pointer border border-red-200 dark:border-red-900/35"
                                >
                                    Remove
                                </button>
                            ) : (
                                <button
                                    onClick={handleApplyCoupon}
                                    disabled={isValidatingCoupon || !couponCode.trim()}
                                    className="px-6 py-4 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                                >
                                    {isValidatingCoupon ? "..." : "Apply"}
                                </button>
                            )}
                        </div>
                        {couponError && <p className="text-[10px] text-red-500 font-bold mt-2 ml-1">⚠️ {couponError}</p>}
                        {appliedCoupon && (
                            <div className="bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/20 rounded-xl p-4 mt-3 animate-in slide-in-from-top-2 duration-300">
                                <p className="text-xs text-green-700 dark:text-green-400 font-black">
                                    ✓ Coupon Applied: {appliedCoupon.coupon_code}
                                </p>
                                <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                    <div>Customer Group: {appliedCoupon.customer_type}</div>
                                    <div>Discount: {
                                        appliedCoupon.discount_type === 'PERCENTAGE' ? `${appliedCoupon.discount_value}%` :
                                        appliedCoupon.discount_type === 'FREE_MONTHS' ? `+${appliedCoupon.discount_value} Free Month(s)` : '100% Free Access'
                                    }</div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Transaction History & Refunds */}
            <div className="w-full max-w-5xl mt-12 bg-white dark:bg-slate-900 p-8 md:p-12 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                    <span className="text-4xl bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl shadow-sm">🧾</span>
                    <div>
                        <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">
                            {t({ en: 'Transaction History & Refunds', kn: 'ವಹಿವಾಟು ಇತಿಹಾಸ ಮತ್ತು ಮರುಪಾವತಿಗಳು' })}
                        </h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {t({ en: 'View billing history and manage wallet refunds', kn: 'ಬಿಲ್ಲುಗಳ ಇತಿಹಾಸ ಮತ್ತು ಮರುಪಾವತಿಗಳನ್ನು ನಿರ್ವಹಿಸಿ' })}
                        </p>
                    </div>
                </div>

                {fetchingTransactions ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : combinedTransactions.length === 0 ? (
                    <p className="text-sm font-bold text-slate-400 text-center py-10 uppercase tracking-wider">
                        {t({ en: 'No transactions found', kn: 'ಯಾವುದೇ ವಹಿವಾಟುಗಳು ಕಂಡುಬಂದಿಲ್ಲ' })}
                    </p>
                ) : (
                    <div className="space-y-4">
                        {combinedTransactions.map(tx => (
                            <div key={tx.id} data-testid="transaction-row" className="bg-slate-50 dark:bg-slate-800/40 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-blue-400 dark:hover:border-blue-700 transition-colors">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            {tx.type === 'membership' 
                                                ? t({ en: `Membership: ${tx.packageName}`, kn: `ಚಂದಾದಾರಿಕೆ: ${tx.packageName}` }) 
                                                : t({ en: 'Wallet Topup', kn: 'ವಾಲೆಟ್ ಟಾಪ್-ಅಪ್' })
                                            }
                                        </span>
                                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                                            tx.type === 'membership' 
                                                ? 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-350' 
                                                : tx.refundable 
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                    : tx.refundRecord 
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                                        : 'bg-red-105 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                        }`}>
                                            {tx.statusLabel}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                                        {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    {tx.type === 'topup' && (
                                        <p className="text-[9px] font-mono text-slate-400 mt-1">
                                            {t({ en: `Includes ${tx.minutes} voice practice minutes`, kn: `ಒಳಗೊಂಡಿದೆ ${tx.minutes} ಧ್ವನಿ ನಿಮಿಷಗಳು` })}
                                        </p>
                                    )}
                                    {tx.refundRecord && (
                                        <div className="mt-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-[10px] text-slate-550">
                                            <p className="font-bold uppercase tracking-wider text-[9px] text-amber-600 mb-0.5">
                                                {t({ en: 'Refund Details', kn: 'ಮರುಪಾವತಿ ವಿವರಗಳು' })}
                                            </p>
                                            <p>Reason: {tx.refundRecord.reason_category}</p>
                                            {tx.refundRecord.reason_notes && <p className="font-mono text-slate-400">Notes: {tx.refundRecord.reason_notes}</p>}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                    <span className="text-xl font-black text-slate-800 dark:text-slate-100">₹{tx.amount}</span>
                                    {tx.type === 'topup' && tx.refundable && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedRefundTx(tx);
                                                setRefundReason('Duplicate payment / Charged twice');
                                                setRefundNotes('');
                                            }}
                                            className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-wider border border-red-100 dark:border-red-900/30 transition-colors shadow-sm cursor-pointer"
                                        >
                                            {t({ en: 'Request Refund', kn: 'ಮರುಪಾವತಿ ಕೇಳಿ' })}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Refund Request Modal */}
            {selectedRefundTx && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[250] animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 p-8 md:p-10 max-w-lg w-full shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <h3 className="text-2xl font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight mb-2">
                            {t({ en: 'Request Wallet Refund', kn: 'ಮರುಪಾವತಿ ವಿನಂತಿ' })}
                        </h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">
                            {t({ en: 'Transaction ID:', kn: 'ವಹಿವಾಟು ಐಡಿ:' })} <span className="font-mono lowercase text-[10px] font-medium text-slate-400 block mt-1">{selectedRefundTx.id}</span>
                        </p>

                        <form onSubmit={handleRequestRefund} className="space-y-6">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{t({ en: 'Refund Amount', kn: 'ಮರುಪಾವತಿ ಮೊತ್ತ' })}</p>
                                    <p className="text-[9px] text-slate-400 font-medium uppercase mt-0.5">{t({ en: 'Full Refund to Wallet', kn: 'ವಾಲೆಟ್‌ಗೆ ಪೂರ್ಣ ಮರುಪಾವತಿ' })}</p>
                                </div>
                                <span className="text-2xl font-black text-slate-900 dark:text-white">₹{selectedRefundTx.amount}</span>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">
                                    {t({ en: 'Reason for Refund', kn: 'ಮರುಪಾವತಿಗೆ ಕಾರಣ' })}
                                </label>
                                <div className="relative">
                                    <select
                                        value={refundReason}
                                        onChange={e => setRefundReason(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 pl-6 pr-10 rounded-2xl font-bold text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="Duplicate payment / Charged twice">{t({ en: 'Duplicate payment / Charged twice', kn: 'ನಕಲಿ ಪಾವತಿ / ಎರಡು ಬಾರಿ ಶುಲ್ಕ' })}</option>
                                        <option value="Order cancelled by customer">{t({ en: 'Order cancelled by customer', kn: 'ಗ್ರಾಹಕರಿಂದ ಆರ್ಡರ್ ರದ್ದು' })}</option>
                                        <option value="Other">{t({ en: 'Other (Specify below)', kn: 'ಇತರೆ (ಕೆಳಗೆ ವಿವರ ನೀಡಿ)' })}</option>
                                    </select>
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                                </div>
                            </div>

                            {refundReason === 'Other' && (
                                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">
                                        {t({ en: 'Explanation Notes', kn: 'ವಿವರಣಾತ್ಮಕ ಟಿಪ್ಪಣಿಗಳು' })}
                                    </label>
                                    <textarea
                                        required
                                        value={refundNotes}
                                        onChange={e => setRefundNotes(e.target.value)}
                                        placeholder={t({ en: 'Please explain the issue (minimum 10 characters)...', kn: 'ದಯವಿಟ್ಟು ಸಮಸ್ಯೆಯನ್ನು ವಿವರಿಸಿ (ಕನಿಷ್ಠ 10 ಅಕ್ಷರಗಳು)...' })}
                                        rows={3}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl font-bold text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-all"
                                    />
                                    {refundNotes.trim().length > 0 && refundNotes.trim().length < 10 && (
                                        <p className="text-[10px] font-bold text-red-500 ml-2">
                                            {t({ en: `Requires ${10 - refundNotes.trim().length} more characters.`, kn: `ಇನ್ನೂ ${10 - refundNotes.trim().length} ಅಕ್ಷರಗಳ ಅವಶ್ಯಕತೆಯಿದೆ.` })}
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRefundTx(null)}
                                    disabled={submittingRefund}
                                    className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-350 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
                                >
                                    {t({ en: 'Cancel', kn: 'ರದ್ದುಮಾಡಿ' })}
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingRefund || (refundReason === 'Other' && refundNotes.trim().length < 10)}
                                    className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 dark:shadow-none transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {submittingRefund ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div> : t({ en: 'Confirm Refund', kn: 'ಮರುಪಾವತಿ ಖಚಿತಪಡಿಸಿ' })}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCheckoutModal && snehiRequest && (
                <SnehiCheckoutModal
                    userId={session.id}
                    requestId={snehiRequest.id}
                    basePrice={sysConfig?.price_snehi || 499}
                    initialCouponCode={appliedCoupon ? appliedCoupon.coupon_code : ''}
                    onClose={() => setShowCheckoutModal(false)}
                    onSuccess={async () => {
                        setShowCheckoutModal(false);
                        const { clearProfileCache } = await import('../services/authService');
                        clearProfileCache();
                        try {
                            await useAppStore.getState().refreshSession();
                        } catch (e) {
                            console.error(e);
                        }
                        // Refresh request status
                        const { getMyAccessRequestStatus } = await import('../services/snehiAccessService');
                        const req = await getMyAccessRequestStatus(session.id);
                        setSnehiRequest(req);
                    }}
                />
            )}
        </div>
    );
};

export default PackageSelection;

const PackageCard: React.FC<{ 
    type: PackageType; 
    isRecommended: boolean; 
    isActive: boolean; 
    disabled: boolean; 
    price: number;
    originalPrice?: number;
    gstPercent: number;
    onSelect: () => void 
}> = ({ type, isRecommended, isActive, disabled, price, originalPrice, gstPercent, onSelect }) => {
    const isTalks = type === PackageType.TALKS;

    // Visual tweaks for disabled cards
    const containerClasses = disabled
        ? 'opacity-50 grayscale scale-[0.98] pointer-events-none'
        : 'hover:border-blue-500 hover:scale-[1.02] shadow-xl';

    const buttonText = disabled ? 'Active Subscription' : (isTalks ? 'Start Learning' : 'Choose Voice Path');
    const buttonStyle = disabled
        ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed border border-slate-200 dark:border-slate-700'
        : (isTalks ? 'bg-blue-600 text-white shadow-xl hover:opacity-90' : 'bg-orange-500 text-white shadow-xl hover:bg-orange-600');

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
                        <span className="font-black text-slate-900 dark:text-white text-lg text-right flex flex-col items-end">
                            {originalPrice && originalPrice !== price && (
                                <span className="line-through text-slate-400 text-xs font-bold">₹{Math.round(originalPrice * (1 + gstPercent / 100))}</span>
                            )}
                            <span>
                                ₹{Math.round(price * (1 + gstPercent / 100))} <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">/mo</span>
                            </span>
                            <span className="text-[8px] text-slate-400 block font-black uppercase tracking-widest mt-0.5">(GST Included)</span>
                        </span>
                    </div>
                </div>

                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{isTalks ? 'SIMPLISH - TALKS' : 'SIMPLISH SNEHI'}</h3>
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
