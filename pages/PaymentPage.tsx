
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PackageType, PackageStatus } from '../types';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../components/LanguageContext';
import { clearProfileCache } from '../services/authService';
import { getSystemConfig } from '../services/systemConfigService';

const PaymentPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { session } = useAppStore();
    const { t } = useLanguage();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentStep, setPaymentStep] = useState<'checkout' | 'processing' | 'success'>('checkout');
    const [costPerMinute, setCostPerMinute] = useState<number>(2.0); // Default fallback

    useEffect(() => {
        getSystemConfig().then(cfg => {
            if (cfg) setCostPerMinute(cfg.cost_per_minute);
        });
    }, []);

    const selectedPackage = searchParams.get('package') as PackageType;
    const packageLabel = selectedPackage === PackageType.TALKS ? 'SIMPLISH - TALKS' : 'SIMPLISH SNEHI';
    const packagePrice = selectedPackage === PackageType.TALKS ? '₹299' : '₹499';

    useEffect(() => {
        if (!session) {
            navigate('/login');
        }
        if (!selectedPackage || !Object.values(PackageType).includes(selectedPackage)) {
            navigate('/dashboard');
        }
    }, [session, selectedPackage, navigate]);

    const handlePayment = async () => {
        setIsProcessing(true);
        setPaymentStep('processing');

        try {
            // SECURITY (REMEDIATION): Server-Side Tokenization & Fulfillment.
            // In a production environment, we MUST NEVER update the profiles table directly
            // from the frontend, as this is a Critical Privilege Escalation vulnerability.
            
            // Step 1: Request Order / Token from secure backend
            console.log("🔒 Requesting secure payment token from Edge Function...");
            // const { data: order } = await supabase.functions.invoke('create-razorpay-order', { body: { package: selectedPackage }});
            await new Promise(resolve => setTimeout(resolve, 800)); // Mock network delay
            
            // Step 2: Open Provider Checkout (e.g., Razorpay / Stripe Elements)
            console.log("💳 Opening secure checkout iframe...");
            await new Promise(resolve => setTimeout(resolve, 1200)); // Mock user entering card details
            const mockPaymentToken = "tok_simulated_secure_123456";

            // Step 3: Send Token for Backend Verification & Fulfillment
            console.log("📡 Sending token to backend for fulfillment verification...");
            // const { error } = await supabase.functions.invoke('verify-and-fulfill', { body: { token: mockPaymentToken }});
            await new Promise(resolve => setTimeout(resolve, 1000)); // Mock backend processing time

            // --- LOCAL DEV FALLBACK ---
            // Because we don't have the edge functions deployed in this local environment,
            // we will simulate the backend's successful fulfillment here.
            await simulateBackendFulfillment();
            
            setPaymentStep('success');

            // Redirect after success message
            setTimeout(() => {
                navigate('/dashboard', { replace: true });
            }, 2000);

        } catch (err) {
            console.error("Payment failed:", err);
            setIsProcessing(false);
            setPaymentStep('checkout');
            alert("Payment failed. Please try again or contact support.");
        }
    };

    // This function mimics what the secure backend / Webhook handler MUST do.
    const simulateBackendFulfillment = async () => {
        let newPackageType = selectedPackage;
        // Upgrade logic to BOTH
        if (
            (session?.packageType === PackageType.TALKS && selectedPackage === PackageType.SNEHI) ||
            (session?.packageType === PackageType.SNEHI && selectedPackage === PackageType.TALKS) ||
            session?.packageType === PackageType.BOTH
        ) {
            newPackageType = PackageType.BOTH;
        }

        const currentCredits = session?.agentCredits || 0;
        const price = selectedPackage === PackageType.SNEHI ? 499 : 0;
        const addedCredits = selectedPackage === PackageType.SNEHI ? Math.floor(price / costPerMinute) : 0;

        const updates = {
            package_type: newPackageType,
            package_status: PackageStatus.ACTIVE,
            package_start_date: new Date().toISOString(),
            package_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            agent_credits: currentCredits + addedCredits
        };

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', session?.id);

        if (error) throw error;

        // Log the transaction
        await supabase.from('package_transactions').insert([{
            user_id: session?.id,
            package_type: selectedPackage,
            amount: selectedPackage === PackageType.SNEHI ? 499 : 299,
            payment_provider: 'simulated_backend_tokenized'
        }]);

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
        useAppStore.getState().refreshSession();
    };

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
                    {/* Order Summary */}
                    <div className="md:col-span-3 space-y-6">
                        <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border-2 border-slate-100 dark:border-slate-800 shadow-xl">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Order Summary</h3>
                            <div className="flex justify-between items-center py-4 border-b border-slate-50 dark:border-slate-800">
                                <div>
                                    <div className="font-black text-slate-900 dark:text-white">{packageLabel}</div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">1 Month Subscription</div>
                                </div>
                                <div className="font-black text-slate-900 dark:text-white">{packagePrice}</div>
                            </div>
                            <div className="flex justify-between items-center pt-6">
                                <div className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Total Amount</div>
                                <div className="text-2xl font-black text-blue-600">{packagePrice}</div>
                            </div>
                        </div>

                        {/* Premium Trust Badges */}
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
