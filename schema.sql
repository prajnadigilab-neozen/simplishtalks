
-- ==========================================
-- RESET SCRIPT: START FRESH
-- ==========================================

-- Drop existing tables in reverse order of dependency
DROP TABLE IF EXISTS public.lessons;
DROP TABLE IF EXISTS public.modules;
DROP TABLE IF EXISTS public.chat_history;
DROP TABLE IF EXISTS public.user_progress;
DROP TABLE IF EXISTS public.profiles;

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  phone TEXT UNIQUE,
  place TEXT,
  role TEXT DEFAULT 'USER', -- 'USER' or 'ADMIN'
  is_restricted BOOLEAN DEFAULT FALSE,
  avatar_url TEXT,
  preferred_model TEXT DEFAULT 'gemini-3-flash-preview',
  voice_profile TEXT DEFAULT 'Aoede',
  system_prompt_focus TEXT DEFAULT '',
  package_type TEXT DEFAULT 'NONE', -- 'NONE', 'TALKS', 'AI_MESHTRU'
  package_status TEXT DEFAULT 'INACTIVE', -- 'INACTIVE', 'ACTIVE', 'EXPIRED'
  package_start_date TIMESTAMP WITH TIME ZONE,
  package_end_date TIMESTAMP WITH TIME ZONE,
  agent_credits INTEGER DEFAULT 0, -- Credits (e.g. minutes) for AI_MESHTRU Package
  streak_count INTEGER DEFAULT 0,
  last_streak_date DATE,
  total_messages_sent INTEGER DEFAULT 0,
  total_talk_time INTEGER DEFAULT 0, -- in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance indexes: RLS policies run a subquery on profiles(id, role)
-- and profiles(id, is_restricted) for every protected request. These indexes
-- make those checks orders of magnitude faster.
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON public.profiles(id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_id_is_restricted ON public.profiles(id, is_restricted);

-- 2. User Progress Table
CREATE TABLE public.user_progress (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  current_level TEXT DEFAULT 'BASIC',
  completed_lessons JSONB DEFAULT '[]'::jsonb, -- Array of lesson IDs
  is_placement_done BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for upsert performance
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON public.user_progress(user_id);

-- 3. Chat History Table (For AI Coach & Audit)
CREATE TABLE public.chat_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid, -- Optional: links to a specific lesson scenario
  role TEXT NOT NULL, -- 'user' or 'coach'
  content TEXT NOT NULL,
  correction TEXT,
  kannada_guide TEXT,
  pronunciation_tip TEXT,
  audio_url TEXT,
  is_hidden_from_user BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Modules Table
CREATE TABLE public.modules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL, -- BASIC, INTERMEDIATE, ADVANCED, EXPERT
  title JSONB NOT NULL, -- {en: "...", kn: "..."}
  description JSONB NOT NULL, -- {en: "...", kn: "..."}
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Lessons Table
CREATE TABLE public.lessons (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE NOT NULL,
  title JSONB NOT NULL,
  notes JSONB NOT NULL,
  video_url TEXT,
  audio_url TEXT,
  pdf_url TEXT,
  text_url TEXT,
  text_content TEXT,
  study_text_content TEXT,
  speak_pdf_url TEXT,
  speak_text_url TEXT,
  speak_text_content TEXT,
  scenario JSONB, -- { character: {en, kn}, objective: {en, kn}, systemInstruction, initialMessage }
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ==========================================
-- POLICIES
-- ==========================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

-- User Progress
-- Supabase UPSERT needs INSERT + UPDATE + SELECT permissions
CREATE POLICY "Users can insert own progress" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own progress" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view progress" ON public.user_progress FOR SELECT USING (
  public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

-- Chat History
CREATE POLICY "Users can see visible chat" ON public.chat_history FOR SELECT USING (
  auth.uid() = user_id AND is_hidden_from_user = FALSE
);
CREATE POLICY "Users can insert chat" ON public.chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can hide chat" ON public.chat_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can audit all chat" ON public.chat_history FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

-- Content (Modules/Lessons)
CREATE POLICY "Anyone can view modules" ON public.modules FOR SELECT USING (true);
CREATE POLICY "Admins manage modules" ON public.modules FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

CREATE POLICY "Anyone can view lessons" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "Admins manage lessons" ON public.lessons FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

-- ==========================================
-- AI INSTRUCTIONS
-- ==========================================
DROP TABLE IF EXISTS public.ai_instructions;
DROP TABLE IF EXISTS public.ai_instructions_history;

-- 6. AI Instructions (Current Configuration)
CREATE TABLE public.ai_instructions (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Singleton pattern
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by uuid REFERENCES public.profiles(id)
);
-- Ensure only one row exists
ALTER TABLE public.ai_instructions ADD CONSTRAINT singleton_chk CHECK (id = 1);

-- 7. AI Instructions History
CREATE TABLE public.ai_instructions_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- RLS for AI Instructions
ALTER TABLE public.ai_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_instructions_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view AI Instructions" ON public.ai_instructions FOR SELECT USING (true);

CREATE POLICY "Admins manage AI Instructions" ON public.ai_instructions FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  OR 
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')))
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  OR 
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')))
);

CREATE POLICY "Admins view AI Instructions History" ON public.ai_instructions_history FOR SELECT USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  OR 
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')))
);
CREATE POLICY "Admins manage AI Instructions History" ON public.ai_instructions_history FOR ALL USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  OR 
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')))
)
WITH CHECK (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  OR 
  (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')))
);
-- 8. User Lesson Recordings (Audio Practice)
CREATE TABLE public.user_lesson_recordings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid NOT NULL, -- Logical link to lesson
  audio_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_lesson_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own recordings" ON public.user_lesson_recordings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all recordings" ON public.user_lesson_recordings FOR SELECT USING (
  public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

-- 9. Telemetry Table
CREATE TABLE IF NOT EXISTS public.telemetry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  page_path TEXT,
  ect TEXT,
  downlink NUMERIC,
  rtt NUMERIC,
  tti NUMERIC,
  zip_code TEXT,
  region TEXT,
  is_dropped BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own telemetry" ON public.telemetry FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins can view telemetry" ON public.telemetry FOR SELECT USING (
  public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

-- 10. API Usage Table
CREATE TABLE IF NOT EXISTS public.api_usage (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  api_type TEXT NOT NULL, -- 'chat', 'voice', 'tts'
  model_name TEXT,
  input_units NUMERIC DEFAULT 0, -- tokens for chat, seconds for voice
  output_units NUMERIC DEFAULT 0,
  total_units NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own usage" ON public.api_usage FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Admins can view usage" ON public.api_usage FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);
