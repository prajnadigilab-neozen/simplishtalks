-- Migration: Add English read text, Kannada phonetic guide, and Transliteration columns to public.lessons
ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS english_text_to_read TEXT,
ADD COLUMN IF NOT EXISTS transcription_to_read_kannada_phonetic TEXT,
ADD COLUMN IF NOT EXISTS transcription_to_read_transliteration TEXT;
