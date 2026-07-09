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
      
      // Also register a custom developer event in window so frontend can display a toast helper
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('dev-otp-sent', { detail: { phone, otp } });
        window.dispatchEvent(event);
      }
      
      return { success: true, otp };
    }

    // ── ONLY PATH: Invoke server-side Supabase Database RPC Proxy ───────────────────
    // The SMS gateway (smsgatewayhub.com) does not support HTTPS, so it cannot be
    // called directly from the browser (mixed-content block). All requests must go
    // through the Supabase database RPC which uses plain HTTP internally.
    console.log("[SMSGateWayHub] Attempting server-side RPC proxy send...");
    const { data, error: rpcError } = await supabase.rpc('send_sms_via_gateway', {
      phone,
      message,
      template_id: templateId,
      peid: SMSGATEWAYHUB_PEID,
      api_key: SMSGATEWAYHUB_API_KEY,
      sender_id: SMSGATEWAYHUB_SENDER_ID,
      channel: SMSGATEWAYHUB_CHANNEL
    });

    if (rpcError) {
      console.error("[SMSGateWayHub] RPC call error:", rpcError);
      return { success: false, error: 'OTP service unavailable. Please try again later.' };
    }

    if (!data) {
      console.error("[SMSGateWayHub] RPC returned no data.");
      return { success: false, error: 'OTP service returned an empty response.' };
    }

    if (!data.success) {
      console.warn("[SMSGateWayHub] RPC proxy SQL error:", data.error);
      return { success: false, error: data.error || 'Failed to send OTP via server proxy.' };
    }

    const content = data.content;
    console.log("[SMSGateWayHub] RPC Proxy response:", content);

    if (content && (
      content.ErrorMessage === 'Success' ||
      content.status === 'Success' ||
      content.ErrorCode === '000' ||
      content.status?.toLowerCase() === 'success'
    )) {
      return { success: true, otp };
    }

    return {
      success: false,
      error: content?.ErrorMessage || 'SMS gateway rejected the request.'
    };

  } catch (error: any) {
    console.error("[SMSGateWayHub] Error sending SMS:", error);
    return { success: false, error: error.message || 'SMS service error occurred' };
  }
}
