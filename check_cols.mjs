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
const supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Testing scenario_saves columns...");
  const { error } = await supabase.from('scenario_saves').select('p_score').limit(1);
  if (error) {
    console.error("Column p_score does NOT exist or Access Denied:", error.message);
  } else {
    console.log("Column p_score EXISTS.");
  }
}

main();
