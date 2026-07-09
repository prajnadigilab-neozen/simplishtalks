-- ===================================================
-- CLEAN UP ORPHANED REFERENCES BEFORE ADDING FKEY CONSTRAINTS
-- ===================================================

-- Clean up orphaned user_id in user_usage_events
UPDATE public.user_usage_events
SET user_id = NULL
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.profiles);

-- Clean up orphaned user_id in chat_history
UPDATE public.chat_history
SET user_id = NULL
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.profiles);
