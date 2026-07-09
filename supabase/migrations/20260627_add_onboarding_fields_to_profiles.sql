-- Migration: Add onboarding fields to public.profiles and remove redundant username
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS username,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT 'Student',
  ADD COLUMN IF NOT EXISTS personal_address TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT;

-- Validation Constraint for Employment Status to restrict values to allowed options
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS chk_employment_status;

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_employment_status 
  CHECK (employment_status IN ('Student', 'Job Seeker', 'Employed', 'Self-Employed', 'Other'));
