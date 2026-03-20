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
  const { data: users } = await supabase.from('profiles').select('id, full_name, phone, total_talk_time');
  
  const targetPhone = '1234567891';
  const user = users.find(u => u.phone && u.phone.includes(targetPhone));
  
  if (!user) {
    console.log("Could not find any user with phone including", targetPhone);
    console.log("Total users:", users.length);
    return;
  }
  
  console.log("Found User ID:", user.id, "Phone:", user.phone, "Name:", user.full_name);
  console.log("total_talk_time:", user.total_talk_time);

  const { data: api } = await supabase.from('api_usage').select('*').eq('user_id', user.id).eq('api_type', 'voice');
  const sumApi = api.reduce((a,c) => a+c.total_units, 0);
  console.log("api_usage count (voice):", api.length, "Sum:", sumApi);
  
  if (api.length > 0) {
      console.log("Top 5 voice usage rows:");
      api.sort((a,b) => b.total_units - a.total_units).slice(0, 5).forEach(r => {
          console.log(`- created_at: ${r.created_at}, model: ${r.model_name}, units: ${r.total_units}`);
      });
  }

}

check();
