-- ==========================================
-- SUPABASE STORAGE SETUP: COURSE-MEDIA BUCKET
-- ==========================================

-- 1. Create the 'course-media' bucket if it doesn't exist, and ensure it's public
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-media', 'course-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Allow Public Read Access (SELECT)
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'course-media' );

-- 3. Allow Admins to Manage Media (INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Admin Manage Access" ON storage.objects;
CREATE POLICY "Admin Manage Access"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'course-media' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
)
WITH CHECK (
  bucket_id = 'course-media' AND 
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);
