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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const adminPhone = '9900000001';
const adminPassword = 'AdminPassword123!';

async function run() {
  const signInRes = await supabase.auth.signInWithPassword({
    phone: adminPhone,
    password: adminPassword
  });
  if (signInRes.error) {
    console.error("SignIn failed:", signInRes.error.message);
    return;
  }

  const { data: events, error } = await supabase
    .from('user_usage_events')
    .select('*')
    .gte('created_at', '2026-06-01T00:00:00.000Z');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Usage events since June 1, 2026:");
  console.log(events);
}

run();
