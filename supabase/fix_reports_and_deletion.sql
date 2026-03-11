-- =========================================================================
-- FIX: Preserve Revenue & Track Deleted Users in Platform Reports
-- Description:
-- 1. Creates an archive table for deleted users to keep their revenue data.
-- 2. Updates delete_user_admin to log the user before deletion.
-- 3. Modifies get_platform_reports_v2 to include archived revenue and counts.
-- =========================================================================

-- 1. Preserve Voice and Chat Usage (Prevent Cascade Deletion)
-- Change user_usage_events to ON DELETE SET NULL so historical usage isn't wiped.
ALTER TABLE public.user_usage_events ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.user_usage_events DROP CONSTRAINT IF EXISTS user_usage_events_user_id_fkey;
ALTER TABLE public.user_usage_events ADD CONSTRAINT user_usage_events_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create Archive Table
CREATE TABLE IF NOT EXISTS public.deleted_users_archive (
  id uuid PRIMARY KEY,
  original_created_at timestamp with time zone,
  deleted_at timestamp with time zone DEFAULT now(),
  package_type text
);

-- 3. Update Deletion Function to Archive First
CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id uuid)
RETURNS void AS $$
DECLARE
  v_created_at timestamp with time zone;
  v_package_type text;
BEGIN
  -- Verify the caller is an ADMIN or SUPER_ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete users.';
  END IF;

  -- Archive the user's revenue-relevant data before deleting
  SELECT created_at, package_type INTO v_created_at, v_package_type
  FROM public.profiles WHERE id = target_user_id;

  IF FOUND THEN
    INSERT INTO public.deleted_users_archive (id, original_created_at, package_type)
    VALUES (target_user_id, v_created_at, COALESCE(v_package_type, 'NONE'))
    ON CONFLICT DO NOTHING;
  END IF;

  -- Delete from auth.users (cascades to profiles)
  DELETE FROM auth.users WHERE id = target_user_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 3. Update Reports Function to Include Archived Users
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
    
    -- Registrations (Active + Archived)
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at) = ud.dte), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at) = ud.dte), 0)
    )::bigint as registered_count,
    
    -- Active Learners 
    COALESCE((SELECT COUNT(DISTINCT up.user_id) FROM public.user_progress up WHERE DATE(up.updated_at) = ud.dte), 0)::bigint as active_count,
    
    -- Talks Sold
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at) = ud.dte AND p.package_type IN ('TALKS', 'BOTH')), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at) = ud.dte AND d.package_type IN ('TALKS', 'BOTH')), 0)
    )::bigint as talks_sold,
    
    -- Snehi Sold 
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at) = ud.dte AND p.package_type IN ('SNEHI', 'SANGAATHI', 'BOTH')), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at) = ud.dte AND d.package_type IN ('SNEHI', 'SANGAATHI', 'BOTH')), 0)
    )::bigint as snehi_sold,
    
    -- Daily Revenue (Active + Archived)
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
    
    -- Deleted Count based on WHEN they were deleted
    COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.deleted_at) = ud.dte), 0)::bigint as deleted_count,
    
    -- Total Chat Messages
    COALESCE((SELECT COUNT(*) FROM public.user_usage_events uue WHERE DATE(uue.created_at) = ud.dte AND uue.event_type = 'TEXT_CHAT'), 0)::bigint as total_messages,
    
    -- Total Voice Seconds
    COALESCE((SELECT SUM(amount) FROM public.user_usage_events uue WHERE DATE(uue.created_at) = ud.dte AND uue.event_type = 'VOICE_CHAT'), 0)::bigint as total_voice_seconds

  FROM unique_dates ud
  ORDER BY ud.dte DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
