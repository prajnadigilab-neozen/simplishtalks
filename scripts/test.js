import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.rpc('get_platform_reports_v2');
  console.log("Data:", data && data.length > 0 ? data[0] : "Empty");
  console.log("Error:", error);
}

check();
