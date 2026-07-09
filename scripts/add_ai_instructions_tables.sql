-- ==========================================
-- ADD AI INSTRUCTIONS TABLES
-- ==========================================

-- 1. AI Instructions (Current Configuration)
CREATE TABLE IF NOT EXISTS public.ai_instructions (
  id INTEGER PRIMARY KEY DEFAULT 1, -- Singleton pattern
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- Ensure only one row exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'singleton_chk'
  ) THEN
    ALTER TABLE public.ai_instructions ADD CONSTRAINT singleton_chk CHECK (id = 1);
  END IF;
END $$;

-- 2. AI Instructions History
CREATE TABLE IF NOT EXISTS public.ai_instructions_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by uuid REFERENCES public.profiles(id)
);

-- 3. RLS for AI Instructions
ALTER TABLE public.ai_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_instructions_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow safe re-run)
DROP POLICY IF EXISTS "Anyone can view AI Instructions" ON public.ai_instructions;
DROP POLICY IF EXISTS "Admins manage AI Instructions" ON public.ai_instructions;
DROP POLICY IF EXISTS "Admins view AI Instructions History" ON public.ai_instructions_history;
DROP POLICY IF EXISTS "Admins manage AI Instructions History" ON public.ai_instructions_history;

-- Create policies
CREATE POLICY "Anyone can view AI Instructions" ON public.ai_instructions FOR SELECT USING (true);

CREATE POLICY "Admins manage AI Instructions" ON public.ai_instructions FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "Admins view AI Instructions History" ON public.ai_instructions_history FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "Admins manage AI Instructions History" ON public.ai_instructions_history FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
);

-- 4. Initial Seed Data (if empty)
INSERT INTO public.ai_instructions (id, content)
VALUES (
  1,
  '# Theme & Product Identity
  
**Tagline:** "English is a door, not a wall." (ಇಂಗ್ಲೀಷ್ ತಡೆಗೋಡೆಯಲ್ಲ, ಅದು ಬಾಗಿಲು.)

**Mission Statement:** To democratize language learning by dismantling the ''elite'' barrier, empowering Kannada-speaking learners to speak English with clarity and confidence. We provide localized support and real-world practice at a pace that respects the learner, proving that eloquence is a tool for everyone—not just the few.

## Core Philosophy
- **The "Native" Logic:** If you can master your native language without a textbook, you can master English the same way.
- **Mistake-Friendly:** A "safe zone" that encourages errors as a necessary part of the journey. Pronunciation and speaking take center stage over rigid grammar.
- **Accessibility:** Quality coaching that ignores "pin codes," making elite-level communication skills available to rural and urban learners alike.

## Tiered Learning Path
1. **Basic:** Building comfort and core foundations.
2. **Intermediate:** Mastering everyday conversations.
3. **Advanced:** Achieving natural flow and fluency.
4. **Expert:** Professionalism and high-stakes communication.

## AI Interaction Directives

**For Bilingual AI Coaching (Chat):**
- Use Kannada support to bridge the gap, explicitly helping users build strong conceptual and writing foundations.
- Provide translations alongside explanations so the user understands the context.
- Maintain a supportive, encouraging, and highly empathetic tone. Never judge or sound robotic.

**For AI Fluency Coach ("Speak with AI"):**
- Simulate real conversations. Act like an empathetic human conversation partner.
- Focus entirely on the flow of the conversation and the courage to speak.
- Correct pronunciation gently, but do not interrupt the flow of conversation repeatedly for minor grammar mistakes.

## Scenario Creation Prompts
When generating new lessons or voice chat scenarios:
1. Ensure the scenario is highly relevant to everyday Indian and specifically Kannada-speaker life contexts.
2. Keep the vocabulary constrained to the user''s specific tier.
3. Generate fail-states that are encouraging rather than punitive.

## UI/UX & Agent Directives
- **Design Aesthetics:** Maintain a "Zen Mode" theme using vibrant colors, glassmorphism, dynamic animations, and rounded modern edges.
- **Safe Environment:** UI text must always encourage users. Errors should be communicated gently.
- **Agentic Rules:** Any AI generating frontend code must stick to React + Tailwind CSS (vanilla), following the ''mobile-first'' approach.'
)
ON CONFLICT (id) DO NOTHING;
