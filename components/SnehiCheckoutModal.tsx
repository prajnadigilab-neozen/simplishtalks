import React, { useState, useEffect } from 'react';
import { useLanguage } from '../components/LanguageContext';
import { getSystemConfig, SystemConfig } from '../services/systemConfigService';
import { completeSnehiPayment } from '../services/snehiAccessService';

interface SnehiCheckoutModalProps {
  userId: string;
  requestId: string;
  basePrice?: number;
  onClose: () => void;
  onSuccess: () => void;
}

const SnehiCheckoutModal: React.FC<SnehiCheckoutModalProps> = ({
  userId,
  requestId,
  basePrice = 499,
  onClose,
  onSuccess
}) => {
  const { t } = useLanguage();
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);
  
  // Pricing States
  const [gstPercent, setGstPercent] = useState(18);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount_percent: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  
  // Payment States
  const [gateway, setGateway] = useState<'RAZORPAY' | 'PHONEPE' | 'STRIPE'>('RAZORPAY');
  const [step, setStep] = useState<'checkout' | 'processing' | 'success' | 'error'>('checkout');
  const [txnError, setTxnError] = useState('');

  useEffect(() => {
    getSystemConfig().then(cfg => {
      if (cfg) {
        setSysConfig(cfg);
        if (cfg.gst_percentage != null) setGstPercent(Number(cfg.gst_percentage));
      }
    });
  }, []);

  const handleApplyCoupon = () => {
    setCouponError('');
    if (!couponCode.trim()) return;

    // Fetch config coupons or fall back to default approved promo coupons
    const couponsList = sysConfig?.coupons || [
      { code: 'SIMPLISH_PRO_2026', discount_percent: 20 },
      { code: 'SNEHI_FREE', discount_percent: 100 }
    ];

    const match = couponsList.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase());
    if (match) {
      setAppliedCoupon(match);
      setCouponError('');
    } else {
      setCouponError(t({ en: 'Invalid coupon code', kn: 'ಅಮಾನ್ಯ ಕೂಪನ್ ಕೋಡ್' }));
      setAppliedCoupon(null);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Computations
  const discountPercent = appliedCoupon ? appliedCoupon.discount_percent : 0;
  const discountAmount = Math.round((basePrice * discountPercent) / 100);
  const taxableAmount = Math.max(0, basePrice - discountAmount);
  const taxAmount = Math.round((taxableAmount * gstPercent) / 100);
  const finalPayable = taxableAmount + taxAmount;

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('processing');
    setTxnError('');

    // Simulate 2 second gateway response
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate simulated Gateway reference id
    const mockTxnId = `TXN-${gateway}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Map amounts to Paise for completeSnehiPayment DB columns
    const success = await completeSnehiPayment(
      userId,
      requestId,
      basePrice * 100,
      taxAmount * 100,
      discountAmount * 100,
      finalPayable * 100,
      gateway,
      mockTxnId
    );

    if (success) {
      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } else {
      setStep('error');
      setTxnError(t({ en: 'Payment failed at gateway. Please try again.', kn: 'ಪಾವತಿ ವಿಫಲವಾಗಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.' }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
        {/* Backdrop decor */}
        <div className="absolute top-0 right-0 -m-12 w-32 h-32 bg-blue-600/5 rounded-full blur-xl"></div>
        <div className="absolute bottom-0 left-0 -m-12 w-32 h-32 bg-orange-600/5 rounded-full blur-xl"></div>

        {step === 'checkout' && (
          <form onSubmit={handlePaymentSubmit} className="space-y-6 relative z-10">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Checkout</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Activate SNEHI Access</p>
              </div>
              <button 
                type="button" 
                onClick={onClose} 
                className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all text-xs"
              >
                ✕
              </button>
            </div>

            {/* Pricing breakdown */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                <span>Base Price</span>
                <span>₹{basePrice}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-green-600 font-bold">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-₹{discountAmount}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                <span>GST ({gstPercent}%)</span>
                <span>+₹{taxAmount}</span>
              </div>
              <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
              <div className="flex justify-between items-center font-black">
                <span className="text-sm text-slate-900 dark:text-white uppercase">Total Payable</span>
                <span className="text-lg text-blue-600 dark:text-blue-400">₹{finalPayable}</span>
              </div>
            </div>

            {/* Coupon Code section */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Coupon / Discount Code</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  disabled={!!appliedCoupon}
                  onChange={e => setCouponCode(e.target.value)}
                  placeholder="e.g. SIMPLISH_PRO_2026"
                  className="flex-1 px-4 py-3 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
                {appliedCoupon ? (
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="px-4 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase hover:bg-red-100 transition-all"
                  >
                    Remove
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-4 bg-blue-600 text-white rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-all active:scale-95 animate-pulse"
                  >
                    Apply
                  </button>
                )}
              </div>
              {couponError && <p className="text-[10px] text-red-500 font-bold">{couponError}</p>}
              {appliedCoupon && (
                <p className="text-[10px] text-green-600 font-bold">
                  ✓ Code applied! {appliedCoupon.discount_percent}% discount active.
                </p>
              )}
            </div>

            {/* Gateway Selection */}
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Select Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'RAZORPAY', label: 'Razorpay', icon: '💳' },
                  { id: 'PHONEPE', label: 'PhonePe', icon: '📱' },
                  { id: 'STRIPE', label: 'Stripe', icon: '🌍' }
                ].map(gw => (
                  <button
                    key={gw.id}
                    type="button"
                    onClick={() => setGateway(gw.id as any)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                      gateway === gw.id
                        ? 'border-blue-600 bg-blue-50/20 text-blue-700 dark:text-blue-400 font-black'
                        : 'border-slate-100 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <span className="text-xl">{gw.icon}</span>
                    <span className="text-[9px] uppercase tracking-wider">{gw.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pay Button */}
            <button
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 border-b-4 border-blue-800 transition-all"
            >
              Pay ₹{finalPayable} Now
            </button>
          </form>
        )}

        {step === 'processing' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 relative z-10">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <h4 className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-wider">Processing Payment...</h4>
            <p className="text-[10px] text-slate-400 font-bold">Please do not close this window or refresh the page.</p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center relative z-10 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-950 text-green-600 rounded-full flex items-center justify-center text-4xl animate-bounce">
              ✓
            </div>
            <h4 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Payment Successful!</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">Your SNEHI access is now completely active.</p>
          </div>
        )}

        {step === 'error' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center relative z-10 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl">
              ✕
            </div>
            <h4 className="text-lg font-black text-red-600 uppercase tracking-tight">Transaction Failed</h4>
            <p className="text-xs text-slate-500 font-bold mb-4">{txnError}</p>
            <button
              onClick={() => setStep('checkout')}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-all"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SnehiCheckoutModal;
