import { createClient } from '@supabase/supabase-js';

// Initialize a fresh client so we aren't bound by Vite's import.meta.env
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://ffompmvolxnlqqqnhwhd.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here'; // We can safely assume it will fail auth without the real key but we can still test the API response structure. 

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testInjection() {
  console.log("Starting Injection & Firewall Tests...");

  // Test 1: Classical SQLi in Login
  console.log("\\n--- Test 1: SQLi in Login ---");
  const sqliPayload = "' OR 1=1 --";
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    phone: sqliPayload,
    password: "password123",
  });
  console.log("SQLi Login Result:", authError ? `Blocked: ${authError.message}` : "Bypassed!");

  // Test 2: XSS in Profile Update
  console.log("\\n--- Test 2: XSS in Profile Update ---");
  const xssPayload = "<script>alert(1)</script>";
  // We need a dummy ID or to rely on RLS blocking it
  const { data: xssData, error: xssError } = await supabase
    .from('profiles')
    .update({ full_name: xssPayload })
    .eq('id', 'dummy-uuid-1234');
  
  if (xssError) {
    console.log("XSS DB Update Result:", xssError.message);
  } else {
    console.log("XSS Payload accepted by DB. (Requires separate frontend sanitation check)");
  }

  // Test 3: Bilingual Integrity (The Kannada Firewall)
  console.log("\\n--- Test 3: Kannada Integrity ---");
  const kannadaPayload = "ರಮೇಶ್";
  const { data: knData, error: knError } = await supabase
    .from('profiles')
    .update({ full_name: kannadaPayload })
    .eq('id', 'dummy-uuid-1234');
  
  if (knError) {
    console.log("Kannada Input Error:", knError.message);
  } else {
    console.log("Kannada Payload successfully processed by DB layer.");
  }
}

testInjection();
