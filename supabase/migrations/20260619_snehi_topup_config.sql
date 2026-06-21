-- ===================================================
-- ADD SNEHI TOPUP CONFIGURATION COLUMNS
-- ===================================================

ALTER TABLE public.system_config ADD COLUMN IF NOT EXISTS snehi_subscription_price NUMERIC DEFAULT 99.0;
ALTER TABLE public.system_config ADD COLUMN IF NOT EXISTS snehi_topup_duration_mins INTEGER DEFAULT 60;

-- Update defaults for existing rows (usually only id = 1)
UPDATE public.system_config 
SET 
  snehi_subscription_price = COALESCE(snehi_subscription_price, 99.0),
  snehi_topup_duration_mins = COALESCE(snehi_topup_duration_mins, 60)
WHERE id = 1;
