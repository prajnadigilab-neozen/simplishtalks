-- ==========================================
-- Admin Dashboard: User Deletion and Restriction Fix
-- ==========================================

-- 1. Create the `delete_user_admin` RPC function
-- This allows SUPER_ADMIN or ADMIN to delete a user's entire account.
-- It requires access to the `auth` schema and must be SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify the caller is an ADMIN or SUPER_ADMIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can delete users.';
  END IF;

  -- Delete the user from auth.users. 
  -- Note: This requires the function to have privileges to delete from auth schema.
  -- Supabase foreign keys with ON DELETE CASCADE will automatically handle the profiles, 
  -- user_progress, and chat_history tables linked to this user's uuid.
  
  DELETE FROM auth.users WHERE id = target_user_id;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;


-- 2. Ensure `is_restricted` column exists
-- If a user gets restricted, they shouldn't be able to access the app or make API calls.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='profiles' AND column_name='is_restricted'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_restricted BOOLEAN DEFAULT FALSE;
  END IF;
END
$$;
