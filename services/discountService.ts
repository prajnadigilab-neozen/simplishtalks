import { supabase } from '../lib/supabase';
import { DiscountMaster, UserDiscountUsage, DiscountAuditLog, DiscountAnalytics } from '../types';

/**
 * Validates a coupon code for a specific user and purchase type.
 * Calls the secure validate_coupon RPC.
 */
export const validateCoupon = async (
  code: string,
  userId: string,
  purchaseType: 'NEW' | 'RENEWAL' | 'TOPUP',
  originalPrice: number
): Promise<{
  is_valid: boolean;
  error_message: string;
  coupon_id: string | null;
  customer_type: string | null;
  coupon_code: string | null;
  discount_type: 'PERCENTAGE' | 'FREE_MONTHS' | 'FREE_ACCESS' | null;
  discount_value: number | null;
  discount_amount: number;
  final_amount: number;
}> => {
  if (!code || !code.trim()) {
    return {
      is_valid: false,
      error_message: 'Enter a coupon code',
      coupon_id: null,
      customer_type: null,
      coupon_code: null,
      discount_type: null,
      discount_value: null,
      discount_amount: 0,
      final_amount: originalPrice,
    };
  }

  try {
    const { data, error } = await supabase.rpc('validate_coupon', {
      p_coupon_code: code.trim(),
      p_user_id: userId,
      p_purchase_type: purchaseType,
      p_original_price: originalPrice,
    });

    if (error) throw error;
    if (!data || data.length === 0) {
      return {
        is_valid: false,
        error_message: 'Coupon validation failed',
        coupon_id: null,
        customer_type: null,
        coupon_code: null,
        discount_type: null,
        discount_value: null,
        discount_amount: 0,
        final_amount: originalPrice,
      };
    }

    return {
      is_valid: data[0].is_valid,
      error_message: data[0].error_message,
      coupon_id: data[0].coupon_id,
      customer_type: data[0].customer_type,
      coupon_code: data[0].coupon_code,
      discount_type: data[0].discount_type,
      discount_value: data[0].discount_value,
      discount_amount: Number(data[0].discount_amount || 0),
      final_amount: Number(data[0].final_amount || originalPrice),
    };
  } catch (err: any) {
    console.error('Error in validateCoupon:', err);
    return {
      is_valid: false,
      error_message: err.message || 'Validation error',
      coupon_id: null,
      customer_type: null,
      coupon_code: null,
      discount_type: null,
      discount_value: null,
      discount_amount: 0,
      final_amount: originalPrice,
    };
  }
};

/**
 * Fetches all coupons (Admin only).
 */
export const getAllCoupons = async (): Promise<DiscountMaster[]> => {
  const { data, error } = await supabase
    .from('discount_master')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as DiscountMaster[];
};

/**
 * Creates a new coupon manually (Admin only).
 */
export const createCoupon = async (
  coupon: Omit<DiscountMaster, 'id' | 'created_at' | 'updated_at' | 'current_usage'>,
  adminId: string
): Promise<DiscountMaster> => {
  const { data, error } = await supabase
    .from('discount_master')
    .insert([
      {
        ...coupon,
        coupon_code: coupon.coupon_code.trim().toUpperCase(),
        current_usage: 0,
      },
    ])
    .select();

  if (error) throw error;

  // Log audit trail
  await supabase.from('discount_audit_log').insert([
    {
      action: 'CREATE',
      coupon_code: coupon.coupon_code.toUpperCase(),
      performed_by: adminId,
      details: { coupon },
    },
  ]);

  return data[0] as DiscountMaster;
};

/**
 * Updates a coupon (Admin only).
 */
export const updateCoupon = async (
  id: string,
  updates: Partial<DiscountMaster>,
  adminId: string
): Promise<DiscountMaster> => {
  const { data, error } = await supabase
    .from('discount_master')
    .update({
      ...updates,
      coupon_code: updates.coupon_code ? updates.coupon_code.trim().toUpperCase() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select();

  if (error) throw error;

  // Log audit trail
  const action = updates.is_active === false ? 'DISABLE' : updates.is_active === true ? 'ACTIVATE' : 'UPDATE';
  await supabase.from('discount_audit_log').insert([
    {
      action,
      coupon_code: data[0].coupon_code,
      performed_by: adminId,
      details: { updates },
    },
  ]);

  return data[0] as DiscountMaster;
};

/**
 * Deletes a coupon (Admin only).
 */
export const deleteCoupon = async (
  id: string,
  code: string,
  adminId: string
): Promise<boolean> => {
  const { error } = await supabase.from('discount_master').delete().eq('id', id);
  if (error) throw error;

  // Log audit trail
  await supabase.from('discount_audit_log').insert([
    {
      action: 'DELETE',
      coupon_code: code,
      performed_by: adminId,
      details: { id },
    },
  ]);

  return true;
};

/**
 * Generates unique, unpredictable alphanumeric suffixes.
 * Uses a secure cryptographic random number generator.
 * Creates multiple hyphen-separated segments of unique characters.
 * Excludes confusing characters: O, 0, I, 1, L.
 */
const generateUnpredictableSuffix = (segments: number = 2, segmentLength: number = 5): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXY3456789';
  const totalLength = segments * segmentLength;
  const randomValues = new Uint32Array(totalLength);
  window.crypto.getRandomValues(randomValues);

  const parts: string[] = [];
  for (let s = 0; s < segments; s++) {
    let segment = '';
    for (let i = 0; i < segmentLength; i++) {
      const index = s * segmentLength + i;
      segment += chars[randomValues[index] % chars.length];
    }
    parts.push(segment);
  }
  return parts.join('-');
};

/**
 * Bulk generates coupons with configured prefix (Admin only).
 */
export const bulkGenerateCoupons = async (
  params: {
    customerType: string;
    displayName?: string;
    prefix: string;
    quantity: number;
    discountType: 'PERCENTAGE' | 'FREE_MONTHS' | 'FREE_ACCESS';
    discountValue: number;
    maxUsage: number;
    startDate?: string;
    endDate?: string;
    description?: string;
  },
  adminId: string
): Promise<DiscountMaster[]> => {
  const { customerType, displayName, prefix, quantity, discountType, discountValue, maxUsage, startDate, endDate, description } = params;

  // Fetch existing codes to prevent duplicate generation
  const { data: existingCodes } = await supabase
    .from('discount_master')
    .select('coupon_code');
  const codeSet = new Set(existingCodes?.map(c => c.coupon_code.toUpperCase()) || []);

  const cleanPrefix = prefix.trim().toUpperCase();
  const couponsToInsert: any[] = [];
  const generatedCodes: string[] = [];

  for (let i = 0; i < quantity; i++) {
    let attempts = 0;
    let newCode = '';
    do {
      const suffix = generateUnpredictableSuffix(2, 5);
      newCode = `${cleanPrefix}-${suffix}`;
      attempts++;
    } while (codeSet.has(newCode) && attempts < 100);

    codeSet.add(newCode);
    generatedCodes.push(newCode);

    couponsToInsert.push({
      customer_type: customerType,
      display_name: displayName || customerType,
      coupon_code: newCode,
      discount_type: discountType,
      discount_value: discountValue,
      description: description || `Bulk generated ${customerType} Coupon`,
      is_active: true,
      start_date: startDate || new Date().toISOString(),
      end_date: endDate || null,
      max_usage: maxUsage,
      current_usage: 0,
      created_by: adminId,
    });
  }

  // Insert in chunks of 500
  const chunkSize = 500;
  const insertedCoupons: DiscountMaster[] = [];

  for (let i = 0; i < couponsToInsert.length; i += chunkSize) {
    const chunk = couponsToInsert.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('discount_master')
      .insert(chunk)
      .select();

    if (error) throw error;
    if (data) insertedCoupons.push(...(data as DiscountMaster[]));
  }

  // Log bulk generation in audit log
  await supabase.from('discount_audit_log').insert([
    {
      action: 'CREATE',
      coupon_code: `${cleanPrefix}-BULK-GEN`,
      performed_by: adminId,
      details: {
        quantity,
        customerType,
        discountType,
        discountValue,
        generated_count: generatedCodes.length,
      },
    },
  ]);

  return insertedCoupons;
};

/**
 * Aggregates discount statistics and performance metrics (Admin only).
 */
export const getDiscountAnalytics = async (): Promise<DiscountAnalytics> => {
  // Parallel fetch coupons and usages
  const [couponsRes, usageRes] = await Promise.all([
    supabase.from('discount_master').select('*'),
    supabase.from('user_discount_usage').select('*'),
  ]);

  if (couponsRes.error) throw couponsRes.error;
  if (usageRes.error) throw usageRes.error;

  const coupons = couponsRes.data || [];
  const usages = (usageRes.data || []) as UserDiscountUsage[];

  const totalCreated = coupons.length;
  const totalUsed = usages.length;

  let revenueLost = 0;
  let revenueGenerated = 0;

  // Track coupon performance
  const performanceMap: Record<string, { count: number; revenue: number }> = {};
  // Track customer type distribution
  const customerMap: Record<string, number> = {};

  usages.forEach(use => {
    revenueLost += Number(use.discount_amount || 0);
    revenueGenerated += Number(use.final_amount || 0);

    const code = use.coupon_code.toUpperCase();
    if (!performanceMap[code]) {
      performanceMap[code] = { count: 0, revenue: 0 };
    }
    performanceMap[code].count += 1;
    performanceMap[code].revenue += Number(use.final_amount || 0);

    const cType = use.customer_type || 'GENERAL';
    customerMap[cType] = (customerMap[cType] || 0) + 1;
  });

  const topPerforming = Object.keys(performanceMap)
    .map(code => ({
      code,
      count: performanceMap[code].count,
      revenue: performanceMap[code].revenue,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const customerDistribution = Object.keys(customerMap).map(type => ({
    type,
    count: customerMap[type],
  }));

  const conversionRate = totalCreated > 0 ? (totalUsed / totalCreated) * 100 : 0;

  return {
    totalCreated,
    totalUsed,
    revenueLost: Math.round(revenueLost * 100) / 100,
    revenueGenerated: Math.round(revenueGenerated * 100) / 100,
    topPerforming,
    conversionRate: Math.round(conversionRate * 10) / 10,
    customerDistribution,
  };
};

/**
 * Fetches the user coupon application history (Admin only).
 */
export const getCouponUsageHistory = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('user_discount_usage')
    .select(`
      *,
      profiles:user_id (
        full_name,
        phone
      )
    `)
    .order('used_on', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Fetches all audit logs related to coupon modifications (Admin only).
 */
export const getDiscountAuditLogs = async (): Promise<any[]> => {
  const { data, error } = await supabase
    .from('discount_audit_log')
    .select(`
      *,
      profiles:performed_by (
        full_name,
        role
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};
