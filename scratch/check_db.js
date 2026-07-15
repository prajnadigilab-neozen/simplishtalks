import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking Supabase connection to:", supabaseUrl);
  
  // Check if discount_master exists
  const { data: dmData, error: dmError } = await supabase.from('discount_master').select('*').limit(1);
  if (dmError) {
    console.error("❌ discount_master table query failed:", dmError.message || dmError);
  } else {
    console.log("✅ discount_master table exists! Sample data:", dmData);
  }

  // Check if validate_coupon function exists
  const { data: rpcData, error: rpcError } = await supabase.rpc('validate_coupon', {
    p_coupon_code: 'BETA50',
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_purchase_type: 'NEW',
    p_original_price: 100
  });
  if (rpcError) {
    console.error("❌ validate_coupon RPC call failed:", rpcError.message || rpcError);
  } else {
    console.log("✅ validate_coupon RPC call succeeded! Response:", rpcData);
  }
}

check();
