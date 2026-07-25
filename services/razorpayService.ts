/**
 * Razorpay Integration Service for Live Payments
 */

export const RAZORPAY_LIVE_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'RZP_LIVE_TE82BKGXSC75KJ';

/**
 * Dynamically loads the Razorpay Standard Checkout SDK script.
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface OpenRazorpayOptions {
  amountRupees: number;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  onSuccess: (paymentId: string, responseData: any) => Promise<void> | void;
  onDismiss?: () => void;
  onError?: (error: any) => void;
}

export const openRazorpayCheckout = async (options: OpenRazorpayOptions): Promise<boolean> => {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    if (options.onError) {
      options.onError(new Error('Failed to load Razorpay payment gateway script.'));
    }
    return false;
  }

  const razorpayOptions = {
    key: RAZORPAY_LIVE_KEY_ID,
    amount: Math.round(options.amountRupees * 100), // in Paise
    currency: 'INR',
    name: options.name || 'SIMPLISH TALKS',
    description: options.description || 'Learning Package Purchase',
    image: '/logo-new.png',
    prefill: {
      name: options.prefill?.name || '',
      contact: options.prefill?.contact || '',
      email: options.prefill?.email || ''
    },
    theme: {
      color: '#2563EB'
    },
    handler: async function (response: any) {
      const paymentId = response.razorpay_payment_id || `rzp_${Date.now()}`;
      await options.onSuccess(paymentId, response);
    },
    modal: {
      onDismiss: function () {
        if (options.onDismiss) options.onDismiss();
      }
    }
  };

  const rzp = new (window as any).Razorpay(razorpayOptions);
  rzp.on('payment.failed', function (response: any) {
    if (options.onError) {
      options.onError(response.error);
    }
  });

  rzp.open();
  return true;
};
