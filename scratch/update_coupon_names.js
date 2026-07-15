import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase URL or Anon Key");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const updateSeedCoupons = async () => {
  try {
    // 1. Authenticate as Admin
    console.log("Authenticating as Admin...");
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      phone: '9999900001',
      password: 'AdminPass123',
    });

    if (authError) {
      console.error("Authentication failed:", authError.message);
      return;
    }
    console.log("Authentication successful! Updating existing seed coupons...");

    // 2. Define updates
    const updates = [
      { code: 'BETA50-A9X2J', name: 'Beta Users' },
      { code: 'STUDENT50-P4KL9', name: 'Students' },
      { code: 'SCHOOL60-Q7MN3', name: 'School Bulk Purchases' },
      { code: 'COLLEGE40-Z2YX8', name: 'College Bulk Purchases' },
      { code: 'INST35-W9RT2', name: 'Institutional Sales' },
      { code: 'RURAL55-B4VL7', name: 'Rural Karnataka Program' },
      { code: 'REFERRAL-M8CN4', name: 'Referral Program' },
      { code: 'RENEW30-X9PT1', name: 'Renewal Customers' },
      { code: 'LAUNCH50-D2QK8', name: 'Launch Promotion' },
      { code: 'AMB100-F7MX5', name: 'Ambassadors' },
    ];

    // 3. Apply updates
    for (const u of updates) {
      const { error: updateError } = await supabase
        .from('discount_master')
        .update({ 
          display_name: u.name, 
          customer_type: 'GENERAL' // ensure constraint matches UI
        })
        .eq('coupon_code', u.code);

      if (updateError) {
        console.error(`Failed to update ${u.code}:`, updateError.message);
      } else {
        console.log(`Successfully updated ${u.code} to display name '${u.name}'`);
      }
    }

    console.log("Done updating coupons.");
  } catch (err) {
    console.error("Unexpected error:", err);
  }
};

updateSeedCoupons();
