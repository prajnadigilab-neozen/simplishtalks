-- SECURITY FIX: Prevent Client-Side IDOR on Billing Fields
-- This tightens the profiles RLS policy to explicitly block authenticated users
-- from modifying their own 'package_type' and 'agent_credits'.
-- Only the service_role key (Edge Functions/Backend) can bypass this and fulfill payments.

BEGIN;

-- ==============================================================================
-- 1. PROFILES TABLE SECRECY
-- ==============================================================================
-- Drop any universally permissive UPDATE policy that might exist for the user
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own non-billing profile data" ON public.profiles;

-- Create a strict UPDATE policy that ensures the user can only change non-billing data
CREATE POLICY "Users can update own non-billing profile data"
ON public.profiles FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND
  
  -- MANDATORY: The user CANNOT change their package_type
  package_type = (SELECT package_type FROM public.profiles WHERE id = auth.uid()) AND
  
  -- MANDATORY: The user CANNOT change their agent_credits
  agent_credits = (SELECT agent_credits FROM public.profiles WHERE id = auth.uid()) AND

  -- MANDATORY: The user CANNOT change their start/end dates
  package_end_date = (SELECT package_end_date FROM public.profiles WHERE id = auth.uid())
);

-- Note: The `service_role` key inherently bypasses RLS, so your Edge Function webhook 
-- will still be able to update these fields successfully.


-- ==============================================================================
-- 2. PACKAGE TRANSACTIONS SECURITY
-- ==============================================================================
-- Users should never be able to INSERT fake transaction logs. Only the secure
-- backend using the service_role should be able to write to this table.

-- Create the table if it doesn't exist (Fix for ERROR: 42P01 relation does not exist)
CREATE TABLE IF NOT EXISTS public.package_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    package_type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    payment_provider TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable RLS just in case it isn't
ALTER TABLE public.package_transactions ENABLE ROW LEVEL SECURITY;

-- Drop any Insert policy that lets authenticated users forge receipts
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.package_transactions;

-- Allow users to SELECT (view) their own history
CREATE POLICY "Users can view own transactions"
ON public.package_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Explicitly DO NOT create an INSERT policy for `authenticated` users.
-- Because RLS is active and no INSERT policy exists for them, writing from the frontend is permanently denied.
-- Only backends using the `service_role` key can inherently bypass to log official translations.

COMMIT;
