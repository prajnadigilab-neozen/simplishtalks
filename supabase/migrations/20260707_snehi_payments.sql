-- Migration: Add SNEHI access payments, dynamic GST & coupon codes, and widen access_requests status
-- Date: 2026-07-07

-- 1. Add GST and Coupons configuration to system_config
ALTER TABLE public.system_config ADD COLUMN IF NOT EXISTS gst_percentage NUMERIC DEFAULT 18.0;
ALTER TABLE public.system_config ADD COLUMN IF NOT EXISTS coupons JSONB DEFAULT '[{"code": "SIMPLISH_PRO_2026", "discount_percent": 20}, {"code": "SNEHI_FREE", "discount_percent": 100}]'::jsonb;

-- Populate default values if existing config has NULL
UPDATE public.system_config 
SET 
  gst_percentage = COALESCE(gst_percentage, 18.0),
  coupons = COALESCE(coupons, '[{"code": "SIMPLISH_PRO_2026", "discount_percent": 20}, {"code": "SNEHI_FREE", "discount_percent": 100}]'::jsonb);

-- 2. Modify check constraint on public.access_requests status
-- First, drop the old CHECK constraint if it exists
ALTER TABLE public.access_requests DROP CONSTRAINT IF EXISTS access_requests_status_check;

-- Map existing lowercase statuses to new uppercase statuses
UPDATE public.access_requests SET status = 'PENDING' WHERE status = 'Pending';
UPDATE public.access_requests SET status = 'ACTIVE' WHERE status = 'Approved';
UPDATE public.access_requests SET status = 'REJECTED' WHERE status = 'Rejected';
UPDATE public.access_requests SET status = 'DISABLED' WHERE status = 'Disabled';

-- Set default to PENDING
ALTER TABLE public.access_requests ALTER COLUMN status SET DEFAULT 'PENDING';

-- Re-apply CHECK constraint
ALTER TABLE public.access_requests ADD CONSTRAINT access_requests_status_check CHECK (status IN ('PENDING', 'AWAITING_PMT', 'REJECTED', 'ACTIVE', 'DISABLED'));

-- 3. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.access_requests(id) ON DELETE CASCADE,
  base_amount INT NOT NULL, -- Paise/Lowest denominator
  tax_amount INT NOT NULL,
  discount_amount INT NOT NULL,
  final_payable_amount INT NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED')),
  transaction_id TEXT,
  payment_gateway TEXT CHECK (payment_gateway IN ('RAZORPAY', 'PHONEPE', 'STRIPE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;

-- Create RLS policies
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

CREATE POLICY "Users can insert own payments" ON public.payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update payments" ON public.payments
  FOR UPDATE USING (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

-- 4. Create or replace atomic complete_snehi_payment function
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
