import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').filter(Boolean).forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const signInRes = await supabase.auth.signInWithPassword({
    phone: '9900000001',
    password: 'AdminPassword123!'
  });
  if (signInRes.error) {
    console.error("Sign in failed:", signInRes.error);
    return;
  }
  console.log("Logged in successfully");
  
  const { data: items, error: itemsError } = await supabase.from('visual_content').select('*').limit(5);
  console.log("Visual Content records:", items, "Error:", itemsError);

  if (items && items.length > 0) {
    const filePath = items[0].image_url;
    console.log("Testing file path:", filePath);
    const { data: fileList, error: listError } = await supabase.storage.from('visual-content').list();
    console.log("Storage files in 'visual-content':", fileList, "Error:", listError);

    const { data: publicUrlData } = supabase.storage.from('visual-content').getPublicUrl(filePath);
    console.log("Public URL:", publicUrlData.publicUrl);
  }
}
run();
