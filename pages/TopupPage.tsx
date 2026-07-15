
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../components/LanguageContext';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { validateCoupon } from '../services/discountService';
import { PackageType } from '../types';
import Logo from '../components/Logo';

const TOPUP_PACKAGES = [
  { id: 'topup_99', rs: 99, mins: 50, color: 'from-blue-500 to-indigo-600' },
  { id: 'topup_199', rs: 199, mins: 105, color: 'from-purple-500 to-pink-600', popular: true },
  { id: 'topup_299', rs: 299, mins: 160, color: 'from-orange-500 to-red-600' },
];

const TopupPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { session, initialized } = useAppStore();
  const [selected, setSelected] = useState(TOPUP_PACKAGES[1]);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const getDiscountedPrice = (base: number) => {
    if (!appliedCoupon) return base;
    if (appliedCoupon.discount_type === 'PERCENTAGE') {
      return Math.round(base * (1 - appliedCoupon.discount_value / 100));
    } else if (appliedCoupon.discount_type === 'FREE_ACCESS') {
      return 0;
    }
    return base;
  };

  const handleApplyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim() || !session?.id) return;
    setIsValidatingCoupon(true);
    try {
      const res = await validateCoupon(couponCode, session.id, 'TOPUP', selected.rs);
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
    setCouponCode('');
    setCouponError('');
  };

  // Restrict to SNEHI/BOTH users who have SNEHI access approved
  React.useEffect(() => {
    if (initialized && session) {
      const isSnehiOrBoth = session.packageType === PackageType.SNEHI || session.packageType === PackageType.BOTH;
      const hasSnehiAccess = session.snehiAccessEnabled === true;
      if (!isSnehiOrBoth || !hasSnehiAccess) {
        navigate('/dashboard');
      }
    }
  }, [session, initialized, navigate]);

  const handlePayment = async () => {
    if (!session?.id) return;
    setProcessing(true);
    
    try {
      // Simulate Payment Delay
      await new Promise(r => setTimeout(r, 1500));

      const finalPayable = getDiscountedPrice(selected.rs);

      // Call secure topup RPC
      const { data, error: topupError } = await supabase.rpc('process_user_topup_v2', {
        p_user_id: session.id,
        p_amount: selected.rs, // original amount
        p_minutes: selected.mins,
        p_coupon_code: appliedCoupon ? appliedCoupon.coupon_code : null
      });

      if (topupError) throw topupError;

      // 2. Fetch updated profile stats to synchronize the Zustand store state securely
      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .select('agent_credits, topup_amount')
        .eq('id', session.id)
        .single();

      if (profileError) throw profileError;

      // 3. Update Local Store
      useAppStore.setState({ 
        session: { 
          ...session, 
          agentCredits: updatedProfile?.agent_credits || 0,
          topupAmount: updatedProfile?.topup_amount || 0
        } 
      });

      setSuccess(true);
      setTimeout(() => navigate('/talk'), 3000);
    } catch (err: any) {
      console.error('Topup failed:', err);
      alert(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center text-5xl mb-6 shadow-lg animate-bounce">
          ✓
        </div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-4 uppercase tracking-tighter">
          Topup Successful!
        </h1>
        <p className="text-slate-600 dark:text-slate-400 font-bold mb-8">
          {selected.mins} minutes have been added to your account.
          <br />Redirecting you back to Live Talk...
        </p>
        <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 animate-progress origin-left"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center py-12 px-4 md:px-8">
      <div className="max-w-4xl w-full">
        <header className="flex flex-col items-center mb-12 text-center">
          <Logo className="mb-6 scale-125" />
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter">
            Instant Topup
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold max-w-md">
            Out of time? Get back to practicing with Namma Simplish Meshtru in seconds.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {TOPUP_PACKAGES.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => {
                setSelected(pkg);
                // Clear active coupon if not eligible for new package amount
                if (appliedCoupon) {
                  handleRemoveCoupon();
                }
              }}
              className={`relative cursor-pointer group transition-all duration-300 ${
                selected.id === pkg.id 
                  ? 'scale-105 z-10' 
                  : 'scale-100 opacity-80 hover:opacity-100'
              }`}
            >
              {pkg.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-blue-900 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg z-20 whitespace-nowrap">
                  Most Popular
                </div>
              )}
              
              <div className={`h-full bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border-4 transition-all ${
                selected.id === pkg.id 
                  ? 'border-blue-600 shadow-2xl dark:border-blue-500' 
                  : 'border-transparent hover:border-slate-200 dark:hover:border-slate-800'
              }`}>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${pkg.color} flex items-center justify-center text-3xl mb-6 shadow-md text-white`}>
                  ⚡
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1 uppercase tracking-tighter">
                  {pkg.mins} Mins
                </h3>
                <p className="text-slate-400 font-bold text-sm mb-6">Talk Pack</p>
                
                <div className="flex items-baseline gap-1 mb-8">
                  {appliedCoupon && appliedCoupon.discount_type !== 'FREE_MONTHS' && (
                    <span className="text-2xl font-bold line-through text-slate-400 mr-2">₹{pkg.rs}</span>
                  )}
                  <span className="text-4xl font-black text-slate-900 dark:text-white">₹{getDiscountedPrice(pkg.rs)}</span>
                  <span className="text-slate-400 font-bold text-sm">/ one-time</span>
                </div>

                <div className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all text-center ${
                  selected.id === pkg.id 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  Selected
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Coupon Code section */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 mb-8 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="text-3xl bg-blue-50 dark:bg-blue-900/30 p-3 rounded-2xl">🎟️</span>
              <div>
                <h4 className="text-lg font-black text-blue-900 dark:text-blue-300 uppercase tracking-tight">Have a Coupon Code?</h4>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Apply a promo code to discount your top-up plan</p>
              </div>
            </div>
            <div className="flex-1 max-w-md w-full">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  disabled={!!appliedCoupon || isValidatingCoupon}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter Coupon Code (e.g. STUDENT50)"
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-2xl text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                {appliedCoupon ? (
                  <button
                    onClick={handleRemoveCoupon}
                    className="px-6 py-3 bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400 rounded-2xl text-xs font-black uppercase hover:bg-red-100 dark:hover:bg-red-950/40 transition-all cursor-pointer border border-red-200 dark:border-red-900/35"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    onClick={handleApplyCoupon}
                    disabled={isValidatingCoupon || !couponCode.trim()}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
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
                      appliedCoupon.discount_type === 'FREE_ACCESS' ? '100% Free' : 'N/A'
                    }</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-8 md:p-12 shadow-xl border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                Order Summary
              </h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold">
                You are adding <span className="text-blue-600">{selected.mins} minutes</span> of high-quality Live Talk time.
                {appliedCoupon && (
                  <span className="block text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                    Coupon ({appliedCoupon.coupon_code}) active: Saved ₹{selected.rs - getDiscountedPrice(selected.rs)}
                  </span>
                )}
              </p>
            </div>
            
            <button
              onClick={handlePayment}
              disabled={processing}
              className="w-full md:w-auto min-w-[240px] bg-slate-900 dark:bg-white text-white dark:text-slate-900 h-16 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-3 border-current border-t-transparent rounded-full animate-spin" />
                  Processing...
                </>
              ) : `Pay ₹${getDiscountedPrice(selected.rs)} Now`}
            </button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-wrap justify-center gap-6">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="text-lg">🛡️</span> Secure Payment
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="text-lg">⚡</span> Instant Activation
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <span className="text-lg">📞</span> 24/7 Support
            </span>
          </div>
        </div>

        <button 
          onClick={() => navigate('/talk')}
          className="mt-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          ← Cancel and go back
        </button>
      </div>

      <style>{`
        @keyframes progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .animate-progress {
          animation: progress 3s linear forwards;
        }
      `}</style>
    </div>
  );
};

export default TopupPage;
