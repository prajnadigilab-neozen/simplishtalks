-- Migration: Web-to-App Attribution System
-- Description: Creates the pending_attributions table and fingerprint matching RPCs to attribute direct APK downloads.

-- 1. Helper function to extract the client's public IP address from PostgREST headers
CREATE OR REPLACE FUNCTION public.get_client_ip()
RETURNS TEXT AS $$
DECLARE
  headers json;
  ip_val text;
BEGIN
  -- request.headers is a PostgREST environment variable containing headers in JSON format
  headers := current_setting('request.headers', true)::json;
  IF headers IS NOT NULL THEN
    ip_val := headers->>'x-forwarded-for';
    IF ip_val IS NOT NULL THEN
      -- Kong proxies x-forwarded-for as a comma-separated list; extract the client's origin IP
      RETURN trim(split_part(ip_val, ',', 1));
    END IF;
  END IF;
  RETURN '127.0.0.1'; -- Default fallback for local development direct connections
EXCEPTION
  WHEN OTHERS THEN
    RETURN '127.0.0.1';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the pending_attributions table to cache website download click data
CREATE TABLE IF NOT EXISTS public.pending_attributions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL DEFAULT public.get_client_ip(),
    user_agent TEXT NOT NULL,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for high-performance lookup during client matching
CREATE INDEX IF NOT EXISTS idx_attribution_match 
    ON public.pending_attributions (ip_address, user_agent, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.pending_attributions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Allow anyone (public/anonymous web visitors) to insert their attribution clicks
DROP POLICY IF EXISTS "Allow anonymous insertions" ON public.pending_attributions;
CREATE POLICY "Allow anonymous insertions" ON public.pending_attributions
    FOR INSERT 
    WITH CHECK (true);

-- Restrict selects so only administrators can view historical lists of attribution IPs
DROP POLICY IF EXISTS "Admins can view attributions" ON public.pending_attributions;
CREATE POLICY "Admins can view attributions" ON public.pending_attributions
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
      )
    );

-- 4. Extend the profiles table to store matched attribution results
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100) DEFAULT 'organic',
  ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100) DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS attribution_method VARCHAR(50),
  ADD COLUMN IF NOT EXISTS attributed_at TIMESTAMPTZ;

-- 5. RPC Function: match_and_claim_attribution
-- Executes server-side, matching IP + User Agent. If matched, updates the authenticated user profile.
CREATE OR REPLACE FUNCTION public.match_and_claim_attribution(
  p_user_agent TEXT,
  p_fallback_ip TEXT DEFAULT NULL
) 
RETURNS JSONB 
SECURITY DEFINER 
AS $$
DECLARE
  v_client_ip TEXT;
  v_matched_id uuid;
  v_utm_source VARCHAR(100);
  v_utm_medium VARCHAR(100);
  v_campaign_name VARCHAR(100);
  v_result JSONB;
  v_user_id uuid;
BEGIN
  -- Determine client IP from server headers
  v_client_ip := public.get_client_ip();
  IF v_client_ip = '127.0.0.1' AND p_fallback_ip IS NOT NULL THEN
    v_client_ip := p_fallback_ip;
  END IF;

  -- Attempt to match the current IP and User Agent inside a 2-hour window
  SELECT id, utm_source, utm_medium, utm_campaign
  INTO v_matched_id, v_utm_source, v_utm_medium, v_campaign_name
  FROM public.pending_attributions
  WHERE ip_address = v_client_ip
    AND user_agent = p_user_agent
    AND created_at >= NOW() - INTERVAL '2 hours'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_matched_id IS NOT NULL THEN
    -- If a user is logged in, attach these metrics directly to their profile
    v_user_id := auth.uid();
    IF v_user_id IS NOT NULL THEN
      UPDATE public.profiles
      SET utm_source = COALESCE(v_utm_source, 'organic'),
          utm_medium = COALESCE(v_utm_medium, 'direct'),
          utm_campaign = COALESCE(v_campaign_name, 'none'),
          attribution_method = 'custom_fingerprint',
          attributed_at = NOW()
      WHERE id = v_user_id;
    END IF;

    -- Return success details
    v_result := jsonb_build_object(
      'matched', true,
      'ip', v_client_ip,
      'utm_source', v_utm_source,
      'utm_medium', v_utm_medium,
      'utm_campaign', v_campaign_name
    );
  ELSE
    v_result := jsonb_build_object(
      'matched', false,
      'ip', v_client_ip
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.match_and_claim_attribution(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.match_and_claim_attribution(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_and_claim_attribution(TEXT, TEXT) TO service_role;

-- 6. Create analytics_events table for event tracking
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_name VARCHAR(100) NOT NULL,
    platform VARCHAR(50) DEFAULT 'web',
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for analytics querying
CREATE INDEX IF NOT EXISTS idx_analytics_event_name ON public.analytics_events (event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events (created_at);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (anyone can trigger a tracking event)
DROP POLICY IF EXISTS "Allow anonymous insertions on analytics" ON public.analytics_events;
CREATE POLICY "Allow anonymous insertions on analytics" ON public.analytics_events
    FOR INSERT 
    WITH CHECK (true);

-- Allow admins to read analytics events
DROP POLICY IF EXISTS "Admins can view analytics events" ON public.analytics_events;
CREATE POLICY "Admins can view analytics events" ON public.analytics_events
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
          AND role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
      )
    );

