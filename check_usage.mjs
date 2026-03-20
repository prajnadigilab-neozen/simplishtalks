import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').filter(Boolean).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: users } = await supabase.from('profiles').select('id, full_name, phone, total_talk_time').limit(20);
  
  console.log("Users in DB:");
  users.forEach(u => console.log(`${u.phone} | ${u.full_name} | ${u.total_talk_time} | ${u.id}`));
}

check();
