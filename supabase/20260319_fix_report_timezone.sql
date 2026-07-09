-- =========================================================================

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
    -- Collect all relevant dates in IST
    SELECT DATE(created_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.profiles
    UNION
    SELECT DATE(created_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.user_usage_events
    UNION
    SELECT DATE(original_created_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.deleted_users_archive
    UNION
    SELECT DATE(deleted_at AT TIME ZONE 'Asia/Kolkata') as dte FROM public.deleted_users_archive
  ),
  unique_dates AS (
    SELECT DISTINCT dte FROM daily_stats WHERE dte IS NOT NULL
  )
  SELECT 
    ud.dte as report_date,
    
    -- Registrations (Active + Deleted)
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0)
    )::bigint as registered_count,
    
    -- Active Learners (users with progress updated on this day)
    COALESCE((SELECT COUNT(DISTINCT up.user_id) FROM public.user_progress up WHERE DATE(up.updated_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0)::bigint as active_count,
    
    -- Talks Sold
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND p.package_type IN ('TALKS', 'BOTH')), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND d.package_type IN ('TALKS', 'BOTH')), 0)
    )::bigint as talks_sold,
    
    -- Snehi Sold
    (
      COALESCE((SELECT COUNT(*) FROM public.profiles p WHERE DATE(p.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND p.package_type IN ('SNEHI', 'SANGAATHI', 'BOTH')), 0) +
      COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND d.package_type IN ('SNEHI', 'SANGAATHI', 'BOTH')), 0)
    )::bigint as snehi_sold,
    
    -- Daily Revenue
    (
      COALESCE((
        SELECT SUM(
          CASE 
            WHEN p.package_type = 'TALKS' THEN 299
            WHEN p.package_type IN ('SNEHI', 'SANGAATHI') THEN 499
            WHEN p.package_type = 'BOTH' THEN (299 + 499)
            ELSE 0
          END
        ) FROM public.profiles p WHERE DATE(p.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte
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
        ) FROM public.deleted_users_archive d WHERE DATE(d.original_created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte
      ), 0)
    )::bigint as daily_revenue,
    
    -- Deleted Count
    COALESCE((SELECT COUNT(*) FROM public.deleted_users_archive d WHERE DATE(d.deleted_at AT TIME ZONE 'Asia/Kolkata') = ud.dte), 0)::bigint as deleted_count,
    
    -- Total Chat Messages
    COALESCE((SELECT COUNT(*) FROM public.user_usage_events uue WHERE DATE(uue.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND uue.event_type = 'TEXT_CHAT'), 0)::bigint as total_messages,
    
    -- Total Voice Seconds
    COALESCE((SELECT SUM(amount) FROM public.user_usage_events uue WHERE DATE(uue.created_at AT TIME ZONE 'Asia/Kolkata') = ud.dte AND uue.event_type = 'VOICE_CHAT'), 0)::bigint as total_voice_seconds

  FROM unique_dates ud
  ORDER BY ud.dte DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
