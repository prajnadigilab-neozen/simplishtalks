-- Add new text content columns for study and speak tabs
ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS study_text_content TEXT,
ADD COLUMN IF NOT EXISTS speak_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS speak_text_url TEXT,
ADD COLUMN IF NOT EXISTS speak_text_content TEXT;
