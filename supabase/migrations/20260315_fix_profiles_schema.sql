-- Migration to ensure all profile columns exist and match types
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS prefers_translation BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS prefers_pronunciation BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS voice_gender TEXT DEFAULT 'WOMAN';

-- Ensure usage columns exist (already in schema.sql but re-checking)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_messages_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_talk_time INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_date DATE,
ADD COLUMN IF NOT EXISTS agent_credits INTEGER DEFAULT 0;

-- Ensure package columns exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS package_type TEXT DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS package_status TEXT DEFAULT 'INACTIVE',
ADD COLUMN IF NOT EXISTS package_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS package_end_date TIMESTAMP WITH TIME ZONE;
