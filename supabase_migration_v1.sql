-- Simplish Database Schema Alignment Migration
-- This script synchronizes the Supabase backend with the application requirements

-- 1. Profiles Table Enhancement
ALTER TABLE IF EXISTS public.profiles 
  ADD COLUMN IF NOT EXISTS place TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'USER';

-- Ensure full_name exists (standardizing on this field)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='full_name') THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
  END IF;
END $$;

-- 2. User Progress Table Standardization
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_level TEXT DEFAULT 'BASIC',
  completed_lessons JSONB DEFAULT '[]'::jsonb,
  is_placement_done BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Course Modules Table (Bilingual JSONB)
CREATE TABLE IF NOT EXISTS public.modules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level TEXT NOT NULL,
  title JSONB NOT NULL, -- Format: { en: "", kn: "" }
  description JSONB NOT NULL, -- Format: { en: "", kn: "" }
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Lessons Table (Bilingual JSONB + Multimedia)
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  module_id UUID REFERENCES public.modules(id) ON DELETE CASCADE,
  title JSONB NOT NULL, -- Format: { en: "", kn: "" }
  notes JSONB NOT NULL, -- Format: { en: "", kn: "" }
  video_url TEXT,
  audio_url TEXT,
  pdf_url TEXT,
  text_content TEXT,
  scenario JSONB, -- AI Practice data
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Chat History Table (Message Sync)
CREATE TABLE IF NOT EXISTS public.chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,
  role TEXT NOT NULL, -- 'user' or 'coach'
  content TEXT NOT NULL,
  correction TEXT,
  kannada_guide TEXT,
  pronunciation_tip TEXT,
  is_hidden_from_user BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (Example: Users can only see their own data)
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own progress" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chat history" ON public.chat_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own chat" ON public.chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own chat (soft delete)" ON public.chat_history FOR UPDATE USING (auth.uid() = user_id);

-- Public access to Course Content
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view modules" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public can view lessons" ON public.lessons FOR SELECT TO authenticated USING (true);
