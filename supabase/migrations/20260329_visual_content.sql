-- 1. Create the visual_content table
CREATE TABLE IF NOT EXISTS public.visual_content (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT,
  category TEXT NOT NULL CHECK (category IN ('jokes', 'fun_facts', 'describe_image', 'identify_image', 'complete_sentence')),
  access_level TEXT NOT NULL DEFAULT 'free' CHECK (access_level IN ('free', 'premium')),
  metadata JSONB DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.visual_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "View free visual content" ON public.visual_content;
DROP POLICY IF EXISTS "Premium users view all visual content" ON public.visual_content;
DROP POLICY IF EXISTS "Admins manage visual content" ON public.visual_content;

-- Policy 1: Everyone who is authenticated can view 'free' content
CREATE POLICY "View free visual content" ON public.visual_content
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND access_level = 'free'
  );

-- Policy 2: Premium users can view ALL content (both free and premium)
CREATE POLICY "Premium users view all visual content" ON public.visual_content
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND package_type IN ('TALKS', 'SNEHI', 'BOTH') 
      AND package_status = 'ACTIVE'
    )
  );

-- Policy 3: Admins can do everything
CREATE POLICY "Admins manage visual content" ON public.visual_content
  FOR ALL
  USING (
    public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  )
  WITH CHECK (
    public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  );

-- 2. Randomized Fetch RPC
CREATE OR REPLACE FUNCTION public.get_discovery_feed(p_limit INT DEFAULT 50)
RETURNS SETOF public.visual_content AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.visual_content
  ORDER BY random()
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- ==========================================
-- 3. STORAGE BUCKET & POLICIES
-- ==========================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('visual-content', 'visual-content', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Everyone can View
CREATE POLICY "Authenticated users can view visual storage"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'visual-content' );

-- Storage Policy: Admins can Insert
CREATE POLICY "Admins can upload visual storage"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'visual-content' AND 
  public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

-- Storage Policy: Admins can Update
CREATE POLICY "Admins can update visual storage"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'visual-content' AND 
  public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);

-- Storage Policy: Admins can Delete
CREATE POLICY "Admins can delete visual storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'visual-content' AND 
  public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
);
