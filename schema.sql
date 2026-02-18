
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. User Progress Table
CREATE TABLE public.user_progress (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  current_level TEXT DEFAULT 'BASIC',
  completed_lessons JSONB DEFAULT '[]'::jsonb, -- Array of lesson IDs
  is_placement_done BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  text_content TEXT,
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
-- POLICIES
-- ==========================================

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);
CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- User Progress
CREATE POLICY "Users can manage own progress" ON public.user_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view progress" ON public.user_progress FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Chat History
CREATE POLICY "Users can see visible chat" ON public.chat_history FOR SELECT USING (
  auth.uid() = user_id AND is_hidden_from_user = FALSE
);
CREATE POLICY "Users can insert chat" ON public.chat_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can hide chat" ON public.chat_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can audit all chat" ON public.chat_history FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- Content (Modules/Lessons)
CREATE POLICY "Anyone can view modules" ON public.modules FOR SELECT USING (true);
CREATE POLICY "Admins manage modules" ON public.modules FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "Anyone can view lessons" ON public.lessons FOR SELECT USING (true);
CREATE POLICY "Admins manage lessons" ON public.lessons FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);
