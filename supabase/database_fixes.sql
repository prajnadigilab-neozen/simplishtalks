-- ==========================================
-- DATABASE FIXES: MISSING TABLES & FUNCTIONS
-- ==========================================

-- 1. User Lesson Recordings Table
CREATE TABLE IF NOT EXISTS public.user_lesson_recordings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  audio_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_lesson_recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own recordings" ON public.user_lesson_recordings;
CREATE POLICY "Users can manage own recordings" ON public.user_lesson_recordings
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all recordings" ON public.user_lesson_recordings;
CREATE POLICY "Admins can view all recordings" ON public.user_lesson_recordings
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
  );

-- 2. User Usage Table
CREATE TABLE IF NOT EXISTS public.user_usage (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE PRIMARY KEY,
  voice_seconds_total INTEGER DEFAULT 0,
  chat_tokens_total INTEGER DEFAULT 0,
  chat_messages_total INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON public.user_usage;
CREATE POLICY "Users can view own usage" ON public.user_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all usage" ON public.user_usage;
CREATE POLICY "Admins can view all usage" ON public.user_usage
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
  );

-- 3. User Usage Events Table (Audit Log)
CREATE TABLE IF NOT EXISTS public.user_usage_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL, -- 'VOICE_CHAT', 'TEXT_CHAT', 'TTS'
  amount INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage events" ON public.user_usage_events;
CREATE POLICY "Users can view own usage events" ON public.user_usage_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all usage events" ON public.user_usage_events;
CREATE POLICY "Admins can view all usage events" ON public.user_usage_events
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
  );

-- 4. RPC: Increment User Usage
DROP FUNCTION IF EXISTS public.increment_user_usage(uuid, integer, integer, integer);
CREATE OR REPLACE FUNCTION public.increment_user_usage(
  p_user_id uuid,
  p_add_seconds integer DEFAULT 0,
  p_add_tokens integer DEFAULT 0,
  p_add_messages integer DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO public.user_usage (user_id, voice_seconds_total, chat_tokens_total, chat_messages_total, updated_at)
  VALUES (p_user_id, p_add_seconds, p_add_tokens, p_add_messages, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    voice_seconds_total = public.user_usage.voice_seconds_total + p_add_seconds,
    chat_tokens_total = public.user_usage.chat_tokens_total + p_add_tokens,
    chat_messages_total = public.user_usage.chat_messages_total + p_add_messages,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RPC: Platform Reports (Aggregation for Dashboard)
DROP FUNCTION IF EXISTS public.get_platform_reports();
CREATE OR REPLACE FUNCTION public.get_platform_reports()
RETURNS TABLE (
  report_date date,
  total_messages bigint,
  total_voice_seconds bigint,
  unique_users bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    created_at::date as report_date,
    COUNT(*) FILTER (WHERE event_type = 'TEXT_CHAT')::bigint as total_messages,
    SUM(amount) FILTER (WHERE event_type = 'VOICE_CHAT')::bigint as total_voice_seconds,
    COUNT(DISTINCT user_id)::bigint as unique_users
  FROM public.user_usage_events
  GROUP BY 1
  ORDER BY 1 DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
