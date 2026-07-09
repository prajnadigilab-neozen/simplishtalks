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
  console.log("Fetching a profile row to inspect columns...");
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error("Error fetching profiles:", error.message);
  } else if (data && data.length > 0) {
    console.log("Profile columns:", Object.keys(data[0]));
  } else {
    console.log("No profiles found, but query succeeded. Checking columns via schema info or trying to insert a dummy to read columns...");
    // Let's print empty data keys if possible, or print whatever data we got
    console.log("Data:", data);
  }
}

main();
