-- User Deletion Fix Migration
-- Enables admins to delete users completely including Auth records

-- 1. Create a function to delete a user (Run as SECURITY DEFINER to bypass Auth restrictions)
CREATE OR REPLACE FUNCTION public.delete_user_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions
AS $$
BEGIN
  -- Check if the CURRENT user is an admin OR is deleting their own account
  IF NOT (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    OR (auth.uid() = target_user_id)
  ) THEN
    RAISE EXCEPTION 'Access Denied: You do not have permission to delete this user.';
  END IF;

  -- Delete from public tables (Explicit cleanup)
  DELETE FROM public.user_progress WHERE user_id = target_user_id;
  DELETE FROM public.chat_history WHERE user_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Delete from auth.users (This is why we need SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- 2. Add Missing DELETE Policies for Admins
-- Ensure admins can delete from public tables if they use the standard SDK as well

DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles 
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Admins can delete progress" ON public.user_progress;
CREATE POLICY "Admins can delete progress" ON public.user_progress 
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

DROP POLICY IF EXISTS "Admins can delete chat history" ON public.chat_history;
CREATE POLICY "Admins can delete chat history" ON public.chat_history 
  FOR DELETE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));
