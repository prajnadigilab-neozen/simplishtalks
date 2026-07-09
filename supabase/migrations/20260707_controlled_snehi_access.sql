-- Migration to implement controlled access for SIMPLISH-SNEHI package
-- Date: 2026-07-07

-- 1. Add snehi_access_enabled column to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS snehi_access_enabled BOOLEAN DEFAULT FALSE;

-- Performance index for security checks
CREATE INDEX IF NOT EXISTS idx_profiles_snehi_access_enabled ON public.profiles(snehi_access_enabled);

-- 2. Create access_requests table
CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Disabled')),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_date TIMESTAMP WITH TIME ZONE,
  remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_access_requests_user_id ON public.access_requests(user_id);

-- Enable RLS on access_requests
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to allow clean re-runs
DROP POLICY IF EXISTS "Users can insert own requests" ON public.access_requests;
DROP POLICY IF EXISTS "Users can view own requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON public.access_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON public.access_requests;

-- RLS policies for access_requests
CREATE POLICY "Users can insert own requests" ON public.access_requests 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own requests" ON public.access_requests 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests" ON public.access_requests 
  FOR SELECT USING (
    public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  );

CREATE POLICY "Admins can update requests" ON public.access_requests 
  FOR UPDATE USING (
    public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  );

-- 3. Create notifications table for in-app alerts
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to allow clean re-runs
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;

-- RLS policies for notifications
CREATE POLICY "Users can view own notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications 
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications" ON public.notifications 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all notifications" ON public.notifications 
  FOR SELECT USING (
    public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  );

CREATE POLICY "Admins can insert notifications" ON public.notifications 
  FOR INSERT WITH CHECK (
    public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  );

-- 4. Security Trigger to prevent regular users from modifying snehi_access_enabled
CREATE OR REPLACE FUNCTION public.check_snehi_access_permission()
RETURNS TRIGGER AS $$
BEGIN
  -- If snehi_access_enabled is being modified, ensure the current user is an admin
  IF NEW.snehi_access_enabled IS DISTINCT FROM OLD.snehi_access_enabled THEN
    IF public.get_my_role() NOT IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR') THEN
      RAISE EXCEPTION 'Access denied: Only administrators can modify SNEHI access permissions.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_check_snehi_access_permission ON public.profiles;

CREATE TRIGGER tr_check_snehi_access_permission
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_snehi_access_permission();

-- 5. Trigger to automatically notify all admins on new SNEHI access requests
CREATE OR REPLACE FUNCTION public.notify_admins_on_new_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_rec RECORD;
  student_phone TEXT;
  student_name TEXT;
BEGIN
  -- Get the student details
  SELECT phone, full_name INTO student_phone, student_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Notify all admins/moderators
  FOR admin_rec IN 
    SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR')
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      admin_rec.id,
      'New Access Request | ಹೊಸ ವಿನಂತಿ',
      'User ' || COALESCE(student_name, 'Student') || ' (' || COALESCE(student_phone, '') || ') has requested access to SIMPLISH-SNEHI. | ಬಳಕೆದಾರರು SIMPLISH-SNEHI ಪ್ರವೇಶವನ್ನು ವಿನಂತಿಸಿದ್ದಾರೆ.',
      'warning'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_notify_admins_on_new_request ON public.access_requests;

CREATE TRIGGER tr_notify_admins_on_new_request
  AFTER INSERT ON public.access_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_new_request();


