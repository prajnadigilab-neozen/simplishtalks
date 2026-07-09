import { supabase } from '../lib/supabase';
import { AccessRequest } from '../types';
import { createNotification } from './notificationService';

/**
 * Submits an access request for the SNEHI package.
 * Automatically inserts a notification for the user and all system admins.
 */
export async function submitSnehiRequest(userId: string): Promise<boolean> {
  try {
    // 1. Insert access request
    const { error: requestError } = await supabase
      .from('access_requests')
      .insert([{
        user_id: userId,
        status: 'PENDING'
      }]);

    if (requestError) {
      console.error("Error creating access request:", requestError.message);
      return false;
    }

    // 2. Notify the user
    await createNotification(
      userId,
      JSON.stringify({ en: 'Request Submitted', kn: 'ವಿನಂತಿ ಸಲ್ಲಿಸಲಾಗಿದೆ' }),
      JSON.stringify({
        en: 'Your request for SIMPLISH-SNEHI access has been submitted. Access will be granted after review.',
        kn: 'SIMPLISH-SNEHI ಪ್ರವೇಶಕ್ಕಾಗಿ ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಸಲ್ಲಿಸಲಾಗಿದೆ. ಪರಿಶೀಲನೆಯ ನಂತರ ಪ್ರವೇಶವನ್ನು ನೀಡಲಾಗುವುದು.'
      }),
      'info'
    );

    // Note: Admin notifications are automatically handled by the database trigger
    // tr_notify_admins_on_new_request to bypass client RLS insertion limits.

    return true;
  } catch (e) {
    console.error("Failed to submit SNEHI request:", e);
    return false;
  }
}

/**
 * Fetches the latest access request for a specific user to determine their status.
 */
export async function getMyAccessRequestStatus(userId: string): Promise<AccessRequest | null> {
  try {
    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .eq('user_id', userId)
      .order('request_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching my request status:", error.message);
      return null;
    }

    return data as AccessRequest;
  } catch (e) {
    console.error("Failed to check SNEHI request status:", e);
    return null;
  }
}

/**
 * Fetches all SNEHI access requests with user profiles joined (Admin only).
 */
export async function getAllAccessRequests(): Promise<AccessRequest[]> {
  try {
    const { data, error } = await supabase
      .from('access_requests')
      .select('*, profiles!user_id(full_name, phone), payments!request_id(*)')
      .order('request_date', { ascending: false });

    if (error) {
      console.error("Error fetching all access requests:", error.message);
      return [];
    }

    return (data || []) as AccessRequest[];
  } catch (e) {
    console.error("Failed to get all access requests:", e);
    return [];
  }
}

/**
 * Approves a user's SNEHI request and enables access on their profile.
 */
export async function approveAccessRequest(
  requestId: string,
  userId: string,
  adminId: string
): Promise<boolean> {
  try {
    // 1. Update access_requests status to AWAITING_PMT
    const { error: requestError } = await supabase
      .from('access_requests')
      .update({
        status: 'AWAITING_PMT',
        approved_by: adminId,
        approved_date: new Date().toISOString()
      })
      .eq('id', requestId);

    if (requestError) throw requestError;

    // 2. Notify the user to pay
    await createNotification(
      userId,
      JSON.stringify({ en: 'Approval Granted', kn: 'ಅನುಮೋದನೆ ನೀಡಲಾಗಿದೆ' }),
      JSON.stringify({
        en: 'Your request has been approved. Please complete payment to activate your access.',
        kn: 'ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ಅನುಮೋದಿಸಲಾಗಿದೆ. ಪ್ರವೇಶವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಲು ದಯವಿಟ್ಟು ಪಾವತಿಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ.'
      }),
      'success'
    );

    return true;
  } catch (e: any) {
    console.error("Failed to approve SNEHI request:", e.message);
    return false;
  }
}

/**
 * Rejects a user's SNEHI request.
 */
export async function rejectAccessRequest(
  requestId: string,
  userId: string,
  adminId: string
): Promise<boolean> {
  try {
    // 1. Update access_requests status
    const { error: requestError } = await supabase
      .from('access_requests')
      .update({
        status: 'REJECTED',
        approved_by: adminId,
        approved_date: new Date().toISOString()
      })
      .eq('id', requestId);

    if (requestError) throw requestError;

    // 2. Ensure snehi_access_enabled is FALSE
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ snehi_access_enabled: false })
      .eq('id', userId);

    if (profileError) throw profileError;

    // 3. Notify the user
    await createNotification(
      userId,
      JSON.stringify({ en: 'Access Rejected', kn: 'ವಿನಂತಿ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ' }),
      JSON.stringify({
        en: 'Your request for SIMPLISH-SNEHI access has been reviewed and rejected.',
        kn: 'SIMPLISH-SNEHI ಗಾಗಿ ನಿಮ್ಮ ವಿನಂತಿಯನ್ನು ತಿರಸ್ಕರಿಸಲಾಗಿದೆ.'
      }),
      'error'
    );

    return true;
  } catch (e: any) {
    console.error("Failed to reject SNEHI request:", e.message);
    return false;
  }
}

/**
 * Disables a user's SNEHI access (Revoke).
 */
export async function disableAccessRequest(
  requestId: string,
  userId: string,
  adminId: string
): Promise<boolean> {
  try {
    // 1. Update access_requests status
    const { error: requestError } = await supabase
      .from('access_requests')
      .update({
        status: 'DISABLED',
        approved_by: adminId,
        approved_date: new Date().toISOString()
      })
      .eq('id', requestId);

    if (requestError) throw requestError;

    // 2. Disable snehi_access_enabled on profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ snehi_access_enabled: false })
      .eq('id', userId);

    if (profileError) throw profileError;

    // 3. Notify the user
    await createNotification(
      userId,
      JSON.stringify({ en: 'Access Disabled', kn: 'ಪ್ರವೇಶವನ್ನು ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ' }),
      JSON.stringify({
        en: 'Your access to SIMPLISH-SNEHI has been disabled. Please contact support.',
        kn: 'SIMPLISH-SNEHI ಗೆ ನಿಮ್ಮ ಪ್ರವೇಶವನ್ನು ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಬೆಂಬಲವನ್ನು ಸಂಪರ್ಕಿಸಿ.'
      }),
      'warning'
    );

    return true;
  } catch (e: any) {
    console.error("Failed to disable SNEHI access:", e.message);
    return false;
  }
}

/**
 * Completes the SNEHI payment and activates user access securely.
 */
export async function completeSnehiPayment(
  userId: string,
  requestId: string,
  baseAmount: number,
  taxAmount: number,
  discountAmount: number,
  finalAmount: number,
  gateway: string,
  transactionId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('complete_snehi_payment', {
      p_user_id: userId,
      p_request_id: requestId,
      p_base_amount: Math.round(baseAmount),
      p_tax_amount: Math.round(taxAmount),
      p_discount_amount: Math.round(discountAmount),
      p_final_amount: Math.round(finalAmount),
      p_gateway: gateway,
      p_transaction_id: transactionId
    });

    if (error) throw error;

    // Create success notification
    await createNotification(
      userId,
      JSON.stringify({ en: 'Payment Captured', kn: 'ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿದೆ' }),
      JSON.stringify({
        en: 'Payment received successfully! Your SIMPLISH-SNEHI access is now active.',
        kn: 'ಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ! ನಿಮ್ಮ SIMPLISH-SNEHI ಪ್ರವೇಶ ಈಗ ಸಕ್ರಿಯವಾಗಿದೆ.'
      }),
      'success'
    );

    return !!data;
  } catch (e: any) {
    console.error("Failed to complete SNEHI payment:", e.message || e);
    return false;
  }
}

/**
 * Issues a simulated refund for a user's SNEHI payment.
 */
export async function issueSnehiRefund(
  requestId: string,
  userId: string,
  adminId: string
): Promise<boolean> {
  try {
    // 1. Update the request status to DISABLED
    const { error: reqError } = await supabase
      .from('access_requests')
      .update({ status: 'DISABLED', approved_by: adminId })
      .eq('id', requestId);
      
    if (reqError) throw reqError;

    // 2. Disable snehi_access_enabled on user's profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ snehi_access_enabled: false })
      .eq('id', userId);

    if (profileError) throw profileError;

    // 3. Update the payment transaction to REFUNDED
    const { error: paymentError } = await supabase
      .from('payments')
      .update({ payment_status: 'REFUNDED' })
      .eq('request_id', requestId);

    if (paymentError) throw paymentError;

    // 4. Create refund notification
    await createNotification(
      userId,
      JSON.stringify({ en: 'Access Refunded', kn: 'ಪ್ರವೇಶ ಮರುಪಾವತಿ ಮಾಡಲಾಗಿದೆ' }),
      JSON.stringify({
        en: 'A refund has been issued for your SNEHI subscription, and your access has been disabled.',
        kn: 'ನಿಮ್ಮ SNEHI ಚಂದಾದಾರಿಕೆಗೆ ಮರುಪಾವತಿಯನ್ನು ನೀಡಲಾಗಿದೆ ಮತ್ತು ನಿಮ್ಮ ಪ್ರವೇಶವನ್ನು ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ.'
      }),
      'warning'
    );

    return true;
  } catch (e: any) {
    console.error("Failed to issue SNEHI refund:", e.message || e);
    return false;
  }
}
