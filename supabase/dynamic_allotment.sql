-- ==========================================
-- PHASE 8: DYNAMIC ALLOTMENT & SYSTEM CONFIG
-- ==========================================

-- 1. Create System Config Table (Singleton)
CREATE TABLE IF NOT EXISTS public.system_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    universal_free_seconds INTEGER DEFAULT 180, -- Free threshold for everyone (3 mins)
    cost_per_minute NUMERIC DEFAULT 2.0,      -- Cost for additional time (₹2/min)
    price_talks NUMERIC DEFAULT 299.0,        -- Standard price for TALKS package
    price_snehi NUMERIC DEFAULT 499.0,        -- Standard price for SNEHI package
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by uuid REFERENCES public.profiles(id),
    CONSTRAINT singleton_chk CHECK (id = 1)
);

-- 2. Enable RLS
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- 3. Policies
CREATE POLICY "Anyone can view system config" ON public.system_config 
    FOR SELECT USING (true);

CREATE POLICY "Admins can update system config" ON public.system_config 
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'MODERATOR')
    );

-- 4. Initial Seed
INSERT INTO public.system_config (id, universal_free_seconds, cost_per_minute, price_talks, price_snehi)
VALUES (1, 180, 2.0, 299.0, 499.0)
ON CONFLICT (id) DO NOTHING;

-- 5. Helper Function to get config
CREATE OR REPLACE FUNCTION public.get_system_config()
RETURNS public.system_config AS $$
    SELECT * FROM public.system_config WHERE id = 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
