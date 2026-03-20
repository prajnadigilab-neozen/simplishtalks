import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching At the Market scenario...");
  const { data: scenarios, error: scenarioError } = await supabase
    .from('scenarios')
    .select('id, title, system_instruction')
    .ilike('title->>en', '%Market%');
    
  if (scenarioError) {
    console.error("Error fetching scenario:", scenarioError);
  } else {
    console.dir(scenarios, { depth: null });
  }

  console.log("\nChecking storage buckets...");
  const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
  
  if (bucketError) {
    console.error("Error fetching buckets:", bucketError);
  } else {
     console.log("Buckets:", buckets.map(b => b.name));
  }
}

main();
