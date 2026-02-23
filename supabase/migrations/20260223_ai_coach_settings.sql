
-- Migration: Add AI Coach settings to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS preferred_model TEXT DEFAULT 'gemini-2.0-flash',
ADD COLUMN IF NOT EXISTS voice_profile TEXT DEFAULT 'Aoede',
ADD COLUMN IF NOT EXISTS system_prompt_focus TEXT DEFAULT 'You are a patient English tutor for Kannada-speaking students. Always explain complex concepts in Kannada first.';

-- Refresh RLS to ensure these are visible if needed, though they already are under broad policies
COMMENT ON COLUMN public.profiles.preferred_model IS 'The AI model ID preferred by this user for live sessions.';
COMMENT ON COLUMN public.profiles.voice_profile IS 'The Gemini Live voice name (e.g., Aoede, Orion).';
COMMENT ON COLUMN public.profiles.system_prompt_focus IS 'Custom instructions to prepend to the AI system prompt.';
