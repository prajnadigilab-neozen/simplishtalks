-- ===================================================
-- FIX AI INSTRUCTIONS RLS POLICIES (REMOVE USER_METADATA REFERENCES)
-- ===================================================

-- Drop the old insecure policies
DROP POLICY IF EXISTS "Admins manage AI Instructions" ON public.ai_instructions;
DROP POLICY IF EXISTS "Admins view AI Instructions History" ON public.ai_instructions_history;
DROP POLICY IF EXISTS "Admins manage AI Instructions History" ON public.ai_instructions_history;

-- Recreate policies checking public.profiles table instead of insecure user_metadata
CREATE POLICY "Admins manage AI Instructions" ON public.ai_instructions 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'))
  );

CREATE POLICY "Admins view AI Instructions History" ON public.ai_instructions_history 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'))
  );

CREATE POLICY "Admins manage AI Instructions History" ON public.ai_instructions_history 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'))
  );
