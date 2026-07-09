import { supabase } from '../lib/supabase';

/**
 * SMSGateWayHub Integration Service
 */

// Retrieve configuration from environment variables
const SMSGATEWAYHUB_API_KEY = import.meta.env.VITE_SMSGATEWAYHUB_API_KEY || import.meta.env.VITE_SMS_GATEWAY_API_KEY || '';
const SMSGATEWAYHUB_SENDER_ID = import.meta.env.VITE_SMSGATEWAYHUB_SENDER_ID || import.meta.env.VITE_SMS_GATEWAY_SENDER_ID || 'PAJDLB';
const SMSGATEWAYHUB_CHANNEL = import.meta.env.VITE_SMSGATEWAYHUB_CHANNEL || import.meta.env.VITE_SMS_GATEWAY_ROUTE || '2'; // 2 is typically transactional
const SMSGATEWAYHUB_PEID = import.meta.env.VITE_SMS_GATEWAY_PEID || '';
const SMSGATEWAYHUB_REGISTER_TEMPLATE_ID = import.meta.env.VITE_SMS_GATEWAY_TEMPLATE_ID || '';
const SMSGATEWAYHUB_RESET_TEMPLATE_ID = import.meta.env.VITE_SMS_GATEWAY_RESET_TEMPLATE_ID || '';
const SMSGATEWAYHUB_MOCK = import.meta.env.VITE_SMS_GATEWAY_MOCK === 'true';

export interface SMSSendResult {
  success: boolean;
  otp?: string;
  error?: string;
}

/**
 * Generates a random 6-digit numerical OTP.
 */
export function generate6DigitOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Sends a 6-digit OTP to the user's mobile device via SMSGateWayHub API.
 * Uses a server-side Supabase RPC proxy to prevent CORS blocks and browser network errors.
 * 
 * @param phone 10-digit phone number
 * @param otp 6-digit OTP code
 * @param type SMS template type: 'register' or 'reset'
 */
export async function sendOTPViaSMSGateWayHub(
  phone: string, 
  otp: string, 
  type: 'register' | 'reset' = 'register'
): Promise<SMSSendResult> {
  try {
    // Construct message body exactly as per DLT registered templates
    let message = '';
    let templateId = '';

    if (type === 'reset') {
      message = `To reset your SIMPLISH TALKS account password, use the code: ${otp}. - PRAJNA DIGILAB`;
      templateId = SMSGATEWAYHUB_RESET_TEMPLATE_ID;
    } else {
      message = `To complete your new user registration for SIMPLISH TALKS, use OTP ${otp}. Do not share this with anyone. - PRAJNA DIGILAB`;
      templateId = SMSGATEWAYHUB_REGISTER_TEMPLATE_ID;
    }

    // Log to console for local testing and debugging
    console.log(`[SMSGateWayHub] Sending ${type} OTP to ${phone}: ${otp}`);
    console.log(`[SMSGateWayHub] Message: "${message}"`);
    console.log(`[SMSGateWayHub] PEID: ${SMSGATEWAYHUB_PEID}, TemplateID: ${templateId}`);

    if (SMSGATEWAYHUB_MOCK || !SMSGATEWAYHUB_API_KEY) {
      console.warn("⚠️ SMSGateWayHub API key not set or Mock enabled. Using developer fallback.");
      
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('dev-otp-sent', { detail: { phone, otp } });
        window.dispatchEvent(event);
      }
      
      return { success: true, otp };
    }

    // ── Edge Function Proxy (Deno fetch = full HTTPS support, no browser CORS) ──────
    // The database RPC (pg http extension) fails TLS handshake with smsgatewayhub.com.
    // The Supabase Edge Function uses Deno's native fetch which handles HTTPS properly.
    // Credentials (API key etc.) are stored securely as Supabase Secrets, never in the bundle.
    console.log("[SMSGateWayHub] Invoking send-sms Edge Function...");
    const { data: fnData, error: fnError } = await supabase.functions.invoke('send-sms', {
      body: { phone, otp, type }
    });

    if (fnError) {
      console.error("[SMSGateWayHub] Edge Function error:", fnError);
      return { success: false, error: 'OTP service unavailable. Please try again later.' };
    }

    console.log("[SMSGateWayHub] Edge Function response:", fnData);

    if (fnData?.success) {
      return { success: true, otp };
    }

    return {
      success: false,
      error: fnData?.error || fnData?.data?.ErrorMessage || 'SMS gateway rejected the request.'
    };

  } catch (error: any) {
    console.error("[SMSGateWayHub] Error sending SMS:", error);
    return { success: false, error: error.message || 'SMS service error occurred' };
  }
}
