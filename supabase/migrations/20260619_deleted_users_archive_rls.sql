-- ===================================================
-- ENABLE RLS ON DELETED USERS ARCHIVE
-- ===================================================

-- Enable RLS on deleted_users_archive table
ALTER TABLE public.deleted_users_archive ENABLE ROW LEVEL SECURITY;

-- Allow ADMIN and SUPER_ADMIN roles to view the archive data
DROP POLICY IF EXISTS "Admins can view deleted users archive" ON public.deleted_users_archive;
CREATE POLICY "Admins can view deleted users archive" ON public.deleted_users_archive
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
  );
