import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const cleanLine = line.replace('\r', '').trim();
  const match = cleanLine.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log(`Testing upload with ${supabaseKey === env.VITE_SUPABASE_ANON_KEY ? 'ANON' : 'SERVICE ROLE'} key...`);
  const dummyBlob = new Blob(["test audio content"], { type: 'audio/webm' });
  const fileName = `test/diagnostic_${Date.now()}.webm`;

  const { data, error } = await supabase.storage
    .from('scenario-audio')
    .upload(fileName, dummyBlob);

  if (error) {
    console.error("Upload failed! Error:", JSON.stringify(error, null, 2));
  } else {
    console.log("Upload SUCCESS:", data);
  }
}

main();
