import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#')).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Checking if onboarding columns exist in profiles table...");
  const { data, error } = await supabase
    .from('profiles')
    .select('username, date_of_birth, employment_status, personal_address, pincode')
    .limit(1);

  if (error) {
    console.error("❌ Column check failed:", error.message);
    console.error("Error details:", error);
  } else {
    console.log("✅ Onboarding columns exist. Data:", data);
  }
}

main();
