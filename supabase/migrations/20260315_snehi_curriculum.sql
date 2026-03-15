-- Create SNEHI Scenarios table
CREATE TABLE IF NOT EXISTS public.snehi_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title JSONB NOT NULL, -- {en: string, kn: string}
    category JSONB NOT NULL, -- {en: string, kn: string}
    level TEXT NOT NULL, -- CourseLevel (BASIC, INTERMEDIATE, etc.)
    system_instruction TEXT NOT NULL,
    initial_message TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add completed_scenarios to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS completed_scenarios UUID[] DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.snehi_scenarios ENABLE ROW LEVEL SECURITY;

-- Policies for snehi_scenarios
-- 1. Everyone can read scenarios
CREATE POLICY "Allow public read access to scenarios"
    ON public.snehi_scenarios FOR SELECT
    USING (true);

-- 2. Only Admins/Moderators can insert/update/delete
CREATE POLICY "Allow admins/moderators to manage scenarios"
    ON public.snehi_scenarios FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND (role = 'SUPER_ADMIN' OR role = 'MODERATOR')
        )
    );

-- Add sample data (Optional, but helpful for first run)
-- INSERT INTO public.snehi_scenarios (title, category, level, system_instruction, initial_message, order_index)
-- VALUES 
-- ('{"en": "At the Market", "kn": "ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ"}', '{"en": "Daily Life", "kn": "ದೈನಂದಿನ ಜೀವನ"}', 'BASIC', 'You are a vegetable vendor in a busy market in Bengaluru. Be polite and helpful.', 'Hello! Looking for some fresh vegetables today?', 1);
