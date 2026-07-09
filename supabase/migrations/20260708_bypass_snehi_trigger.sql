-- Migration: Bypass SNEHI access trigger check during payment completion
-- Date: 2026-07-08

-- 1. Redefine security trigger function to allow bypass via local transaction settings
CREATE OR REPLACE FUNCTION public.check_snehi_access_permission()
RETURNS TRIGGER AS $$
DECLARE
  v_bypass TEXT;
BEGIN
  -- Retrieve transaction-local setting
  BEGIN
    v_bypass := current_setting('app.bypass_snehi_trigger', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;

  -- Bypass if flagged
  IF v_bypass = 'true' THEN
    RETURN NEW;
  END IF;

  -- If snehi_access_enabled is being modified, ensure the current user is an admin
  IF NEW.snehi_access_enabled IS DISTINCT FROM OLD.snehi_access_enabled THEN
    IF public.get_my_role() NOT IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR') THEN
      RAISE EXCEPTION 'Access denied: Only administrators can modify SNEHI access permissions.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Redefine complete_snehi_payment to set the bypass setting
CREATE OR REPLACE FUNCTION public.complete_snehi_payment(
  p_user_id UUID,
  p_request_id UUID,
  p_base_amount INT,
  p_tax_amount INT,
  p_discount_amount INT,
  p_final_amount INT,
  p_gateway TEXT,
  p_transaction_id TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Set transaction-local setting to bypass check_snehi_access_permission trigger
  PERFORM set_config('app.bypass_snehi_trigger', 'true', true);

  -- Select request status with lock
  SELECT status INTO v_current_status
  FROM public.access_requests
  WHERE id = p_request_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_current_status IS DISTINCT FROM 'AWAITING_PMT' THEN
    RAISE EXCEPTION 'Request status must be AWAITING_PMT, found: %', v_current_status;
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
  UPDATE public.profiles
  SET snehi_access_enabled = TRUE
  WHERE id = p_user_id;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
