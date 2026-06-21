-- ==========================================
-- REFUNDS, PRICING & TRANSACTION MANAGEMENT
-- ==========================================

-- 1. Alter System Config Table to Add Pricing & Duration Fields
ALTER TABLE public.system_config ADD COLUMN IF NOT EXISTS subscription_price NUMERIC DEFAULT 99.0;
ALTER TABLE public.system_config ADD COLUMN IF NOT EXISTS topup_duration_days INTEGER DEFAULT 30;

-- Update seeds/defaults
UPDATE public.system_config 
SET subscription_price = 99.0, topup_duration_days = 30
WHERE id = 1;

-- 2. Create Refunds Table
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.topup_transactions(id) ON DELETE CASCADE,
  refund_amount NUMERIC NOT NULL,
  refund_type TEXT NOT NULL CHECK (refund_type IN ('full', 'partial')),
  reason_category TEXT NOT NULL CHECK (reason_category IN (
    'Duplicate payment / Charged twice',
    'Order cancelled by customer',
    'Other'
  )),
  reason_notes TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own refunds" ON public.refunds;
CREATE POLICY "Users can view own refunds" ON public.refunds
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own refunds" ON public.refunds;
CREATE POLICY "Users can insert own refunds" ON public.refunds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage all refunds" ON public.refunds;
CREATE POLICY "Admins can manage all refunds" ON public.refunds
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  );

-- 3. Create pay_package_with_wallet RPC
CREATE OR REPLACE FUNCTION pay_package_with_wallet(
  p_user_id UUID,
  p_package_type TEXT,
  p_amount NUMERIC
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
BEGIN
  -- Check Auth
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get user current topup_amount
  SELECT topup_amount, agent_credits, package_end_date INTO v_current_topup, v_current_credits, v_current_end
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_current_topup IS NULL OR v_current_topup < p_amount THEN
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
    v_added_credits := floor(p_amount / v_cost_per_min);
  END IF;

  -- Calculate new end date
  v_base_date := COALESCE(v_current_end, v_now);
  IF v_base_date < v_now THEN
    v_base_date := v_now;
  END IF;
  v_new_end := v_base_date + INTERVAL '30 days';

  -- Update Profile
  UPDATE public.profiles
  SET
    topup_amount = topup_amount - p_amount,
    package_type = v_new_package_type,
    package_status = 'ACTIVE',
    package_start_date = v_now,
    package_end_date = v_new_end,
    agent_credits = COALESCE(agent_credits, 0) + v_added_credits
  WHERE id = p_user_id;

  -- Log Transaction
  INSERT INTO public.package_transactions (
    user_id, package_type, amount, payment_provider
  ) VALUES (
    p_user_id, p_package_type, p_amount, 'wallet_topup_balance'
  );

END;
$$;

-- 4. Create process_user_topup RPC
CREATE OR REPLACE FUNCTION process_user_topup(
  p_user_id UUID,
  p_amount NUMERIC,
  p_minutes INTEGER
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
BEGIN
  -- Check Auth
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
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

  -- Update Profile
  UPDATE public.profiles
  SET
    agent_credits = COALESCE(agent_credits, 0) + p_minutes,
    topup_amount = COALESCE(topup_amount, 0) + p_amount,
    package_end_date = v_new_end
  WHERE id = p_user_id;

  -- Log Transaction
  INSERT INTO public.topup_transactions (
    user_id, amount, minutes, status
  ) VALUES (
    p_user_id, p_amount, p_minutes, 'SUCCESS'
  );

END;
$$;

-- 5. Create process_user_refund RPC
CREATE OR REPLACE FUNCTION process_user_refund(
  p_user_id UUID,
  p_payment_id UUID,
  p_refund_amount NUMERIC,
  p_refund_type TEXT,
  p_reason_category TEXT,
  p_reason_notes TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment_amount NUMERIC;
  v_payment_minutes INTEGER;
  v_already_refunded NUMERIC;
  v_remaining NUMERIC;
  v_cost_per_min NUMERIC;
  v_deduct_mins INTEGER;
  v_payment_user UUID;
BEGIN
  -- Check Auth (Allow user or admins)
  IF auth.uid() != p_user_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')) THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- Fetch payment info
  SELECT amount, minutes, user_id INTO v_payment_amount, v_payment_minutes, v_payment_user
  FROM public.topup_transactions
  WHERE id = p_payment_id;

  IF v_payment_amount IS NULL THEN
    RAISE EXCEPTION 'Payment record not found.';
  END IF;

  IF v_payment_user != p_user_id THEN
    RAISE EXCEPTION 'Payment record does not belong to the user.';
  END IF;

  -- Calculate already refunded
  SELECT COALESCE(SUM(refund_amount), 0) INTO v_already_refunded
  FROM public.refunds
  WHERE payment_id = p_payment_id AND status = 'completed';

  v_remaining := v_payment_amount - v_already_refunded;
  IF v_remaining <= 0 THEN
    RAISE EXCEPTION 'Transaction already fully refunded.';
  END IF;

  IF p_refund_amount > v_remaining THEN
    RAISE EXCEPTION 'Refund amount exceeds remaining balance.';
  END IF;

  -- Calculate minutes to deduct
  SELECT cost_per_minute INTO v_cost_per_min FROM public.system_config WHERE id = 1;
  IF v_cost_per_min IS NULL OR v_cost_per_min <= 0 THEN
    v_cost_per_min := 2.0;
  END IF;
  v_deduct_mins := floor(p_refund_amount / v_cost_per_min);

  -- Insert Refund log
  INSERT INTO public.refunds (
    user_id, payment_id, refund_amount, refund_type, reason_category, reason_notes, status
  ) VALUES (
    p_user_id, p_payment_id, p_refund_amount, p_refund_type, p_reason_category, p_reason_notes, 'completed'
  );

  -- Update Profile
  UPDATE public.profiles
  SET
    topup_amount = GREATEST(0, topup_amount - p_refund_amount),
    agent_credits = GREATEST(0, agent_credits - v_deduct_mins)
  WHERE id = p_user_id;

END;
$$;

-- 6. Recreate get_platform_reports_v3 to properly count packages, topups, and subtract refunds
CREATE OR REPLACE FUNCTION public.get_platform_reports_v3()
RETURNS TABLE (
  report_date date,
  registered_count bigint,
  active_count bigint,
  talks_sold bigint,
  snehi_sold bigint,
  daily_revenue bigint,
  deleted_count bigint,
  total_messages bigint,
  total_voice_seconds bigint,
  custom_scenarios_created bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT DATE(created_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.profiles
    UNION
    SELECT DATE(created_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.user_usage_events
    UNION
    SELECT DATE(original_created_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.deleted_users_archive
    UNION
    SELECT DATE(deleted_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.deleted_users_archive
    UNION
    SELECT DATE(created_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.topup_transactions
    UNION
    SELECT DATE(created_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.refunds
  ),
  unique_dates AS (
    SELECT DISTINCT dte FROM daily_stats WHERE dte IS NOT NULL
  )
  SELECT 
    ud.dte as report_date,
    
    -- Registrations
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0)
    )::bigint as registered_count,
    
    -- Active Learners
    COALESCE((SELECT COUNT(DISTINCT up.user_id) FROM public.user_progress up WHERE DATE(up.updated_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0)::bigint as active_count,
    
    -- Talks Sold
    COALESCE((SELECT COUNT(*) FROM public.package_transactions pt WHERE DATE(pt.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND pt.package_type IN ('TALKS', 'BOTH')), 0)::bigint as talks_sold,
    
    -- Snehi Sold
    COALESCE((SELECT COUNT(*) FROM public.package_transactions pt WHERE DATE(pt.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND pt.package_type IN ('SNEHI', 'BOTH')), 0)::bigint as snehi_sold,
    
    -- Daily Revenue (Packages + Topups - Refunds)
    (
      COALESCE((SELECT SUM(amount) FROM public.package_transactions pt WHERE DATE(pt.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0) +
      COALESCE((SELECT SUM(amount) FROM public.topup_transactions tt WHERE DATE(tt.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND tt.status = 'SUCCESS'), 0) -
      COALESCE((SELECT SUM(refund_amount) FROM public.refunds r WHERE DATE(r.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND r.status = 'completed'), 0)
    )::bigint as daily_revenue,
    
    -- Deleted Count
    COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.deleted_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0)::bigint as deleted_count,
    
    -- Total Chat Messages
    COALESCE((SELECT COUNT(*) FROM public.user_usage_events uue WHERE DATE(uue.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND uue.event_type = 'TEXT_CHAT'), 0)::bigint as total_messages,
    
    -- Total Voice Seconds
    COALESCE((SELECT SUM(amount) FROM public.user_usage_events uue WHERE DATE(uue.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND uue.event_type = 'VOICE_CHAT'), 0)::bigint as total_voice_seconds,

    -- Custom Scenarios Created
    COALESCE((SELECT COUNT(*) FROM public.lessons l WHERE DATE(l.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND l.scenario IS NOT NULL), 0)::bigint as custom_scenarios_created

  FROM unique_dates ud
  ORDER BY ud.dte DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
