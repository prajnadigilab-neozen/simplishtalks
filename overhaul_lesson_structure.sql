-- ==========================================
-- LESSON STRUCTURE OVERHAUL MIGRATION
-- ==========================================

-- 1. Add new columns to lessons table for SPEAK section
ALTER TABLE public.lessons 
  ADD COLUMN IF NOT EXISTS speak_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS speak_text_url TEXT;

-- 2. Create User Lesson Recordings table
CREATE TABLE IF NOT EXISTS public.user_lesson_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  audio_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.user_lesson_recordings ENABLE ROW LEVEL SECURITY;

-- 4. Policies for User Recordings
DROP POLICY IF EXISTS "Users can manage own recordings" ON public.user_lesson_recordings;
CREATE POLICY "Users can manage own recordings" 
ON public.user_lesson_recordings 
FOR ALL 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all recordings" ON public.user_lesson_recordings;
CREATE POLICY "Admins can view all recordings" 
ON public.user_lesson_recordings 
FOR SELECT 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);
