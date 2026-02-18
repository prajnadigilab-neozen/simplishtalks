
import { createClient } from '@supabase/supabase-js';

// These would typically come from your .env file
// For the purpose of this environment, we use process.env placeholders
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase configuration. Check your .env.local file.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
