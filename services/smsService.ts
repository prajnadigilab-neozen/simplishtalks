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
 * If credentials are not configured, it logs the OTP and shows a visual toast for testing.
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

    // Build the SMSGateWayHub DLT compliant API endpoint URL
    const encodedText = encodeURIComponent(message);
    let url = `https://login.smsgatewayhub.com/api/mt/SendSMS?APIKey=${SMSGATEWAYHUB_API_KEY}&senderid=${SMSGATEWAYHUB_SENDER_ID}&channel=${SMSGATEWAYHUB_CHANNEL}&DCS=0&flashsms=0&number=91${phone}&text=${encodedText}`;

    if (SMSGATEWAYHUB_PEID) {
      url += `&EntityId=${SMSGATEWAYHUB_PEID}`;
    }
    if (templateId) {
      url += `&dlttemplateid=${templateId}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("[SMSGateWayHub] Response data:", data);

    if (data.ErrorMessage === 'Success' || data.status === 'Success' || data.ErrorCode === '000' || data.status?.toLowerCase() === 'success') {
      return { success: true, otp };
    } else {
      return { success: false, error: data.ErrorMessage || 'Failed to send SMS through SMSGateWayHub' };
    }
  } catch (error: any) {
    console.error("[SMSGateWayHub] Error sending SMS:", error);
    return { success: false, error: error.message || 'SMS service error occurred' };
  }
}
