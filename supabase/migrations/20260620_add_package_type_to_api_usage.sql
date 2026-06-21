-- ADD package_type COLUMN TO public.api_usage
ALTER TABLE public.api_usage ADD COLUMN IF NOT EXISTS package_type TEXT;

-- BACKFILL EXISTING ROWS (Heuristic fallback)
-- Voice usage belongs to SNEHI. Chat/TTS usage defaults to TALKS.
UPDATE public.api_usage
SET package_type = CASE 
  WHEN api_type = 'voice' THEN 'SNEHI'
  ELSE 'TALKS'
END
WHERE package_type IS NULL;
