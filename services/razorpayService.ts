/**
 * Razorpay Integration Service for Live Payments
 */

export const getRazorpayKeyId = (): string => {
  const envKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
  if (!envKey) {
    console.error("❌ VITE_RAZORPAY_KEY_ID is missing from environment variables.");
    return '';
  }
  let rawKey = envKey.trim();

  // Normalize prefix
  if (rawKey.startsWith('RZP_LIVE_')) {
    rawKey = rawKey.replace('RZP_LIVE_', 'rzp_live_');
  } else if (rawKey.startsWith('RZP_TEST_')) {
    rawKey = rawKey.replace('RZP_TEST_', 'rzp_test_');
  }

  // Remediation for Hostinger auto-uppercasing environment variable values:
  // If Hostinger converted TE82BkgxsC75Kj to TE82BKGXSC75KJ, restore exact case required by Razorpay API.
  if (rawKey.toLowerCase() === 'rzp_live_te82bkgxsc75kj') {
    rawKey = 'rzp_live_TE82BkgxsC75Kj';
  }

  return rawKey;
};

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

  const keyId = getRazorpayKeyId();
  if (!keyId) {
    if (options.onError) {
      options.onError(new Error('Razorpay Key ID (VITE_RAZORPAY_KEY_ID) is not configured in environment variables.'));
    }
    return false;
  }

  console.log("💳 Initializing Razorpay Checkout with Key ID:", keyId);

  const razorpayOptions = {
    key: keyId,
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
      console.log("✅ Razorpay payment success:", response.razorpay_payment_id);
      const paymentId = response.razorpay_payment_id || `rzp_${Date.now()}`;
      await options.onSuccess(paymentId, response);
    },
    modal: {
      onDismiss: function () {
        console.log("ℹ️ Razorpay checkout modal closed by user.");
        if (options.onDismiss) options.onDismiss();
      }
    }
  };

  const rzp = new (window as any).Razorpay(razorpayOptions);
  rzp.on('payment.failed', function (response: any) {
    console.error("❌ Razorpay Payment Failed:", response.error);
    if (options.onError) {
      let errReason = response.error?.description || response.error?.reason;
      if (!errReason || errReason.includes('undefined')) {
        errReason = 'Razorpay Key Unauthorized (401). Please check if Live Mode is activated in Razorpay Dashboard and talks.simplish.in is added under Website URLs.';
      }
      options.onError(new Error(errReason));
    }
  });

  rzp.open();
  return true;
};
