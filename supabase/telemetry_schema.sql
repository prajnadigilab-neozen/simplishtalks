-- Telemetry Table for tracking performance and connectivity
CREATE TABLE IF NOT EXISTS public.telemetry (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  tti INTEGER, -- Time to Interactive in ms
  ect TEXT, -- Effective Connection Type (4g, 3g, 2g, slow-2g)
  downlink FLOAT, -- Effective bandwidth in Mbps
  rtt INTEGER, -- Round-trip time in ms
  zip_code TEXT,
  region TEXT,
  is_dropped BOOLEAN DEFAULT FALSE,
  page_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.telemetry ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can insert own telemetry" ON public.telemetry 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all telemetry" ON public.telemetry 
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
  );

-- Index for performance trends
CREATE INDEX IF NOT EXISTS idx_telemetry_zip_code ON public.telemetry(zip_code);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON public.telemetry(created_at);
