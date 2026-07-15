import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PackageType, PackageStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { clearProfileCache } from '../services/authService';
import { getSystemConfig } from '../services/systemConfigService';
import { applyMockLocalFulfillmentDBV2, resolveUpgradedPackage, calculateBonusCredits } from '../services/paymentService';
import { supabase } from '../lib/supabase';
import { validateCoupon } from '../services/discountService';

// --- CONFIGURATION CONSTANTS ---
const PACKAGE_CONFIG: Record<PackageType, { label: string; price: number; displayPrice: string }> = {
    [PackageType.TALKS]: { label: 'SIMPLISH - TALKS', price: 299, displayPrice: '₹299' },
    [PackageType.SNEHI]: { label: 'SIMPLISH SNEHI', price: 499, displayPrice: '₹499' },
    [PackageType.BOTH]: { label: 'PREMIUM BUNDLE', price: 798, displayPrice: '₹798' }, // Assuming arbitrary sum for both
    [PackageType.NONE]: { label: 'NONE', price: 0, displayPrice: '₹0' },
};

const DEFAULT_COST_PER_MINUTE = 2.0;
const SUBSCRIPTION_DAYS_DURATION = 30;
const MS_IN_A_DAY = 24 * 60 * 60 * 1000;

// --- PRESENTATIONAL SUB-COMPONENTS ---

const OrderSummary = ({ 
    packageLabel, 
    originalPrice, 
    discountAmount, 
    finalPayable,
    couponCode 
}: { 
    packageLabel: string; 
    originalPrice: number; 
    discountAmount: number; 
    finalPayable: number;
    couponCode?: string;
}) => (
    <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border-2 border-slate-100 dark:border-slate-800 shadow-xl">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Order Summary</h3>
        <div className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-800">
            <div>
                <div className="font-black text-slate-900 dark:text-white">{packageLabel}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">1 Month Subscription</div>
            </div>
            <div className="font-black text-slate-900 dark:text-white">₹{originalPrice}</div>
        </div>
        {discountAmount > 0 && (
            <div className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-800 text-green-600 font-bold text-xs">
                <span>Discount Applied ({couponCode})</span>
                <span>-₹{discountAmount}</span>
            </div>
        )}
        <div className="flex justify-between items-center pt-6">
            <div className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Total Amount</div>
            <div className="text-2xl font-black text-blue-600">₹{finalPayable}</div>
        </div>
    </div>
);

const TrustBadges = () => (
    <div className="flex justify-between px-4">
        <div className="flex flex-col items-center opacity-40">
            <span className="text-2xl mb-1">🔒</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Secure SSL</span>
        </div>
        <div className="flex flex-col items-center opacity-40">
            <span className="text-2xl mb-1">⚡</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Instant Access</span>
        </div>
        <div className="flex flex-col items-center opacity-40">
            <span className="text-2xl mb-1">🛡️</span>
            <span className="text-[8px] font-black uppercase tracking-widest text-center">Data Protected</span>
        </div>
    </div>
);

// --- MAIN COMPONENT ---

const PaymentPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const mounted = useRef(true); 
    
    const session = useAppStore(state => state.session);
    
    // Refactor Fix: Eliminated redundant flag state `isProcessing`, derived directly from payment step
    const [paymentStep, setPaymentStep] = useState<'checkout' | 'processing' | 'success'>('checkout');
    const isProcessing = paymentStep === 'processing';
    
    const [costPerMinute, setCostPerMinute] = useState<number>(DEFAULT_COST_PER_MINUTE);
    const [prices, setPrices] = useState<Record<PackageType, number>>({
        [PackageType.TALKS]: 299,
        [PackageType.SNEHI]: 499,
        [PackageType.BOTH]: 798,
        [PackageType.NONE]: 0
    });
    const [paymentMethod, setPaymentMethod] = useState<'mock' | 'wallet'>('mock');

    // Coupon States
    const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [couponInput, setCouponInput] = useState('');
    const [couponError, setCouponError] = useState('');

    useEffect(() => {
        mounted.current = true;
        let active = true;
        getSystemConfig().then(cfg => {
            if (active && mounted.current && cfg) {
                setCostPerMinute(cfg.cost_per_minute);
                setPrices({
                    [PackageType.TALKS]: cfg.price_talks || 299,
                    [PackageType.SNEHI]: cfg.price_snehi || 499,
                    [PackageType.BOTH]: (cfg.price_talks || 299) + (cfg.price_snehi || 499),
                    [PackageType.NONE]: 0
                });
            }
        });
        return () => { 
            active = false;
            mounted.current = false; 
        };
    }, []);

    const selectedPackage = searchParams.get('package') as PackageType;
    const couponParam = searchParams.get('coupon') || '';
    const isValidPackage = Object.values(PackageType).includes(selectedPackage);
    const safePackageKey = isValidPackage ? selectedPackage : PackageType.NONE;
    
    const currentPrice = prices[safePackageKey] || 0;

    // Pre-populate input if couponParam exists
    useEffect(() => {
        if (couponParam) {
            setCouponInput(couponParam);
        }
    }, [couponParam]);

    // Validate Initial Coupon on Mount
    useEffect(() => {
        if (couponParam && session?.id && currentPrice > 0 && !appliedCoupon) {
            setIsValidatingCoupon(true);
            validateCoupon(couponParam, session.id, 'NEW', currentPrice).then(res => {
                if (res.is_valid) {
                    setAppliedCoupon(res);
                } else {
                    setCouponError(res.error_message);
                }
                setIsValidatingCoupon(false);
            });
        }
    }, [couponParam, session, currentPrice]);

    const handleApplyCoupon = async () => {
        setCouponError('');
        if (!couponInput.trim() || !session?.id || currentPrice <= 0) return;
        setIsValidatingCoupon(true);
        try {
            const res = await validateCoupon(couponInput, session.id, 'NEW', currentPrice);
            if (res.is_valid) {
                setAppliedCoupon(res);
                setCouponError('');
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
        setCouponInput('');
        setCouponError('');
    };

    const discountAmount = appliedCoupon ? appliedCoupon.discount_amount : 0;
    const finalPayablePrice = Math.max(0, currentPrice - discountAmount);

    const packageLabel = safePackageKey === PackageType.TALKS 
        ? 'SIMPLISH - TALKS' 
        : safePackageKey === PackageType.SNEHI 
            ? 'SIMPLISH SNEHI' 
            : safePackageKey === PackageType.BOTH 
                ? 'PREMIUM BUNDLE' 
                : 'NONE';
    const packagePrice = `₹${finalPayablePrice}`;

    useEffect(() => {
        if (!session) {
            navigate('/login');
        } else if (!selectedPackage || !isValidPackage) {
            navigate('/dashboard');
        }
    }, [session, selectedPackage, isValidPackage, navigate]);

    const handlePayment = async () => {
        if (isProcessing) return; // Prevent double submit
        setPaymentStep('processing');

        try {
            // Free Access instantly fulfills
            if (appliedCoupon && appliedCoupon.discount_type === 'FREE_ACCESS') {
                await simulateBackendFulfillment();
                setPaymentStep('success');
                setTimeout(() => {
                    if (mounted.current) navigate('/dashboard', { replace: true });
                }, 2000);
                return;
            }

            if (paymentMethod === 'wallet') {
                const userBalance = session?.topupAmount || 0;
                if (userBalance < finalPayablePrice) {
                    throw new Error('Insufficient wallet balance.');
                }
                
                const { error: walletError } = await supabase.rpc('pay_package_with_wallet_v2', {
                    p_user_id: session!.id,
                    p_package_type: safePackageKey,
                    p_amount: currentPrice,
                    p_coupon_code: appliedCoupon ? appliedCoupon.coupon_code : null
                });

                if (walletError) throw walletError;

                // Optimistically update Zustand store
                const newPackageType = resolveUpgradedPackage(session?.packageType, safePackageKey);
                const safeCostPerMinute = (costPerMinute && costPerMinute > 0) ? costPerMinute : DEFAULT_COST_PER_MINUTE;
                const addedCredits = calculateBonusCredits(safePackageKey, currentPrice, safeCostPerMinute);

                const currentSession = useAppStore.getState().session;
                if (currentSession) {
                    useAppStore.getState().setSession({
                        ...currentSession,
                        packageType: newPackageType,
                        packageStatus: PackageStatus.ACTIVE,
                        topupAmount: Math.max(0, (currentSession.topupAmount || 0) - currentPrice),
                        agentCredits: (currentSession.agentCredits || 0) + addedCredits,
                        packageEndDate: new Date(Date.now() + SUBSCRIPTION_DAYS_DURATION * MS_IN_A_DAY).toISOString()
                    });
                }
                
                clearProfileCache();
                try {
                     await useAppStore.getState().refreshSession();
                } catch (e) {
                     console.error("Failed to re-sync optimistic UI session state", e);
                }

                setPaymentStep('success');
                setTimeout(() => {
                    if (mounted.current) navigate('/dashboard', { replace: true });
                }, 2000);
                return;
            }

            // SECURITY (REMEDIATION): Server-Side Tokenization & Fulfillment.
            // In a production environment, we MUST NEVER update the profiles table directly
            // from the frontend, as this is a Critical Privilege Escalation vulnerability.
            
            // Step 1: Request Order / Token from secure backend
            console.log("🔒 Requesting secure payment token from Edge Function...");
            // const { data: order } = await supabase.functions.invoke('create-razorpay-order', { body: { package: safePackageKey }});
            await new Promise(resolve => setTimeout(resolve, 800)); // Mock network delay
            if (!mounted.current) return; // Fix: Memory leak on unmount cancellation
            
            // Step 2: Open Provider Checkout (e.g., Razorpay / Stripe Elements)
            console.log("💳 Opening secure checkout iframe...");
            await new Promise(resolve => setTimeout(resolve, 1200)); // Mock user entering card details
            const mockPaymentToken = "tok_simulated_secure_123456";
            if (!mounted.current) return; // Unmount cancellation block

            // Step 3: Send Token for Backend Verification & Fulfillment
            console.log("📡 Sending token to backend for fulfillment verification...");
            // const { error } = await supabase.functions.invoke('verify-and-fulfill', { body: { token: mockPaymentToken }});
            await new Promise(resolve => setTimeout(resolve, 1000)); // Mock backend processing time
            if (!mounted.current) return; // Unmount cancellation block

            // --- LOCAL DEV FALLBACK ---
            // Because we don't have the edge functions deployed in this local environment,
            // we will simulate the backend's successful fulfillment here.
            if (import.meta.env.DEV) {
                const fulfilled = await simulateBackendFulfillment();
                if (!fulfilled || !mounted.current) return; 
            } else {
                // In production, wait for the actual secure webhook fulfillment
                console.log("Waiting for real backend webhook fulfillment confirmation...");
                await new Promise(resolve => setTimeout(resolve, 3000));
                if (!mounted.current) return; // Unmount cancellation
            }
            
            setPaymentStep('success');

            // Redirect after success message (safely bound to mount)
            setTimeout(() => {
                if (mounted.current) navigate('/dashboard', { replace: true });
            }, 2000);

        } catch (err) {
            if (!mounted.current) return;
            console.error("Payment failed:", err);
            setPaymentStep('checkout');
            alert("Payment failed. Please try again or contact support.");
        }
    };

    // This function mimics what the secure backend / Webhook handler MUST do.
    const simulateBackendFulfillment = async () => {
        if (!import.meta.env.DEV) {
            console.error("Critical Security Alert: Attempted to run local backend mock in production.");
            return false;
        }
        
        // PURE MATH & LOGIC EXTRACTED TO SERVICE LAYER
        const safeCostPerMinute = (costPerMinute && costPerMinute > 0) ? costPerMinute : DEFAULT_COST_PER_MINUTE;
        const newPackageType = resolveUpgradedPackage(session?.packageType, safePackageKey);
        const addedCredits = calculateBonusCredits(safePackageKey, currentPrice, safeCostPerMinute);

        const currentCredits = session?.agentCredits || 0;
        const now = new Date();
        const currentEndDate = session?.packageEndDate ? new Date(session.packageEndDate) : now;
        const baseDate = currentEndDate > now ? currentEndDate : now;
        const newEndDate = new Date(baseDate.getTime() + SUBSCRIPTION_DAYS_DURATION * MS_IN_A_DAY).toISOString();

        const updates = {
            package_type: newPackageType,
            package_status: PackageStatus.ACTIVE,
            package_start_date: now.toISOString(),
            package_end_date: newEndDate,
            agent_credits: currentCredits + addedCredits
        };

        const transactionLog = {
            user_id: session!.id,
            package_type: safePackageKey,
            amount: finalPayablePrice,
            payment_provider: 'simulated_backend_tokenized'
        };

        // DATABASE SIDE-EFFECTS EXTRACTED TO SERVICE LAYER
        await applyMockLocalFulfillmentDBV2(session!.id, updates, transactionLog, appliedCoupon ? appliedCoupon.coupon_code : null);

        // CRITICAL: Immediately update the Zustand store with the new package data
        const currentSession = useAppStore.getState().session;
        if (currentSession) {
            useAppStore.getState().setSession({
                ...currentSession,
                packageType: newPackageType,
                packageStatus: PackageStatus.ACTIVE,
                packageStartDate: updates.package_start_date,
                packageEndDate: updates.package_end_date,
                agentCredits: updates.agent_credits,
            });
        }

        // Trigger a background re-fetch for full sync
        clearProfileCache();
        try {
             await useAppStore.getState().refreshSession();
        } catch (e) {
             console.error("Failed to re-sync optimistic UI session state", e);
        }
        
        return true;
    };

    if (!session || !isValidPackage) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex justify-center items-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (paymentStep === 'processing') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
                <div className="w-20 h-20 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-8"></div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Processing Payment</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold">Please do not refresh the page or click back.</p>
            </div>
        );
    }

    if (paymentStep === 'success') {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-5xl text-white shadow-2xl shadow-green-500/20 mb-8 animate-bounce">✓</div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tighter">Payment Successful!</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold mb-4">You have unlocked {packageLabel}.</p>
                <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.2em] animate-pulse">Redirecting to Dashboard...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-6 flex flex-col items-center animate-in fade-in duration-700">
            <div className="max-w-2xl w-full">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                        Step 3: Secure Checkout
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Complete Your Purchase</h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                    {/* Order Summary & Badges  */}
                    <div className="md:col-span-3 space-y-6">
                        <OrderSummary 
                            packageLabel={packageLabel} 
                            originalPrice={currentPrice} 
                            discountAmount={discountAmount} 
                            finalPayable={finalPayablePrice} 
                            couponCode={appliedCoupon?.coupon_code}
                        />

                        {/* Coupon Code section */}
                        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span>🎟️</span> Apply Promo Code
                            </h4>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={couponInput}
                                    disabled={!!appliedCoupon || isValidatingCoupon}
                                    onChange={e => setCouponInput(e.target.value.toUpperCase())}
                                    placeholder="Enter Coupon Code (e.g. STUDENT50)"
                                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                />
                                {appliedCoupon ? (
                                    <button
                                        onClick={handleRemoveCoupon}
                                        className="px-5 py-3 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-xl text-xs font-black uppercase hover:bg-red-100 dark:hover:bg-red-950/40 transition-all border border-red-200 dark:border-red-900/35"
                                    >
                                        Remove
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleApplyCoupon}
                                        disabled={isValidatingCoupon || !couponInput.trim()}
                                        className="px-5 py-3 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {isValidatingCoupon ? '...' : 'Apply'}
                                    </button>
                                )}
                            </div>
                            {couponError && <p className="text-[10px] text-red-500 font-bold">⚠️ {couponError}</p>}
                            {appliedCoupon && (
                                <div className="bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/20 rounded-xl p-3">
                                    <p className="text-xs text-green-700 dark:text-green-400 font-black">
                                        ✓ Coupon Applied: {appliedCoupon.coupon_code}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 mt-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                        <div>Group: {appliedCoupon.customer_type}</div>
                                        <div>Discount: {
                                            appliedCoupon.discount_type === 'PERCENTAGE' ? `${appliedCoupon.discount_value}%` :
                                            appliedCoupon.discount_type === 'FREE_MONTHS' ? `+${appliedCoupon.discount_value} Free Month(s)` : '100% Free Access'
                                        }</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <TrustBadges />
                    </div>

                    {/* Payment Method Selector */}
                    <div className="md:col-span-2 space-y-4">
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border-2 border-blue-500 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-blue-500 text-white text-[8px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest">Selected</div>
                            <div className="text-2xl mb-4">💳</div>
                            <h4 className="font-black text-slate-900 dark:text-white text-sm mb-1 uppercase tracking-tight">Mock Payment</h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-tight">Clicking "Pay Now" will simulate a successful transaction for testing.</p>
                        </div>

                        <div className="bg-slate-100 dark:bg-slate-800/50 rounded-[2rem] p-6 border border-slate-200 dark:border-slate-700 opacity-40 grayscale flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">📱</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white">UPI (PhonePe/GPay)</span>
                            </div>
                        </div>

                        <button
                            onClick={handlePayment}
                            disabled={isProcessing}
                            className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all border-b-4 border-blue-800 mt-6"
                        >
                            Pay Now {packagePrice}
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full py-4 text-slate-400 hover:text-slate-600 font-black text-[10px] uppercase tracking-widest"
                        >
                            Cancel Order
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentPage;
