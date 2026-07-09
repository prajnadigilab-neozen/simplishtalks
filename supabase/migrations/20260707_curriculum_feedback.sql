-- SQL Migration: Curriculum Completion Feedback & Review System
-- Date: 2026-07-07

-- 1. Create course_feedback table
CREATE TABLE IF NOT EXISTS public.course_feedback (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    course_id uuid NOT NULL,
    completion_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    
    -- Ratings (1-5 scales)
    overall_rating INT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
    content_rating INT NOT NULL CHECK (content_rating BETWEEN 1 AND 5),
    mentor_rating INT NOT NULL CHECK (mentor_rating BETWEEN 1 AND 5),
    learning_rating INT NOT NULL CHECK (learning_rating BETWEEN 1 AND 5),
    
    -- Survey Metrics
    confidence_improvement VARCHAR(50) NOT NULL,
    recommendation_score INT NOT NULL CHECK (recommendation_score BETWEEN 0 AND 10),
    
    -- Text fields
    review_text TEXT NOT NULL,
    success_story TEXT,
    
    -- Consent & Assets
    testimonial_permission BOOLEAN NOT NULL DEFAULT FALSE,
    photo_url VARCHAR(512),
    video_url VARCHAR(512),
    audio_url VARCHAR(512),
    
    -- Moderation State
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
    approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    approved_date TIMESTAMP WITH TIME ZONE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- System Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_user_course_feedback UNIQUE (user_id, course_id)
);

-- 2. Create feedback_audit_logs table
CREATE TABLE IF NOT EXISTS public.feedback_audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    feedback_id uuid NOT NULL REFERENCES public.course_feedback(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    original_status VARCHAR(20),
    new_status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.course_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for course_feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.course_feedback;
CREATE POLICY "Users can view own feedback" ON public.course_feedback
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can view approved testimonials" ON public.course_feedback;
CREATE POLICY "Public can view approved testimonials" ON public.course_feedback
    FOR SELECT USING (status = 'approved' AND testimonial_permission = true);

DROP POLICY IF EXISTS "Admins can view all feedback" ON public.course_feedback;
CREATE POLICY "Admins can view all feedback" ON public.course_feedback
    FOR SELECT USING (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

DROP POLICY IF EXISTS "Users can insert own feedback" ON public.course_feedback;
CREATE POLICY "Users can insert own feedback" ON public.course_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update feedback" ON public.course_feedback;
CREATE POLICY "Admins can update feedback" ON public.course_feedback
    FOR UPDATE USING (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

-- 5. Create Policies for feedback_audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.feedback_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.feedback_audit_logs
    FOR SELECT USING (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.feedback_audit_logs;
CREATE POLICY "Admins can insert audit logs" ON public.feedback_audit_logs
    FOR INSERT WITH CHECK (public.get_my_role() IN ('ADMIN', 'SUPER_ADMIN', 'MODERATOR'));

-- 6. Trigger to verify 100% completion before insert
CREATE OR REPLACE FUNCTION public.verify_curriculum_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_completed_count INTEGER;
  v_total_count INTEGER;
BEGIN
  -- Count completed lessons from user_progress
  SELECT jsonb_array_length(completed_lessons) INTO v_completed_count
  FROM public.user_progress
  WHERE user_id = NEW.user_id;

  -- Count total lessons in public.lessons
  SELECT COUNT(*) INTO v_total_count
  FROM public.lessons;

  -- If progress not completed, prevent insertion
  IF v_completed_count IS NULL OR v_completed_count < v_total_count OR v_total_count = 0 THEN
    RAISE EXCEPTION 'Access denied: Curriculum must be 100%% completed to submit feedback.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_verify_curriculum_completion ON public.course_feedback;
CREATE TRIGGER tr_verify_curriculum_completion
BEFORE INSERT ON public.course_feedback
FOR EACH ROW
EXECUTE FUNCTION public.verify_curriculum_completion();

-- 7. Trigger to log moderation updates
CREATE OR REPLACE FUNCTION public.log_feedback_moderation()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.feedback_audit_logs (
      admin_id,
      feedback_id,
      action,
      original_status,
      new_status
    ) VALUES (
      auth.uid(),
      NEW.id,
      'status_update',
      OLD.status,
      NEW.status
    );
  ELSIF (OLD.review_text IS DISTINCT FROM NEW.review_text OR OLD.success_story IS DISTINCT FROM NEW.success_story) THEN
    INSERT INTO public.feedback_audit_logs (
      admin_id,
      feedback_id,
      action,
      original_status,
      new_status
    ) VALUES (
      auth.uid(),
      NEW.id,
      'text_edit',
      OLD.status,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_log_feedback_moderation ON public.course_feedback;
CREATE TRIGGER tr_log_feedback_moderation
AFTER UPDATE ON public.course_feedback
FOR EACH ROW
EXECUTE FUNCTION public.log_feedback_moderation();
