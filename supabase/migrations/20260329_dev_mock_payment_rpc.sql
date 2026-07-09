-- DEV MOCK ONLY: RPC to simulate a backend payment fulfillment webhook
-- This bypasses RLS safely to allow the frontend to simulate a strict backend webhook transaction

CREATE OR REPLACE FUNCTION dev_mock_payment_fulfillment(
  p_user_id UUID,
  p_package_type TEXT,
  p_package_status TEXT,
  p_package_start_date TIMESTAMPTZ,
  p_package_end_date TIMESTAMPTZ,
  p_agent_credits INTEGER,
  p_amount NUMERIC
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Essential: Bypasses RLS to act as a simulated backend
AS $$
BEGIN
  -- Strict Check: Only allow users to fulfill for their own UUID.
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only fulfill mock payments for your own account.';
  END IF;

  -- 1. Fulfill Profile Package
  UPDATE public.profiles
  SET 
    package_type = p_package_type,
    package_status = p_package_status,
    package_start_date = p_package_start_date,
    package_end_date = p_package_end_date,
    agent_credits = p_agent_credits
  WHERE id = p_user_id;

  -- 2. Log Transaction
  INSERT INTO public.package_transactions (
    user_id, package_type, amount, payment_provider
  ) VALUES (
    p_user_id, p_package_type, p_amount, 'simulated_rpc_backend'
  );

END;
$$;
