-- Migration: Add Discount & Coupon Management System
-- Date: 2026-07-15

BEGIN;

-- 1. Alter public.profiles to add customer_type
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS customer_type TEXT DEFAULT 'GENERAL';

-- 2. Create public.discount_master table
CREATE TABLE IF NOT EXISTS public.discount_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_type TEXT NOT NULL, -- e.g., 'GENERAL'
  display_name TEXT DEFAULT '',

  coupon_code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FREE_MONTHS', 'FREE_ACCESS')),
  discount_value NUMERIC NOT NULL CHECK (discount_value >= 0),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  max_usage INTEGER NOT NULL CHECK (max_usage >= 0),
  current_usage INTEGER DEFAULT 0 NOT NULL CHECK (current_usage >= 0),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for fast lookup by code
CREATE INDEX IF NOT EXISTS idx_discount_master_coupon_code ON public.discount_master(UPPER(coupon_code));

-- 3. Create public.user_discount_usage table
CREATE TABLE IF NOT EXISTS public.user_discount_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  coupon_id UUID REFERENCES public.discount_master(id) ON DELETE SET NULL,
  customer_type TEXT NOT NULL,
  coupon_code TEXT NOT NULL,
  discount_applied NUMERIC NOT NULL, -- The percentage or duration value
  purchase_type TEXT NOT NULL CHECK (purchase_type IN ('NEW', 'RENEWAL', 'TOPUP')),
  amount_before_discount NUMERIC NOT NULL CHECK (amount_before_discount >= 0),
  discount_amount NUMERIC NOT NULL CHECK (discount_amount >= 0),
  final_amount NUMERIC NOT NULL CHECK (final_amount >= 0),
  transaction_id TEXT NOT NULL,
  used_on TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for lookup by user
CREATE INDEX IF NOT EXISTS idx_user_discount_usage_user_id ON public.user_discount_usage(user_id);
-- Index to verify if a user already used a coupon
CREATE INDEX IF NOT EXISTS idx_user_discount_usage_user_code ON public.user_discount_usage(user_id, UPPER(coupon_code));

-- 4. Create public.discount_audit_log table
CREATE TABLE IF NOT EXISTS public.discount_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DISABLE', 'ACTIVATE', 'DELETE', 'APPLY')),
  coupon_code TEXT NOT NULL,
  performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ip_address TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Seed Customer Discount Matrix
INSERT INTO public.discount_master (customer_type, display_name, coupon_code, discount_type, discount_value, description, max_usage, current_usage, start_date, end_date)
VALUES 
  ('GENERAL', 'Beta Users', 'BETA50-A9X2J', 'PERCENTAGE', 50, '50% discount for Beta Users', 500, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'Students', 'STUDENT50-P4KL9', 'PERCENTAGE', 50, '50% discount for Students', 1000, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'School Bulk Purchases', 'SCHOOL60-Q7MN3', 'PERCENTAGE', 60, '60% discount for School Bulk Purchases', 100, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'College Bulk Purchases', 'COLLEGE40-Z2YX8', 'PERCENTAGE', 40, '40% discount for College Bulk Purchases', 200, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'Institutional Sales', 'INST35-W9RT2', 'PERCENTAGE', 35, '35% discount for Institutional sales', 250, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'Rural Karnataka Program', 'RURAL55-B4VL7', 'PERCENTAGE', 55, '55% discount for Rural Karnataka Program', 2000, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'Referral Program', 'REFERRAL-M8CN4', 'FREE_MONTHS', 1, '1 free month for referrals', 5000, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'Renewal Customers', 'RENEW30-X9PT1', 'PERCENTAGE', 30, '30% discount on renewals', 1000, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'Launch Promotion', 'LAUNCH50-D2QK8', 'PERCENTAGE', 50, '50% discount launch promo', 1000, 0, NOW(), NOW() + INTERVAL '365 days'),
  ('GENERAL', 'Ambassadors', 'AMB100-F7MX5', 'FREE_ACCESS', 100, 'Free access for Ambassadors / Influencers / Moderators', 100, 0, NOW(), NOW() + INTERVAL '365 days')
ON CONFLICT (coupon_code) DO NOTHING;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.discount_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_discount_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_audit_log ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- discount_master
DROP POLICY IF EXISTS "Admins manage all coupons" ON public.discount_master;
CREATE POLICY "Admins manage all coupons" ON public.discount_master
  FOR ALL USING (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

DROP POLICY IF EXISTS "Users view active coupons" ON public.discount_master;
CREATE POLICY "Users view active coupons" ON public.discount_master
  FOR SELECT USING (is_active = true AND (start_date IS NULL OR start_date <= NOW()) AND (end_date IS NULL OR end_date >= NOW()));

-- user_discount_usage
DROP POLICY IF EXISTS "Admins view all usages" ON public.user_discount_usage;
CREATE POLICY "Admins view all usages" ON public.user_discount_usage
  FOR SELECT USING (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

DROP POLICY IF EXISTS "Users view own usage" ON public.user_discount_usage;
CREATE POLICY "Users view own usage" ON public.user_discount_usage
  FOR SELECT USING (auth.uid() = user_id);

-- discount_audit_log
DROP POLICY IF EXISTS "Admins view all audit logs" ON public.discount_audit_log;
CREATE POLICY "Admins view all audit logs" ON public.discount_audit_log
  FOR SELECT USING (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

-- 8. Business Logic & Coupon Validation RPC
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_coupon_code TEXT,
  p_user_id UUID,
  p_purchase_type TEXT,
  p_original_price NUMERIC
) RETURNS TABLE (
  is_valid BOOLEAN,
  error_message TEXT,
  coupon_id UUID,
  customer_type TEXT,
  coupon_code TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC,
  final_amount NUMERIC
) AS $$
DECLARE
  v_coupon RECORD;
  v_user RECORD;
  v_is_valid BOOLEAN := TRUE;
  v_err TEXT := '';
  v_discount_amt NUMERIC := 0;
  v_final_amt NUMERIC := p_original_price;
BEGIN
  -- 1. Find coupon (case insensitive)
  SELECT * FROM public.discount_master dm
  WHERE UPPER(dm.coupon_code) = UPPER(TRIM(p_coupon_code))
  INTO v_coupon;

  IF v_coupon IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Invalid Coupon Code'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, 0::NUMERIC, p_original_price;
    RETURN;
  END IF;

  -- 2. Check active status
  IF NOT v_coupon.is_active THEN
    RETURN QUERY SELECT FALSE, 'Coupon Code Disabled'::TEXT, v_coupon.id, v_coupon.customer_type, v_coupon.coupon_code, v_coupon.discount_type, v_coupon.discount_value, 0::NUMERIC, p_original_price;
    RETURN;
  END IF;

  -- 3. Check expiration
  IF (v_coupon.start_date IS NOT NULL AND v_coupon.start_date > NOW()) OR (v_coupon.end_date IS NOT NULL AND v_coupon.end_date < NOW()) THEN
    RETURN QUERY SELECT FALSE, 'Coupon Expired'::TEXT, v_coupon.id, v_coupon.customer_type, v_coupon.coupon_code, v_coupon.discount_type, v_coupon.discount_value, 0::NUMERIC, p_original_price;
    RETURN;
  END IF;

  -- 4. Check usage limits
  IF v_coupon.current_usage >= v_coupon.max_usage THEN
    RETURN QUERY SELECT FALSE, 'Coupon Usage Limit Reached'::TEXT, v_coupon.id, v_coupon.customer_type, v_coupon.coupon_code, v_coupon.discount_type, v_coupon.discount_value, 0::NUMERIC, p_original_price;
    RETURN;
  END IF;

  -- Get User info
  SELECT * FROM public.profiles p WHERE p.id = p_user_id INTO v_user;
  IF v_user IS NULL THEN
    RETURN QUERY SELECT FALSE, 'User Profile Not Found'::TEXT, v_coupon.id, v_coupon.customer_type, v_coupon.coupon_code, v_coupon.discount_type, v_coupon.discount_value, 0::NUMERIC, p_original_price;
    RETURN;
  END IF;

  -- 5. Verify user eligibility
  IF v_coupon.customer_type != 'GENERAL' THEN
    -- Check specific cases:
    -- 'Renewal Customers' -> must have had previous packages
    IF v_coupon.customer_type = 'Renewal Customers' AND v_user.package_type = 'NONE' THEN
      v_is_valid := FALSE;
      v_err := 'Only applicable for Renewal Customers';
    -- 'Ambassadors' -> includes MODERATOR role, SUPER_ADMIN role or matching customer_type
    ELSIF v_coupon.customer_type = 'Ambassadors' AND v_user.role NOT IN ('MODERATOR', 'SUPER_ADMIN') AND v_user.customer_type != 'Ambassadors' THEN
      v_is_valid := FALSE;
      v_err := 'Only applicable for Ambassadors/Moderators';
    -- Other customer types check exact string match
    ELSIF v_coupon.customer_type != 'Renewal Customers' AND v_coupon.customer_type != 'Ambassadors' AND v_user.customer_type != v_coupon.customer_type THEN
      v_is_valid := FALSE;
      v_err := 'Your profile is not eligible for this coupon';
    END IF;
  END IF;

  -- 6. Check if coupon was already used by this user (prevent duplicate redemption)
  IF v_is_valid AND EXISTS (
    SELECT 1 FROM public.user_discount_usage udu
    WHERE udu.user_id = p_user_id AND UPPER(udu.coupon_code) = UPPER(TRIM(p_coupon_code))
  ) THEN
    v_is_valid := FALSE;
    v_err := 'Already Used';
  END IF;

  -- 7. Compute final pricing if valid
  IF v_is_valid THEN
    IF v_coupon.discount_type = 'PERCENTAGE' THEN
      v_discount_amt := ROUND((p_original_price * v_coupon.discount_value) / 100.0, 2);
      v_final_amt := p_original_price - v_discount_amt;
    ELSIF v_coupon.discount_type = 'FREE_ACCESS' THEN
      v_discount_amt := p_original_price;
      v_final_amt := 0;
    ELSIF v_coupon.discount_type = 'FREE_MONTHS' THEN
      v_discount_amt := 0; -- No price reduction
      v_final_amt := p_original_price;
    END IF;
  END IF;

  RETURN QUERY SELECT 
    v_is_valid, 
    v_err::TEXT, 
    v_coupon.id, 
    v_coupon.customer_type, 
    v_coupon.coupon_code, 
    v_coupon.discount_type, 
    v_coupon.discount_value, 
    v_discount_amt, 
    v_final_amt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Fulfill Snehi Payment v2 (Supporting optional coupon code)
CREATE OR REPLACE FUNCTION public.complete_snehi_payment_v2(
  p_user_id UUID,
  p_request_id UUID,
  p_base_amount INT,
  p_tax_amount INT,
  p_discount_amount INT,
  p_final_amount INT,
  p_gateway TEXT,
  p_transaction_id TEXT,
  p_coupon_code TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_val RECORD;
BEGIN
  -- Select request status with lock
  SELECT status INTO v_current_status
  FROM public.access_requests
  WHERE id = p_request_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_current_status IS DISTINCT FROM 'AWAITING_PMT' THEN
    RAISE EXCEPTION 'Request status must be AWAITING_PMT, found: %', v_current_status;
  END IF;

  -- Coupon Application logic
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    -- Validate Coupon
    SELECT * FROM public.validate_coupon(p_coupon_code, p_user_id, 'NEW', (p_base_amount::numeric / 100.0)) INTO v_val;
    IF NOT v_val.is_valid THEN
      RAISE EXCEPTION 'Coupon validation failed: %', v_val.error_message;
    END IF;

    -- Update coupon usage
    UPDATE public.discount_master
    SET current_usage = current_usage + 1, updated_at = NOW()
    WHERE id = v_val.coupon_id;

    -- Record discount usage
    INSERT INTO public.user_discount_usage (
      user_id, coupon_id, customer_type, coupon_code, discount_applied, 
      purchase_type, amount_before_discount, discount_amount, final_amount, transaction_id
    ) VALUES (
      p_user_id, v_val.coupon_id, v_val.customer_type, v_val.coupon_code, v_val.discount_value,
      'NEW', (p_base_amount::numeric / 100.0), (p_discount_amount::numeric / 100.0), (p_final_amount::numeric / 100.0), p_transaction_id
    );

    -- Log Audit
    INSERT INTO public.discount_audit_log (action, coupon_code, performed_by, details)
    VALUES ('APPLY', v_val.coupon_code, p_user_id, jsonb_build_object('transaction_id', p_transaction_id, 'purchase_type', 'NEW', 'amount', p_final_amount));
  END IF;

  -- 1. Insert successful payment log
  INSERT INTO public.payments (
    user_id,
    request_id,
    base_amount,
    tax_amount,
    discount_amount,
    final_payable_amount,
    payment_status,
    transaction_id,
    payment_gateway
  ) VALUES (
    p_user_id,
    p_request_id,
    p_base_amount,
    p_tax_amount,
    p_discount_amount,
    p_final_amount,
    'SUCCESS',
    p_transaction_id,
    p_gateway
  );

  -- 2. Update access request status to ACTIVE
  UPDATE public.access_requests
  SET status = 'ACTIVE', approved_date = NOW()
  WHERE id = p_request_id;

  -- 3. Enable SNEHI access on user profile
  -- If coupon is FREE_MONTHS, we extend by 1 additional month (total 60 days duration)
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' AND v_val.discount_type = 'FREE_MONTHS' THEN
    UPDATE public.profiles
    SET 
      snehi_access_enabled = TRUE,
      package_end_date = COALESCE(package_end_date, NOW()) + INTERVAL '60 days'
    WHERE id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET 
      snehi_access_enabled = TRUE,
      package_end_date = COALESCE(package_end_date, NOW()) + INTERVAL '30 days'
    WHERE id = p_user_id;
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Pay Package with Wallet v2 (Supporting optional coupon code)
CREATE OR REPLACE FUNCTION public.pay_package_with_wallet_v2(
  p_user_id UUID,
  p_package_type TEXT,
  p_amount NUMERIC,
  p_coupon_code TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_topup NUMERIC;
  v_new_package_type TEXT;
  v_added_credits INTEGER;
  v_current_credits INTEGER;
  v_now TIMESTAMPTZ := NOW();
  v_current_end TIMESTAMPTZ;
  v_base_date TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  v_cost_per_min NUMERIC;
  
  v_val RECORD;
  v_discount_amt NUMERIC := 0;
  v_payable_amt NUMERIC := p_amount;
  v_txn_id TEXT;
  v_is_free_months BOOLEAN := FALSE;
  v_free_months_val INTEGER := 0;
BEGIN
  -- Check Auth
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get user current topup_amount
  SELECT topup_amount, agent_credits, package_end_date INTO v_current_topup, v_current_credits, v_current_end
  FROM public.profiles
  WHERE id = p_user_id;

  -- Validate coupon
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    SELECT * FROM public.validate_coupon(p_coupon_code, p_user_id, 'NEW', p_amount) INTO v_val;
    IF NOT v_val.is_valid THEN
      RAISE EXCEPTION 'Coupon validation failed: %', v_val.error_message;
    END IF;

    v_discount_amt := v_val.discount_amount;
    v_payable_amt := v_val.final_amount;

    IF v_val.discount_type = 'FREE_MONTHS' THEN
      v_is_free_months := TRUE;
      v_free_months_val := v_val.discount_value::integer;
    END IF;
  END IF;

  IF v_current_topup IS NULL OR v_current_topup < v_payable_amt THEN
    RAISE EXCEPTION 'Insufficient wallet balance.';
  END IF;

  -- Resolve upgraded package type
  SELECT package_type INTO v_new_package_type FROM public.profiles WHERE id = p_user_id;
  IF v_new_package_type = 'BOTH' OR p_package_type = 'BOTH' THEN
    v_new_package_type := 'BOTH';
  ELSIF (v_new_package_type = 'TALKS' AND p_package_type = 'SNEHI') OR (v_new_package_type = 'SNEHI' AND p_package_type = 'TALKS') THEN
    v_new_package_type := 'BOTH';
  ELSE
    v_new_package_type := p_package_type;
  END IF;

  -- Calculate credits if SNEHI
  v_added_credits := 0;
  IF p_package_type = 'SNEHI' THEN
    SELECT cost_per_minute INTO v_cost_per_min FROM public.system_config WHERE id = 1;
    IF v_cost_per_min IS NULL OR v_cost_per_min <= 0 THEN
      v_cost_per_min := 2.0;
    END IF;
    v_added_credits := floor(v_payable_amt / v_cost_per_min);
  END IF;

  -- Calculate new end date
  v_base_date := COALESCE(v_current_end, v_now);
  IF v_base_date < v_now THEN
    v_base_date := v_now;
  END IF;
  
  -- Handle free months extension
  IF v_is_free_months THEN
    v_new_end := v_base_date + INTERVAL '30 days' + (v_free_months_val || ' months')::INTERVAL;
  ELSE
    v_new_end := v_base_date + INTERVAL '30 days';
  END IF;

  -- Update Profile
  UPDATE public.profiles
  SET
    topup_amount = topup_amount - v_payable_amt,
    package_type = v_new_package_type,
    package_status = 'ACTIVE',
    package_start_date = v_now,
    package_end_date = v_new_end,
    agent_credits = COALESCE(agent_credits, 0) + v_added_credits
  WHERE id = p_user_id;

  -- Generate fake Txn ID for internal logs
  v_txn_id := 'TXN-WL-' || UPPER(SUBSTRING(md5(random()::text), 1, 9));

  -- Log Package Transaction
  INSERT INTO public.package_transactions (
    user_id, package_type, amount, payment_provider
  ) VALUES (
    p_user_id, p_package_type, v_payable_amt, 'wallet_topup_balance'
  );

  -- Record Coupon Usage
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    UPDATE public.discount_master
    SET current_usage = current_usage + 1, updated_at = NOW()
    WHERE id = v_val.coupon_id;

    INSERT INTO public.user_discount_usage (
      user_id, coupon_id, customer_type, coupon_code, discount_applied, 
      purchase_type, amount_before_discount, discount_amount, final_amount, transaction_id
    ) VALUES (
      p_user_id, v_val.coupon_id, v_val.customer_type, v_val.coupon_code, v_val.discount_value,
      'NEW', p_amount, v_discount_amt, v_payable_amt, v_txn_id
    );

    INSERT INTO public.discount_audit_log (action, coupon_code, performed_by, details)
    VALUES ('APPLY', v_val.coupon_code, p_user_id, jsonb_build_object('transaction_id', v_txn_id, 'purchase_type', 'NEW', 'amount', v_payable_amt));
  END IF;

END;
$$;

-- 11. Dev Mock Payment Fulfillment v2 (Supporting optional coupon code)
CREATE OR REPLACE FUNCTION public.dev_mock_payment_fulfillment_v2(
  p_user_id UUID,
  p_package_type TEXT,
  p_package_status TEXT,
  p_package_start_date TIMESTAMPTZ,
  p_package_end_date TIMESTAMPTZ,
  p_agent_credits INTEGER,
  p_amount NUMERIC,
  p_coupon_code TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_val RECORD;
  v_discount_amt NUMERIC := 0;
  v_payable_amt NUMERIC := p_amount;
  v_txn_id TEXT;
  v_final_end TIMESTAMPTZ := p_package_end_date;
BEGIN
  -- Strict Check: Only allow users to fulfill for their own UUID.
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only fulfill mock payments for your own account.';
  END IF;

  -- Validate coupon
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    SELECT * FROM public.validate_coupon(p_coupon_code, p_user_id, 'NEW', p_amount) INTO v_val;
    IF NOT v_val.is_valid THEN
      RAISE EXCEPTION 'Coupon validation failed: %', v_val.error_message;
    END IF;

    v_discount_amt := v_val.discount_amount;
    v_payable_amt := v_val.final_amount;

    -- Apply FREE_MONTHS duration extension
    IF v_val.discount_type = 'FREE_MONTHS' THEN
      v_final_end := p_package_end_date + (v_val.discount_value || ' months')::INTERVAL;
    END IF;
  END IF;

  -- 1. Fulfill Profile Package
  UPDATE public.profiles
  SET 
    package_type = p_package_type,
    package_status = p_package_status,
    package_start_date = p_package_start_date,
    package_end_date = v_final_end,
    agent_credits = p_agent_credits
  WHERE id = p_user_id;

  v_txn_id := 'TXN-MC-' || UPPER(SUBSTRING(md5(random()::text), 1, 9));

  -- 2. Log Transaction
  INSERT INTO public.package_transactions (
    user_id, package_type, amount, payment_provider
  ) VALUES (
    p_user_id, p_package_type, v_payable_amt, 'simulated_rpc_backend'
  );

  -- 3. Record Coupon Usage
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    UPDATE public.discount_master
    SET current_usage = current_usage + 1, updated_at = NOW()
    WHERE id = v_val.coupon_id;

    INSERT INTO public.user_discount_usage (
      user_id, coupon_id, customer_type, coupon_code, discount_applied, 
      purchase_type, amount_before_discount, discount_amount, final_amount, transaction_id
    ) VALUES (
      p_user_id, v_val.coupon_id, v_val.customer_type, v_val.coupon_code, v_val.discount_value,
      'NEW', p_amount, v_discount_amt, v_payable_amt, v_txn_id
    );

    INSERT INTO public.discount_audit_log (action, coupon_code, performed_by, details)
    VALUES ('APPLY', v_val.coupon_code, p_user_id, jsonb_build_object('transaction_id', v_txn_id, 'purchase_type', 'NEW', 'amount', v_payable_amt));
  END IF;

END;
$$;

-- 12. Process User Topup v2 (Supporting optional coupon code)
CREATE OR REPLACE FUNCTION public.process_user_topup_v2(
  p_user_id UUID,
  p_amount NUMERIC,
  p_minutes INTEGER,
  p_coupon_code TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_topup_days INTEGER;
  v_current_end TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_base_date TIMESTAMPTZ;
  v_new_end TIMESTAMPTZ;
  
  v_val RECORD;
  v_discount_amt NUMERIC := 0;
  v_payable_amt NUMERIC := p_amount;
  v_txn_id TEXT;
  v_free_months_val INTEGER := 0;
  v_is_free_months BOOLEAN := FALSE;
BEGIN
  -- Check Auth
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate coupon
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    SELECT * FROM public.validate_coupon(p_coupon_code, p_user_id, 'TOPUP', p_amount) INTO v_val;
    IF NOT v_val.is_valid THEN
      RAISE EXCEPTION 'Coupon validation failed: %', v_val.error_message;
    END IF;

    v_discount_amt := v_val.discount_amount;
    v_payable_amt := v_val.final_amount;

    IF v_val.discount_type = 'FREE_MONTHS' THEN
      v_is_free_months := TRUE;
      v_free_months_val := v_val.discount_value::integer;
    END IF;
  END IF;

  -- Fetch topup_duration_days from system_config
  SELECT topup_duration_days INTO v_topup_days FROM public.system_config WHERE id = 1;
  IF v_topup_days IS NULL THEN
    v_topup_days := 30;
  END IF;

  -- Calculate new package_end_date
  SELECT package_end_date INTO v_current_end FROM public.profiles WHERE id = p_user_id;
  v_base_date := COALESCE(v_current_end, v_now);
  IF v_base_date < v_now THEN
    v_base_date := v_now;
  END IF;
  
  v_new_end := v_base_date + (v_topup_days || ' days')::INTERVAL;
  IF v_is_free_months THEN
    v_new_end := v_new_end + (v_free_months_val || ' months')::INTERVAL;
  END IF;

  -- Update Profile
  UPDATE public.profiles
  SET
    agent_credits = COALESCE(agent_credits, 0) + p_minutes,
    topup_amount = COALESCE(topup_amount, 0) + v_payable_amt,
    package_end_date = v_new_end
  WHERE id = p_user_id;

  v_txn_id := 'TXN-TP-' || UPPER(SUBSTRING(md5(random()::text), 1, 9));

  -- Log Transaction
  INSERT INTO public.topup_transactions (
    user_id, amount, minutes, status
  ) VALUES (
    p_user_id, v_payable_amt, p_minutes, 'SUCCESS'
  );

  -- Record Coupon Usage
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    UPDATE public.discount_master
    SET current_usage = current_usage + 1, updated_at = NOW()
    WHERE id = v_val.coupon_id;

    INSERT INTO public.user_discount_usage (
      user_id, coupon_id, customer_type, coupon_code, discount_applied, 
      purchase_type, amount_before_discount, discount_amount, final_amount, transaction_id
    ) VALUES (
      p_user_id, v_val.coupon_id, v_val.customer_type, v_val.coupon_code, v_val.discount_value,
      'TOPUP', p_amount, v_discount_amt, v_payable_amt, v_txn_id
    );

    INSERT INTO public.discount_audit_log (action, coupon_code, performed_by, details)
    VALUES ('APPLY', v_val.coupon_code, p_user_id, jsonb_build_object('transaction_id', v_txn_id, 'purchase_type', 'TOPUP', 'amount', v_payable_amt));
  END IF;

END;
$$;

COMMIT;
