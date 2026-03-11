-- =========================================================================
-- COMPREHENSIVE ADMIN & USER SELF-DELETION FIX
-- =========================================================================

-- 1. Create Archive Table for revenue and cumulative stats (if not exists)
CREATE TABLE IF NOT EXISTS public.deleted_users_archive (
  id uuid PRIMARY KEY,
  original_created_at timestamp with time zone,
  deleted_at timestamp with time zone DEFAULT now(),
  package_type text,
  total_voice_seconds bigint DEFAULT 0,
  total_messages bigint DEFAULT 0
);

-- ADD MISSING COLUMNS IF TABLE ALREADY EXISTED
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deleted_users_archive' AND column_name='total_voice_seconds') THEN
    ALTER TABLE public.deleted_users_archive ADD COLUMN total_voice_seconds bigint DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='deleted_users_archive' AND column_name='total_messages') THEN
    ALTER TABLE public.deleted_users_archive ADD COLUMN total_messages bigint DEFAULT 0;
  END IF;
END
$$;

-- 2. Ensure Usage Events are Retained
-- We set user_id to NULL on delete so history stays but isn't linked to a live user.
ALTER TABLE public.user_usage_events ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_usage_events DROP CONSTRAINT IF EXISTS user_usage_events_user_id_fkey;
ALTER TABLE public.user_usage_events ADD CONSTRAINT user_usage_events_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Ensure Chat History is Retained (For training as requested)
ALTER TABLE public.chat_history ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.chat_history DROP CONSTRAINT IF EXISTS chat_history_user_id_fkey;
ALTER TABLE public.chat_history ADD CONSTRAINT chat_history_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Shared Archiving Logic
CREATE OR REPLACE FUNCTION public.archive_user_data(target_user_id uuid)
RETURNS void AS $$
DECLARE
  v_created_at timestamp with time zone;
  v_package_type text;
  v_voice_secs bigint;
  v_msgs bigint;
BEGIN
  -- Capture stats from profiles before deletion
  SELECT 
    created_at, 
    package_type, 
    COALESCE(total_talk_time, 0), 
    COALESCE(total_messages_sent, 0)
  INTO v_created_at, v_package_type, v_voice_secs, v_msgs
  FROM public.profiles WHERE id = target_user_id;

  IF FOUND THEN
    INSERT INTO public.deleted_users_archive (id, original_created_at, package_type, total_voice_seconds, total_messages)
    VALUES (target_user_id, v_created_at, COALESCE(v_package_type, 'NONE'), v_voice_secs, v_msgs)
    ON CONFLICT (id) DO UPDATE SET 
      original_created_at = EXCLUDED.original_created_at,
      package_type = EXCLUDED.package_type,
      total_voice_seconds = EXCLUDED.total_voice_seconds,
      total_messages = EXCLUDED.total_messages;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Admin Deletion Wrapper
CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify the caller is an ADMIN or SUPER_ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'MODERATOR')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete users.';
  END IF;

  PERFORM public.archive_user_data(target_user_id);

  -- Delete from auth.users (cascades to profiles, user_progress etc)
  -- user_usage_events and chat_history will have user_id set to NULL due to SET NULL constraint
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 6. User Self-Deletion Wrapper
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.archive_user_data(v_uid);

  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 7. Corrected platform reports function
DROP FUNCTION IF EXISTS public.get_platform_reports_v2();

CREATE OR REPLACE FUNCTION public.get_platform_reports_v2()
RETURNS TABLE (
  report_date date,
  registered_count bigint,
  active_count bigint,
  talks_sold bigint,
  snehi_sold bigint,
  daily_revenue bigint,
  deleted_count bigint,
  total_messages bigint,
  total_voice_seconds bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH daily_stats AS (
    SELECT DATE(created_at) as dte FROM public.profiles
    UNION
    SELECT DATE(created_at) as dte FROM public.user_usage_events
    UNION
    SELECT DATE(original_created_at) as dte FROM public.deleted_users_archive
    UNION
    SELECT DATE(deleted_at) as dte FROM public.deleted_users_archive
  ),
  unique_dates AS (
    SELECT DISTINCT dte FROM daily_stats WHERE dte IS NOT NULL
  )
  SELECT 
    ud.dte as report_date,
    
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at) = ud.dte), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at) = ud.dte), 0)
    )::bigint as registered_count,
    
    COALESCE((SELECT COUNT(DISTINCT up.user_id) FROM public.user_progress up WHERE DATE(up.updated_at) = ud.dte), 0)::bigint as active_count,
    
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at) = ud.dte AND p.package_type IN ('TALKS', 'BOTH')), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at) = ud.dte AND d.package_type IN ('TALKS', 'BOTH')), 0)
    )::bigint as talks_sold,
    
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at) = ud.dte AND p.package_type IN ('SNEHI', 'SANGAATHI', 'BOTH')), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at) = ud.dte AND d.package_type IN ('SNEHI', 'SANGAATHI', 'BOTH')), 0)
    )::bigint as snehi_sold,
    
    (
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN p.package_type = 'TALKS' THEN 299
            WHEN p.package_type IN ('SNEHI', 'SANGAATHI') THEN 499
            WHEN p.package_type = 'BOTH' THEN (299 + 499)
            ELSE 0
          END
        ) FROM public.profiles p WHERE DATE(p.created_at) = ud.dte
      ), 0)
      +
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN d.package_type = 'TALKS' THEN 299
            WHEN d.package_type IN ('SNEHI', 'SANGAATHI') THEN 499
            WHEN d.package_type = 'BOTH' THEN (299 + 499)
            ELSE 0
          END
        ) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at) = ud.dte
      ), 0)
    )::bigint as daily_revenue,
    
    COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.deleted_at) = ud.dte), 0)::bigint as deleted_count,
    
    COALESCE((SELECT COUNT(*) FROM public.user_usage_events uue WHERE DATE(uue.created_at) = ud.dte AND uue.event_type = 'TEXT_CHAT'), 0)::bigint as total_messages,
    
    COALESCE((SELECT SUM(amount) FROM public.user_usage_events uue WHERE DATE(uue.created_at) = ud.dte AND uue.event_type = 'VOICE_CHAT'), 0)::bigint as total_voice_seconds

  FROM unique_dates ud
  ORDER BY ud.dte DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
