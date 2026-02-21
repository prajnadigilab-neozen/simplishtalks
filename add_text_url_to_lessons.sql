-- Migration to add text_url column to lessons table
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS text_url TEXT;

-- Update RLS policies to ensure it's included (though they are ALREADY broad enough)
-- The existing policies for 'lessons' are:
-- CREATE POLICY "Anyone can view lessons" ON public.lessons FOR SELECT USING (true);
-- CREATE POLICY "Admins manage lessons" ON public.lessons FOR ALL USING (
--   (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
-- );
-- These policies apply to all columns in the table, so no changes needed for RLS.
