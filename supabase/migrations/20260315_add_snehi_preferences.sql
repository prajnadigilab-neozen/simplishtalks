-- Migration to add SNEHI preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS prefers_translation BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS prefers_pronunciation BOOLEAN DEFAULT TRUE;

-- Update the increment_profile_usage function or other relevant functions if needed, 
-- but these are just preference flags, so no logic changes needed in existing RPCs.
