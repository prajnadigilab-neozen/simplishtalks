-- ==========================================
-- SUPABASE STORAGE SETUP: AVATARS BUCKET
-- ==========================================

-- 1. Create the 'avatars' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow Public Read Access (SELECT)
-- This allows anyone to view the profile images via their public URL
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

-- 3. Allow Authenticated Upload (INSERT)
-- This allows logged-in users to upload their own profile images
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = 'profiles'
);

-- 4. Allow Authenticated Update (UPDATE)
-- This allows users to overwrite their own profile images
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = 'profiles'
);

-- 5. Allow Authenticated Delete (DELETE)
-- This allows users to delete their own profile images
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = 'profiles'
);
